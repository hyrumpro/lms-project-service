import { boolean, integer, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { courses } from "./catalog";

/**
 * Platform/CMS domain — legacy tables: settings + frontend_settings,
 * home_pages, custom_page, seo_fields (spec §5, §8).
 */

/** Domain-prefixed typed settings, e.g. key "system" → SystemSettings JSON. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HomeSection = { type: string; props: Record<string, unknown> };

/** Legacy: home_pages (page-builder layouts + 9 template skins). */
export const homePageConfigs = pgTable("home_page_configs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  identifier: text("identifier").notNull().unique(), // default, university2, fitness, ...
  title: text("title").notNull(),
  description: text("description"),
  sections: jsonb("sections").$type<HomeSection[]>().notNull(),
  isPermanent: boolean("is_permanent").notNull().default(false),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Legacy: custom_page. */
export const customPages = pgTable("custom_pages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  url: text("url").notNull().unique(), // served at /p/{url}
  content: text("content").notNull(),
  buttonTitle: text("button_title"),
  buttonPosition: text("button_position"),
  status: boolean("status").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Legacy: seo_fields (per-route meta + OG + JSON-LD). */
export const seoMeta = pgTable("seo_meta", {
  route: text("route").primaryKey(),
  metaTitle: text("meta_title"),
  metaKeywords: text("meta_keywords"),
  metaDescription: text("meta_description"),
  metaRobots: text("meta_robots"),
  canonicalUrl: text("canonical_url"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImage: text("og_image"),
  jsonLd: jsonb("json_ld").$type<Record<string, unknown>>(),
});

/** Legacy addon: certificates (spec §7.10) — issued at 100% completion. */
export const certificate = pgTable(
  "certificates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    code: text("code").notNull().unique(), // used in /certificate/{code}
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("certificates_student_course_unique").on(t.studentId, t.courseId)],
);

/** Granular admin permissions (legacy permissions table, spec §7.9). */
export const ADMIN_SECTIONS = [
  "categories",
  "courses",
  "users",
  "commerce",
  "content",
  "newsletters",
] as const;

export const adminPermissions = pgTable("admin_permissions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** { categories: true, courses: false, … } — missing key = allowed (default-open) */
  flags: jsonb("flags")
    .$type<Partial<Record<(typeof ADMIN_SECTIONS)[number], boolean>>>()
    .notNull()
    .default({}),
});

/** Live classes (legacy bbb_meetings + zoom/jitsi addons, spec §7.11). */
export const liveClasses = pgTable("live_classes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  provider: text("provider").notNull().default("jitsi"), // jitsi | zoom | bbb | external
  joinUrl: text("join_url"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Setting = typeof settings.$inferSelect;
export type HomePageConfig = typeof homePageConfigs.$inferSelect;
export type CustomPage = typeof customPages.$inferSelect;
export type SeoMetaRow = typeof seoMeta.$inferSelect;
export type Certificate = typeof certificate.$inferSelect;
export type LiveClass = typeof liveClasses.$inferSelect;


export type AdminPermission = typeof adminPermissions.$inferSelect;
