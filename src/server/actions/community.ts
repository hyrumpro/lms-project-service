"use server";

import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { messageThreads, messages, notifications, user, wishlistItems } from "@/db/schema";
import { auth } from "@/lib/auth";

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function toggleWishlist(courseId: string): Promise<ActionResult & { added?: boolean }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };

  const [existing] = await db
    .select({ id: wishlistItems.id })
    .from(wishlistItems)
    .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.courseId, courseId)))
    .limit(1);

  if (existing) {
    await db.delete(wishlistItems).where(eq(wishlistItems.id, existing.id));
    revalidatePath("/dashboard/wishlist");
    return { ok: true, added: false };
  }
  await db.insert(wishlistItems).values({ userId, courseId }).onConflictDoNothing();
  revalidatePath("/dashboard/wishlist");
  return { ok: true, added: true };
}

export async function markNotificationsRead(): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  revalidatePath("/dashboard/notifications");
  return { ok: true };
}

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  title: z.string().trim().max(120).optional(),
  biography: z.string().trim().max(2000).optional(),
});

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  await db
    .update(user)
    .set({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      name: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
      title: parsed.data.title || null,
      biography: parsed.data.biography || null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
  revalidatePath("/dashboard/profile");
  return { ok: true };
}

const messageSchema = z.object({
  threadCode: z.string().min(4),
  body: z.string().trim().min(1).max(4000),
});

export async function sendMessage(input: z.infer<typeof messageSchema>): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const [thread] = await db
    .select()
    .from(messageThreads)
    .where(eq(messageThreads.threadCode, parsed.data.threadCode))
    .limit(1);
  if (!thread || (thread.senderId !== userId && thread.receiverId !== userId)) {
    return { ok: false, error: "not_found" };
  }

  await db.insert(messages).values({
    threadId: thread.id,
    senderId: userId,
    body: parsed.data.body,
  });
  await db
    .update(messageThreads)
    .set({ lastMessageAt: new Date() })
    .where(eq(messageThreads.id, thread.id));
  revalidatePath(`/dashboard/messages/${parsed.data.threadCode}`);
  return { ok: true };
}
