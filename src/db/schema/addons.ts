import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { courses } from "./catalog";

export const bundles = pgTable("bundles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  price: integer("price").notNull().default(0),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bundleCourses = pgTable(
  "bundle_courses",
  {
    bundleId: text("bundle_id").notNull().references(() => bundles.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  },
  (t) => [unique("bundle_courses_unique").on(t.bundleId, t.courseId)],
);

export const ebooks = pgTable("ebooks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  price: integer("price").notNull().default(0),
  summary: text("summary"),
  fileUrl: text("file_url"),
  category: text("category"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tutors = pgTable("tutors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  hourlyRate: integer("hourly_rate").notNull().default(0),
  bio: text("bio"),
});

export const tutorSlots = pgTable("tutor_slots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tutorId: text("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
});

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slotId: text("slot_id").notNull().references(() => tutorSlots.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ebookPurchases = pgTable(
  "ebook_purchases",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    ebookId: text("ebook_id").notNull().references(() => ebooks.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("ebook_purchases_unique").on(t.ebookId, t.userId)],
);

export const affiliates = pgTable("affiliates", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  commissionPercent: integer("commission_percent").notNull().default(10),
});

export const bundlesRelations = relations(bundles, ({ many }) => ({
  courses: many(bundleCourses),
}));
