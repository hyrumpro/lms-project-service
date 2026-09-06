"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  applications,
  coupons,
  courseInstructors,
  courses,
  customPages,
  enrollments,
  notifications,
  payouts,
  posts,
  reviews,
  user,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAccessAdminSection } from "@/server/queries/admin";
import { slugify } from "@/lib/slug";
import { fulfillOrder } from "@/server/services/checkout";
import { getSettings, systemSettingsSchema, frontendSettingsSchema } from "@/lib/settings";

export type AdminResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(section?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") return null;
  if (section && !(await canAccessAdminSection(session.user.id, section))) return null;
  return session;
}

/* ── moderation (legacy Admin::change_course_status_for_admin) ── */

export async function moderateCourse(courseId: string, status: "active" | "pending" | "draft"): Promise<AdminResult> {
  if (!(await requireAdmin('courses'))) return { ok: false, error: "forbidden" };
  const [course] = await db
    .update(courses)
    .set({ status, updatedAt: new Date() })
    .where(eq(courses.id, courseId))
    .returning({ title: courses.title });
  if (course && status === "active") {
    await notifyCourseOwners(courseId, "course_approved", `Approved: ${course.title}`, "Your course is now live.", "/studio/courses");
  }
  revalidatePath("/admin/courses");
  return { ok: true };
}

async function notifyCourseOwners(
  courseId: string,
  type: string,
  title: string,
  body: string,
  url: string,
) {
  const owners = await db
    .select({ instructorId: courseInstructors.instructorId })
    .from(courseInstructors)
    .where(eq(courseInstructors.courseId, courseId));
  if (owners.length > 0) {
    await db.insert(notifications).values(
      owners.map((o) => ({ userId: o.instructorId, type, title, body, url })),
    );
  }
}

/* ── users & applications ── */

