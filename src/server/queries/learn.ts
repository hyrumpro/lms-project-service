import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  certificate,
  courseInstructors,
  courseProgress,
  courses,
  enrollments,
  lessonProgress,
  lessons,
  questions,
  quizResults,
  quizzes,
  resourceFiles,
  reviews,
  sections,
  user,
} from "@/db/schema";
import { isSectionUnlocked } from "@/lib/learning";
import { getActiveSubscription } from "@/server/queries/subscriptions";

/** Player queries (spec §7.6) — mirrors get_watch_histories + access gates. */

export type LearnSidebarLesson = {
  id: string;
  title: string;
  type: string;
  isFreePreview: boolean;
  durationSeconds: number;
  isCompleted: boolean;
  lastPositionSeconds: number;
  locked: boolean;
  lockReason?: string;
};

export type LearnData = {
  course: typeof courses.$inferSelect;
  isExpired: boolean;
  percent: number;
  completedCount: number;
  totalLessons: number;
  sections: {
    id: string;
    title: string;
    order: number;
    locked: boolean;
    lockReason?: string;
    lessons: LearnSidebarLesson[];
  }[];
  certificateCode: string | null;
};

export async function getLearnAccess(userId: string, courseId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return { ok: false as const, reason: "not_found" };

  const owners = await db
    .select({ instructorId: courseInstructors.instructorId })
    .from(courseInstructors)
    .where(eq(courseInstructors.courseId, courseId));
  const isOwner = owners.some((o) => o.instructorId === userId);

  let [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);

  if (!isOwner && !enrollment) {
    // all-access subscription gate: auto-enroll on first visit (spec §7.5 extension)
    const sub = await getActiveSubscription(userId);
    if (!sub) return { ok: false as const, reason: "not_enrolled" };
    await db
      .insert(enrollments)
      .values({ userId, courseId, source: "subscription" as const })
      .onConflictDoNothing();
    await db
      .insert(courseProgress)
      .values({ userId, courseId })
      .onConflictDoNothing();
    enrollment = { expiresAt: null } as typeof enrollment;
  }
  const isExpired = Boolean(enrollment?.expiresAt && enrollment.expiresAt < new Date()) && !isOwner;

  return { ok: true as const, course, enrollment, isOwner, isExpired };
}

export async function getLearnData(userId: string, courseId: string): Promise<LearnData | null> {
  const access = await getLearnAccess(userId, courseId);
  if (!access.ok) return null;
  const { course, enrollment, isExpired } = access;

  const sectionRows = await db
    .select()
    .from(sections)
    .where(eq(sections.courseId, courseId))
    .orderBy(asc(sections.order));
  const lessonRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.order));
  const progressRows = await db
    .select({ progress: lessonProgress })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .where(and(eq(lessonProgress.userId, userId), eq(lessons.courseId, courseId)));
  const progressByLesson = new Map(progressRows.map((r) => [r.progress.lessonId, r.progress]));

  const [progress] = await db
    .select()
    .from(courseProgress)
    .where(and(eq(courseProgress.userId, userId), eq(courseProgress.courseId, courseId)))
    .limit(1);

  const [cert] = await db
    .select({ code: certificate.code })
    .from(certificate)
    .where(and(eq(certificate.studentId, userId), eq(certificate.courseId, courseId)))
    .limit(1);

  // drip locks cascade section by section (spec §3: unlock rules on sections)
  const now = new Date();
  const enrollmentStartedAt = enrollment?.createdAt ?? null;
  let previousSectionCompleted = true;

  const sidebar = sectionRows.map((section) => {
    const unlock = course.enableDripContent
      ? isSectionUnlocked(section.unlockRule, { now, enrollmentStartedAt, previousSectionCompleted })
      : { unlocked: true };
    const sectionLessons = lessonRows.filter((l) => l.sectionId === section.id);
    const allDone =
      sectionLessons.length > 0 &&
      sectionLessons.every((l) => progressByLesson.get(l.id)?.isCompleted);
    previousSectionCompleted = previousSectionCompleted && allDone && unlock.unlocked;

    return {
      id: section.id,
      title: section.title,
      order: section.order,
      locked: !unlock.unlocked,
      lockReason: unlock.reason,
      lessons: sectionLessons.map((l) => ({
        id: l.id,
        title: l.title,
        type: l.type,
        isFreePreview: l.isFreePreview,
        durationSeconds: l.durationSeconds,
        isCompleted: progressByLesson.get(l.id)?.isCompleted ?? false,
        lastPositionSeconds: progressByLesson.get(l.id)?.lastPositionSeconds ?? 0,
        locked: !unlock.unlocked,
        lockReason: unlock.reason,
      })),
    };
  });

  const totalLessons = lessonRows.length;
  const completedCount =
    progress?.completedLessons ??
    sidebar.reduce((sum, s) => sum + s.lessons.filter((l) => l.isCompleted).length, 0);

  return {
    course,
    isExpired,
    percent: progress?.percent ?? 0,
    completedCount,
    totalLessons,
    sections: sidebar,
    certificateCode: cert?.code ?? null,
  };
}

export async function getLessonBundle(courseId: string, lessonId: string) {
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson || lesson.courseId !== courseId) return null;

  let quiz: { id: string; timeLimitMinutes: number | null; questions: (typeof questions.$inferSelect)[] } | null = null;
  if (lesson.type === "quiz") {
    const [quizRow] = await db.select().from(quizzes).where(eq(quizzes.lessonId, lesson.id)).limit(1);
    if (quizRow) {
      const questionRows = await db
        .select()
        .from(questions)
        .where(eq(questions.quizId, quizRow.id))
        .orderBy(asc(questions.order));
      quiz = { id: quizRow.id, timeLimitMinutes: quizRow.timeLimitMinutes, questions: questionRows };
    }
  }

  const attachments = await db
    .select({ id: resourceFiles.id, title: resourceFiles.title, file: resourceFiles.file })
    .from(resourceFiles)
    .where(eq(resourceFiles.lessonId, lesson.id));

  return { lesson, quiz, attachments };
}

export async function getLatestQuizResult(quizId: string, userId: string) {
  const [row] = await db
    .select()
    .from(quizResults)
    .where(and(eq(quizResults.quizId, quizId), eq(quizResults.userId, userId)))
    .orderBy(desc(quizResults.createdAt))
    .limit(1);
  return row ?? null;
}

export async function countQuizAttempts(quizId: string, userId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(quizResults)
    .where(and(eq(quizResults.quizId, quizId), eq(quizResults.userId, userId)));
  return total;
}

export async function getCourseRatingStats(courseId: string) {
  const [stats] = await db
    .select({
      ratingAvg: sql<number>`coalesce(avg(${reviews.rating}), 0)::float`,
      ratingCount: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(eq(reviews.courseId, courseId));
  return stats;
}
