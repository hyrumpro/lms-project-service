import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cartItems,
  courses,
  orderItems,
  orders,
  payments,
  payouts,
  user,
} from "@/db/schema";

/** Commerce queries (cart, invoices, sales, payouts). */

export async function getCart(userId: string) {
  const rows = await db
    .select({ courseId: cartItems.courseId })
    .from(cartItems)
    .where(eq(cartItems.userId, userId));
  if (rows.length === 0) return [];
  return db
    .select()
    .from(courses)
    .where(inArray(courses.id, rows.map((r) => r.courseId)));
}

export async function getCartCount(userId: string): Promise<number> {
  const rows = await db
    .select({ courseId: cartItems.courseId })
    .from(cartItems)
    .where(eq(cartItems.userId, userId));
  return rows.length;
}

export async function getOrderForInvoice(userId: string, orderId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const [payment] = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
  return { order, items, payment: payment ?? null };
}

export async function getMyOrders(userId: string) {
  return db
    .select({
      id: orders.id,
      status: orders.status,
      total: orders.total,
      gateway: orders.gateway,
      giftToEmail: orders.giftToEmail,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
      itemCount: sql<number>`(select count(*) from ${orderItems} oi where oi.order_id = ${orders.id})::int`,
      titles: sql<string>`(select string_agg(oi.title_snapshot, ', ') from ${orderItems} oi where oi.order_id = ${orders.id})`,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

/** Instructor sales: two-step listing (order items → payments) without join gymnastics. */
export async function getInstructorSalesReport(instructorId: string) {
  const courseRows = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(
      sql`${courses.id} in (select course_id from course_instructors where instructor_id = ${instructorId})`,
    );
  if (courseRows.length === 0) return [];

  const items = await db
    .select({
      orderId: orderItems.orderId,
      courseId: orderItems.courseId,
      titleSnapshot: orderItems.titleSnapshot,
      unitPrice: orderItems.unitPrice,
    })
    .from(orderItems)
    .where(inArray(orderItems.courseId, courseRows.map((c) => c.id)));

  const orderIds = [...new Set(items.map((i) => i.orderId))];
  if (orderIds.length === 0) return [];

  const paymentRows = await db
    .select({
      orderId: payments.orderId,
      gateway: payments.gateway,
      createdAt: payments.createdAt,
      studentName: user.name,
    })
    .from(payments)
    .innerJoin(user, eq(user.id, payments.userId))
    .where(inArray(payments.orderId, orderIds));

  const courseTitle = new Map(courseRows.map((c) => [c.id, c.title]));
  return items
    .map((item) => {
      const payment = paymentRows.find((p) => p.orderId === item.orderId);
      if (!payment) return null;
      return {
        ...item,
        courseTitle: courseTitle.get(item.courseId) ?? item.titleSnapshot,
        gateway: payment.gateway,
        createdAt: payment.createdAt,
        studentName: payment.studentName,
        instructorRevenue: Math.round(item.unitPrice * 0.7),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getInstructorPayouts(instructorId: string) {
  return db
    .select()
    .from(payouts)
    .where(eq(payouts.instructorId, instructorId))
    .orderBy(desc(payouts.createdAt));
}

/** Total earned (sum of instructor revenue share across paid orders). */
export async function getInstructorEarnings(instructorId: string): Promise<number> {
  const report = await getInstructorSalesReport(instructorId);
  return report.reduce((sum, row) => sum + row.instructorRevenue, 0);
}
