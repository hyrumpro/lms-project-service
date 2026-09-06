import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { lessonProgress, lessons, sections } from "@/db/schema";
import type { UnlockRule } from "@/db/schema";

/**
 * Drip-content evaluation (spec §7.6, legacy section.restricted_by).
 * Rules: fixed date · previous section completed · N days after enrollment.
 */
export function isSectionUnlocked(
  rule: UnlockRule | null,
  context: { now: Date; enrollmentStartedAt: Date | null; previousSectionCompleted: boolean },
): { unlocked: boolean; reason?: string } {
  if (!rule) return { unlocked: true };

  switch (rule.kind) {
    case "date": {
      const date = new Date(rule.date);
      return date <= context.now
        ? { unlocked: true }
        : { unlocked: false, reason: `Unlocks ${date.toLocaleDateString("en", { month: "long", day: "numeric" })}` };
    }
    case "prevSection":
      return context.previousSectionCompleted
        ? { unlocked: true }
        : { unlocked: false, reason: "Finish the previous section first" };
    case "daysAfterEnroll": {
      if (!context.enrollmentStartedAt) return { unlocked: false, reason: "Enroll to unlock" };
      const unlockAt = new Date(context.enrollmentStartedAt.getTime() + rule.days * 86_400_000);
      return unlockAt <= context.now
        ? { unlocked: true }
        : {
            unlocked: false,
            reason: `Unlocks ${unlockAt.toLocaleDateString("en", { month: "long", day: "numeric" })}`,
          };
    }
  }
}

/**
 * Recomputes the aggregate row for a student × course and issues a
 * certificate on 100% (spec §3.3 progress math, §7.10 issuance).
 */
export async function recomputeCourseProgress(userId: string, courseId: string) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(lessons)
    .where(eq(lessons.courseId, courseId));

  const [{ completed }] = await db
    .select({ completed: count() })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessons.courseId, courseId),
        eq(lessonProgress.isCompleted, true),
      ),
    );

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const completedAt = percent >= 100 ? new Date() : null;

  const { courseProgress } = await import("@/db/schema");
  const [existing] = await db
    .select({ id: courseProgress.id })
    .from(courseProgress)
    .where(and(eq(courseProgress.userId, userId), eq(courseProgress.courseId, courseId)))
    .limit(1);

  if (existing) {
    await db
      .update(courseProgress)
      .set({ completedLessons: completed, percent, completedAt, updatedAt: new Date() })
      .where(eq(courseProgress.id, existing.id));
  } else {
    await db.insert(courseProgress).values({
      userId,
      courseId,
      completedLessons: completed,
      percent,
      completedAt,
    });
  }

  return { completed, total, percent };
}

export function generateCertificateCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return `AC-${code.slice(0, 5)}-${code.slice(5)}`;
}
