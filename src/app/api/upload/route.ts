import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { UPLOAD_BUCKETS, validateUpload, saveUpload, type UploadBucket } from "@/lib/storage";
import { auth } from "@/lib/auth";

/**
 * POST /api/upload — multipart file upload (course builder media, avatars).
 * Auth: signed-in; non-instructors may only upload to user_image.
 * Returns { url } — the public path (LOCAL driver) to store on the entity.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Sign in to upload files." }, { status: 401 });
  }

  const isInstructor = session.user.isInstructor || session.user.role === "admin";

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });

  const bucket = String(form.get("bucket") ?? "") as UploadBucket;
  if (!UPLOAD_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: `Unknown bucket "${bucket}".` }, { status: 400 });
  }
  if (bucket !== "user_image" && !isInstructor) {
    return NextResponse.json({ error: "Instructor access required for course media." }, { status: 403 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const invalid = validateUpload(bucket, file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 415 });

  try {
    const url = await saveUpload(bucket, file);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[upload]", error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
