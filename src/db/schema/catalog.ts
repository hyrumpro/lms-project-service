import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Catalog domain — legacy tables: category, course, section, lesson,
 * question, resource_files (see NEXTJS-CLONE-BUILD-SPEC.md §5).
 * Money is stored in minor units (integer cents).
 */

export const courseStatusEnum = pgEnum("course_status", ["draft", "pending", "active"]);

export const lessonTypeEnum = pgEnum("lesson_type", [
  "video",
  "audio",
  "document",
  "text",
  "quiz",
]);

export const videoProviderEnum = pgEnum("video_provider", [
  "html5",
  "youtube",
  "vimeo",
  "iframe",
  "external",
  "s3",
  "wasabi",
  "google_drive",
  "stream",
]);

export type Faq = { question: string; answer: string };

/** Drip-content unlock rule for a section (legacy section.restricted_by). */
export type UnlockRule =
  | { kind: "date"; date: string }
  | { kind: "prevSection" }
  | { kind: "daysAfterEnroll"; days: number };

export const categories = pgTable("categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  parentId: text("parent_id").references((): AnyPgColumn => categories.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon"),
  thumbnail: text("thumbnail"),
  subThumbnail: text("sub_thumbnail"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courses = pgTable("courses", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  legacyId: integer("legacy_id"),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(), // URL: /course/{slug}-{id}
  shortDescription: text("short_description"),
  description: text("description"),
  outcomes: jsonb("outcomes").$type<string[]>(),
  requirements: jsonb("requirements").$type<string[]>(),
  faqs: jsonb("faqs").$type<Faq[]>(),
  language: text("language").notNull().default("English"),
  level: text("level").notNull().default("beginner"),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  status: courseStatusEnum("status").notNull().default("draft"),
  // pricing (legacy course columns; minor units)
  isFree: boolean("is_free").notNull().default(false),
  price: integer("price").notNull().default(0),
  discountEnabled: boolean("discount_enabled").notNull().default(false),
  discountedPrice: integer("discounted_price").notNull().default(0),
  // media
  thumbnail: text("thumbnail"),
  promoVideoUrl: text("promo_video_url"),
  promoVideoProvider: videoProviderEnum("promo_video_provider"),
  // meta & access rules
  expiryPeriod: integer("expiry_period"), // days; null = forever
  enableDripContent: boolean("enable_drip_content").notNull().default(false),
  publishDate: timestamp("publish_date", { withTimezone: true }),
  isTopCourse: boolean("is_top_course").notNull().default(false),
  createdByAdmin: boolean("created_by_admin").notNull().default(false),
  multiInstructor: boolean("multi_instructor").notNull().default(false),
  metaKeywords: text("meta_keywords"),
  metaDescription: text("meta_description"),
  customFieldValues: jsonb("custom_field_values").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Replaces legacy comma-separated course.user_id (spec §3.7). */
export const courseInstructors = pgTable(
  "course_instructors",
  {
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    instructorId: text("instructor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    isOwner: boolean("is_owner").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.instructorId] })],
);

export const sections = pgTable("sections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  order: integer("order").notNull().default(0),
  unlockRule: jsonb("unlock_rule").$type<UnlockRule>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lessons = pgTable("lessons", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  legacyId: integer("legacy_id"),
  title: text("title").notNull(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  sectionId: text("section_id")
    .notNull()
    .references(() => sections.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  type: lessonTypeEnum("type").notNull(),
  // video lessons
  videoProvider: videoProviderEnum("video_provider"),
  videoUrl: text("video_url"),
  cloudVideoId: text("cloud_video_id"),
  // audio / document / text
  audioUrl: text("audio_url"),
  attachment: text("attachment"),
  attachmentType: text("attachment_type"),
  caption: text("caption"), // .vtt path
  summary: text("summary"), // text lesson body / video summary
  isFreePreview: boolean("is_free_preview").notNull().default(false),
  quizMaxAttempts: integer("quiz_max_attempts").notNull().default(1),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resourceFiles = pgTable("resource_files", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  lessonId: text("lesson_id").references(() => lessons.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  file: text("file").notNull(), // storage path
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryTree",
  }),
  children: many(categories, { relationName: "categoryTree" }),
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  category: one(categories, {
    fields: [courses.categoryId],
    references: [categories.id],
  }),
  instructors: many(courseInstructors),
  sections: many(sections),
}));

export const courseInstructorsRelations = relations(courseInstructors, ({ one }) => ({
  course: one(courses, {
    fields: [courseInstructors.courseId],
    references: [courses.id],
  }),
  instructor: one(user, {
    fields: [courseInstructors.instructorId],
    references: [user.id],
  }),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  course: one(courses, { fields: [sections.courseId], references: [courses.id] }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  course: one(courses, { fields: [lessons.courseId], references: [courses.id] }),
  section: one(sections, { fields: [lessons.sectionId], references: [sections.id] }),
  resources: many(resourceFiles),
}));

export type Category = typeof categories.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type ResourceFile = typeof resourceFiles.$inferSelect;
