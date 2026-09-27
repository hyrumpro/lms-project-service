import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Storage abstraction (spec §4.4). LOCAL driver writes under ./uploads (git-ignored), served via /api/files/[...path]
 * (public/ is frozen at build time by next start). For serverless/S3, implement the S3
 * branch (presigned PUT) — the call sites only ever see a public URL.
 */

export const UPLOAD_BUCKETS = ["thumbnails", "lesson_files", "resource_files", "blog", "user_image", "description-images"] as const;
export type UploadBucket = (typeof UPLOAD_BUCKETS)[number];

export const MAX_SIZE_BYTES: Record<UploadBucket, number> = {
  thumbnails: 5 * 1024 * 1024,
  lesson_files: 512 * 1024 * 1024,
  resource_files: 100 * 1024 * 1024,
  blog: 10 * 1024 * 1024,
  user_image: 5 * 1024 * 1024,
  "description-images": 5 * 1024 * 1024,
};

const ALLOWED_MIME: Record<UploadBucket, RegExp> = {
  thumbnails: /^image\/(jpeg|png|webp|gif|avif)$/,
  lesson_files: /^(video\/(mp4|webm|quicktime)|audio\/(mpeg|mp4|ogg))$/,
  resource_files: /^(application\/pdf|image\/(jpeg|png|webp)|application\/(zip|octet-stream)|text\/plain)/,
  blog: /^image\/(jpeg|png|webp|gif)$/,
  user_image: /^image\/(jpeg|png|webp|gif|avif)$/,
  "description-images": /^image\/(jpeg|png|webp|gif)$/,
};

export function validateUpload(bucket: UploadBucket, file: File): string | null {
  if (!ALLOWED_MIME[bucket].test(file.type)) return `Unsupported file type: ${file.type || "unknown"}`;
  if (file.size > MAX_SIZE_BYTES[bucket]) return `File too large (max ${Math.round(MAX_SIZE_BYTES[bucket] / 1024 / 1024)} MB)`;
  return null;
}

/** Saves the file and returns its public URL (LOCAL driver). */
export async function saveUpload(bucket: UploadBucket, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const key = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "uploads", bucket);

  if (process.env.STORAGE_DRIVER === "s3") {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const bucketName = process.env.S3_BUCKET;
    if (!bucketName) throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3");
    const client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
    const body = Buffer.from(await file.arrayBuffer());
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: `${bucket}/${key}`,
        Body: body,
        ContentType: file.type,
      }),
    );
    const base = process.env.S3_PUBLIC_BASE ?? "";
    return base ? `${base}/${bucket}/${key}` : `/api/files/uploads/${bucket}/${key}`;
  }

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), Buffer.from(await file.arrayBuffer()));
  return `/api/files/uploads/${bucket}/${key}`;
}

function s3Client() {
  return import("@aws-sdk/client-s3").then(({ S3Client }) =>
    new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    }),
  );
}

export async function presignUpload(bucket: UploadBucket, fileName: string, contentType: string) {
  if (process.env.STORAGE_DRIVER !== "s3") return null;
  const bucketName = process.env.S3_BUCKET;
  if (!bucketName) return null;
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const key = `${bucket}/${Date.now().toString(36)}-${fileName.replace(/[^\w.-]/g, "")}`;
  const client = await s3Client();
  const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType }), {
    expiresIn: 600,
  });
  return { url, key };
}

export async function signedReadUrl(key: string) {
  if (process.env.STORAGE_DRIVER !== "s3") return null;
  const bucketName = process.env.S3_BUCKET;
  if (!bucketName) return null;
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await s3Client();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucketName, Key: key }), { expiresIn: 3600 });
}
