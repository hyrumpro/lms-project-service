"use server";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  applications,
  categories,
  courseInstructors,
  courses,
  lessons,
  notifications,
  payouts,
  postCategories,
  posts,
  questions,
  quizzes,
  sections,
  user,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { getInstructorEarnings } from "@/server/queries/commerce";

export type StudioResult = { ok: true } | { ok: false; error: string };

async function requireInstructor(): Promise<
  { ok: false; error: "auth_required" | "not_instructor" } | { ok: true; userId: string; isAdmin: boolean }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "auth_required" };
  const isAdmin = session.user.role === "admin";
  if (!session.user.isInstructor && !isAdmin) return { ok: false, error: "not_instructor" };
  return { ok: true, userId: session.user.id, isAdmin };
}

/** Ownership gate (legacy is_the_course_belongs_to_current_instructor). */
async function assertOwnsCourse(userId: string, courseId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const [row] = await db
    .select({ instructorId: courseInstructors.instructorId })
    .from(courseInstructors)
    .where(and(eq(courseInstructors.courseId, courseId), eq(courseInstructors.instructorId, userId)))
    .limit(1);
  return Boolean(row);
}

/** Primary author gate (for instructor assignment & deletion). */
async function assertIsCourseOwner(userId: string, courseId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const [row] = await db
    .select({ isOwner: courseInstructors.isOwner })
    .from(courseInstructors)
    .where(
      and(
        eq(courseInstructors.courseId, courseId),
        eq(courseInstructors.instructorId, userId),
        eq(courseInstructors.isOwner, true),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/* ─────────────────────────── application ─────────────────────────── */

export async function applyAsInstructor(message: string): Promise<StudioResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "auth_required" };
  const [existing] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.userId, session.user.id), eq(applications.status, "pending")))
    .limit(1);
  if (existing) return { ok: false, error: "already_pending" };
  await db.insert(applications).values({ userId: session.user.id, message });
  return { ok: true };
}

/* ─────────────────────────── courses ─────────────────────────── */

const basicsSchema = z.object({
  title: z.string().trim().min(4).max(120),
  shortDescription: z.string().trim().max(200).optional(),
  description: z.string().trim().max(20000).optional(),
  categoryId: z.string().min(1),
  level: z.enum(["beginner", "intermediate", "expert", "any"]).default("beginner"),
  language: z.string().default("English"),
});

export async function createCourse(input: z.infer<typeof basicsSchema>): Promise<
  { ok: true; courseId: string } | { ok: false; error: string }
> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = basicsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const courseId = crypto.randomUUID();
  await db.insert(courses).values({
    id: courseId,
    title: parsed.data.title,
    slug: slugify(parsed.data.title),
    shortDescription: parsed.data.shortDescription || null,
    description: parsed.data.description || null,
    categoryId: parsed.data.categoryId,
    level: parsed.data.level,
    language: parsed.data.language,
    status: guard.isAdmin ? "active" : "draft", // legacy: admin-created courses skip moderation
    createdByAdmin: guard.isAdmin,
  });
  await db.insert(courseInstructors).values({
    courseId,
    instructorId: guard.userId,
    isOwner: true,
  });
  revalidatePath("/studio/courses");
  return { ok: true, courseId };
}

