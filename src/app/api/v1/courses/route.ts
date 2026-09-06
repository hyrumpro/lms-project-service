import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, courses, enrollments, lessonProgress, lessons } from "@/db/schema";
import { verifyLegacyToken, bearerToken } from "@/lib/jwt-legacy";

/** GET /api/v1/courses — active catalog (legacy top_courses_get / filter). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(50, Number(url.searchParams.get("limit") ?? 20));

  const rows = await db
    .select({
      course_id: courses.id,
      title: courses.title,
      slug: courses.slug,
      short_description: courses.shortDescription,
      price: sql<number>`(case when ${courses.isFree} then 0 when ${courses.discountEnabled} then ${courses.discountedPrice} else ${courses.price} end)::int`,
      is_free: courses.isFree,
      level: courses.level,
      language: courses.language,
      thumbnail: courses.thumbnail,
      category: categories.name,
      students: sql<number>`(select count(*) from ${enrollments} e where e.course_id = ${courses.id})::int`,
      rating: sql<number>`coalesce((select avg(rating) from reviews r where r.course_id = ${courses.id}), 0)::float`,
    })
    .from(courses)
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .where(eq(courses.status, "active"))
    .orderBy(desc(courses.createdAt))
    .limit(limit);

  return NextResponse.json({ status: true, courses: rows });
}

/**
 * POST /api/v1/courses — progress update (legacy save_course_progress_get /
 * update_watch_history). Body: { courseId, lessonId, positionSeconds?, complete? }
 * Auth: Bearer legacy JWT.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  const payload = token ? await verifyLegacyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ status: false, message: "Invalid token" }, { status: 401 });
  }
  const userId = payload.userId;

  const body = (await request.json().catch(() => null)) as {
    courseId?: string;
    lessonId?: string;
    positionSeconds?: number;
    complete?: boolean;
  } | null;
  if (!body?.courseId || !body?.lessonId) {
    return NextResponse.json({ status: false, message: "courseId and lessonId required" }, { status: 400 });
  }

  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, userId), eq(enrollments.courseId, body.courseId)),
    )
    .limit(1);
  if (!enrollment) {
    return NextResponse.json({ status: false, message: "Not enrolled" }, { status: 403 });
  }

  await db
    .insert(lessonProgress)
    .values({
      userId,
      lessonId: body.lessonId,
      lastPositionSeconds: Math.max(0, Math.floor(body.positionSeconds ?? 0)),
      isCompleted: Boolean(body.complete),
      watchCount: 1,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        lastPositionSeconds: Math.max(0, Math.floor(body.positionSeconds ?? 0)),
        ...(body.complete ? { isCompleted: true } : {}),
        updatedAt: new Date(),
      },
    });

  // recompute percent (spec §3.3)
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(lessons)
    .where(eq(lessons.courseId, body.courseId));
  const [{ completed }] = await db
    .select({ completed: sql<number>`count(*)::int` })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessons.courseId, body.courseId),
        eq(lessonProgress.isCompleted, true),
      ),
    );
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  const { courseProgress } = await import("@/db/schema");
  await db
    .insert(courseProgress)
    .values({ userId, courseId: body.courseId, completedLessons: completed, percent })
    .onConflictDoUpdate({
      target: [courseProgress.userId, courseProgress.courseId],
      set: { completedLessons: completed, percent, updatedAt: new Date() },
    });

  return NextResponse.json({ status: true, percent, completed, total });
}
