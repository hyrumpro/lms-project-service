/**
 * E2E purchase verification (M4): coupon math → order → fulfillment →
 * revenue split → enrollment → idempotent replay. Run:
 *   DATABASE_URL=… npx tsx scripts/test-purchase.ts [email] [courseSlug] [coupon]
 */
import { db } from "../src/db";
import { courses, user, orders, payments, enrollments } from "../src/db/schema";
import { createOrder, fulfillOrder, findValidCoupon } from "../src/server/services/checkout";
import { eq } from "drizzle-orm";

const [email = "maria@academy-next.test", slug = "react-from-scratch", couponCode = "WELCOME10"] =
  process.argv.slice(2);

(async () => {
  const [buyer] = await db.select().from(user).where(eq(user.email, email));
  const [course] = await db.select().from(courses).where(eq(courses.slug, slug));
  const coupon = await findValidCoupon(couponCode);
  console.log(`buyer=${email} course=${slug} coupon=${coupon?.code} ${coupon?.discountPercentage}%`);

  const order = await createOrder({
    userId: buyer.id,
    courseIds: [course.id],
    couponCode,
    gateway: "mock",
  });
  if (!order.ok) {
    console.log("createOrder failed:", order.error);
    process.exit(1);
  }
  const [row] = await db.select().from(orders).where(eq(orders.id, order.orderId));
  console.log("order:", { subtotal: row.subtotal, discount: row.discount, total: row.total });

  await fulfillOrder(order.orderId, { transactionId: "TEST-E2E", gateway: "mock" });
  const [pay] = await db.select().from(payments).where(eq(payments.orderId, order.orderId));
  console.log("revenue split: admin", pay.adminRevenue, "/ instructor", pay.instructorRevenue);

  const enrollment = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.userId, buyer.id));
  console.log("enrollments for buyer:", enrollment.length);
  console.log("idempotent replay:", JSON.stringify(await fulfillOrder(order.orderId, {})));
  process.exit(0);
})();