export async function addCourseInstructorByEmail(
  courseId: string,
  email: string,
): Promise<StudioResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return { ok: false, error: "invalid_email" };
  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${normalized}`)
    .limit(1);
  if (!found) return { ok: false, error: "user_not_found" };
  return addCourseInstructor(courseId, found.id);
}

export async function addCourseInstructor(
  courseId: string,
  instructorId: string,
): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertIsCourseOwner(guard.userId, courseId, guard.isAdmin))) {
    return { ok: false, error: "forbidden" };
  }

  const [targetUser] = await db
    .select({ id: user.id, isInstructor: user.isInstructor, role: user.role })
    .from(user)
    .where(eq(user.id, instructorId))
    .limit(1);
  if (!targetUser || (!targetUser.isInstructor && targetUser.role !== "admin")) {
    return { ok: false, error: "user_not_instructor" };
  }

  const [existing] = await db
    .select()
    .from(courseInstructors)
    .where(
      and(
        eq(courseInstructors.courseId, courseId),
        eq(courseInstructors.instructorId, instructorId),
      ),
    )
    .limit(1);
  if (existing) return { ok: false, error: "already_instructor" };

  await db.insert(courseInstructors).values({
    courseId,
    instructorId,
    isOwner: false,
  });

  await db
    .update(courses)
    .set({ multiInstructor: true, updatedAt: new Date() })
    .where(eq(courses.id, courseId));

  await db.insert(notifications).values({
    userId: instructorId,
    type: "course_co_instructor",
    title: "Added as co-instructor",
    body: "You have been added as an instructor for a course.",
    url: "/studio/courses",
  });

  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true };
}

export async function removeCourseInstructor(
  courseId: string,
  instructorId: string,
): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertIsCourseOwner(guard.userId, courseId, guard.isAdmin))) {
    return { ok: false, error: "forbidden" };
  }

  const [existing] = await db
    .select()
    .from(courseInstructors)
    .where(
      and(
        eq(courseInstructors.courseId, courseId),
        eq(courseInstructors.instructorId, instructorId),
      ),
    )
    .limit(1);
  if (!existing) return { ok: false, error: "not_found" };

  if (existing.isOwner) {
    return { ok: false, error: "cannot_remove_primary_owner" };
  }

  await db
    .delete(courseInstructors)
    .where(
      and(
        eq(courseInstructors.courseId, courseId),
        eq(courseInstructors.instructorId, instructorId),
      ),
    );

  const [remaining] = await db
    .select({ total: count() })
    .from(courseInstructors)
    .where(eq(courseInstructors.courseId, courseId));

  if ((remaining?.total ?? 0) <= 1) {
    await db
      .update(courses)
      .set({ multiInstructor: false, updatedAt: new Date() })
      .where(eq(courses.id, courseId));
  }

  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true };
}

export async function changeCourseAuthor(
  courseId: string,
  newAuthorId: string,
): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertIsCourseOwner(guard.userId, courseId, guard.isAdmin))) {
    return { ok: false, error: "forbidden" };
  }

  const [targetUser] = await db
    .select({ id: user.id, isInstructor: user.isInstructor, role: user.role })
    .from(user)
    .where(eq(user.id, newAuthorId))
    .limit(1);
  if (!targetUser || (!targetUser.isInstructor && targetUser.role !== "admin")) {
    return { ok: false, error: "user_not_instructor" };
  }

  await db
    .update(courseInstructors)
    .set({ isOwner: false })
    .where(eq(courseInstructors.courseId, courseId));

  const [existing] = await db
    .select()
    .from(courseInstructors)
    .where(
      and(
        eq(courseInstructors.courseId, courseId),
        eq(courseInstructors.instructorId, newAuthorId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(courseInstructors)
      .set({ isOwner: true })
      .where(
        and(
          eq(courseInstructors.courseId, courseId),
          eq(courseInstructors.instructorId, newAuthorId),
        ),
      );
  } else {
    await db.insert(courseInstructors).values({
      courseId,
      instructorId: newAuthorId,
      isOwner: true,
    });
  }

  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true };
}

const mediaSchema = z.object({
  courseId: z.string(),
  thumbnail: z.string().trim().url().optional().or(z.literal("")),
  promoVideoUrl: z.string().trim().optional().or(z.literal("")),
});

export async function updateCourseMedia(input: z.infer<typeof mediaSchema>): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertOwnsCourse(guard.userId, input.courseId, guard.isAdmin)))
    return { ok: false, error: "forbidden" };

  const provider =
    input.promoVideoUrl && input.promoVideoUrl.includes("youtu")
      ? ("youtube" as const)
      : input.promoVideoUrl
        ? ("external" as const)
        : null;
  await db
    .update(courses)
    .set({
      thumbnail: input.thumbnail || null,
      promoVideoUrl: input.promoVideoUrl || null,
      promoVideoProvider: provider,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, input.courseId));
  revalidatePath(`/studio/courses/${input.courseId}/edit`);
  return { ok: true };
}

const pricingSchema = z.object({
  courseId: z.string(),
  isFree: z.boolean(),
  price: z.coerce.number().min(0),
  discountEnabled: z.boolean(),
  discountedPrice: z.coerce.number().min(0),
});

export async function updateCoursePricing(input: z.infer<typeof pricingSchema>): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertOwnsCourse(guard.userId, input.courseId, guard.isAdmin)))
    return { ok: false, error: "forbidden" };

  await db
    .update(courses)
    .set({
      isFree: input.isFree,
      price: Math.round(input.price * 100),
      discountEnabled: input.discountEnabled,
      discountedPrice: Math.round(input.discountedPrice * 100),
      updatedAt: new Date(),
    })
    .where(eq(courses.id, input.courseId));
  revalidatePath(`/studio/courses/${input.courseId}/edit`);
  return { ok: true };
}

const listSchema = z.object({
  courseId: z.string(),
  outcomes: z.array(z.string().trim().min(1)).max(20),
  requirements: z.array(z.string().trim().min(1)).max(20),
  faqs: z.array(z.object({ question: z.string().trim().min(1), answer: z.string().trim().min(1) })).max(20),
});

export async function updateCourseRequirements(input: z.infer<typeof listSchema>): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertOwnsCourse(guard.userId, input.courseId, guard.isAdmin)))
    return { ok: false, error: "forbidden" };

  await db
    .update(courses)
    .set({
      outcomes: input.outcomes.filter(Boolean),
      requirements: input.requirements.filter(Boolean),
      faqs: input.faqs.filter((f) => f.question && f.answer),
      updatedAt: new Date(),
    })
    .where(eq(courses.id, input.courseId));
  revalidatePath(`/studio/courses/${input.courseId}/edit`);
  return { ok: true };
}

/** Status transitions (legacy course_actions): draft → pending → active. */
export async function setCourseStatus(courseId: string, action: "submit" | "retract" | "delete"): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertOwnsCourse(guard.userId, courseId, guard.isAdmin)))
    return { ok: false, error: "forbidden" };

  if (action === "delete") {
    await db.delete(courses).where(and(eq(courses.id, courseId), eq(courses.status, "draft")));
    revalidatePath("/studio/courses");
    return { ok: true };
  }
  await db
    .update(courses)
    .set({ status: action === "submit" ? "pending" : "draft", updatedAt: new Date() })
    .where(eq(courses.id, courseId));
  revalidatePath("/studio/courses");
  return { ok: true };
}

/* ─────────────────────────── curriculum ─────────────────────────── */

export async function addSection(courseId: string, title: string): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertOwnsCourse(guard.userId, courseId, guard.isAdmin)))
    return { ok: false, error: "forbidden" };
  if (title.trim().length < 2) return { ok: false, error: "invalid" };

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${sections.order}), -1)::int` })
    .from(sections)
    .where(eq(sections.courseId, courseId));
  await db.insert(sections).values({ courseId, title: title.trim(), order: max + 1 });
  revalidatePath(`/studio/courses/${courseId}/curriculum`);
  return { ok: true };
}

