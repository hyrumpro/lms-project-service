import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { homePageConfigs, reviews, user } from "@/db/schema";
import { getTopInstructors, listCourses } from "@/server/queries/catalog";
import { getCategoryCounts, getCategoryTree } from "@/server/queries/catalog";

/** Home page rendering from the page-builder config (spec §7.2), legacy home_1 order. */

export async function getActiveHomeConfig() {
  const [config] = await db
    .select()
    .from(homePageConfigs)
    .where(eq(homePageConfigs.isActive, true))
    .limit(1);
  return config ?? null;
}

export type HomeTestimonial = {
  id: string;
  rating: number;
  review: string | null;
  userName: string;
  userImage: string | null;
  courseTitle: string;
};

export async function getHomeSectionData() {
  const [courses, latest, categoryTree, categoryCounts, instructors, heroStats, testimonials] =
    await Promise.all([
      listCourses({ sort: "popular", limit: 8 }),
      listCourses({ limit: 4 }),
      getCategoryTree(),
      getCategoryCounts(),
      getTopInstructors(4),
      getHeroStats(),
      getTopTestimonials(3),
    ]);
  const latestPosts = await import("@/server/queries/blog").then((m) => m.listPublishedPosts({ limit: 3 }));

  return {
    topCourses: courses.items,
    latestCourses: latest.items,
    categoryTree,
    categoryCounts,
    instructors,
    heroStats,
    testimonials,
    latestPosts,
  };
}

async function getTopTestimonials(limit: number): Promise<HomeTestimonial[]> {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      review: reviews.review,
      userName: user.name,
      userImage: user.image,
      courseTitle: sql<string>`(select title from courses c where c.id = ${reviews.courseId})`,
    })
    .from(reviews)
    .innerJoin(user, eq(user.id, reviews.userId))
    .where(and(sql`${reviews.review} is not null`, sql`${reviews.rating} >= 4`))
    .orderBy(desc(reviews.rating), desc(reviews.createdAt))
    .limit(limit);
}

async function getHeroStats(): Promise<{ courses: number; instructors: number }> {
  const [courses, instructors] = await Promise.all([
    listCourses({ limit: 1 }),
    db
      .select({ total: count() })
      .from(user)
      .where(and(eq(user.isInstructor, true), eq(user.status, "active"))),
  ]);
  return { courses: courses.total, instructors: instructors[0]?.total ?? 0 };
}
