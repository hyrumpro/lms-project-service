"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { enrollments, reviews } from "@/db/schema";
import { auth } from "@/lib/auth";

const reviewSchema = z.object({
  courseId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  review: z.string().trim().max(2000).optional(),
});

export type ReviewResult = { ok: true } | { ok: false; error: string };

export async function submitReview(input: z.infer<typeof reviewSchema>): Promise<ReviewResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "auth_required" };

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, session.user.id),
        eq(enrollments.courseId, parsed.data.courseId),
      ),
    )
    .limit(1);

  if (!enrollment && session.user.role !== "admin") {
    return { ok: false, error: "not_enrolled" };
  }

  await db
    .insert(reviews)
    .values({
      userId: session.user.id,
      courseId: parsed.data.courseId,
      rating: parsed.data.rating,
      review: parsed.data.review || null,
    })
    .onConflictDoUpdate({
      target: [reviews.userId, reviews.courseId],
      set: {
        rating: parsed.data.rating,
        review: parsed.data.review || null,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/course");
  revalidatePath(`/learn/${parsed.data.courseId}`);
  return { ok: true };
}
