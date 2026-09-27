import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EnrollButton } from "@/components/course/enroll-button";
import { WishlistButton } from "@/components/course/wishlist-button";
import { PaidCourseActions } from "@/components/course/paid-course-actions";
import { ReviewForm } from "@/components/course/review-form";
import { MessageButton } from "@/components/community/message-button";
import { LiveClassesSection } from "@/components/course/live-classes-section";
import { VideoLesson } from "@/components/player/video-lesson";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AudioLines,
  CircleHelp,
  FileText,
  PlayCircle,
  ScrollText,
} from "lucide-react";
import { CourseCard } from "@/components/course/course-card";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { coursePriceLabel } from "@/lib/money";
import { courseHref } from "@/lib/slug";
import { getSystemSettings } from "@/lib/settings";
import {
  getCourseByUrlSlug,
  getCourseCurriculum,
  getCourseReviews,
  getEnrollmentFor,
  getRelatedCourses,
  isInstructorOfCourse,
} from "@/server/queries/catalog";
import { getWishlistItemFor } from "@/server/queries/community";

const LESSON_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  video: PlayCircle,
  audio: AudioLines,
  document: FileText,
  text: ScrollText,
  quiz: CircleHelp,
};

type Params = Promise<{ slug: string }>;

function courseJsonLd(course: { title: string; slug: string; id: string; shortDescription: string | null; level: string; language: string }, instructors: { name: string }[], ratingAvg: number, ratingCount: number, priceCents: number, isFree: boolean) {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.shortDescription ?? course.title,
    url: `${base}/course/${course.slug}-${course.id}`,
    inLanguage: course.language,
    educationalLevel: course.level,
    provider: { "@type": "Organization", name: "Academy LMS" },
    instructor: instructors.map((i) => ({ "@type": "Person", name: i.name })),
    ...(ratingCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: ratingAvg.toFixed(1), ratingCount, bestRating: 5 } }
      : {}),
    ...(isFree || priceCents === 0
      ? { offers: { "@type": "Offer", price: 0, priceCurrency: "USD", availability: "https://schema.org/InStock" } }
      : {}),
  };
}

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const data = await getCourseByUrlSlug(slug);
  if (!data) return { title: "Course not found" };
  return {
    title: data.course.title,
    description: data.course.metaDescription ?? data.course.shortDescription ?? undefined,
    keywords: data.course.metaKeywords ?? undefined,
  };
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

