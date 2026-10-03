import { NextResponse } from "next/server";
import { and, count, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { courses, courseProgress, enrollments, notifications } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * GET /api/cron — scheduled maintenance (spec §4.4 jobs, legacy cronjob page).
 * Auth: CRON_SECRET via the `x-cron-secret` header (external schedulers) OR a
 * `?secret=` query param (Vercel native cron, which can't set custom headers —
 * put the secret in the Vercel dashboard crontab path), OR an admin session.
 * Tasks: notify enrollments expiring within 3 days; refresh drip unlocks.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const url = new URL(request.url);
  const secret = request.headers.get("x-cron-secret") ?? url.searchParams.get("secret") ?? undefined;
  const authorized =
    (session?.user.role === "admin" && Boolean(session)) ||
    (process.env.CRON_SECRET ? secret === process.env.CRON_SECRET : false);
  if (!authorized) {
    return NextResponse.json({ status: false, message: "forbidden" }, { status: 403 });
  }

  const threeDaysFromNow = new Date(Date.now() + 3 * 86_400_000);
  const expiring = await db
    .select({
      id: enrollments.id,
      userId: enrollments.userId,
      courseId: enrollments.courseId,
      courseTitle: courses.title,
      expiresAt: enrollments.expiresAt,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(
      and(
        sql`${enrollments.expiresAt} is not null`,
        lte(enrollments.expiresAt, threeDaysFromNow),
        sql`${enrollments.expiresAt} > now()`,
      ),
    )
    .limit(100);

  let notified = 0;
  for (const row of expiring) {
    const [existing] = await db
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, row.userId),
          eq(notifications.type, "enrollment_expiring"),
          sql`${notifications.body} like ${"%" + row.courseTitle + "%"}`,
        ),
      );
    if ((existing?.total ?? 0) === 0) {
      await db.insert(notifications).values({
        userId: row.userId,
        type: "enrollment_expiring",
        title: `Access ending soon: ${row.courseTitle}`,
        body: `Your enrollment expires on ${row.expiresAt?.toLocaleDateString("en", { dateStyle: "medium" })}.`,
        url: "/dashboard/my-courses",
      });
      notified++;
    }
  }

  const dripCourses = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.enableDripContent, true))
    .limit(50);
  let dripUpdated = 0;
  for (const course of dripCourses) {
    const enrolled = await db
      .select({ userId: enrollments.userId, createdAt: enrollments.createdAt })
      .from(enrollments)
      .where(eq(enrollments.courseId, course.id))
      .limit(200);
    for (const row of enrolled) {
      const days = Math.floor((Date.now() - row.createdAt.getTime()) / 86_400_000);
      await db
        .update(courseProgress)
        .set({ dripUnlockedOrder: days, updatedAt: new Date() })
        .where(and(eq(courseProgress.userId, row.userId), eq(courseProgress.courseId, course.id)));
      dripUpdated++;
    }
  }

  return NextResponse.json({ status: true, checked: expiring.length, notified, dripUpdated });
}
