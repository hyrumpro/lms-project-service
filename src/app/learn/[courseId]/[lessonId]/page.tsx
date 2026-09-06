import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  Award,
  ChevronLeft,
  FileText,
  GraduationCap,
  Headphones,
  HelpCircle,
  Lock,
  Paperclip,
  Play,
  StickyNote,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getLearnData, getLearnAccess, getLatestQuizResult, getLessonBundle } from "@/server/queries/learn";
import { VideoLesson } from "@/components/player/video-lesson";
import { QuizRunner } from "@/components/player/quiz-runner";
import { LessonCompleteButton } from "@/components/player/lesson-complete-button";
import { CertificateCta } from "@/components/player/certificate-cta";
import { CourseForum } from "@/components/player/course-forum";
import { getCourseForum } from "@/server/queries/forum";

type Params = Promise<{ courseId: string; lessonId: string }>;

const TYPE_ICON = {
  video: Play,
  quiz: HelpCircle,
  text: StickyNote,
  document: FileText,
  audio: Headphones,
} as const;

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${minutes}min`;
}

export async function generateMetadata({ params }: { params: Params }) {
  const { courseId, lessonId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { title: "Learning" };
  const data = await getLearnData(session.user.id, courseId);
  if (!data) return { title: "Learning" };
  const all = data.sections.flatMap((s) => s.lessons);
  const current = all.find((l) => l.id === lessonId);
  return { title: current ? `${current.title} — ${data.course.title}` : data.course.title };
}

export default async function LearnLessonPage({ params }: { params: Params }) {
  const { courseId, lessonId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const access = await getLearnAccess(session.user.id, courseId);
  if (!access.ok) notFound();
  if (access.isExpired) {
    redirect(`/course/${access.course.slug}-${courseId}`);
  }

  const data = await getLearnData(session.user.id, courseId);
  if (!data) notFound();

  const bundle = await getLessonBundle(courseId, lessonId);
  if (!bundle) notFound();
  const forumQuestions = await getCourseForum(courseId);
  const { lesson } = bundle;

  const flatLessons = data.sections.flatMap((s) =>
    s.lessons.map((l) => ({ ...l, sectionTitle: s.title, locked: s.locked })),
  );
  const currentIndex = flatLessons.findIndex((l) => l.id === lessonId);
  const current = flatLessons[currentIndex];
  if (!current) notFound();
  if (current.locked) redirect(`/learn/${courseId}`);
  const previous = flatLessons[currentIndex - 1];
  const next = flatLessons[currentIndex + 1];

  const quizResult =
    bundle.quiz && !access.isOwner
      ? await getLatestQuizResult(bundle.quiz.id, session.user.id)
      : null;
  const attemptsLeft = bundle.quiz
    ? Math.max(0, lesson.quizMaxAttempts - (quizResult ? 1 : 0))
    : 0;

  const isVideoTracked = lesson.type === "video";

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      {/* top bar */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-4 px-4">
          <Link
            href={`/course/${data.course.slug}-${courseId}`}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" />
            Course page
          </Link>
          <div className="hidden min-w-0 flex-1 flex-col sm:flex">
            <span className="truncate text-sm font-semibold">{data.course.title}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Progress
              value={data.percent}
              className="w-28"
              aria-label={`${data.percent}% complete`}
            />
            <span className="text-sm font-medium">{data.percent}%</span>
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground hidden items-center gap-1 text-sm sm:flex"
            >
              <GraduationCap className="size-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[300px_1fr]">
        {/* curriculum sidebar */}
        <aside className="order-2 flex flex-col gap-4 lg:order-1">
          <nav aria-label="Course curriculum" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
            {data.sections.map((section) => (
              <div key={section.id} className="flex flex-col gap-1">
                <p className="text-sm font-semibold">{section.title}</p>
                {section.locked && section.lockReason && (
                  <p className="text-coral flex items-center gap-1 text-xs">
                    <Lock className="size-3" />
                    {section.lockReason}
                  </p>
                )}
                <ul className="mt-1 flex flex-col">
                  {section.lessons.map((l) => {
                    const Icon = TYPE_ICON[l.type as keyof typeof TYPE_ICON] ?? FileText;
                    const isActive = l.id === lessonId;
                    return (
                      <li key={l.id}>
                        {l.locked ? (
                          <span className="text-muted-foreground/60 flex cursor-not-allowed items-center gap-2 py-2 pl-2 text-sm">
                            <Lock className="size-3.5 shrink-0" />
                            <span className="truncate">{l.title}</span>
                          </span>
                        ) : (
                          <Link
                            href={`/learn/${courseId}/${l.id}`}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-2 rounded-md py-2 pl-2 pr-1 text-sm transition-colors",
                              isActive
                                ? "bg-coral/10 font-medium text-coral"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                                l.isCompleted && "border-teal-600 bg-teal-600 text-white",
                              )}
                            >
                              {l.isCompleted ? "✓" : <Icon className="size-3" />}
                            </span>
                            <span className="truncate">{l.title}</span>
                            {l.durationSeconds > 0 && (
                              <span className="ml-auto text-[10px]">
                                {formatDuration(l.durationSeconds)}
                              </span>
                            )}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* lesson pane */}
        <main className="order-1 flex min-w-0 flex-col gap-6 lg:order-2">
          <header className="flex flex-col gap-1">
            <p className="kicker">
              {current.sectionTitle} · Lesson {currentIndex + 1} of {flatLessons.length}
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{lesson.title}</h1>
          </header>

          {lesson.type === "video" && lesson.videoUrl && (
            <VideoLesson
              courseId={courseId}
              lessonId={lesson.id}
              provider={lesson.videoProvider ?? "external"}
              videoUrl={lesson.videoUrl}
              resumeSeconds={current.lastPositionSeconds}
              isCompleted={current.isCompleted}
            />
          )}

          {lesson.type === "text" && (
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
              <div
                className="text-foreground/90 [&_a]:text-coral [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-3"
                dangerouslySetInnerHTML={{ __html: lesson.summary ?? "<p>No content yet.</p>" }}
              />
              {!access.isOwner && (
                <LessonCompleteButton
                  courseId={courseId}
                  lessonId={lesson.id}
                  isCompleted={current.isCompleted}
                />
              )}
            </div>
          )}

          {lesson.type === "audio" && lesson.audioUrl && (
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio src={lesson.audioUrl} controls className="w-full" />
              {!access.isOwner && (
                <LessonCompleteButton
                  courseId={courseId}
                  lessonId={lesson.id}
                  isCompleted={current.isCompleted}
                />
              )}
            </div>
          )}

          {lesson.type === "document" && (
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
              {lesson.attachment ? (
                <>
                  <object
                    data={lesson.attachment}
                    type="application/pdf"
                    className="h-[60vh] w-full rounded-lg border"
                    aria-label={lesson.title}
                  >
                    <p className="p-4 text-sm">
                      Preview unavailable —{" "}
                      <a href={lesson.attachment} className="text-coral underline">
                        download the file
                      </a>
                      .
                    </p>
                  </object>
                  {!access.isOwner && (
                    <LessonCompleteButton
                      courseId={courseId}
                      lessonId={lesson.id}
                      isCompleted={current.isCompleted}
                    />
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No document attached yet.</p>
              )}
            </div>
          )}

          {lesson.type === "quiz" && (
            <>
              {!access.isOwner && bundle.quiz ? (
                <QuizRunner
                  courseId={courseId}
                  lessonId={lesson.id}
                  timeLimitMinutes={bundle.quiz.timeLimitMinutes}
                  questions={bundle.quiz.questions.map((q) => ({
                    id: q.id,
                    title: q.title,
                    type: q.type,
                    options: q.options,
                  }))}
                  attemptsLeft={attemptsLeft}
                  previousResult={
                    quizResult
                      ? {
                          obtainedMarks: quizResult.obtainedMarks,
                          totalMarks: quizResult.totalMarks,
                          answers: quizResult.answers,
                        }
                      : null
                  }
                />
              ) : null}
              {access.isOwner && (
                <p className="text-muted-foreground text-sm">
                  Instructor view — students get {lesson.quizMaxAttempts} attempt(s).
                </p>
              )}
            </>
          )}

          {/* lesson footer: prev/next */}
          <nav className="flex items-center justify-between border-t pt-4" aria-label="Lesson navigation">
            {previous && !previous.locked ? (
              <Link
                href={`/learn/${courseId}/${previous.id}`}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ← {previous.title}
              </Link>
            ) : (
              <span />
            )}
            {next && !next.locked ? (
              <Link
                href={`/learn/${courseId}/${next.id}`}
                className="text-coral text-sm font-medium hover:underline"
              >
                Next: {next.title} →
              </Link>
            ) : (
              <span />
            )}
          </nav>

          {/* bottom tabs: summary / attachments / certificate */}
          <section className="rounded-xl border bg-card">
            <div className="border-b px-5 py-3">
              <h2 className="font-heading text-sm font-semibold">About this lesson</h2>
            </div>
            <div className="flex flex-col gap-4 p-5 text-sm">
              {lesson.summary && lesson.type !== "text" && (
                <div
                  className="text-muted-foreground [&_p]:my-1"
                  dangerouslySetInnerHTML={{ __html: lesson.summary }}
                />
              )}
              {bundle.attachments.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {bundle.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.file}
                        className="text-coral inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-secondary"
                      >
                        <Paperclip className="size-3" />
                        {a.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {data.percent >= 100 && (
                <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-sun bg-sun/10 p-4">
                  <Award className="text-sun-foreground size-8" />
                  <div className="flex-1">
                    <p className="font-heading font-semibold">Course complete!</p>
                    <p className="text-muted-foreground text-xs">
                      Your certificate is ready to claim.
                    </p>
                  </div>
                  <CertificateCta courseId={courseId} code={data.certificateCode} />
                </div>
              )}
            </div>
          </section>

          {/* course Q&A forum (legacy addon, spec §7.20) */}
          <section className="rounded-xl border bg-card">
            <div className="border-b px-5 py-3">
              <h2 className="font-heading text-sm font-semibold">Q&amp;A</h2>
            </div>
            <div className="p-5">
              <CourseForum
                courseId={courseId}
                questions={forumQuestions.map((q) => ({
                  id: q.id,
                  title: q.title,
                  body: q.body,
                  votes: q.votes,
                  authorName: q.authorName,
                  replies: q.replies.map((r) => ({
                    id: r.id,
                    body: r.body,
                    authorName: r.authorName,
                  })),
                }))}
                enrolled={access.isOwner || Boolean(access.enrollment)}
                labels={{
                  askTitle: "Ask the class",
                  question: "Your question",
                  details: "Add details (optional)",
                  ask: "Post question",
                  reply: "Reply",
                  writeReply: "Write a reply…",
                  votes: "Upvote",
                  empty: "No questions yet — be the first.",
                  enrollFirst: "Enroll to join the Q&A.",
                  needDetails: "Give your question a clear title and a few details.",
                  error: "Something went wrong.",
                }}
              />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
