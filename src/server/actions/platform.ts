"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  badges,
  badgeAwards,
  categories,
  contactMessages,
  courses,
  courseInstructors,
  courseProgress,
  enrollments,
  followings,
  forumQuestions,
  forumReplies,
  lessonProgress,
  liveClasses,
  newsletterCampaigns,
  notifications,
  quizResults,
  subscribers,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { chatComplete } from "@/lib/ai";
import { canAccessAdminSection } from "@/server/queries/admin";

export type SimpleResult = { ok: true } | { ok: false; error: string };

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

async function requireAdmin(section?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") return null;
  if (section && !(await canAccessAdminSection(session.user.id, section))) return null;
  return session;
}

async function requireInstructor() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return session.user.role === "admin" || session.user.isInstructor ? session : null;
}

/* ── contact (legacy contact page + inbox) ── */

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10).max(4000),
});

export async function sendContactMessage(
  input: z.infer<typeof contactSchema>,
): Promise<SimpleResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await db.insert(contactMessages).values({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone || null,
    message: parsed.data.message,
  });
  return { ok: true };
}

export async function markContactRead(id: string): Promise<SimpleResult> {
  if (!(await requireAdmin('content'))) return { ok: false, error: "forbidden" };
  await db.update(contactMessages).set({ hasRead: true }).where(eq(contactMessages.id, id));
  revalidatePath("/admin/content");
  return { ok: true };
}

/* ── instructor following (legacy instructor_followings) ── */

export async function toggleFollow(
  instructorId: string,
): Promise<SimpleResult & { following?: boolean }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };
  if (userId === instructorId) return { ok: false, error: "self" };

  const [existing] = await db
    .select({ id: followings.id })
    .from(followings)
    .where(and(eq(followings.followerId, userId), eq(followings.instructorId, instructorId)))
    .limit(1);
  if (existing) {
    await db.delete(followings).where(eq(followings.id, existing.id));
    return { ok: true, following: false };
  }
  await db.insert(followings).values({ followerId: userId, instructorId }).onConflictDoNothing();
  return { ok: true, following: true };
}

/* ── forum Q&A (legacy addon, enrolled-only, spec §7.20) ── */

async function requireEnrolledIn(courseId: string) {
  const userId = await requireUserId();
  if (!userId) return null;
  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  return enrollment ? userId : null;
}

const questionSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(6).max(150),
  body: z.string().trim().min(10).max(4000),
});

export async function askForumQuestion(
  input: z.infer<typeof questionSchema>,
): Promise<SimpleResult> {
  const userId = await requireEnrolledIn(input.courseId);
  if (!userId) return { ok: false, error: "enroll_first" };
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await db.insert(forumQuestions).values({
    courseId: parsed.data.courseId,
    userId,
    title: parsed.data.title,
    body: parsed.data.body,
  });
  revalidatePath("/learn");
  return { ok: true };
}

const replySchema = z.object({
  questionId: z.string().min(1),
  courseId: z.string().min(1),
  body: z.string().trim().min(2).max(4000),
});

export async function replyToQuestion(input: z.infer<typeof replySchema>): Promise<SimpleResult> {
  const userId = await requireEnrolledIn(input.courseId);
  if (!userId) return { ok: false, error: "enroll_first" };
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await db.insert(forumReplies).values({
    questionId: parsed.data.questionId,
    userId,
    body: parsed.data.body,
  });
  revalidatePath("/learn");
  return { ok: true };
}

export async function toggleForumVote(
  questionId: string,
): Promise<SimpleResult & { votes?: number }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };
  const [question] = await db
    .select({ votes: forumQuestions.votes })
    .from(forumQuestions)
    .where(eq(forumQuestions.id, questionId))
    .limit(1);
  if (!question) return { ok: false, error: "not_found" };
  const votes = question.votes.includes(userId)
    ? question.votes.filter((v) => v !== userId)
    : [...question.votes, userId];
  await db.update(forumQuestions).set({ votes }).where(eq(forumQuestions.id, questionId));
  revalidatePath("/learn");
  return { ok: true, votes: votes.length };
}

/* ── newsletter campaigns (legacy newsletters) ── */

const campaignSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(20000),
});

export async function createCampaign(input: z.infer<typeof campaignSchema>): Promise<SimpleResult> {
  if (!(await requireAdmin("newsletters"))) return { ok: false, error: "forbidden" };
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await db.insert(newsletterCampaigns).values({
    subject: parsed.data.subject,
    body: parsed.data.body,
  });
  revalidatePath("/admin/newsletters");
  return { ok: true };
}

