import { and, asc, count, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  courseInstructors,
  courses,
  enrollments,
  lessons,
  posts,
  questions,
  quizzes,
  reviews,
  sections,
  user,
} from "@/db/schema";

/** Studio queries — instructor-owned data with status counts. */

export type StudioCourse = Awaited<ReturnType<typeof listStudioCourses>>[number];

export async function listStudioCourses(instructorId: string) {
  return db
    .select({
      ...getTableColumns(courses),
      categoryName: categories.name,
      lessonCount: sql<number>`(select count(*) from ${lessons} l where l.course_id = ${courses.id})::int`,
      studentCount: sql<number>`(select count(*) from ${enrollments} e where e.course_id = ${courses.id})::int`,
      ratingAvg: sql<number>`coalesce((select avg(rating) from ${reviews} r where r.course_id = ${courses.id}), 0)::float`,
    })
    .from(courseInstructors)
    .innerJoin(courses, eq(courses.id, courseInstructors.courseId))
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .where(eq(courseInstructors.instructorId, instructorId))
    .orderBy(desc(courses.updatedAt));
}

export async function listCourseInstructors(courseId: string) {
  return db
    .select({
      instructorId: courseInstructors.instructorId,
      isOwner: courseInstructors.isOwner,
      name: user.name,
      email: user.email,
    })
    .from(courseInstructors)
    .innerJoin(user, eq(user.id, courseInstructors.instructorId))
    .where(eq(courseInstructors.courseId, courseId))
    .orderBy(desc(courseInstructors.isOwner));
}

export async function getCourseForEdit(courseId: string, instructorId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return null;
  const [owner] = await db
    .select({ instructorId: courseInstructors.instructorId })
    .from(courseInstructors)
    .where(and(eq(courseInstructors.courseId, courseId), eq(courseInstructors.instructorId, instructorId)))
    .limit(1);
  if (!owner) return null;
  return course;
}

export async function getCurriculumForEdit(courseId: string) {
  const sectionRows = await db
    .select()
    .from(sections)
    .where(eq(sections.courseId, courseId))
    .orderBy(asc(sections.order));
  const lessonRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.order));
  const quizLessonIds = lessonRows.filter((l) => l.type === "quiz").map((l) => l.id);
  const quizRows = quizLessonIds.length
    ? await db.select().from(quizzes).where(inArray(quizzes.lessonId, quizLessonIds))
    : [];
  const questionRows = quizRows.length
    ? await db
        .select()
        .from(questions)
        .where(inArray(questions.quizId, quizRows.map((q) => q.id)))
        .orderBy(asc(questions.order))
    : [];

  return sectionRows.map((section) => ({
    ...section,
    lessons: lessonRows
      .filter((l) => l.sectionId === section.id)
      .map((lesson) => ({
        ...lesson,
        questions:
          lesson.type === "quiz"
            ? questionRows.filter((q) => q.quizId === quizRows.find((qz) => qz.lessonId === lesson.id)?.id)
            : [],
      })),
  }));
}

export async function getCategoryOptions() {
  return db
    .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
    .from(categories)
    .orderBy(asc(categories.order));
}

export async function getStudioBlogPosts(authorId: string) {
  return db
    .select()
    .from(posts)
    .where(eq(posts.authorId, authorId))
    .orderBy(desc(posts.publishedAt));
}

export async function getStudioStats(instructorId: string) {
  const [courseStats] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${courses.status} = 'active')::int`,
      pending: sql<number>`count(*) filter (where ${courses.status} = 'pending')::int`,
    })
    .from(courseInstructors)
    .innerJoin(courses, eq(courses.id, courseInstructors.courseId))
    .where(eq(courseInstructors.instructorId, instructorId));

  const [studentStats] = await db
    .select({ students: sql<number>`count(distinct ${enrollments.userId})::int` })
    .from(enrollments)
    .innerJoin(courseInstructors, eq(courseInstructors.courseId, enrollments.courseId))
    .where(eq(courseInstructors.instructorId, instructorId));

  return { ...courseStats, students: studentStats?.students ?? 0 };
}
