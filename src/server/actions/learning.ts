"use server";

import { and, eq } from "drizzle-orm";
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
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  generateCertificateCode,
  recomputeCourseProgress,
} from "@/lib/learning";
import { gradeQuiz } from "@/server/services/quiz-submit";

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

/** Manual mark-complete toggle (legacy parity with update_watch_history_manually). */
export async function markLessonComplete(
  courseId: string,
  lessonId: string,
  forceState?: boolean,
): Promise<LearnResult & { isCompleted?: boolean }> {
  const guard = await requireEnrolled(courseId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { userId } = guard;

  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
    .limit(1);
  if (!lesson) return { ok: false, error: "not_found" };

  const [current] = await db
    .select({ isCompleted: lessonProgress.isCompleted })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)))
    .limit(1);

  const nextState = forceState !== undefined ? forceState : !current?.isCompleted;

  await db
    .insert(lessonProgress)
    .values({ userId, lessonId, isCompleted: nextState })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { isCompleted: nextState, updatedAt: new Date() },
    });

  const stats = await recomputeCourseProgress(userId, courseId);
  if (stats.percent >= 100) await issueCertificateIfEligible(userId, courseId);
  const { evaluateBadges } = await import("@/server/actions/platform");
  await evaluateBadges(userId);
  revalidatePath("/learn");
  return { ok: true, isCompleted: nextState };
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

  const graded = await gradeQuiz(userId, input);
  if (!graded.ok) return graded;
  const stats = await recomputeCourseProgress(userId, input.courseId);
  if (stats.percent >= 100) await issueCertificateIfEligible(userId, input.courseId);
  const { evaluateBadges } = await import("@/server/actions/platform");
  await evaluateBadges(userId);
  revalidatePath("/learn");
  return graded;
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

  const system = await import("@/lib/settings").then((mod) => mod.getSystemSettings());
  const threshold = course.certificateQuizThreshold ?? system.certificateQuizThreshold;
  if (threshold > 0) {
    const [progress] = await db
      .select({ quizSummary: courseProgress.quizSummary })
      .from(courseProgress)
      .where(and(eq(courseProgress.userId, userId), eq(courseProgress.courseId, courseId)))
      .limit(1);
    const scores = progress?.quizSummary ?? [];
    const best = scores.reduce((max, row) => {
      const pct = row.totalMarks === 0 ? 0 : Math.round((row.obtainedMarks / row.totalMarks) * 100);
      return Math.max(max, pct);
    }, 0);
    if (scores.length === 0 || best < threshold) return null;
  }

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