export async function deleteSection(courseId: string, sectionId: string): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertOwnsCourse(guard.userId, courseId, guard.isAdmin)))
    return { ok: false, error: "forbidden" };
  await db.delete(sections).where(and(eq(sections.id, sectionId), eq(sections.courseId, courseId)));
  revalidatePath(`/studio/courses/${courseId}/curriculum`);
  return { ok: true };
}

const lessonSchema = z.object({
  courseId: z.string(),
  sectionId: z.string(),
  title: z.string().trim().min(2).max(160),
  type: z.enum(["video", "audio", "document", "text", "quiz", "image"]),
  provider: z
    .enum(["youtube", "vimeo", "html5", "iframe", "external", "s3", "wasabi", "google_drive", "stream"])
    .optional(),
  url: z.string().trim().optional(),
  body: z.string().trim().optional(),
  caption: z.string().trim().optional(),
  durationMinutes: z.coerce.number().min(0).max(600).optional(),
  isFreePreview: z.boolean().optional(),
});

export async function addLesson(input: z.infer<typeof lessonSchema>): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertOwnsCourse(guard.userId, input.courseId, guard.isAdmin)))
    return { ok: false, error: "forbidden" };

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${lessons.order}), -1)::int` })
    .from(lessons)
    .where(eq(lessons.sectionId, input.sectionId));

  const isVideo = input.type === "video";
  await db.insert(lessons).values({
    courseId: input.courseId,
    sectionId: input.sectionId,
    title: input.title,
    order: max + 1,
    type: input.type,
    videoProvider: isVideo ? (input.provider ?? "youtube") : null,
    videoUrl: isVideo ? (input.url || null) : null,
    audioUrl: input.type === "audio" ? (input.url || null) : null,
    attachment: input.type === "document" || input.type === "image" ? (input.url || null) : null,
    caption: input.caption || null,
    summary: input.body || null,
    isFreePreview: input.isFreePreview ?? false,
    durationSeconds: Math.round((input.durationMinutes ?? 0) * 60),
  });
  revalidatePath(`/studio/courses/${input.courseId}/curriculum`);
  return { ok: true };
}

export async function deleteLesson(courseId: string, lessonId: string): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertOwnsCourse(guard.userId, courseId, guard.isAdmin)))
    return { ok: false, error: "forbidden" };
  await db.delete(lessons).where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)));
  revalidatePath(`/studio/courses/${courseId}/curriculum`);
  return { ok: true };
}

export async function moveLesson(courseId: string, lessonId: string, direction: "up" | "down"): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertOwnsCourse(guard.userId, courseId, guard.isAdmin)))
    return { ok: false, error: "forbidden" };

  const [current] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!current) return { ok: false, error: "not_found" };
  const siblings = await db
    .select()
    .from(lessons)
    .where(eq(lessons.sectionId, current.sectionId))
    .orderBy(asc(lessons.order));
  const index = siblings.findIndex((l) => l.id === lessonId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) return { ok: true };

  const neighbor = siblings[swapIndex];
  await db.update(lessons).set({ order: neighbor.order }).where(eq(lessons.id, current.id));
  await db.update(lessons).set({ order: current.order }).where(eq(lessons.id, neighbor.id));
  revalidatePath(`/studio/courses/${courseId}/curriculum`);
  return { ok: true };
}

/* ─────────────────────────── quiz builder ─────────────────────────── */

const questionSchema = z.object({
  courseId: z.string(),
  lessonId: z.string(),
  title: z.string().trim().min(3).max(500),
  type: z.enum(["single_choice", "multiple_choice", "fill_in_the_blank"]),
  options: z.array(z.string().trim()).default([]),
  correct: z.array(z.string().trim()).min(1),
});

export async function addQuizQuestion(input: z.infer<typeof questionSchema>): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertOwnsCourse(guard.userId, input.courseId, guard.isAdmin)))
    return { ok: false, error: "forbidden" };

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(
      and(
        eq(lessons.id, input.lessonId),
        eq(lessons.courseId, input.courseId),
        eq(lessons.type, "quiz"),
      ),
    )
    .limit(1);
  if (!lesson) return { ok: false, error: "not_found" };

  let [quiz] = await db.select().from(quizzes).where(eq(quizzes.lessonId, lesson.id)).limit(1);
  if (!quiz) {
    [quiz] = await db.insert(quizzes).values({ lessonId: lesson.id }).returning();
  }

  if (input.type !== "fill_in_the_blank" && input.options.length < 2) {
    return { ok: false, error: "need_two_options" };
  }
  if (input.type === "single_choice" && input.correct.length !== 1) {
    return { ok: false, error: "single_needs_one" };
  }

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${questions.order}), -1)::int` })
    .from(questions)
    .where(eq(questions.quizId, quiz.id));

  await db.insert(questions).values({
    quizId: quiz.id,
    title: input.title,
    type: input.type,
    numberOfOptions: input.options.length,
    options: input.options,
    correctAnswers: input.correct,
    order: max + 1,
  });
  revalidatePath(`/studio/courses/${input.courseId}/curriculum`);
  return { ok: true };
}

