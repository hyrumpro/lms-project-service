import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  cartItems,
  coupons,
  courseProgress,
  courses,
  courseInstructors,
  enrollments,
  notifications,
  orderItems,
  orders,
  payments,
  user,
} from "@/db/schema";
import { getSystemSettings } from "@/lib/settings";

/**
 * Checkout engine (spec §7.5). Money in minor units.
 * Coupon math per §3.9: coupon applies to the already-discounted price.
 */

export type PricedLine = {
  courseId: string;
  title: string;
  listPrice: number; // sticker price (minor units)
  payable: number; // after course-level discount, before coupon
  couponDiscount: number; // this line's share of the coupon
  net: number; // payable - couponDiscount
};

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number;
  couponDiscount: number;
  tax: number;
  total: number;
};

export function effectiveCoursePrice(course: {
  isFree: boolean;
  price: number;
  discountEnabled: boolean;
  discountedPrice: number;
}): number {
  if (course.isFree) return 0;
  if (course.discountEnabled && course.discountedPrice > 0) return course.discountedPrice;
  return course.price;
}

/** §3.9: price_with_course_discount − (price_with_course_discount × pct / 100) */
export function priceCart(
  courseRows: (typeof courses.$inferSelect)[],
  coupon: { discountPercentage: number } | null,
  taxPercent: number,
): PricedCart {
  const lines: PricedLine[] = courseRows.map((course) => {
    const payable = effectiveCoursePrice(course);
    const couponDiscount = coupon
      ? Math.floor((payable * coupon.discountPercentage) / 100)
      : 0;
    return {
      courseId: course.id,
      title: course.title,
      listPrice: course.isFree ? 0 : course.price,
      payable,
      couponDiscount,
      net: payable - couponDiscount,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.listPrice, 0);
  const couponDiscountTotal = lines.reduce((s, l) => s + l.couponDiscount, 0);
  const taxable = lines.reduce((s, l) => s + l.net, 0);
  const tax = Math.floor((taxable * taxPercent) / 100);

  return {
    lines,
    subtotal,
    couponDiscount: couponDiscountTotal,
    tax,
    total: taxable + tax,
  };
}

export async function findValidCoupon(code: string) {
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code.toUpperCase()))
    .limit(1);
  if (!coupon) return null;
  if (coupon.expiryDate && coupon.expiryDate < new Date()) return null;
  return coupon;
}

export type CreateOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

export async function createOrder(input: {
  userId: string;
  courseIds: string[];
  couponCode?: string | null;
  giftToEmail?: string | null;
  gateway: string;
}): Promise<CreateOrderResult> {
  if (input.courseIds.length === 0) return { ok: false, error: "empty_cart" };

  const courseRows = await db
    .select()
    .from(courses)
    .where(inArray(courses.id, input.courseIds));
  if (courseRows.length !== input.courseIds.length) return { ok: false, error: "not_found" };
  if (courseRows.some((c) => c.status !== "active")) return { ok: false, error: "unavailable" };

  const isGift = Boolean(input.giftToEmail);
  if (!isGift) {
    const existing = await db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(
        and(eq(enrollments.userId, input.userId), inArray(enrollments.courseId, input.courseIds)),
      );
    if (existing.length > 0) return { ok: false, error: "already_enrolled" };
  }

  const freeItemsOnly = courseRows.every((c) => effectiveCoursePrice(c) === 0);
  if (freeItemsOnly) return { ok: false, error: "use_free_enrollment" };

  const coupon = input.couponCode ? await findValidCoupon(input.couponCode) : null;
  if (input.couponCode && !coupon) return { ok: false, error: "invalid_coupon" };

  const system = await getSystemSettings();
  const cart = priceCart(courseRows, coupon, system.courseSellingTax);

  const [order] = await db
    .insert(orders)
    .values({
      userId: input.userId,
      status: input.gateway === "offline" ? "pending_review" : "pending",
      gateway: input.gateway,
      subtotal: cart.subtotal,
      discount: cart.couponDiscount,
      tax: cart.tax,
      total: cart.total,
      couponId: coupon?.id ?? null,
      giftToEmail: input.giftToEmail?.toLowerCase() ?? null,
    })
    .returning({ id: orders.id });

  await db.insert(orderItems).values(
    cart.lines.map((line) => ({
      orderId: order.id,
      courseId: line.courseId,
      titleSnapshot: line.title,
      unitPrice: line.net,
    })),
  );

  return { ok: true, orderId: order.id };
}

/**
 * Idempotent fulfillment: payment row with revenue split, enrollments
 * (buyer or gift recipient), notifications, cart clear (spec §7.5).
 */
export async function fulfillOrder(
  orderId: string,
  opts: { transactionId?: string; gateway?: string } = {},
): Promise<{ ok: boolean; error?: string }> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { ok: false, error: "not_found" };
  if (order.status === "paid") return { ok: true }; // idempotent webhook replay

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const courseRows = await db
    .select()
    .from(courses)
    .where(inArray(courses.id, items.map((i) => i.courseId)));

  const system = await getSystemSettings();
  const percent = system.instructorRevenuePercent;

  // revenue split per course (owner gets instructor share of that course's net + tax)
  const instructorShare = courseRows.reduce((sum, course) => {
    const line = items.find((i) => i.courseId === course.id);
    if (!line) return sum;
    const lineTax = order.total > 0 ? Math.floor((line.unitPrice / (order.total - order.tax || 1)) * order.tax) : 0;
    return sum + Math.round(line.unitPrice * (percent / 100)) + lineTax;
  }, 0);
  const adminShare = order.total - instructorShare;

  await db.insert(payments).values({
    orderId,
    userId: order.userId,
    gateway: opts.gateway ?? order.gateway ?? "mock",
    amount: order.total,
    tax: order.tax,
    adminRevenue: adminShare,
    instructorRevenue: instructorShare,
    transactionId: opts.transactionId,
  });

  await db
    .update(orders)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(orders.id, orderId));

  // enroll buyer — or the gift recipient when the email matches an account
  let recipientId = order.userId;
  if (order.giftToEmail) {
    const [recipient] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, order.giftToEmail))
      .limit(1);
    recipientId = recipient?.id ?? order.userId;
  }

  await db
    .insert(enrollments)
    .values(
      courseRows.map((course) => ({
        userId: recipientId,
        courseId: course.id,
        source: order.giftToEmail ? ("gift" as const) : ("purchase" as const),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(courseProgress)
    .values(courseRows.map((course) => ({ userId: recipientId, courseId: course.id })))
    .onConflictDoNothing();

  await db.insert(notifications).values({
    userId: order.userId,
    type: "course_purchase",
    title: order.giftToEmail ? "Your gift is sent!" : "Purchase complete",
    body: `Order total ${(order.total / 100).toFixed(2)} ${system.currencyCode}. ${
      order.giftToEmail && recipientId === order.userId
        ? `The recipient ${order.giftToEmail} has no account yet — they'll get access once they sign up with that email.`
        : "The courses are in your library."
    }`,
    url: "/dashboard/purchases",
  });

  await db.delete(cartItems).where(eq(cartItems.userId, order.userId));
  return { ok: true };
}

/** Instructor of record for revenue (first/owner instructor, legacy parity). */
export async function courseOwnerId(courseId: string): Promise<string | null> {
  const [row] = await db
    .select({ instructorId: courseInstructors.instructorId })
    .from(courseInstructors)
    .where(and(eq(courseInstructors.courseId, courseId), eq(courseInstructors.isOwner, true)))
    .limit(1);
  return row?.instructorId ?? null;
}
