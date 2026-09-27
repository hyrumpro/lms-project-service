import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  categories,
  courseProgress,
  courses,
  enrollments,
  messageThreads,
  messages,
  notifications,
  user,
  wishlistItems,
} from "@/db/schema";
import { auth } from "@/lib/auth";

/** Student dashboard queries (spec §7.2 student area, M2). */

export async function requireSession() {
  return auth.api.getSession({ headers: await headers() });
}

const instructorNamesSql = sql<string>`(
  select coalesce(string_agg(u.name, ', '), '') from course_instructors ci
  join "user" u on u.id = ci.instructor_id
  where ci.course_id = ${courses.id}
)`;

export async function getMyCourses(userId: string) {
  return db
    .select({
      ...getTableColumns(courses),
      categoryName: categories.name,
      percent: sql<number>`coalesce(${courseProgress.percent}, 0)::int`,
      completedLessons: sql<number>`coalesce(${courseProgress.completedLessons}, 0)::int`,
      watchingLessonId: courseProgress.watchingLessonId,
      enrolledAt: enrollments.createdAt,
      expiresAt: enrollments.expiresAt,
      instructorNames: instructorNamesSql,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .leftJoin(
      courseProgress,
      and(eq(courseProgress.courseId, courses.id), eq(courseProgress.userId, userId)),
    )
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.createdAt));
}

export async function getWishlist(userId: string) {
  return db
    .select({
      ...getTableColumns(courses),
      categoryName: categories.name,
      categorySlug: categories.slug,
      instructorNames: instructorNamesSql,
      enrolledCount: sql<number>`(select count(*) from ${enrollments} e where e.course_id = ${courses.id})::int`,
      ratingAvg: sql<number>`coalesce((select avg(rating) from reviews r where r.course_id = ${courses.id}), 0)::float`,
      ratingCount: sql<number>`(select count(*) from reviews r where r.course_id = ${courses.id})::int`,
    })
    .from(wishlistItems)
    .innerJoin(courses, eq(courses.id, wishlistItems.courseId))
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt));
}

export async function getWishlistItemFor(userId: string, courseId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: wishlistItems.id })
    .from(wishlistItems)
    .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.courseId, courseId)))
    .limit(1);
  return Boolean(row);
}

export async function getPurchaseHistory(userId: string) {
  return db
    .select({
      enrollmentId: enrollments.id,
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      isFree: courses.isFree,
      price: courses.price,
      source: enrollments.source,
      enrolledAt: enrollments.createdAt,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.createdAt));
}

export async function getNotifications(userId: string) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.total ?? 0;
}

export async function getMessageThreads(userId: string) {
  const rows = await db
    .select({
      id: messageThreads.id,
      threadCode: messageThreads.threadCode,
      senderId: messageThreads.senderId,
      receiverId: messageThreads.receiverId,
      lastMessageAt: messageThreads.lastMessageAt,
    })
    .from(messageThreads)
    .where(sql`${messageThreads.senderId} = ${userId} or ${messageThreads.receiverId} = ${userId}`)
    .orderBy(desc(messageThreads.lastMessageAt));

  if (rows.length === 0) return [];

  const partnerIds = rows.map((t) => (t.senderId === userId ? t.receiverId : t.senderId));
  const partners = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, partnerIds));

  const lastMessages = await db
    .select({
      threadId: messages.threadId,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(inArray(messages.threadId, rows.map((t) => t.id)))
    .orderBy(desc(messages.createdAt));

  return rows.map((thread) => {
    const partner = partners.find((p) => p.id === (thread.senderId === userId ? thread.receiverId : thread.senderId));
    const last = lastMessages.find((m) => m.threadId === thread.id);
    return { ...thread, partner, lastMessage: last };
  });
}

export async function getThread(threadCode: string, userId: string) {
  const [thread] = await db
    .select()
    .from(messageThreads)
    .where(eq(messageThreads.threadCode, threadCode))
    .limit(1);
  if (!thread || (thread.senderId !== userId && thread.receiverId !== userId)) return null;

  const partnerId = thread.senderId === userId ? thread.receiverId : thread.senderId;
  const [partner] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, partnerId))
    .limit(1);

  const threadMessages = await db
    .select({
      id: messages.id,
      body: messages.body,
      senderId: messages.senderId,
      createdAt: messages.createdAt,
      readAt: messages.readAt,
    })
    .from(messages)
    .where(eq(messages.threadId, thread.id))
    .orderBy(messages.createdAt);

  return { thread, partner, messages: threadMessages };
}

export async function getDashboardOverview(userId: string) {
  const [myCourses, unread] = await Promise.all([getMyCourses(userId), getUnreadCount(userId)]);
  const inProgress = myCourses.filter((c) => c.percent > 0 && c.percent < 100);
  const completed = myCourses.filter((c) => c.percent >= 100);
  const notStarted = myCourses.filter((c) => c.percent === 0);
  return { myCourses, inProgress, completed, notStarted, unread };
}

export async function getMessageRecipients(excludeUserId: string) {
  return db
    .select({
      id: user.id,
      name: user.name,
      role: user.role,
      isInstructor: user.isInstructor,
      image: user.image,
    })
    .from(user)
    .where(and(ne(user.id, excludeUserId), eq(user.status, "active")))
    .orderBy(asc(user.name))
    .limit(100);
}
