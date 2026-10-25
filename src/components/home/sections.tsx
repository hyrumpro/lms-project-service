import Link from "next/link";
import { ChevronRight, Search, Star, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseCard } from "@/components/course/course-card";
import type { CourseCardData, getCategoryTree, getTopInstructors } from "@/server/queries/catalog";
import type { HomeSection } from "@/db/schema";
import type { FrontendSettings } from "@/lib/settings";
import type { CurrencyMeta } from "@/lib/money";
import { sanitizeHtml } from "@/lib/sanitize";

type CategoryNode = Awaited<ReturnType<typeof getCategoryTree>>[number];
type TopInstructor = Awaited<ReturnType<typeof getTopInstructors>>[number];
type PostCard = { id: string; title: string; slug: string; description: string | null; authorName: string };

export type HomeSectionData = {
  currency: CurrencyMeta;
  topCourses: CourseCardData[];
  latestCourses: CourseCardData[];
  categoryTree: CategoryNode[];
  categoryCounts: Map<string, number>;
  instructors: TopInstructor[];
  frontend: FrontendSettings;
  heroStats: { courses: number; instructors: number };
  testimonials: {
    id: string;
    rating: number;
    review: string | null;
    userName: string;
    userImage: string | null;
    courseTitle: string;
  }[];
  latestPosts: PostCard[];
};

export function renderHomeSection(section: HomeSection, data: HomeSectionData): React.ReactNode {
  switch (section.type) {
    case "hero":
      return <HeroSection key={section.type} frontend={data.frontend} stats={data.heroStats} />;
    case "topCourses":
      return <TopCoursesSection key={section.type} courses={data.topCourses} currency={data.currency} />;
    case "latestCourses":
      return <LatestCoursesSection key={section.type} courses={data.latestCourses} currency={data.currency} />;
    case "topCategories":
      return (
        <TopCategoriesSection key={section.type} tree={data.categoryTree} counts={data.categoryCounts} />
      );
    case "topInstructors":
      return <TopInstructorsSection key={section.type} instructors={data.instructors} />;
    case "testimonials":
      return <TestimonialsSection key={section.type} testimonials={data.testimonials} />;
    case "faqPreview":
      return <FaqPreviewSection key={section.type} />;
    case "latestBlog":
      return <LatestBlogSection key={section.type} posts={data.latestPosts} />;
    case "becomeInstructor":
      return <BecomeInstructorSection key={section.type} />;
    case "customHtml":
      return (
        <div
          key={`custom-${JSON.stringify(section.props).length}`}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(section.props.html ?? "")) }}
        />
      );
    default:
      return null;
  }
}

/* Banner — legacy home_1: centered title (last word accented), subtitle, big search */
export async function HeroSection({
  frontend,
  stats,
}: {
  frontend: FrontendSettings;
  stats: { courses: number; instructors: number };
}) {
  const t = await getTranslations("home");
  return (
    <section className="relative overflow-hidden border-b">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--primary) 12%, transparent) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "linear-gradient(to bottom, black 50%, transparent)",
        }}
      />
      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pt-20 pb-16 text-center">
        <p className="kicker">{t("kicker")}</p>
        <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
          {frontend.heroTitle.split(" ").map((word, i, all) =>
            i === all.length - 1 ? (
              <span key={i} className="mark italic">
                {word}
              </span>
            ) : (
              <span key={i}>{word} </span>
            ),
          )}
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg">{frontend.heroSubTitle}</p>

        {/* legacy: big centered "What do you want to learn" search */}
        <form action="/courses" className="w-full max-w-xl">
          <div className="flex items-center gap-2 rounded-full border-2 bg-card p-2 pl-5 shadow-sm focus-within:ring-3 focus-within:ring-ring/30">
            <Search className="text-muted-foreground size-5 shrink-0" />
            <input
              type="search"
              name="q"
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <Button type="submit" size="lg" className="rounded-full">
              {t("browse")}
            </Button>
          </div>
        </form>

        <dl className="mt-4 grid grid-cols-3 gap-8">
          {[
            [t("courses"), String(stats.courses)],
            [t("instructors"), String(stats.instructors)],
            [t("free"), t("alwaysWelcome")],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="kicker">{label}</dt>
              <dd className="font-heading text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export async function TopCategoriesSection({
  tree,
  counts,
}: {
  tree: CategoryNode[];
  counts: Map<string, number>;
}) {
  const t = await getTranslations("home");
  if (tree.length === 0) return null;
  return (
    <SectionShell title={t("topCategories")} index="01">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tree.slice(0, 8).map((category) => {
          const childIds = category.children.map((c) => c.id);
          const total =
            (counts.get(category.id) ?? 0) +
            childIds.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
          return (
            <Link
              key={category.id}
              href={`/courses?category=${category.slug}`}
              className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                <Users className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{category.name}</span>
                <span className="text-muted-foreground text-sm">{total} courses</span>
              </div>
            </Link>
          );
        })}
      </div>
    </SectionShell>
  );
}

