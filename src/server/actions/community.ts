"use server";

import { and, eq, isNull, or } from "drizzle-orm";
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

const createThreadSchema = z.object({
  recipientId: z.string().min(1),
  message: z.string().trim().min(1).max(4000),
});

export async function createMessageThread(
  input: z.infer<typeof createThreadSchema>,
): Promise<{ ok: true; threadCode: string } | { ok: false; error: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };
  const parsed = createThreadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (parsed.data.recipientId === userId) {
    return { ok: false, error: "cannot_message_self" };
  }

  const [recipient] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, parsed.data.recipientId))
    .limit(1);
  if (!recipient) return { ok: false, error: "recipient_not_found" };

  const [existingThread] = await db
    .select()
    .from(messageThreads)
    .where(
      or(
        and(eq(messageThreads.senderId, userId), eq(messageThreads.receiverId, parsed.data.recipientId)),
        and(eq(messageThreads.senderId, parsed.data.recipientId), eq(messageThreads.receiverId, userId)),
      ),
    )
    .limit(1);

  let thread = existingThread;
  if (!thread) {
    const threadCode = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const [newThread] = await db
      .insert(messageThreads)
      .values({
        threadCode,
        senderId: userId,
        receiverId: parsed.data.recipientId,
        lastMessageAt: new Date(),
      })
      .returning();
    thread = newThread;
  }

  await db.insert(messages).values({
    threadId: thread.id,
    senderId: userId,
    body: parsed.data.message,
  });

  await db
    .update(messageThreads)
    .set({ lastMessageAt: new Date() })
    .where(eq(messageThreads.id, thread.id));

  await db.insert(notifications).values({
    userId: parsed.data.recipientId,
    type: "message",
    title: "New message received",
    body: parsed.data.message.slice(0, 100),
    url: `/dashboard/messages/${thread.threadCode}`,
  });

  revalidatePath("/dashboard/messages");
  revalidatePath(`/dashboard/messages/${thread.threadCode}`);
  return { ok: true, threadCode: thread.threadCode };
}
