"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { cartItems, courses, enrollments } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  createOrder,
  findValidCoupon,
  fulfillOrder,
  priceCart,
} from "@/server/services/checkout";
import { getSystemSettings } from "@/lib/settings";

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function addToCart(courseId: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };
  await db.insert(cartItems).values({ userId, courseId }).onConflictDoNothing();
  revalidatePath("/dashboard/shopping-cart");
  return { ok: true };
}

export async function removeFromCart(courseId: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  await db
    .delete(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.courseId, courseId)));
  revalidatePath("/dashboard/shopping-cart");
}

export async function buyNow(courseId: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) redirect("/sign-in");
  redirect(`/dashboard/shopping-cart?buy=${courseId}`);
}

const couponInput = z.object({ code: z.string().min(2).max(40), subtotal: z.number().int() });

export async function checkCoupon(input: z.infer<typeof couponInput>) {
  const parsed = couponInput.safeParse(input);
  if (!parsed.success) return { valid: false as const, discount: 0, message: "Invalid code" };
  const coupon = await findValidCoupon(parsed.data.code);
  if (!coupon) return { valid: false as const, discount: 0, message: "Code not found or expired" };
  const discount = Math.floor((parsed.data.subtotal * coupon.discountPercentage) / 100);
  return {
    valid: true as const,
    discount,
    percentage: coupon.discountPercentage,
    message: `${coupon.discountPercentage}% off applied`,
  };
}

const checkoutSchema = z.object({
  gateway: z.enum(["mock", "offline"]),
  couponCode: z.string().max(40).optional().nullable(),
  giftToEmail: z.string().email().optional().nullable(),
  buyNowCourseId: z.string().optional().nullable(),
});

export async function startCheckout(
  input: z.infer<typeof checkoutSchema>,
): Promise<{ ok: boolean; error?: string; orderId?: string; total?: number }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };

  let courseIds: string[] = [];
  if (input.buyNowCourseId) {
    courseIds = [input.buyNowCourseId];
  } else {
    const rows = await db
      .select({ courseId: cartItems.courseId })
      .from(cartItems)
      .where(eq(cartItems.userId, userId));
    courseIds = rows.map((r) => r.courseId);
  }

  const result = await createOrder({
    userId,
    courseIds,
    couponCode: input.couponCode || null,
    giftToEmail: input.giftToEmail || null,
    gateway: input.gateway,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const { orders } = await import("@/db/schema");
  const [order] = await db.select().from(orders).where(eq(orders.id, result.orderId)).limit(1);

  // free after coupon → skip gateway entirely (legacy coupon_offer_100_percent)
  if (order && order.total === 0) {
    await fulfillOrder(order.id, { gateway: "coupon_zero" });
    revalidatePath("/dashboard/purchases");
    return { ok: true, orderId: order.id, total: 0 };
  }

  return { ok: true, orderId: result.orderId, total: order?.total };
}

/** Mock gateway "payment" — dev/demo only, guarded by gateway type. */
export async function mockPay(orderId: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) redirect("/sign-in");
  const { orders } = await import("@/db/schema");
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.userId !== userId || order.gateway !== "mock") redirect("/dashboard");
  await fulfillOrder(orderId, { transactionId: `MOCK-${Date.now()}`, gateway: "mock" });
  revalidatePath("/dashboard/purchases");
  redirect(`/dashboard/invoices/${orderId}`);
}

export async function cancelOrder(orderId: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) redirect("/sign-in");
  const { orders } = await import("@/db/schema");
  await db
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId), eq(orders.status, "pending")));
  redirect("/dashboard/shopping-cart");
}

export async function enrollFreeDirect(courseId: string): Promise<void> {
  // legacy Home::get_enrolled_to_free_course for course-page free CTA
  const userId = await requireUserId();
  if (!userId) redirect("/sign-in");
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return;
  const [existing] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  if (!existing) {
    await db.insert(enrollments).values({ userId, courseId, source: "free" }).onConflictDoNothing();
    revalidatePath("/dashboard/my-courses");
  }
  redirect(`/learn/${courseId}`);
}
