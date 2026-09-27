"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { courseProgress, courses, enrollments } from "@/db/schema";
import { auth } from "@/lib/auth";

export type EnrollResult = { ok: true } | { ok: false; error: string };

/**
 * Free-course enrollment (legacy Home::get_enrolled_to_free_course).
 * Paid checkout arrives in M4; this path covers isFree and 100%-discounted
 * courses per spec §3.9.
 */
export async function enrollInFreeCourse(courseId: string, slug: string): Promise<EnrollResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "auth_required" };

  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.status, "active")))
    .limit(1);
  if (!course) return { ok: false, error: "not_found" };

  const isFree = course.isFree || (course.discountEnabled && course.discountedPrice === 0);
  if (!isFree) return { ok: false, error: "not_free" };

  const expiresAt =
    course.expiryPeriod && course.expiryPeriod > 0
      ? new Date(Date.now() + course.expiryPeriod * 86_400_000)
      : null;

  await db
    .insert(enrollments)
    .values({ userId: session.user.id, courseId, source: "free", expiresAt })
    .onConflictDoNothing();

  await db
    .insert(courseProgress)
    .values({ userId: session.user.id, courseId })
    .onConflictDoNothing();

  revalidatePath(`/course/${slug}-${courseId}`);
  return { ok: true };
}
