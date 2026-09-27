"use server";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { postComments, subscribers } from "@/db/schema";
import { auth } from "@/lib/auth";

const commentSchema = z.object({
  postId: z.string().min(1),
  slug: z.string().min(1),
  body: z.string().trim().min(2, "Comment is too short").max(2000),
});

export type CommentResult = { ok: true } | { ok: false; error: string };

export async function addPostComment(input: z.infer<typeof commentSchema>): Promise<CommentResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "auth_required" };

  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  await db.insert(postComments).values({
    postId: parsed.data.postId,
    userId: session.user.id,
    body: parsed.data.body,
  });
  revalidatePath(`/blog/${parsed.data.slug}`);
  return { ok: true };
}

const subscriberSchema = z.object({ email: z.string().email() });

export async function subscribeToNewsletter(email: string): Promise<CommentResult> {
  const parsed = subscriberSchema.safeParse({ email });
  if (!parsed.success) return { ok: false, error: "invalid_email" };
  await db
    .insert(subscribers)
    .values({ email: parsed.data.email, confirmed: false })
    .onConflictDoNothing();
  const { sendEmail } = await import("@/server/services/email");
  const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
  await sendEmail({
    to: parsed.data.email,
    subject: "Confirm your Academy newsletter subscription",
    html: `<p>Confirm your subscription: <a href="${origin}/newsletter/confirm?email=${encodeURIComponent(parsed.data.email)}">confirm</a></p>`,
  });
  return { ok: true };
}

export async function confirmNewsletter(email: string): Promise<CommentResult> {
  const parsed = subscriberSchema.safeParse({ email });
  if (!parsed.success) return { ok: false, error: "invalid_email" };
  await db.update(subscribers).set({ confirmed: true }).where(eq(subscribers.email, parsed.data.email));
  return { ok: true };
}

export async function likePostComment(commentId: string, slug: string): Promise<CommentResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "auth_required" };
  await db
    .update(postComments)
    .set({ likes: sql`${postComments.likes} + 1` })
    .where(eq(postComments.id, commentId));
  revalidatePath(`/blog/${slug}`);
  return { ok: true };
}
