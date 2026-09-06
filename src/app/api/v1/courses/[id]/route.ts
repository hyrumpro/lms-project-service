import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, courseInstructors, lessons, sections, user } from "@/db/schema";

/** GET /api/v1/courses/{id} — course object with curriculum (legacy course_object_by_id_get). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  if (!course) {
    return NextResponse.json({ status: false, message: "Not found" }, { status: 404 });
  }

  const instructorRows = await db
    .select({ instructorId: courseInstructors.instructorId, isOwner: courseInstructors.isOwner })
    .from(courseInstructors)
    .where(eq(courseInstructors.courseId, id));
  const ownerRow =
    instructorRows.find((r) => r.isOwner) ?? instructorRows[0] ?? { instructorId: "", isOwner: false };
  const instructors = ownerRow.instructorId
    ? await db
        .select({ id: user.id, name: user.name, image: user.image, title: user.title })
        .from(user)
        .where(eq(user.id, ownerRow.instructorId))
    : [];

  const sectionRows = await db
    .select()
    .from(sections)
    .where(eq(sections.courseId, id))
    .orderBy(asc(sections.order));
  const lessonRows = await db
    .select({
      id: lessons.id,
      section_id: lessons.sectionId,
      title: lessons.title,
      type: lessons.type,
      video_provider: lessons.videoProvider,
      video_url: lessons.videoUrl,
      duration_seconds: lessons.durationSeconds,
      is_free_preview: lessons.isFreePreview,
      order: lessons.order,
    })
    .from(lessons)
    .where(eq(lessons.courseId, id))
    .orderBy(asc(lessons.order));

  return NextResponse.json({
    status: true,
    course: {
      course_id: course.id,
      title: course.title,
      slug: course.slug,
      short_description: course.shortDescription,
      description: course.description,
      outcomes: course.outcomes,
      requirements: course.requirements,
      faqs: course.faqs,
      level: course.level,
      language: course.language,
      is_free: course.isFree,
      price: course.price,
      status: course.status,
    },
    instructors,
    sections: sectionRows.map((s) => ({
      section_id: s.id,
      title: s.title,
      order: s.order,
      lessons: lessonRows.filter((l) => l.section_id === s.id),
    })),
  });
}
