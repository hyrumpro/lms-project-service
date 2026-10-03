import { NextResponse } from "next/server";
import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { account, categories, courses, enrollments, lessons, sections, user, wishlistItems, cartItems, forumQuestions, payouts, liveClasses, courseInstructors } from "@/db/schema";
import { bearerToken, signLegacyToken, verifyLegacyToken } from "@/lib/jwt-legacy";
import { auth } from "@/lib/auth";
import { hashPassword } from "better-auth/crypto";
import { consumeEmailCode, issueEmailCode } from "@/server/actions/auth-extra";
import { gradeQuiz } from "@/server/services/quiz-submit";
import { searchCourseForum } from "@/server/queries/forum";

/**
 * Resolve the acting user for a /api/v1 request. Prefers a legacy HS256 bearer
 * token (existing mobile apps); falls back to the Better-Auth session cookie so
 * new/secure clients can authenticate without the public legacy JWT secret.
 */
async function userIdFrom(request: Request) {
  const token = bearerToken(request);
  if (token) {
    const legacy = await verifyLegacyToken(token);
    if (legacy?.userId) return legacy.userId;
  }
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export async function handleMobile(request: Request, slug: string[]) {
  const path = slug.join("/");
  const url = new URL(request.url);

  if (path === "auth/register" && request.method === "POST") {
    const body = (await request.json().catch(() => null)) as { email?: string; password?: string; name?: string } | null;
    if (!body?.email || !body.password) return NextResponse.json({ status: false, message: "email and password required" }, { status: 400 });
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(body.password);
    await db.insert(user).values({
      id,
      email: body.email.toLowerCase(),
      name: body.name ?? body.email,
      emailVerified: false,
    });
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: passwordHash,
    });
    await issueEmailCode(body.email);
    const token = await signLegacyToken(id);
    return NextResponse.json({ status: true, token, user_id: id });
  }

  if (path === "auth/verify" && request.method === "POST") {
    const body = (await request.json().catch(() => null)) as { email?: string; code?: string } | null;
    if (!body?.email || !body.code) return NextResponse.json({ status: false }, { status: 400 });
    const ok = await consumeEmailCode(body.email, body.code);
    if (ok) {
      await db.update(user).set({ emailVerified: true }).where(eq(user.email, body.email.toLowerCase()));
    }
    return NextResponse.json({ status: ok });
  }

  if (path === "auth/forgot" && request.method === "POST") {
    return NextResponse.json({ status: true, message: "If the account exists, a reset email was sent." });
  }

  if (path === "categories" && request.method === "GET") {
    const rows = await db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories);
    return NextResponse.json({ status: true, categories: rows });
  }

  if (path === "courses/search" && request.method === "GET") {
    const q = url.searchParams.get("q") ?? "";
    const rows = await db
      .select({ course_id: courses.id, title: courses.title, slug: courses.slug })
      .from(courses)
      .where(and(eq(courses.status, "active"), ilike(courses.title, `%${q}%`)))
      .limit(20);
    return NextResponse.json({ status: true, courses: rows });
  }

  const userId = await userIdFrom(request);

  if (path.startsWith("courses/") && path.endsWith("/sections") && request.method === "GET") {
    const courseId = path.split("/")[1];
    const rows = await db.select().from(sections).where(eq(sections.courseId, courseId)).orderBy(sections.order);
    const lessonRows = await db.select().from(lessons).where(eq(lessons.courseId, courseId)).orderBy(lessons.order);
    return NextResponse.json({
      status: true,
      sections: rows.map((section) => ({
        ...section,
        lessons: lessonRows.filter((lesson) => lesson.sectionId === section.id),
      })),
    });
  }

  if (path === "wishlist" && request.method === "POST") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { courseId?: string } | null;
    if (!body?.courseId) return NextResponse.json({ status: false }, { status: 400 });
    await db.insert(wishlistItems).values({ userId, courseId: body.courseId }).onConflictDoNothing();
    return NextResponse.json({ status: true });
  }

  if (path === "cart" && request.method === "POST") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { courseId?: string } | null;
    if (!body?.courseId) return NextResponse.json({ status: false }, { status: 400 });
    await db.insert(cartItems).values({ userId, courseId: body.courseId }).onConflictDoNothing();
    return NextResponse.json({ status: true });
  }

  if (path === "enroll-free" && request.method === "POST") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { courseId?: string } | null;
    if (!body?.courseId) return NextResponse.json({ status: false }, { status: 400 });
    await db.insert(enrollments).values({ userId, courseId: body.courseId, source: "free" }).onConflictDoNothing();
    return NextResponse.json({ status: true });
  }

  if (path === "quiz-submit" && request.method === "POST") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const body = (await request.json().catch(() => null)) as {
      courseId?: string;
      lessonId?: string;
      answers?: Record<string, string[]>;
    } | null;
    if (!body?.courseId || !body.lessonId || !body.answers) {
      return NextResponse.json({ status: false }, { status: 400 });
    }
    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, body.courseId)))
      .limit(1);
    if (!enrollment) return NextResponse.json({ status: false, message: "not_enrolled" }, { status: 403 });
    const result = await gradeQuiz(userId, {
      courseId: body.courseId,
      lessonId: body.lessonId,
      answers: body.answers,
    });
    return NextResponse.json(result);
  }

  if (path === "profile" && request.method === "POST") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { name?: string; biography?: string } | null;
    await db
      .update(user)
      .set({ name: body?.name, biography: body?.biography, updatedAt: new Date() })
      .where(eq(user.id, userId));
    return NextResponse.json({ status: true });
  }

  if (path === "forum/search" && request.method === "GET") {
    const courseId = url.searchParams.get("courseId") ?? "";
    const q = url.searchParams.get("q") ?? "";
    const rows = await searchCourseForum(courseId, q);
    return NextResponse.json({ status: true, questions: rows });
  }

  if (path === "forum" && request.method === "POST") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { courseId?: string; title?: string; body?: string } | null;
    if (!body?.courseId || !body.title) return NextResponse.json({ status: false }, { status: 400 });
    await db.insert(forumQuestions).values({
      courseId: body.courseId,
      userId,
      title: body.title,
      body: body.body ?? "",
    });
    return NextResponse.json({ status: true });
  }

  if (path === "instructor/courses" && request.method === "GET") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const rows = await db
      .select({ course_id: courses.id, title: courses.title, status: courses.status })
      .from(courseInstructors)
      .innerJoin(courses, eq(courses.id, courseInstructors.courseId))
      .where(eq(courseInstructors.instructorId, userId));
    return NextResponse.json({ status: true, courses: rows });
  }

  if (path === "instructor/payouts" && request.method === "GET") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const rows = await db.select().from(payouts).where(eq(payouts.instructorId, userId)).orderBy(desc(payouts.createdAt));
    return NextResponse.json({ status: true, payouts: rows });
  }

  if (path === "instructor/live-classes" && request.method === "GET") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const rows = await db
      .select({ id: liveClasses.id, title: liveClasses.title, join_url: liveClasses.joinUrl, starts_at: liveClasses.startsAt })
      .from(liveClasses)
      .innerJoin(courseInstructors, eq(courseInstructors.courseId, liveClasses.courseId))
      .where(eq(courseInstructors.instructorId, userId));
    return NextResponse.json({ status: true, live_classes: rows });
  }

  if (path === "auth/resend" && request.method === "POST") {
    const body = (await request.json().catch(() => null)) as { email?: string } | null;
    if (!body?.email) return NextResponse.json({ status: false }, { status: 400 });
    await issueEmailCode(body.email);
    return NextResponse.json({ status: true });
  }

  if (path === "password" && request.method === "POST") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { password?: string } | null;
    if (!body?.password || body.password.length < 8) return NextResponse.json({ status: false }, { status: 400 });
    await db
      .update(account)
      .set({ password: await hashPassword(body.password), updatedAt: new Date() })
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
    return NextResponse.json({ status: true });
  }

  if (path === "courses/top" && request.method === "GET") {
    const rows = await db
      .select({ course_id: courses.id, title: courses.title, slug: courses.slug })
      .from(courses)
      .where(eq(courses.status, "active"))
      .orderBy(desc(courses.createdAt))
      .limit(10);
    return NextResponse.json({ status: true, courses: rows });
  }

  if (path === "courses/filter" && request.method === "GET") {
    const category = url.searchParams.get("category");
    const rows = await db
      .select({ course_id: courses.id, title: courses.title, price: courses.price })
      .from(courses)
      .where(category ? and(eq(courses.status, "active"), eq(courses.categoryId, category)) : eq(courses.status, "active"))
      .limit(30);
    return NextResponse.json({ status: true, courses: rows });
  }

  if (path === "profile" && request.method === "GET") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const [row] = await db.select({ user_id: user.id, name: user.name, email: user.email }).from(user).where(eq(user.id, userId));
    return NextResponse.json({ status: true, user: row });
  }

  if (path === "instructor/sections" && request.method === "GET") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const courseId = url.searchParams.get("courseId") ?? "";
    const rows = await db.select().from(sections).where(eq(sections.courseId, courseId)).orderBy(sections.order);
    return NextResponse.json({ status: true, sections: rows });
  }

  if (path === "instructor/lessons" && request.method === "GET") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const courseId = url.searchParams.get("courseId") ?? "";
    const rows = await db.select().from(lessons).where(eq(lessons.courseId, courseId)).orderBy(lessons.order);
    return NextResponse.json({ status: true, lessons: rows });
  }

  if (path === "instructor/sort" && request.method === "POST") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { lessonId?: string; order?: number } | null;
    if (!body?.lessonId || body.order === undefined) return NextResponse.json({ status: false }, { status: 400 });
    await db.update(lessons).set({ order: body.order }).where(eq(lessons.id, body.lessonId));
    return NextResponse.json({ status: true });
  }

  if (path === "instructor/pricing" && request.method === "POST") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { courseId?: string; price?: number } | null;
    if (!body?.courseId || body.price === undefined) return NextResponse.json({ status: false }, { status: 400 });
    await db.update(courses).set({ price: body.price }).where(eq(courses.id, body.courseId));
    return NextResponse.json({ status: true });
  }

  if (path === "instructor/sales" && request.method === "GET") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const rows = await db
      .select({ course_id: courses.id, title: courses.title })
      .from(courseInstructors)
      .innerJoin(courses, eq(courses.id, courseInstructors.courseId))
      .where(eq(courseInstructors.instructorId, userId));
    return NextResponse.json({ status: true, sales: rows });
  }

  if (path === "instructor/withdrawals" && request.method === "POST") {
    if (!userId) return NextResponse.json({ status: false }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { amount?: number } | null;
    if (!body?.amount || body.amount < 1) return NextResponse.json({ status: false }, { status: 400 });
    await db.insert(payouts).values({ instructorId: userId, amount: body.amount, method: "paypal", status: "requested" });
    return NextResponse.json({ status: true });
  }

  return NextResponse.json({ status: false, message: "Unknown endpoint" }, { status: 404 });
}