/**
 * Marks a campaign sent and records stats. Actual delivery plugs into
 * Resend/SMTP here (spec §12.4) — recipients are logged for the sandbox.
 */
export async function sendCampaign(campaignId: string): Promise<SimpleResult> {
  if (!(await requireAdmin("newsletters"))) return { ok: false, error: "forbidden" };
  const [campaign] = await db
    .select()
    .from(newsletterCampaigns)
    .where(eq(newsletterCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) return { ok: false, error: "not_found" };
  const recipients = await db
    .select({ email: subscribers.email })
    .from(subscribers)
    .where(eq(subscribers.confirmed, true));
  const { sendEmail } = await import("@/server/services/email");
  const { campaignSends } = await import("@/db/schema");
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient.email,
      subject: campaign.subject,
      html: campaign.body,
    });
    await db.insert(campaignSends).values({
      campaignId,
      email: recipient.email,
      status: result.ok ? "sent" : "failed",
    });
    if (result.ok) sent++;
    else failed++;
  }
  await db
    .update(newsletterCampaigns)
    .set({ status: "sent", sentAt: new Date(), stats: { sent, failed } })
    .where(eq(newsletterCampaigns.id, campaignId));
  revalidatePath("/admin/newsletters");
  return { ok: true };
}

/* ── categories CRUD (legacy Admin::categories) ── */

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  parentId: z.string().optional().nullable(),
});

export async function createCategory(input: z.infer<typeof categorySchema>): Promise<SimpleResult> {
  if (!(await requireAdmin('categories'))) return { ok: false, error: "forbidden" };
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const slug = slugify(parsed.data.name);
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  if (existing) return { ok: false, error: "slug_taken" };
  await db.insert(categories).values({
    name: parsed.data.name,
    slug,
    parentId: parsed.data.parentId || null,
  });
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function renameCategory(id: string, name: string): Promise<SimpleResult> {
  if (!(await requireAdmin('categories'))) return { ok: false, error: "forbidden" };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, error: "invalid" };
  await db.update(categories).set({ name: trimmed }).where(eq(categories.id, id));
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<SimpleResult> {
  if (!(await requireAdmin('categories'))) return { ok: false, error: "forbidden" };
  const [inUse] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.categoryId, id))
    .limit(1);
  if (inUse) return { ok: false, error: "in_use" };
  const [hasChildren] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentId, id))
    .limit(1);
  if (hasChildren) return { ok: false, error: "has_children" };
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/admin/categories");
  return { ok: true };
}

/* ── badges engine (legacy badges addon, condition_from/to semantics) ── */

export async function evaluateBadges(userId: string): Promise<string[]> {
  const allBadges = await db.select().from(badges);
  if (allBadges.length === 0) return [];

  const countOf = async (where: Promise<{ n: unknown }[]>): Promise<number> => {
    const rows = await where;
    return rows.length;
  };

  const counts = {
    lessons_completed: await countOf(
      db.select({ n: lessonProgress.id }).from(lessonProgress).where(eq(lessonProgress.userId, userId)),
    ),
    courses_completed: await countOf(
      db
        .select({ n: courseProgress.id })
        .from(courseProgress)
        .where(and(eq(courseProgress.userId, userId), eq(courseProgress.percent, 100))),
    ),
    enrollments: await countOf(
      db.select({ n: enrollments.id }).from(enrollments).where(eq(enrollments.userId, userId)),
    ),
    quizzes_aced: await countOf(
      db
        .select({ n: quizResults.id })
        .from(quizResults)
        .where(and(eq(quizResults.userId, userId), eq(quizResults.obtainedMarks, quizResults.totalMarks))),
    ),
  };

  const earned: string[] = [];
  for (const badge of allBadges) {
    const value = counts[badge.type as keyof typeof counts] ?? 0;
    const max = badge.conditionTo ?? Number.POSITIVE_INFINITY;
    if (value >= badge.conditionFrom && value <= max) {
      const inserted = await db
        .insert(badgeAwards)
        .values({ badgeId: badge.id, userId })
        .onConflictDoNothing()
        .returning({ id: badgeAwards.id });
      if (inserted.length > 0) {
        earned.push(badge.title);
        await db.insert(notifications).values({
          userId,
          type: "badge_earned",
          title: `Badge earned: ${badge.title}`,
          body: badge.description ?? "Keep the streak going!",
          url: "/dashboard/badges",
        });
      }
    }
  }
  return earned;
}

