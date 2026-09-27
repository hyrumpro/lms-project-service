import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { courses } from "./catalog";

/**
 * Commerce domain — legacy tables: payment, payment_gateways, coupons,
 * payout, currency (spec §5, §7.5). Money in minor units.
 */

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "pending_review", // offline payment awaiting admin approval
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "requested",
  "approved",
  "paid",
  "rejected",
]);

export const coupons = pgTable("coupons", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  discountPercentage: integer("discount_percentage").notNull(), // 1..100
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: orderStatusEnum("status").notNull().default("pending"),
  gateway: text("gateway"), // mock | stripe | paypal | razorpay | offline
  gatewaySessionId: text("gateway_session_id"),
  subtotal: integer("subtotal").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  total: integer("total").notNull().default(0),
  couponId: text("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
  /** gift checkout: enrollments go to this email (legacy gifting) */
  giftToEmail: text("gift_to_email"),
  affiliateCode: text("affiliate_code"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  titleSnapshot: text("title_snapshot").notNull(),
  unitPrice: integer("unit_price").notNull(),
});

export const payments = pgTable("payments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  gateway: text("gateway").notNull(),
  amount: integer("amount").notNull(),
  tax: integer("tax").notNull().default(0),
  /** revenue split at purchase time (legacy payment.admin_revenue / instructor_revenue) */
  adminRevenue: integer("admin_revenue").notNull().default(0),
  instructorRevenue: integer("instructor_revenue").notNull().default(0),
  transactionId: text("transaction_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gatewayConfigs = pgTable("gateway_configs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  identifier: text("identifier").notNull().unique(), // mock | stripe | paypal | razorpay | offline
  title: text("title").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  testMode: boolean("test_mode").notNull().default(true),
  /** provider keys — encrypt at rest before production use */
  keys: jsonb("keys").$type<Record<string, string>>(),
});

export const payouts = pgTable("payouts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  method: text("method").notNull().default("paypal"),
  status: payoutStatusEnum("status").notNull().default("requested"),
  reference: text("reference"),
  note: text("note"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Simple signed-in cart (legacy used session cart; spec §7.5). */
export const cartItems = pgTable(
  "cart_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("cart_user_course_unique").on(t.userId, t.courseId)],
);

export type Coupon = typeof coupons.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
