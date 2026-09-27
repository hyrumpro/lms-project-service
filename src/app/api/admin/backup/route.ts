import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { courses, settings, user } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const [users, courseRows, settingRows] = await Promise.all([
    db.select({ id: user.id, email: user.email, role: user.role }).from(user),
    db.select({ id: courses.id, title: courses.title, status: courses.status }).from(courses),
    db.select().from(settings),
  ]);
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), users, courses: courseRows, settings: settingRows }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=academy-backup.json",
    },
  });
}
