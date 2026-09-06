"use server";

import { eq } from "drizzle-orm";
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
    .values({ email: parsed.data.email })
    .onConflictDoNothing();
  return { ok: true };
}
