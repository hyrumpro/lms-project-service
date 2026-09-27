import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { and, eq, like, or } from "drizzle-orm";
import { db } from "@/db";
import { courseInstructors, enrollments, lessons, resourceFiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { bearerToken, verifyLegacyToken } from "@/lib/jwt-legacy";

/**
 * GET /api/files/uploads/<bucket>/<file> — serves runtime-uploaded media for
 * the LOCAL storage driver (public/ is frozen at build time by `next start`).
 * Path is sanitized against traversal; only known buckets are reachable.
 * Access to protected buckets (lesson_files, resource_files) is auth-gated.
 */
const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm",
  ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".pdf": "application/pdf",
  ".zip": "application/zip", ".txt": "text/plain",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (segments.length !== 3 || segments[0] !== "uploads") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [bucket, file] = [segments[1], segments[2]];
  const safeBucket = /^(thumbnails|lesson_files|resource_files|blog|user_image|description-images)$/.test(bucket)
    ? bucket
    : null;
  const safeFile = /^[\w.-]+$/.test(file) && !file.includes("..") ? file : null;
  if (!safeBucket || !safeFile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "uploads", safeBucket, safeFile);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isProtected = safeBucket === "lesson_files" || safeBucket === "resource_files";

  if (isProtected) {
    const fileSuffix = `%${safeFile}`;
    const [lesson] = await db
      .select({
        courseId: lessons.courseId,
        isFreePreview: lessons.isFreePreview,
      })
      .from(lessons)
      .where(
        or(
          like(lessons.videoUrl, fileSuffix),
          like(lessons.audioUrl, fileSuffix),
          like(lessons.attachment, fileSuffix),
        ),
      )
      .limit(1);

    let courseId = lesson?.courseId;
    const isFreePreview = Boolean(lesson?.isFreePreview);

    if (!courseId) {
      const [res] = await db
        .select({ courseId: lessons.courseId })
        .from(resourceFiles)
        .innerJoin(lessons, eq(lessons.id, resourceFiles.lessonId))
        .where(like(resourceFiles.file, fileSuffix))
        .limit(1);
      courseId = res?.courseId;
    }

    if (courseId && !isFreePreview) {
      const session = await auth.api.getSession({ headers: await headers() });
      const bearer = bearerToken(_request);
      const legacyUserId = bearer ? (await verifyLegacyToken(bearer))?.userId : null;
      const actorId = session?.user.id ?? legacyUserId;
      if (!actorId) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      if (session?.user.role !== "admin") {
        const [enrollment] = await db
          .select({ id: enrollments.id, expiresAt: enrollments.expiresAt })
          .from(enrollments)
          .where(and(eq(enrollments.userId, actorId), eq(enrollments.courseId, courseId)))
          .limit(1);

        const isExpired = enrollment?.expiresAt && enrollment.expiresAt < new Date();
        const isEnrolled = Boolean(enrollment && !isExpired);

        if (!isEnrolled) {
          const [instructor] = await db
            .select({ instructorId: courseInstructors.instructorId })
            .from(courseInstructors)
            .where(and(eq(courseInstructors.courseId, courseId), eq(courseInstructors.instructorId, actorId)))
            .limit(1);
          if (!instructor) {
            return NextResponse.json({ error: "Enrollment required to access this file" }, { status: 403 });
          }
        }
      }
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(statSync(filePath).size),
      "Cache-Control": isProtected
        ? "private, no-cache, no-store, must-revalidate"
        : "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    },
  });
}
