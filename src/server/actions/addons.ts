"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  affiliates,
  bookings,
  bundleCourses,
  bundles,
  courses,
  ebookPurchases,
  ebooks,
  enrollments,
  orderItems,
  orders,
  tutorSlots,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSystemSettings } from "@/lib/settings";
import { fulfillOrder } from "@/server/services/checkout";

async function userId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function purchaseBundle(slug: string, affiliateCode?: string) {
  const buyerId = await userId();
  if (!buyerId) return { ok: false as const, error: "auth_required" };
  const parsed = z.string().min(1).safeParse(slug);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const [bundle] = await db.select().from(bundles).where(eq(bundles.slug, parsed.data)).limit(1);
  if (!bundle) return { ok: false as const, error: "not_found" };
  const included = await db
    .select({ id: courses.id, title: courses.title, expiryPeriod: courses.expiryPeriod })
    .from(bundleCourses)
    .innerJoin(courses, eq(courses.id, bundleCourses.courseId))
    .where(eq(bundleCourses.bundleId, bundle.id));
  if (included.length === 0) return { ok: false as const, error: "empty" };

  const share = Math.floor(bundle.price / included.length);
  const [order] = await db
    .insert(orders)
    .values({
      userId: buyerId,
      status: "pending",
      gateway: bundle.price === 0 ? "coupon_zero" : "bundle",
      subtotal: bundle.price,
      total: bundle.price,
      affiliateCode: affiliateCode || null,
    })
    .returning({ id: orders.id });
  await db.insert(orderItems).values(
    included.map((course, index) => ({
      orderId: order.id,
      courseId: course.id,
      titleSnapshot: course.title,
      unitPrice: index === included.length - 1 ? bundle.price - share * (included.length - 1) : share,
    })),
  );
  const result = await fulfillOrder(order.id, { gateway: "bundle", enrollmentSource: "bundle" });
  revalidatePath("/dashboard/my-courses");
  return result.ok ? { ok: true as const, orderId: order.id } : { ok: false as const, error: result.error ?? "failed" };
}

export async function purchaseEbook(slug: string) {
  const buyerId = await userId();
  if (!buyerId) return { ok: false as const, error: "auth_required" };
  const [ebook] = await db.select().from(ebooks).where(eq(ebooks.slug, slug)).limit(1);
  if (!ebook) return { ok: false as const, error: "not_found" };
  if (ebook.price > 0) {
    const [order] = await db
      .insert(orders)
      .values({
        userId: buyerId,
        status: "pending",
        gateway: "ebook",
        subtotal: ebook.price,
        total: ebook.price,
      })
      .returning({ id: orders.id });
    return { ok: true as const, orderId: order.id, pending: true as const };
  }
  await db.insert(ebookPurchases).values({ ebookId: ebook.id, userId: buyerId }).onConflictDoNothing();
  revalidatePath("/ebooks");
  return { ok: true as const, pending: false as const };
}

export async function bookTutorSlot(slotId: string) {
  const studentId = await userId();
  if (!studentId) return { ok: false as const, error: "auth_required" };
  const parsed = z.string().min(1).safeParse(slotId);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const [slot] = await db.select().from(tutorSlots).where(eq(tutorSlots.id, parsed.data)).limit(1);
  if (!slot) return { ok: false as const, error: "not_found" };
  const [taken] = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.slotId, slot.id)).limit(1);
  if (taken) return { ok: false as const, error: "taken" };
  await db.insert(bookings).values({ slotId: slot.id, studentId });
  revalidatePath("/dashboard/bookings");
  revalidatePath("/tutors");
  return { ok: true as const };
}

export async function ensureAffiliateCode() {
  const id = await userId();
  if (!id) return { ok: false as const, error: "auth_required" };
  const [existing] = await db.select().from(affiliates).where(eq(affiliates.userId, id)).limit(1);
  if (existing) return { ok: true as const, code: existing.code };
  const system = await getSystemSettings();
  const code = `AFF${id.slice(0, 6).toUpperCase()}`;
  await db.insert(affiliates).values({
    userId: id,
    code,
    commissionPercent: system.affiliateCommissionPercent,
  });
  return { ok: true as const, code };
}

export async function readerOwnsEbook(userIdValue: string, ebookId: string) {
  const [row] = await db
    .select({ id: ebookPurchases.id })
    .from(ebookPurchases)
    .where(and(eq(ebookPurchases.userId, userIdValue), eq(ebookPurchases.ebookId, ebookId)))
    .limit(1);
  return Boolean(row);
}

export async function purchaseBundleForm(formData: FormData) {
  const result = await purchaseBundle(String(formData.get("slug") ?? ""), String(formData.get("affiliate") ?? ""));
  if (!result.ok) return;
  redirect(`/dashboard/invoices/${result.orderId}`);
}

export async function purchaseEbookForm(formData: FormData) {
  const result = await purchaseEbook(String(formData.get("slug") ?? ""));
  if (!result.ok) return;
  if ("orderId" in result && result.orderId) redirect(`/dashboard/invoices/${result.orderId}`);
  redirect("/ebooks");
}

export async function bookTutorSlotForm(formData: FormData) {
  const result = await bookTutorSlot(String(formData.get("slotId") ?? ""));
  if (result.ok) redirect("/dashboard/bookings");
}

export async function enrolledFromBundle(userIdValue: string, courseId: string) {
  const [row] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userIdValue), eq(enrollments.courseId, courseId), eq(enrollments.source, "bundle")))
    .limit(1);
  return Boolean(row);
}
