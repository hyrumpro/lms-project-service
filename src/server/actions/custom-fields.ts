"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { courses, settings } from "@/db/schema";
import { auth } from "@/lib/auth";

const fieldSchema = z.object({
  section: z.string().min(1).max(80),
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
});

export async function saveCustomField(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/sign-in");
  const parsed = fieldSchema.safeParse({
    section: String(formData.get("section") ?? ""),
    key: String(formData.get("key") ?? ""),
    label: String(formData.get("label") ?? ""),
  });
  if (!parsed.success) return;
  const [row] = await db.select().from(settings).where(eq(settings.key, "custom_fields"));
  const list = Array.isArray(row?.value) ? (row.value as { section: string; key: string; label: string }[]) : [];
  list.push(parsed.data);
  await db
    .insert(settings)
    .values({ key: "custom_fields", value: list })
    .onConflictDoUpdate({ target: settings.key, set: { value: list } });
  redirect("/admin/custom-fields");
}

export async function setCourseFieldValue(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/sign-in");
  const courseId = String(formData.get("courseId") ?? "");
  const key = String(formData.get("key") ?? "");
  const value = String(formData.get("value") ?? "");
  if (!courseId || !key) return;
  const [course] = await db.select({ customFieldValues: courses.customFieldValues }).from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return;
  await db
    .update(courses)
    .set({ customFieldValues: { ...(course.customFieldValues ?? {}), [key]: value } })
    .where(eq(courses.id, courseId));
  redirect("/admin/custom-fields");
}
