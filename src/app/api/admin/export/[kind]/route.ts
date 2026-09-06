import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, enrollments, orders, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAccessAdminSection } from "@/server/queries/admin";

/**
 * CSV exports (legacy export_enrol_history_csv / export_admins_csv parity).
 * GET /api/admin/export/[kind] — admin-only, section-scoped.
 */

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

async function guard(request: Request, kind: string): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") return false;
  const sectionMap: Record<string, string> = {
    enrollments: "courses",
    students: "users",
    orders: "commerce",
    progress: "courses",
  };
  return canAccessAdminSection(session.user.id, sectionMap[kind] ?? "dashboard");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (!(await guard(request, kind))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let rows: Record<string, unknown>[] = [];
  if (kind === "enrollments") {
    rows = await db
      .select({
        enrollment_id: enrollments.id,
        student: user.name,
        email: user.email,
        course: courses.title,
        source: enrollments.source,
        enrolled_at: enrollments.createdAt,
        expires_at: enrollments.expiresAt,
      })
      .from(enrollments)
      .innerJoin(user, eq(user.id, enrollments.userId))
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .orderBy(desc(enrollments.createdAt));
  } else if (kind === "students") {
    rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_instructor: user.isInstructor,
        status: user.status,
        created_at: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt));
  } else if (kind === "orders") {
    rows = await db
      .select({
        order_id: orders.id,
        customer: user.name,
        email: user.email,
        gateway: orders.gateway,
        status: orders.status,
        subtotal: orders.subtotal,
        discount: orders.discount,
        tax: orders.tax,
        total: orders.total,
        gift_for: orders.giftToEmail,
        created_at: orders.createdAt,
      })
      .from(orders)
      .innerJoin(user, eq(user.id, orders.userId))
      .orderBy(desc(orders.createdAt));
  } else {
    return NextResponse.json({ error: "Unknown export kind" }, { status: 404 });
  }

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="academy-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
