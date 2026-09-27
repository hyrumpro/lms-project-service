import { boolean, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Content domain — legacy tables: blog_category, blogs, blog_comments
 * (spec §5, §7.13).
 */

export const postCategories = pgTable("post_categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  subtitle: text("subtitle"),
});

export const posts = pgTable("posts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  categoryId: text("category_id")
    .notNull()
    .references(() => postCategories.id),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  thumbnail: text("thumbnail"),
  keywords: text("keywords"),
  description: text("description").notNull(),
  isPopular: boolean("is_popular").notNull().default(false),
  likes: integer("likes").notNull().default(0),
  /** instructor posts default to pending (admin moderation, spec §3.8) */
  status: text("status").notNull().default("published"), // published | pending
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export const postComments = pgTable("post_comments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  body: text("body").notNull(),
  likes: integer("likes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PostCategory = typeof postCategories.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostComment = typeof postComments.$inferSelect;
