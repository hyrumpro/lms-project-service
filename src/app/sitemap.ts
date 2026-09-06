import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customPages, posts } from "@/db/schema";
import { listCourses } from "@/server/queries/catalog";

const BASE = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = ["", "/courses", "/blog", "/sign-in", "/sign-up"].map(
    (path) => ({
      url: `${BASE}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: path === "" ? 1 : 0.7,
    }),
  );

  try {
    const [courses, blogPosts, pages] = await Promise.all([
      listCourses({ limit: 500 }),
      db.select({ slug: posts.slug, publishedAt: posts.publishedAt }).from(posts).where(eq(posts.status, "published")),
      db.select({ url: customPages.url }).from(customPages).where(eq(customPages.status, true)),
    ]);

    return [
      ...statics,
      ...courses.items.map((c) => ({
        url: `${BASE}/course/${c.slug}-${c.id}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...blogPosts.map((p) => ({
        url: `${BASE}/blog/${p.slug}`,
        lastModified: p.publishedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...pages.map((p) => ({
        url: `${BASE}/p/${p.url}`,
        changeFrequency: "yearly" as const,
        priority: 0.4,
      })),
    ];
  } catch {
    return statics;
  }
}