export async function deleteQuizQuestion(courseId: string, questionId: string): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!(await assertOwnsCourse(guard.userId, courseId, guard.isAdmin)))
    return { ok: false, error: "forbidden" };

  const [target] = await db
    .select({ id: questions.id })
    .from(questions)
    .innerJoin(quizzes, eq(quizzes.id, questions.quizId))
    .innerJoin(lessons, eq(lessons.id, quizzes.lessonId))
    .where(and(eq(questions.id, questionId), eq(lessons.courseId, courseId)))
    .limit(1);
  if (!target) return { ok: false, error: "not_found" };

  await db.delete(questions).where(eq(questions.id, questionId));
  revalidatePath(`/studio/courses/${courseId}/curriculum`);
  return { ok: true };
}

/* ─────────────────────────── payouts ─────────────────────────── */

export async function requestWithdrawal(amount: number, method: string): Promise<
  StudioResult | { ok: false; error: string; min?: number }
> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };

  const earnings = await getInstructorEarnings(guard.userId);
  const requested = await db
    .select({ total: sql<number>`coalesce(sum(${payouts.amount}), 0)::int` })
    .from(payouts)
    .where(and(eq(payouts.instructorId, guard.userId), sql`${payouts.status} in ('requested','approved','paid')`));
  const available = earnings - (requested[0]?.total ?? 0);

  const cents = Math.round(amount * 100);
  if (cents <= 0) return { ok: false, error: "invalid" };
  if (cents > available) return { ok: false, error: "insufficient", min: available / 100 };

  await db.insert(payouts).values({ instructorId: guard.userId, amount: cents, method });
  revalidatePath("/studio/payouts");
  return { ok: true };
}

/* ─────────────────────────── instructor blog ─────────────────────────── */

export async function createInstructorPost(input: {
  title: string;
  description: string;
  categorySlug: string;
}): Promise<StudioResult> {
  const guard = await requireInstructor();
  if (!guard.ok) return { ok: false, error: guard.error };

  const [category] = await db
    .select()
    .from(postCategories)
    .where(eq(postCategories.slug, input.categorySlug))
    .limit(1);
  if (!category) return { ok: false, error: "invalid" };

  await db.insert(posts).values({
    title: input.title,
    slug: slugify(input.title),
    categoryId: category.id,
    authorId: guard.userId,
    description: input.description,
    status: "pending", // instructor posts await admin moderation (spec §7.13)
  });
  revalidatePath("/studio/blog");
  return { ok: true };
}