export async function TopCoursesSection({
  courses,
  currency,
}: {
  courses: CourseCardData[];
  currency: CurrencyMeta;
}) {
  const t = await getTranslations("home");
  if (courses.length === 0) return null;
  return (
    <SectionShell title={t("topCourses")} index="02" href="/courses?sort=popular">
      <p className="text-muted-foreground -mt-4 mb-6 text-sm">{t("topCoursesSub")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} currency={currency} />
        ))}
      </div>
    </SectionShell>
  );
}

/* legacy: "top ten latest courses" (home_1 eLatestcourse) */
export async function LatestCoursesSection({
  courses,
  currency,
}: {
  courses: CourseCardData[];
  currency: CurrencyMeta;
}) {
  const t = await getTranslations("home");
  if (courses.length === 0) return null;
  return (
    <SectionShell title={t("latestCourses")} index={"02 · " + t("justReleased")} href="/courses">
      <p className="text-muted-foreground -mt-4 mb-6 text-sm">{t("justReleasedSub")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} currency={currency} />
        ))}
      </div>
    </SectionShell>
  );
}

export async function TopInstructorsSection({ instructors }: { instructors: TopInstructor[] }) {
  const t = await getTranslations("home");
  if (instructors.length === 0) return null;
  return (
    <SectionShell title={t("topInstructors")} index="03" href="/courses">
      <p className="text-muted-foreground -mt-4 mb-6 text-sm">{t("instructorsSub")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {instructors.map((instructor) => (
          <Card key={instructor.id} className="gap-3">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  <AvatarImage src={instructor.image ?? undefined} alt={instructor.name} />
                  <AvatarFallback>{instructor.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <CardTitle className="text-base">
                    <Link href={`/instructor/${instructor.id}`} className="hover:underline">
                      {instructor.name}
                    </Link>
                  </CardTitle>
                  <span className="text-muted-foreground text-xs">
                    {instructor.title ?? "Instructor"}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-muted-foreground flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Star className="size-3.5" /> {instructor.courseCount} courses
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-3.5" /> {instructor.students} students
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionShell>
  );
}

/* legacy: "What the people Thinks About Us" */
export async function TestimonialsSection({
  testimonials,
}: {
  testimonials: HomeSectionData["testimonials"];
}) {
  const t = await getTranslations("home");
  if (testimonials.length === 0) return null;
  return (
    <SectionShell title={t("testimonials")} index="04">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <Card key={testimonial.id} className="gap-3">
            <CardContent className="flex flex-col gap-3">
              <span className="text-amber-500">
                {"★".repeat(testimonial.rating)}
                <span className="text-muted-foreground/40">
                  {"★".repeat(5 - testimonial.rating)}
                </span>
              </span>
              {testimonial.review && (
                <p className="text-sm leading-relaxed">“{testimonial.review}”</p>
              )}
              <div className="mt-auto flex items-center gap-2 pt-1">
                <Avatar className="size-8">
                  <AvatarImage src={testimonial.userImage ?? undefined} alt={testimonial.userName} />
                  <AvatarFallback>{testimonial.userName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-xs">
                  <p className="font-medium">{testimonial.userName}</p>
                  <p className="text-muted-foreground">{testimonial.courseTitle}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionShell>
  );
}

/* legacy FAQ block, previewing the /faq page */
export async function FaqPreviewSection() {
  const t = await getTranslations("home");
  return (
    <SectionShell title={t("faqTitle")} index="05" href="/faq">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <details open className="group rounded-lg border p-4">
          <summary className="cursor-pointer list-none font-medium select-none">
            How do certificates work?
          </summary>
          <p className="text-muted-foreground mt-2 text-sm">
            Finish 100% of the lessons — the certificate issues itself, with a public verify link.
          </p>
        </details>
        <details className="group rounded-lg border p-4">
          <summary className="cursor-pointer list-none font-medium select-none">
            Are there free courses?
          </summary>
          <p className="text-muted-foreground mt-2 text-sm">
            Yes — filter the catalog by Free and enroll instantly.
          </p>
        </details>
        <details className="group rounded-lg border p-4">
          <summary className="cursor-pointer list-none font-medium select-none">
            Can I teach here?
          </summary>
          <p className="text-muted-foreground mt-2 text-sm">
            Apply from the studio; an admin reviews every application.
          </p>
        </details>
        <details className="group rounded-lg border p-4">
          <summary className="cursor-pointer list-none font-medium select-none">
            What lesson types exist?
          </summary>
          <p className="text-muted-foreground mt-2 text-sm">
            Video, audio, documents, rich text and graded quizzes.
          </p>
        </details>
      </div>
      <div className="mt-4">
        <Button variant="ghost" render={<Link href="/faq" />}>
          {t("seeAllFaqs")}
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </SectionShell>
  );
}

/* legacy: "Visit our latest blogs" */
export async function LatestBlogSection({ posts }: { posts: PostCard[] }) {
  const t = await getTranslations("home");
  if (posts.length === 0) return null;
  return (
    <SectionShell title={t("latestBlog")} index="06" href="/blog">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group flex flex-col gap-2 bg-card p-6 transition-colors hover:bg-muted/50"
          >
            <h3 className="font-heading font-semibold leading-snug group-hover:underline">
              {post.title}
            </h3>
            <p className="text-muted-foreground line-clamp-2 text-sm">{post.description}</p>
            <span className="text-muted-foreground mt-auto pt-2 text-xs">{post.authorName}</span>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

/* legacy "Think more clearly / Start Now" band */
export async function BecomeInstructorSection() {
  const t = await getTranslations("home");
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12">
      <div className="bg-primary text-primary-foreground relative flex flex-col items-center gap-5 overflow-hidden rounded-2xl px-6 py-14 text-center">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(160deg, black 30%, transparent 85%)",
          }}
        />
        <Badge className="bg-white/15">{t("ctaBadge")}</Badge>
        <h2 className="font-heading max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("ctaTitle1")} <span className="mark italic">{t("ctaAccent")}</span>
        </h2>
        <p className="text-primary-foreground/80 max-w-xl text-sm sm:text-base">{t("ctaBody")}</p>
        <Button size="lg" variant="secondary" render={<Link href="/sign-up" />}>
          {t("ctaButton")}
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </section>
  );
}

async function SectionShell({
  title,
  index,
  href,
  children,
}: {
  title: string;
  index: string;
  href?: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("home");
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="kicker">{index}</p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
        {href && (
          <Button variant="ghost" render={<Link href={href} />}>
            {t("seeAll")}
            <ChevronRight data-icon="inline-end" />
          </Button>
        )}
      </div>
      <div className="rule-dash mb-8" aria-hidden />
      {children}
    </section>
  );
}