export async function setUserInstructor(userId: string, isInstructor: boolean): Promise<AdminResult> {
  if (!(await requireAdmin('users'))) return { ok: false, error: "forbidden" };
  await db.update(user).set({ isInstructor, updatedAt: new Date() }).where(eq(user.id, userId));
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserDisabled(userId: string, disabled: boolean): Promise<AdminResult> {
  if (!(await requireAdmin('users'))) return { ok: false, error: "forbidden" };
  await db
    .update(user)
    .set({ status: disabled ? "disabled" : "active", updatedAt: new Date() })
    .where(eq(user.id, userId));
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function reviewApplication(applicationId: string, approve: boolean): Promise<AdminResult> {
  if (!(await requireAdmin('users'))) return { ok: false, error: "forbidden" };
  const [application] = await db
    .update(applications)
    .set({ status: approve ? "approved" : "rejected" })
    .where(eq(applications.id, applicationId))
    .returning({ userId: applications.userId });
  if (application && approve) {
    await db
      .update(user)
      .set({ isInstructor: true, updatedAt: new Date() })
      .where(eq(user.id, application.userId));
    await db.insert(notifications).values({
      userId: application.userId,
      type: "instructor_approved",
      title: "You're an instructor now!",
      body: "Your application was approved. Your studio is unlocked.",
      url: "/studio",
    });
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

/* ── enrollments (legacy Admin::enrol_student) ── */

const enrollSchema = z.object({ userEmail: z.string().email(), courseId: z.string().min(1) });

export async function enrollStudentManually(input: z.infer<typeof enrollSchema>): Promise<AdminResult> {
  if (!(await requireAdmin('courses'))) return { ok: false, error: "forbidden" };
  const parsed = enrollSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const [student] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, parsed.data.userEmail.toLowerCase()))
    .limit(1);
  if (!student) return { ok: false, error: "user_not_found" };
  await db
    .insert(enrollments)
    .values({ userId: student.id, courseId: parsed.data.courseId, source: "manual" })
    .onConflictDoNothing();
  await db.insert(notifications).values({
    userId: student.id,
    type: "course_enrolled",
    title: "You've been enrolled in a course",
    body: "An admin enrolled you — find it in My courses.",
    url: "/dashboard/my-courses",
  });
  revalidatePath("/admin");
  return { ok: true };
}

/* ── commerce ── */

export async function approveOfflineOrder(orderId: string): Promise<AdminResult> {
  if (!(await requireAdmin('commerce'))) return { ok: false, error: "forbidden" };
  const result = await fulfillOrder(orderId, { gateway: "offline", transactionId: `OFFLINE-${Date.now()}` });
  revalidatePath("/admin/commerce");
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "failed" };
}

export async function reviewPayout(payoutId: string, status: "approved" | "paid" | "rejected", reference?: string): Promise<AdminResult> {
  if (!(await requireAdmin('commerce'))) return { ok: false, error: "forbidden" };
  const [payout] = await db
    .update(payouts)
    .set({ status, reference: reference ?? null, paidAt: status === "paid" ? new Date() : null })
    .where(eq(payouts.id, payoutId))
    .returning({ instructorId: payouts.instructorId, amount: payouts.amount });
  if (payout) {
    await db.insert(notifications).values({
      userId: payout.instructorId,
      type: "payout_" + status,
      title: `Payout ${status}`,
      body: `Your withdrawal request is now ${status}.`,
      url: "/studio/payouts",
    });
  }
  revalidatePath("/admin/commerce");
  return { ok: true };
}

/* ── coupons ── */

const couponSchema = z.object({
  code: z.string().trim().min(3).max(30),
  discountPercentage: z.coerce.number().int().min(1).max(100),
});

export async function createCoupon(input: z.infer<typeof couponSchema>): Promise<AdminResult> {
  if (!(await requireAdmin('content'))) return { ok: false, error: "forbidden" };
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await db
    .insert(coupons)
    .values({ code: parsed.data.code.toUpperCase(), discountPercentage: parsed.data.discountPercentage })
    .onConflictDoNothing();
  revalidatePath("/admin/content");
  return { ok: true };
}

export async function deleteCoupon(couponId: string): Promise<AdminResult> {
  if (!(await requireAdmin('content'))) return { ok: false, error: "forbidden" };
  await db.delete(coupons).where(eq(coupons.id, couponId));
  revalidatePath("/admin/content");
  return { ok: true };
}

/* ── reviews / custom pages / home builder / settings ── */

export async function moderatePost(postId: string, status: "published" | "draft"): Promise<AdminResult> {
  if (!(await requireAdmin('content'))) return { ok: false, error: "forbidden" };
  const [post] = await db
    .update(posts)
    .set({ status })
    .where(eq(posts.id, postId))
    .returning({ title: posts.title, authorId: posts.authorId });
  if (post && status === "published") {
    await db.insert(notifications).values({
      userId: post.authorId,
      type: "post_approved",
      title: `Published: ${post.title}`,
      body: "Your blog post is now live.",
      url: "/blog",
    });
  }
  revalidatePath("/admin/content");
  revalidatePath("/blog");
  return { ok: true };
}

export async function deleteReview(reviewId: string): Promise<AdminResult> {
  if (!(await requireAdmin('content'))) return { ok: false, error: "forbidden" };
  await db.delete(reviews).where(eq(reviews.id, reviewId));
  revalidatePath("/admin/content");
  return { ok: true };
}

const pageSchema = z.object({
  title: z.string().trim().min(2).max(120),
  content: z.string().min(2),
});

export async function createCustomPage(input: z.infer<typeof pageSchema>): Promise<AdminResult> {
  if (!(await requireAdmin('content'))) return { ok: false, error: "forbidden" };
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await db.insert(customPages).values({
    title: parsed.data.title,
    url: slugify(parsed.data.title),
    content: parsed.data.content,
  });
  revalidatePath("/admin/content");
  return { ok: true };
}

export async function saveHomeSections(sections: unknown): Promise<AdminResult> {
  if (!(await requireAdmin('content'))) return { ok: false, error: "forbidden" };
  const { homePageConfigs } = await import("@/db/schema");
  const [config] = await db
    .select()
    .from(homePageConfigs)
    .where(eq(homePageConfigs.identifier, "default"))
    .limit(1);
  if (!config) return { ok: false, error: "not_found" };
  await db
    .update(homePageConfigs)
    .set({ sections: sections as never, updatedAt: new Date() })
    .where(eq(homePageConfigs.id, config.id));
  revalidatePath("/");
  return { ok: true };
}

const settingsSchema = z.object({
  system: systemSettingsSchema.partial().optional(),
  frontend: frontendSettingsSchema.partial().optional(),
});

export async function saveSettings(input: z.infer<typeof settingsSchema>): Promise<AdminResult> {
  if (!(await requireAdmin('content'))) return { ok: false, error: "forbidden" };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  for (const [key, schema] of [
    ["system", systemSettingsSchema],
    ["frontend", frontendSettingsSchema],
  ] as const) {
    const patch = parsed.data[key];
    if (!patch) continue;
    const current = await getSettings(key, schema);
    const { settings } = await import("@/db/schema");
    await db
      .insert(settings)
      .values({ key, value: { ...current, ...patch } })
      .onConflictDoUpdate({ target: settings.key, set: { value: { ...current, ...patch } } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ── granular admin permissions (legacy permissions page) ── */

const SECTIONS = ['categories', 'courses', 'users', 'commerce', 'content', 'newsletters'] as const;

export async function setAdminFlags(targetUserId: string, flags: Record<string, boolean>): Promise<AdminResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== 'admin') return { ok: false, error: 'forbidden' };
  if (targetUserId === session.user.id) return { ok: false, error: 'Cannot change your own access — ask another admin.' };
  const clean = Object.fromEntries(
    Object.entries(flags).filter(([k]) => (SECTIONS as readonly string[]).includes(k)),
  );
  const { adminPermissions } = await import('@/db/schema');
  await db
    .insert(adminPermissions)
    .values({ userId: targetUserId, flags: clean })
    .onConflictDoUpdate({ target: adminPermissions.userId, set: { flags: clean } });
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function deleteCustomPage(id: string): Promise<AdminResult> {
  if (!(await requireAdmin('content'))) return { ok: false, error: 'forbidden' };
  await db.delete(customPages).where(eq(customPages.id, id));
  revalidatePath('/admin/content');
  return { ok: true };
}
