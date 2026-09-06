import { NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * GET /api/files/uploads/<bucket>/<file> — serves runtime-uploaded media for
 * the LOCAL storage driver (public/ is frozen at build time by `next start`).
 * Path is sanitized against traversal; only known buckets are reachable.
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

  const ext = path.extname(filePath).toLowerCase();
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(statSync(filePath).size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    },
  });
}
