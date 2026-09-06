import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, courses, enrollments, lessons, user } from "@/db/schema";

/** Compare data for up to 3 courses (legacy Home::compare). */
export async function getCompareCourses(ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({
      ...getTableColumns(courses),
      categoryName: categories.name,
      instructorNames: sql<string>`(
        select coalesce(string_agg(u.name, ', '), '') from course_instructors ci
        join "user" u on u.id = ci.instructor_id where ci.course_id = ${courses.id}
      )`,
      enrolledCount: sql<number>`(select count(*) from ${enrollments} e where e.course_id = ${courses.id})::int`,
      ratingAvg: sql<number>`coalesce((select avg(rating) from reviews r where r.course_id = ${courses.id}), 0)::float`,
      lessonCount: sql<number>`(select count(*) from ${lessons} l where l.course_id = ${courses.id})::int`,
      totalDuration: sql<number>`(select coalesce(sum(l.duration_seconds), 0) from ${lessons} l where l.course_id = ${courses.id})::int`,
    })
    .from(courses)
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .where(and(eq(courses.status, "active"), inArray(courses.id, ids)));
}

export async function listActiveCoursesForSelect() {
  return db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.status, "active"))
    .orderBy(courses.title);
}
