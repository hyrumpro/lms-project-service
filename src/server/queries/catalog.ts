import { and, asc, count, desc, eq, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  courseInstructors,
  courses,
  enrollments,
  lessons,
  reviews,
  sections,
  user,
} from "@/db/schema";
import { parseCourseSlugParam } from "@/lib/slug";

/**
 * Catalog queries (spec §7.3, §7.4) — mirrors legacy Crud_model
 * get_courses / filter_course / get_course_by_id / get_related_courses.
 */

export const PAGE_SIZE = 12;

export type CourseFilters = {
  q?: string;
  categorySlug?: string;
  level?: string;
  price?: "free" | "paid";
  sort?: "newest" | "popular" | "rating" | "price_asc" | "price_desc";
  page?: number;
  limit?: number;
};

export type CourseCardData = Awaited<ReturnType<typeof listCourses>>["items"][number];

const effectivePriceSql = sql<number>`(case when ${courses.isFree} then 0 when ${courses.discountEnabled} then ${courses.discountedPrice} else ${courses.price} end)`;

async function categoryIdsForSlug(slug: string): Promise<string[]> {
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  if (!category) return [];
  const children = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentId, category.id));
  return [category.id, ...children.map((c) => c.id)];
}

export async function listCourses(filters: CourseFilters = {}) {
  const limit = filters.limit ?? PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);

  const conditions = [eq(courses.status, "active")];
  if (filters.q) {
    conditions.push(
      or(
        ilike(courses.title, `%${filters.q}%`),
        ilike(courses.shortDescription, `%${filters.q}%`),
      )!,
    );
  }
  if (filters.level) conditions.push(eq(courses.level, filters.level));
  if (filters.price === "free") conditions.push(eq(courses.isFree, true));
  if (filters.price === "paid") conditions.push(eq(courses.isFree, false));
  if (filters.categorySlug) {
    const ids = await categoryIdsForSlug(filters.categorySlug);
    if (ids.length === 0) return { items: [], total: 0, page: 1, pages: 1 };
    conditions.push(inArray(courses.categoryId, ids));
  }

  const where = and(...conditions);

  const rows = await db
    .select({
      ...getTableColumns(courses),
      categoryName: categories.name,
      categorySlug: categories.slug,
      instructorNames: sql<string>`coalesce(string_agg(distinct ${user.name}, ', '), '')`,
      enrolledCount: sql<number>`count(distinct ${enrollments.id})::int`,
      ratingAvg: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 1), 0)::float`,
      ratingCount: sql<number>`count(distinct ${reviews.id})::int`,
    })
    .from(courses)
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
    .leftJoin(reviews, eq(reviews.courseId, courses.id))
    .leftJoin(courseInstructors, eq(courseInstructors.courseId, courses.id))
    .leftJoin(user, eq(user.id, courseInstructors.instructorId))
    .where(where)
    .groupBy(courses.id, categories.name, categories.slug)
    .orderBy(
      filters.sort === "popular"
        ? desc(sql`count(distinct ${enrollments.id})`)
        : filters.sort === "rating"
          ? desc(sql`coalesce(avg(${reviews.rating}), 0)`)
          : filters.sort === "price_asc"
            ? asc(effectivePriceSql)
            : filters.sort === "price_desc"
              ? desc(effectivePriceSql)
              : desc(courses.createdAt),
    )
    .limit(limit)
    .offset((page - 1) * limit);

  const [{ total }] = await db.select({ total: count() }).from(courses).where(where);

  return {
    items: rows,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getCategoryTree() {
  const rows = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.order), asc(categories.name));
  const parents = rows.filter((r) => !r.parentId);
  return parents.map((parent) => ({
    ...parent,
    children: rows.filter((r) => r.parentId === parent.id),
  }));
}

export async function getCategoryCounts() {
  const rows = await db
    .select({ categoryId: courses.categoryId, total: count() })
    .from(courses)
    .where(eq(courses.status, "active"))
    .groupBy(courses.categoryId);
  return new Map(rows.map((r) => [r.categoryId, r.total]));
}

export async function getCourseByUrlSlug(param: string) {
  const { slug, id } = parseCourseSlugParam(param);
  const condition = id ? or(eq(courses.slug, slug), eq(courses.id, id))! : eq(courses.slug, slug);

  const [course] = await db.select().from(courses).where(condition).limit(1);
  if (!course) return null;

  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, course.categoryId))
    .limit(1);

  const instructors = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      title: user.title,
      biography: user.biography,
      isOwner: courseInstructors.isOwner,
    })
    .from(courseInstructors)
    .innerJoin(user, eq(user.id, courseInstructors.instructorId))
    .where(eq(courseInstructors.courseId, course.id));

  const [stats] = await db
    .select({
      enrolledCount: sql<number>`(select count(*) from ${enrollments} where ${enrollments.courseId} = ${course.id})::int`,
      ratingAvg: sql<number>`coalesce((select avg(${reviews.rating}) from ${reviews} where ${reviews.courseId} = ${course.id}), 0)::float`,
      ratingCount: sql<number>`(select count(*) from ${reviews} where ${reviews.courseId} = ${course.id})::int`,
    })
    .from(courses)
    .where(eq(courses.id, course.id))
    .limit(1);

  return { course, category, instructors, stats };
}

export async function getCourseCurriculum(courseId: string) {
  const sectionRows = await db
    .select()
    .from(sections)
    .where(eq(sections.courseId, courseId))
    .orderBy(asc(sections.order));
  const lessonRows = await db
    .select({
      id: lessons.id,
      sectionId: lessons.sectionId,
      title: lessons.title,
      type: lessons.type,
      isFreePreview: lessons.isFreePreview,
      durationSeconds: lessons.durationSeconds,
      order: lessons.order,
    })
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.order));

  return sectionRows.map((section) => ({
    ...section,
    lessons: lessonRows.filter((l) => l.sectionId === section.id),
  }));
}

export async function getCourseReviews(courseId: string, limit = 10) {
  return db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      rating: reviews.rating,
      review: reviews.review,
      createdAt: reviews.createdAt,
      userName: user.name,
      userImage: user.image,
    })
    .from(reviews)
    .innerJoin(user, eq(user.id, reviews.userId))
    .where(eq(reviews.courseId, courseId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function getRelatedCourses(courseId: string, categoryId: string, limit = 4) {
  return db
    .select({
      ...getTableColumns(courses),
      categoryName: categories.name,
      categorySlug: categories.slug,
      instructorNames: sql<string>`''`,
      enrolledCount: sql<number>`0::int`,
      ratingAvg: sql<number>`coalesce((select avg(rating) from ${reviews} where ${reviews.courseId} = ${courses.id}), 0)::float`,
      ratingCount: sql<number>`(select count(*) from ${reviews} where ${reviews.courseId} = ${courses.id})::int`,
    })
    .from(courses)
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .where(
      and(
        eq(courses.status, "active"),
        eq(courses.categoryId, categoryId),
        sql`${courses.id} <> ${courseId}`,
      ),
    )
    .limit(limit);
}

export async function isInstructorOfCourse(userId: string, courseId: string): Promise<boolean> {
  const rows = await db
    .select({ instructorId: courseInstructors.instructorId })
    .from(courseInstructors)
    .where(eq(courseInstructors.courseId, courseId));
  return rows.some((r) => r.instructorId === userId);
}

export async function getEnrollmentFor(userId: string, courseId: string) {
  const [row] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  return row ?? null;
}

export async function getInstructorProfile(instructorId: string) {
  const [instructor] = await db
    .select()
    .from(user)
    .where(and(eq(user.id, instructorId), eq(user.isInstructor, true)))
    .limit(1);
  if (!instructor) return null;

  const instructorCourses = await db
    .select({
      ...getTableColumns(courses),
      categoryName: categories.name,
      categorySlug: categories.slug,
      instructorNames: sql<string>`${instructor.name}`,
      enrolledCount: sql<number>`(select count(*) from ${enrollments} where ${enrollments.courseId} = ${courses.id})::int`,
      ratingAvg: sql<number>`coalesce((select avg(rating) from ${reviews} where ${reviews.courseId} = ${courses.id}), 0)::float`,
      ratingCount: sql<number>`(select count(*) from ${reviews} where ${reviews.courseId} = ${courses.id})::int`,
    })
    .from(courseInstructors)
    .innerJoin(courses, eq(courses.id, courseInstructors.courseId))
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .where(and(eq(courseInstructors.instructorId, instructorId), eq(courses.status, "active")))
    .groupBy(courses.id, categories.name, categories.slug)
    .orderBy(desc(courses.createdAt));

  const [stats] = await db
    .select({
      students: sql<number>`count(distinct ${enrollments.userId})::int`,
      courses: sql<number>`count(distinct ${enrollments.courseId})::int`,
    })
    .from(enrollments)
    .innerJoin(courseInstructors, eq(courseInstructors.courseId, enrollments.courseId))
    .where(eq(courseInstructors.instructorId, instructorId));

  return { instructor, courses: instructorCourses, stats };
}

export async function getTopInstructors(limit = 4) {
  return db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      title: user.title,
      courseCount: sql<number>`count(distinct ${courseInstructors.courseId})::int`,
      students: sql<number>`(
        select count(distinct e.user_id) from ${enrollments} e
        inner join ${courseInstructors} ci on ci.course_id = e.course_id
        where ci.instructor_id = ${user.id}
      )::int`,
    })
    .from(user)
    .innerJoin(courseInstructors, eq(courseInstructors.instructorId, user.id))
    .where(eq(user.isInstructor, true))
    .groupBy(user.id)
    .orderBy(desc(sql`count(distinct ${courseInstructors.courseId})`))
    .limit(limit);
}