export default async function CoursePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [data, system, session] = await Promise.all([
    getCourseByUrlSlug(slug),
    getSystemSettings(),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!data || data.course.status !== "active") notFound();

  const { course, category, instructors, stats } = data;
  const [curriculum, reviews, related] = await Promise.all([
    getCourseCurriculum(course.id),
    getCourseReviews(course.id),
    getRelatedCourses(course.id, course.categoryId),
  ]);
  const enrollment = session ? await getEnrollmentFor(session.user.id, course.id) : null;
  const isExpired = Boolean(enrollment?.expiresAt && new Date(enrollment.expiresAt) < new Date());
  const hasActiveEnrollment = Boolean(enrollment && !isExpired);
  const userReview = session ? reviews.find((r) => r.userId === session.user.id) : null;
  const isOwner = session ? await isInstructorOfCourse(session.user.id, course.id) : false;
  const wishlisted = session ? await getWishlistItemFor(session.user.id, course.id) : false;
  const price = coursePriceLabel(course, system);
  const totalLessons = curriculum.reduce((sum, s) => sum + s.lessons.length, 0);
  const totalDuration = curriculum.reduce(
    (sum, s) => sum + s.lessons.reduce((acc, l) => acc + l.durationSeconds, 0),
    0,
  );

  const jsonLd = courseJsonLd(course, instructors, stats.ratingAvg, stats.ratingCount, course.isFree ? 0 : course.price, course.isFree);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-8">
          {/* legacy course_page_preview: overview video (inline, not modal) */}
          {course.promoVideoUrl && course.promoVideoProvider ? (
            <VideoLesson
              courseId={course.id}
              lessonId="promo"
              provider={course.promoVideoProvider}
              videoUrl={course.promoVideoUrl}
              resumeSeconds={0}
              isCompleted
              previewMode
            />
          ) : (
            <div className="bg-primary relative flex aspect-video items-center justify-center overflow-hidden rounded-xl">
              <div
                aria-hidden
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
                }}
              />
              <span className="text-white/90 relative text-lg font-medium">
                {course.title}
              </span>
            </div>
          )}
          <header className="flex flex-col gap-3">
            <div className="text-muted-foreground flex items-center gap-1 text-sm">
              <Link href="/courses" className="hover:text-foreground">
                Courses
              </Link>
              <span>/</span>
              {category && (
                <Link
                  href={`/courses?category=${category.slug}`}
                  className="hover:text-foreground"
                >
                  {category.name}
                </Link>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{course.title}</h1>
            {course.shortDescription && (
              <p className="text-muted-foreground text-lg">{course.shortDescription}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {stats.ratingCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  ★ {stats.ratingAvg.toFixed(1)} ({stats.ratingCount} reviews)
                </span>
              )}
              <span>{stats.enrolledCount} students</span>
              <Badge variant="outline">{course.level}</Badge>
              <Badge variant="outline">{course.language}</Badge>
              {totalDuration > 0 && <span>{formatDuration(totalDuration)} total</span>}
            </div>
          </header>

          {course.outcomes && course.outcomes.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold">What you&apos;ll learn</h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {course.outcomes.map((outcome) => (
                  <li key={outcome} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5">✓</span>
                    {outcome}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.course.customFieldValues && Object.keys(data.course.customFieldValues).length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold">Details</h2>
              <dl className="grid gap-2 text-sm">
                {Object.entries(data.course.customFieldValues).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[160px_1fr] gap-2">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section>
            <h2 className="mb-4 text-xl font-semibold">Curriculum</h2>
            {curriculum.length === 0 ? (
              <p className="text-muted-foreground text-sm">Curriculum coming soon.</p>
            ) : (
              <Accordion defaultValue={[curriculum[0]?.id]} className="gap-3">
                {curriculum.map((section) => {
                  const sectionMinutes = Math.round(
                    section.lessons.reduce((acc, l) => acc + l.durationSeconds, 0) / 60,
                  );
                  return (
                    <AccordionItem
                      key={section.id}
                      value={section.id}
                      className="rounded-xl border bg-card px-4 last:border-b"
                    >
                      <AccordionTrigger className="py-4 text-base hover:no-underline">
                        <span className="flex flex-col items-start gap-0.5">
                          <span className="font-semibold">{section.title}</span>
                          <span className="text-muted-foreground text-xs font-normal">
                            {section.lessons.length} lessons
                            {sectionMinutes > 0 && ` · ${sectionMinutes} min`}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <ul>
                          {section.lessons.map((lesson) => {
                            const Icon = LESSON_ICON[lesson.type] ?? FileText;
                            return (
                              <li
                                key={lesson.id}
                                className="text-muted-foreground flex items-center gap-3 border-t px-1 py-2.5 text-sm first:border-t-0"
                              >
                                <Icon className="text-foreground/70 size-4 shrink-0" />
                                <span className="text-foreground flex-1">{lesson.title}</span>
                                {lesson.isFreePreview && <Badge variant="secondary">Preview</Badge>}
                                {lesson.durationSeconds > 0 && (
                                  <span className="text-xs tabular-nums">
                                    {formatDuration(lesson.durationSeconds)}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </section>

          <LiveClassesSection courseId={course.id} />

          <section>
            <h2 className="mb-4 text-xl font-semibold">Instructors</h2>
            <div className="flex flex-col gap-4">
              {instructors.map((instructor) => (
                <Card key={instructor.id}>
                  <CardContent className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="size-14">
                        <AvatarImage src={instructor.image ?? undefined} alt={instructor.name} />
                        <AvatarFallback>{instructor.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/instructor/${instructor.id}`}
                          className="font-semibold hover:underline"
                        >
                          {instructor.name}
                        </Link>
                        {instructor.title && (
                          <span className="text-muted-foreground text-sm">{instructor.title}</span>
                        )}
                        {instructor.biography && (
                          <p className="text-muted-foreground text-sm">{instructor.biography}</p>
                        )}
                      </div>
                    </div>
                    {(!session || session.user.id !== instructor.id) && (
                      <MessageButton
                        recipientId={instructor.id}
                        recipientName={instructor.name}
                        currentUserId={session?.user.id}
                        size="sm"
                        buttonText="Message"
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold">
              Reviews {stats.ratingCount > 0 && `(${stats.ratingCount})`}
            </h2>
            {session && hasActiveEnrollment && (
              <div className="mb-6">
                <ReviewForm
                  courseId={course.id}
                  existingReview={
                    userReview
                      ? { rating: userReview.rating, review: userReview.review }
                      : null
                  }
                />
              </div>
            )}
            {reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reviews yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {reviews.map((review) => (
                  <div key={review.id} className="flex items-start gap-3">
                    <Avatar className="size-9">
                      <AvatarImage src={review.userImage ?? undefined} alt={review.userName} />
                      <AvatarFallback>{review.userName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{review.userName}</span>
                      <span className="text-sm text-amber-600 dark:text-amber-400">
                        {"★".repeat(review.rating)}
                      </span>
                      {review.review && (
                        <p className="text-muted-foreground text-sm">{review.review}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-baseline gap-2 text-2xl">
                {price.label}
                {price.original && (
                  <span className="text-muted-foreground text-base font-normal line-through">
                    {price.original}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!isOwner && (
                <div className="flex flex-col gap-2">
                  {isExpired && (
                    <Badge variant="destructive" className="justify-center py-1 text-xs">
                      Access expired on {new Date(enrollment!.expiresAt!).toLocaleDateString()}
                    </Badge>
                  )}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      {course.isFree || (course.discountEnabled && course.discountedPrice === 0) ? (
                        <EnrollButton
                          courseId={course.id}
                          slug={course.slug}
                          enrolled={hasActiveEnrollment}
                        />
                      ) : hasActiveEnrollment ? (
                        <Button className="w-full" render={<a href={`/learn/${course.id}`} />}>
                          Continue learning →
                        </Button>
                      ) : (
                        <PaidCourseActions courseId={course.id} />
                      )}
                    </div>
                    <WishlistButton courseId={course.id} wishlisted={wishlisted} />
                  </div>
                </div>
              )}
              {isOwner && (
                <Badge variant="secondary" className="justify-center py-2">
                  You teach this course
                </Badge>
              )}
              {!course.isFree && !enrollment && (
                <p className="text-muted-foreground text-center text-xs">
                  Secure checkout · Sandbox Bank (demo) or bank transfer
                </p>
              )}
              <Separator />
              <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
                <li>{totalLessons} lessons</li>
                {totalDuration > 0 && <li>{formatDuration(totalDuration)} of content</li>}
                {course.expiryPeriod && <li>Access: {course.expiryPeriod} days</li>}
                <li>Certificate on completion</li>
              </ul>
            </CardContent>
          </Card>

          {course.faqs && course.faqs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">FAQs</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {course.faqs.map((faq) => (
                  <div key={faq.question} className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{faq.question}</span>
                    <span className="text-muted-foreground text-sm">{faq.answer}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Related courses</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((relatedCourse) => (
              <CourseCard key={relatedCourse.id} course={relatedCourse} currency={system} />
            ))}
          </div>
        </section>
      )}

      {/* keep courseHref referenced for internal link parity checks */}
      <span className="hidden">{courseHref(course.slug, course.id)}</span>
    </div>
  );
}
