import { NextResponse } from "next/server";
import { and, count, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { courses, enrollments, notifications } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * GET /api/cron — scheduled maintenance (spec §4.4 jobs, legacy cronjob page).
 * Header: x-cron-secret (CRON_SECRET env). Vercel Cron / external scheduler friendly.
 * Tasks: notify enrollments expiring within 3 days.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const secret = request.headers.get("x-cron-secret");
  const authorized =
    (session?.user.role === "admin" && Boolean(session)) ||
    (process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
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

  return NextResponse.json({ status: true, checked: expiring.length, notified });
}