/* ── live classes (spec §7.11) ── */

const liveClassSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(3).max(120),
  provider: z.enum(["jitsi", "zoom", "bbb", "external"]),
  joinUrl: z.string().url().optional().nullable(),
  startsAt: z.string().min(4),
});

export async function scheduleLiveClass(
  input: z.infer<typeof liveClassSchema>,
): Promise<SimpleResult> {
  const session = await requireInstructor();
  if (!session) return { ok: false, error: "forbidden" };

  const parsed = liveClassSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const owns = await db
    .select({ instructorId: courseInstructors.instructorId })
    .from(courseInstructors)
    .where(eq(courseInstructors.courseId, parsed.data.courseId));
  const isAdmin = session.user.role === "admin";
  if (!isAdmin && !owns.some((o) => o.instructorId === session.user.id)) {
    return { ok: false, error: "not_your_course" };
  }

  const resolved = await import("@/lib/live-class").then((mod) =>
    mod.resolveProviderJoinUrl({
      provider: parsed.data.provider,
      title: parsed.data.title,
      courseId: parsed.data.courseId,
      startsAt: parsed.data.startsAt,
      joinUrl: parsed.data.joinUrl,
    }),
  );

  await db.insert(liveClasses).values({
    courseId: parsed.data.courseId,
    title: parsed.data.title,
    provider: parsed.data.provider,
    joinUrl: resolved.joinUrl,
    startsAt: new Date(parsed.data.startsAt),
  });
  revalidatePath("/studio/live");
  return { ok: true };
}

export async function listMyLiveClasses() {
  const session = await requireInstructor();
  if (!session) return [];
  return db
    .select({
      id: liveClasses.id,
      title: liveClasses.title,
      provider: liveClasses.provider,
      joinUrl: liveClasses.joinUrl,
      startsAt: liveClasses.startsAt,
      courseTitle: courses.title,
      courseId: courses.id,
    })
    .from(liveClasses)
    .innerJoin(courses, eq(courses.id, liveClasses.courseId))
    .innerJoin(courseInstructors, eq(courseInstructors.courseId, liveClasses.courseId))
    .where(eq(courseInstructors.instructorId, session.user.id))
    .orderBy(liveClasses.startsAt);
}

/* ── AI assistant (spec §7.16, legacy gpt_assistant) ── */

const aiSchema = z.object({
  mode: z.enum(["description", "outcomes", "quiz"]),
  topic: z.string().trim().min(3).max(200),
});

export async function generateCourseDraft(
  input: z.infer<typeof aiSchema>,
): Promise<SimpleResult & { text?: string }> {
  const session = await requireInstructor();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = aiSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const systemPrompt =
    "You are an expert course designer for an online academy. Be concrete, practical and concise. Plain text, no markdown headers.";
  const prompts: Record<(typeof parsed.data)["mode"], string> = {
    description: `Write a compelling 120-word course description for a course about: ${parsed.data.topic}.`,
    outcomes: `Write 6 specific learning outcomes (one per line, starting with a verb) for a course about: ${parsed.data.topic}.`,
    quiz: `Write 3 quiz questions with answers about: ${parsed.data.topic}. Format: Q: … / Correct answer: …`,
  };

  return chatComplete([
    { role: "system", content: systemPrompt },
    { role: "user", content: prompts[parsed.data.mode] },
  ]);
}

/* ── quiz time limit (legacy flipclock timer) ── */

export async function updateQuizTimeLimit(
  lessonId: string,
  minutes: number | null,
): Promise<SimpleResult> {
  const session = await requireInstructor();
  if (!session) return { ok: false, error: "forbidden" };
  const safe = minutes && minutes > 0 ? Math.min(180, Math.floor(minutes)) : null;
  const { quizzes, lessons } = await import("@/db/schema");
  const [lesson] = await db.select({ courseId: lessons.courseId }).from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson) return { ok: false, error: "not_found" };
  if (session.user.role !== "admin") {
    const owns = await db
      .select({ instructorId: courseInstructors.instructorId })
      .from(courseInstructors)
      .where(eq(courseInstructors.courseId, lesson.courseId));
    if (!owns.some((o) => o.instructorId === session.user.id)) return { ok: false, error: "not_your_course" };
  }
  await db.update(quizzes).set({ timeLimitMinutes: safe }).where(eq(quizzes.lessonId, lessonId));
  revalidatePath("/learn");
  return { ok: true };
}
