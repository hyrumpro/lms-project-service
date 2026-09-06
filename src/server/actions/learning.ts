"use server";

import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  certificate,
  courseProgress,
  courses,
  enrollments,
  lessonProgress,
  lessons,
  questions,
  quizResults,
  quizzes,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  generateCertificateCode,
  recomputeCourseProgress,
} from "@/lib/learning";

export type LearnResult = { ok: true } | { ok: false; error: string };

type EnrollGuard =
  | { ok: false; error: "auth_required" | "not_enrolled" | "expired" }
  | { ok: true; userId: string };

async function requireEnrolled(courseId: string): Promise<EnrollGuard> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "auth_required" };

  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, session.user.id), eq(enrollments.courseId, courseId)))
    .limit(1);
  if (!enrollment) return { ok: false, error: "not_enrolled" };
  if (enrollment.expiresAt && enrollment.expiresAt < new Date()) {
    return { ok: false, error: "expired" };
  }
  return { ok: true, userId: session.user.id };
}

/** Legacy parity: watchingLessonId tracking (update_last_played_lesson). */
export async function markLessonVisited(courseId: string, lessonId: string): Promise<LearnResult> {
  const guard = await requireEnrolled(courseId);
  if (!guard.ok) return { ok: false, error: guard.error };

  await db
    .insert(courseProgress)
    .values({ userId: guard.userId, courseId, watchingLessonId: lessonId })
    .onConflictDoNothing();
  await db
    .update(courseProgress)
    .set({ watchingLessonId: lessonId, updatedAt: new Date() })
    .where(and(eq(courseProgress.userId, guard.userId), eq(courseProgress.courseId, courseId)));
  return { ok: true };
}

/** Manual mark-complete (legacy update_watch_history_manually). */
export async function markLessonComplete(courseId: string, lessonId: string): Promise<LearnResult> {
  const guard = await requireEnrolled(courseId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { userId } = guard;

  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
    .limit(1);
  if (!lesson) return { ok: false, error: "not_found" };

  await db
    .insert(lessonProgress)
    .values({ userId, lessonId, isCompleted: true })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { isCompleted: true, updatedAt: new Date() },
    });

  const stats = await recomputeCourseProgress(userId, courseId);
  if (stats.percent >= 100) await issueCertificateIfEligible(userId, courseId);
  const { evaluateBadges } = await import("@/server/actions/platform");
  await evaluateBadges(userId);
  revalidatePath("/learn");
  return { ok: true };
}

/**
 * Video heartbeat (legacy update_watch_history_with_duration): stores the
 * resume position and auto-completes at >= 90% watched (spec §7.6).
 */
export async function saveProgressSeconds(
  courseId: string,
  lessonId: string,
  positionSeconds: number,
  durationSeconds: number,
): Promise<LearnResult> {
  const guard = await requireEnrolled(courseId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { userId } = guard;

  const safePosition = Math.max(0, Math.floor(positionSeconds));
  const safeDuration = Math.max(0, Math.floor(durationSeconds));
  const shouldComplete =
    safeDuration > 0 && safePosition / safeDuration >= 0.9;

  await db
    .insert(lessonProgress)
    .values({
      userId,
      lessonId,
      lastPositionSeconds: safePosition,
      isCompleted: shouldComplete,
      watchCount: 1,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        lastPositionSeconds: safePosition,
        ...(shouldComplete ? { isCompleted: true } : {}),
        updatedAt: new Date(),
      },
    });

  if (shouldComplete) {
    const stats = await recomputeCourseProgress(userId, courseId);
    if (stats.percent >= 100) await issueCertificateIfEligible(userId, courseId);
    const { evaluateBadges } = await import("@/server/actions/platform");
    await evaluateBadges(userId);
  }
  return { ok: true };
}

/**
 * Quiz grading with legacy parity (Home::submit_quiz, spec §3.2):
 * sort(correct) deep-equals sort(submitted) per question.
 */
const submissionSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  /** questionId -> selected option strings / typed answer */
  answers: z.record(z.string(), z.array(z.string())),
});

export async function submitQuiz(
  input: z.infer<typeof submissionSchema>,
): Promise<
  | { ok: true; obtainedMarks: number; totalMarks: number; attemptsLeft: number; answers: { questionId: string; submitted: string[]; correct: string[]; status: number }[] }
  | { ok: false; error: string }
> {
  const guard = await requireEnrolled(input.courseId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { userId } = guard;

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, input.lessonId), eq(lessons.courseId, input.courseId)))
    .limit(1);
  if (!lesson || lesson.type !== "quiz") return { ok: false, error: "not_found" };

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.lessonId, lesson.id)).limit(1);
  if (!quiz) return { ok: false, error: "not_found" };

  const attempts = await db
    .select({ id: quizResults.id })
    .from(quizResults)
    .where(and(eq(quizResults.quizId, quiz.id), eq(quizResults.userId, userId)));
  const maxAttempts = lesson.quizMaxAttempts;
  if (attempts.length >= maxAttempts) {
    return { ok: false, error: "no_attempts_left" };
  }

  const questionRows = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quiz.id))
    .orderBy(asc(questions.order));

  // legacy grading: exact match of sorted answer arrays
  const graded = questionRows.map((question) => {
    const submitted = [...(input.answers[question.id] ?? [])].sort();
    const correct = [...question.correctAnswers].sort();
    const status =
      submitted.length === correct.length && submitted.every((v, i) => v === correct[i]) ? 1 : 0;
    return { questionId: question.id, submitted, correct, status };
  });
  const totalMarks = questionRows.length;
  const obtainedMarks = graded.reduce((sum, g) => sum + g.status, 0);

  await db.insert(quizResults).values({
    quizId: quiz.id,
    userId,
    answers: graded,
    obtainedMarks,
    totalMarks,
    isSubmitted: true,
  });

  await db
    .insert(courseProgress)
    .values({ userId, courseId: input.courseId })
    .onConflictDoNothing();

  const attemptsLeft = maxAttempts - attempts.length - 1;
  const { evaluateBadges } = await import("@/server/actions/platform");
  await evaluateBadges(userId);
  revalidatePath("/learn");
  return { ok: true, obtainedMarks, totalMarks, attemptsLeft, answers: graded };
}

/** Issues the certificate once the course is complete (spec §7.10). */
async function issueCertificateIfEligible(userId: string, courseId: string) {
  const [existing] = await db
    .select({ id: certificate.id })
    .from(certificate)
    .where(and(eq(certificate.studentId, userId), eq(certificate.courseId, courseId)))
    .limit(1);
  if (existing) return null;

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return null;

  const [created] = await db
    .insert(certificate)
    .values({
      code: generateCertificateCode(),
      studentId: userId,
      courseId,
      issuedAt: new Date(),
    })
    .returning({ code: certificate.code });
  if (!created) return null;

  revalidatePath(`/certificate/${created.code}`);
  return created.code;
}

export async function issueCertificateForCourse(courseId: string): Promise<
  { ok: true; code: string } | { ok: false; error: string }
> {
  const guard = await requireEnrolled(courseId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { userId } = guard;

  const stats = await recomputeCourseProgress(userId, courseId);
  if (stats.percent < 100) return { ok: false, error: "not_complete" };

  const code = await issueCertificateIfEligible(userId, courseId);
  if (!code) {
    const [existing] = await db
      .select({ code: certificate.code })
      .from(certificate)
      .where(and(eq(certificate.studentId, userId), eq(certificate.courseId, courseId)))
      .limit(1);
    return existing ? { ok: true, code: existing.code } : { ok: false, error: "unknown" };
  }
  return { ok: true, code };
}
