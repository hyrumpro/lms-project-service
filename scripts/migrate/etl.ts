/**
 * Academy LMS v7.1 → Academy Next — COMPLETE migration ETL (spec §9).
 *
 * Reads the legacy MySQL database (restored from uploads/install.sql + your
 * production data) and writes into the Neon Postgres schema **exclusively
 * through Drizzle** (src/db/schema) so every insert is type-checked.
 *
 * Usage:
 *   LEGACY_DB_URL=mysql://root:legacy@localhost:3307/academy_legacy \
 *   DATABASE_URL=postgresql://…/academy_mig \
 *   npx tsx scripts/migrate/etl.ts [--wipe] [--dry-run]
 *
 * Transforms (verified against the real dump):
 *   unix-int timestamps → timestamptz · double money → integer minor units ·
 *   course.user_id CSV → course_instructor join rows · users.wishlist CSV →
 *   wishlist rows · JSON blobs parsed w/ quarantine · question.correct_answers
 *   (option indexes) → option strings · sha1 passwords → `legacy-sha1:` account
 *   rows (runtime bridge in src/lib/auth.ts) · payment rows → synthesized paid
 *   Order/OrderItem/Payment with recorded split · completed_lesson JSON →
 *   lesson_progress rows · skipped w/ warning: role/permissions, language,
 *   addons, log, ci_sessions, tag, currency, notification_settings (→ settings).
 */
import "dotenv/config";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { eq, sql } from "drizzle-orm";
import { db } from "../../src/db";
import * as t from "../../src/db/schema";

const LEGACY_URL = process.env.LEGACY_DB_URL;
const DRY = process.argv.includes("--dry-run");
const WIPE = process.argv.includes("--wipe");

if (!LEGACY_URL) {
  console.error("Set LEGACY_DB_URL=mysql://user:pass@host/legacy_db");
  process.exit(1);
}
const LEGACY_URL_STR: string = LEGACY_URL;

type Row = Record<string, unknown>;
let mysqlDb: mysql.Connection | null = null;
async function getMysql() {
  if (!mysqlDb) mysqlDb = await mysql.createConnection(LEGACY_URL_STR);
  return mysqlDb;
}
const legacy = async <T = Row>(q: string): Promise<T[]> => {
  const conn = await getMysql();
  const [rows] = await conn.query(q);
  return rows as T[];
};

// ── helpers ────────────────────────────────────────────────────────────────
const uuid = () => crypto.randomUUID();
const idm = {
  users: new Map<number, string>(),
  courses: new Map<number, string>(),
  sections: new Map<number, string>(),
  lessons: new Map<number, string>(),
  quizzes: new Map<number, string>(),
  postCats: new Map<number, string>(),
  posts: new Map<number, string>(),
  threads: new Map<string, string>(),
};
const warnings: string[] = [];
const warn = (m: string) => warnings.push(m);
const toCents = (v: unknown): number => Math.round(Number(v ?? 0) * 100) || 0;
const isUnix = (v: unknown) => typeof v === "number" && v > 1_000_000_000 && v < 4_000_000_000;
const toDate = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === "" || v === "0000-00-00 00:00:00" || v === "0000-00-00") return null;
  if (isUnix(v)) return new Date((v as number) * 1000);
  const n = Number(v);
  if (Number.isFinite(n) && n > 1_000_000_000 && n < 4_000_000_000) return new Date(n * 1000);
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const intDate = (v: unknown): Date | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : null;
};
const parseJson = <T>(raw: unknown, label: string, fallback: T): T => {
  if (raw === null || raw === undefined || raw === "") return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    warn(`quarantined JSON: ${label} → ${String(raw).slice(0, 80)}`);
    return fallback;
  }
};
const bool = (v: unknown) => Number(v ?? 0) === 1;
const mediaUrl = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.startsWith("http") ? s : `/uploads/${s.replace(/^\/+/, "")}`;
};
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const mapOrNull = (map: Map<number, string>, key: unknown): string | null => {
  if (key === null || key === undefined || Number(key) === 0) return null;
  return map.get(Number(key)) ?? null;
};
const providerOf = (v: unknown): "youtube" | "vimeo" | "html5" | "iframe" | "external" | null => {
  const s = String(v ?? "").toLowerCase();
  if (s === "youtube" || s === "vimeo" || s === "iframe" || s === "html5") return s;
  if (!s) return null;
  if (s === "academy_cloud") warn("academy_cloud video → kept as external URL (vendor service dropped)");
  return "external";
};

async function truncateTarget() {
  const names = [
    "quiz_results", "questions", "quizzes", "lesson_progress", "course_progress", "reviews",
    "forum_replies", "forum_questions", "enrollments", "order_items", "payments", "orders",
    "cart_items", "wishlist_items", "followings", "badge_awards", "payouts", "messages",
    "message_threads", "notifications", "post_comments", "posts", "post_categories",
    "newsletter_campaigns", "subscribers", "contact_messages", "custom_pages", "seo_meta",
    "live_classes", "certificates", "resource_files", "lessons", "sections",
    "course_instructors", "courses", "categories", "home_page_configs", "settings",
    "gateway_configs", "applications", "session", "account", "user",
  ];
  for (const name of names) {
    try {
      await db.execute(sql.raw(`TRUNCATE TABLE "${name}" CASCADE`));
    } catch {
      /* older target without that table — ignore */
    }
  }
}

// ── 1. categories (parents first) → map ───────────────────────────────────
async function migrateCategories(): Promise<Map<number, string>> {
  const rows = await legacy("SELECT * FROM category ORDER BY parent IS NULL DESC, id");
  const map = new Map<number, string>();
  let order = 0;
  for (const c of rows) {
    const id = uuid();
    map.set(Number(c.id), id);
    await db.insert(t.categories).values({
      id,
      parentId: c.parent ? (map.get(Number(c.parent)) ?? null) : null,
      name: String(c.name),
      slug: (c.slug as string) || slugify(String(c.name)),
      icon: (c.font_awesome_class as string) ?? null,
      thumbnail: mediaUrl(c.thumbnail),
      subThumbnail: mediaUrl(c.sub_category_thumbnail),
      order: order++,
    });
  }
  return map;
}

// ── 2. users (+auth accounts) ─────────────────────────────────────────────
async function migrateUsers(): Promise<number> {
  const rows = await legacy("SELECT * FROM users");
  for (const u of rows) {
    const id = uuid();
    idm.users.set(Number(u.id), id);
    await db.insert(t.user).values({
      id,
      name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || String(u.email),
      email: String(u.email).toLowerCase(),
      emailVerified: true,
      image: mediaUrl(u.image),
      firstName: (u.first_name as string) ?? null,
      lastName: (u.last_name as string) ?? null,
      title: (u.title as string) ?? null,
      biography: (u.biography as string) ?? null,
      role: Number(u.role_id) === 1 ? "admin" : "student",
      isInstructor: bool(u.is_instructor),
      status: bool(u.status) ? "active" : "disabled",
      createdAt: intDate(u.date_added) ?? new Date(),
      updatedAt: intDate(u.last_modified) ?? new Date(),
    });
    await db.insert(t.account).values({
      id: uuid(),
      issuer: "local:credential",
      accountId: id,
      providerId: "credential",
      userId: id,
      password: `legacy-sha1:${u.password}`, // bridge verified in src/lib/auth.ts
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return rows.length;
}

// ── 3. courses (+instructor join rows, custom fields) ─────────────────────
async function migrateCourses(categoryMap: Map<number, string>): Promise<number> {
  const rows = await legacy("SELECT * FROM course");
  const customFields = await legacy("SELECT * FROM custom_fields ORDER BY sorting");
  const cfByCourse = new Map<number, Row[]>();
  for (const cf of customFields) {
    const key = Number(cf.course_id);
    cfByCourse.set(key, [...(cfByCourse.get(key) ?? []), cf]);
  }

  for (const c of rows) {
    const id = uuid();
    idm.courses.set(Number(c.id), id);
    const outcomes = parseJson<string[]>(c.outcomes, `course#${c.id}.outcomes`, []);
    const requirements = parseJson<string[]>(c.requirements, `course#${c.id}.requirements`, []);
    const faqsRaw = parseJson<{ question?: string; answer?: string }[]>(c.faqs, `course#${c.id}.faqs`, []);
    const categoryId = mapOrNull(categoryMap, c.category_id);
    if (!categoryId) {
      warn(`course#${c.id}: category ${c.category_id} missing → skipped`);
      continue;
    }

    await db.insert(t.courses).values({
      id,
      legacyId: Number(c.id),
      title: String(c.title),
      slug: slugify(String(c.title)) || `course-${c.id}`,
      shortDescription: (c.short_description as string) ?? null,
      description: (c.description as string) ?? null,
      outcomes: outcomes.filter(Boolean),
      requirements: requirements.filter(Boolean),
      faqs: faqsRaw.filter((f) => f?.question).map((f) => ({ question: String(f.question), answer: String(f.answer ?? "") })),
      language: (c.language as string) || "English",
      level: (c.level as string) || "beginner",
      categoryId,
      status: c.status === "active" ? "active" : c.status === "pending" ? "pending" : "draft",
      isFree: bool(c.is_free_course),
      price: toCents(c.price),
      discountEnabled: bool(c.discount_flag),
      discountedPrice: toCents(c.discounted_price),
      thumbnail: mediaUrl(c.thumbnail),
      promoVideoUrl: (c.video_url as string) ?? null,
      promoVideoProvider: providerOf(c.course_overview_provider),
      expiryPeriod: c.expiry_period ? Number(c.expiry_period) : null,
      enableDripContent: bool(c.enable_drip_content),
      isTopCourse: bool(c.is_top_course),
      createdByAdmin: bool(c.is_admin),
      multiInstructor: bool(c.multi_instructor),
      metaKeywords: (c.meta_keywords as string) ?? null,
      metaDescription: (c.meta_description as string) ?? null,
      customFieldValues: (cfByCourse.get(Number(c.id))
        ? { items: cfByCourse.get(Number(c.id))!.map((cf) => ({
            title: String(cf.custom_title ?? ""),
            type: String(cf.custom_type ?? "text"),
            value: String(cf.custom_field ?? ""),
          })) }
        : null) as Record<string, unknown> | null,
      publishDate: toDate(c.publish_date),
      createdAt: intDate(c.date_added) ?? new Date(),
      updatedAt: intDate(c.last_modified) ?? intDate(c.date_added) ?? new Date(),
    });

    const owners = String(c.user_id ?? "").split(",").map((x) => Number(x.trim())).filter(Boolean);
    for (const [i, legacyUserId] of owners.entries()) {
      const instructorId = idm.users.get(legacyUserId);
      if (!instructorId) {
        warn(`course#${c.id}: unknown owner user ${legacyUserId}`);
        continue;
      }
      await db.insert(t.courseInstructors).values({ courseId: id, instructorId, isOwner: i === 0 });
    }
  }
  return rows.length;
}

// ── 3b. wishlist (needs courses) ──────────────────────────────────────────
async function migrateWishlists(): Promise<number> {
  const rows = await legacy("SELECT id, wishlist FROM users WHERE wishlist IS NOT NULL AND wishlist <> ''");
  let count = 0;
  for (const u of rows) {
    const userId = idm.users.get(Number(u.id));
    if (!userId) continue;
    for (const legacyCourseId of String(u.wishlist).split(",").map((x) => Number(x.trim())).filter(Boolean)) {
      const courseId = idm.courses.get(legacyCourseId);
      if (!courseId) continue;
      await db.insert(t.wishlistItems).values({ userId, courseId }).onConflictDoNothing();
      count++;
    }
  }
  return count;
}

// ── 4. sections + lessons + quizzes + questions + resources ──────────────
async function migrateCurriculum() {
  const sections = await legacy("SELECT * FROM section ORDER BY `order`");
  for (const s of sections) {
    const courseId = idm.courses.get(Number(s.course_id));
    if (!courseId) {
      warn(`section#${s.id}: course missing`);
      continue;
    }
    const unlockRule =
      s.start_date && toDate(s.start_date)
        ? ({ kind: "date", date: (toDate(s.start_date) as Date).toISOString() } as const)
        : null;
    const id = uuid();
    idm.sections.set(Number(s.id), id);
    await db.insert(t.sections).values({
      id,
      courseId,
      title: String(s.title),
      order: Number(s.order ?? 0),
      unlockRule,
    });
  }

  const lessons = await legacy("SELECT * FROM lesson ORDER BY `order`");
  for (const l of lessons) {
    const courseId = idm.courses.get(Number(l.course_id));
    const sectionId = idm.sections.get(Number(l.section_id));
    if (!courseId || !sectionId) {
      warn(`lesson#${l.id}: course/section missing`);
      continue;
    }
    const lessonType = String(l.lesson_type ?? "video").toLowerCase();
    const type = (["video", "audio", "document", "text", "quiz"].includes(lessonType) ? lessonType : "video") as
      | "video"
      | "audio"
      | "document"
      | "text"
      | "quiz";
    const videoType = String(l.video_type ?? "").toLowerCase();

    const id = uuid();
    idm.lessons.set(Number(l.id), id);
    await db.insert(t.lessons).values({
      id,
      legacyId: Number(l.id),
      title: String(l.title),
      courseId,
      sectionId,
      order: Number(l.order ?? 0),
      type,
      videoProvider: type === "video" ? (providerOf(videoType) as never) : null,
      videoUrl: type === "video" ? ((l.video_url as string) ?? null) : null,
      cloudVideoId: l.cloud_video_id ? String(l.cloud_video_id) : null,
      audioUrl: type === "audio" ? ((l.audio_url as string) ?? null) : null,
      attachment: mediaUrl(l.attachment),
      attachmentType: (l.attachment_type as string) ?? null,
      caption: mediaUrl(l.caption),
      summary: (l.summary as string) ?? null,
      isFreePreview: bool(l.is_free),
      quizMaxAttempts: l.quiz_attempt ? Number(l.quiz_attempt) : 1,
      durationSeconds: Math.max(0, Math.round(Number(l.duration ?? 0) || 0)),
      createdAt: intDate(l.date_added) ?? new Date(),
      updatedAt: intDate(l.last_modified) ?? new Date(),
    });

    if (type === "quiz") {
      const quizId = uuid();
      idm.quizzes.set(Number(l.id), quizId); // legacy question.quiz_id references the LESSON id
      await db.insert(t.quizzes).values({ id: quizId, lessonId: id });
    }
  }

  const questions = await legacy("SELECT * FROM question ORDER BY `order`");
  for (const q of questions) {
    const quizId = idm.quizzes.get(Number(q.quiz_id));
    if (!quizId) {
      warn(`question#${q.id}: quiz lesson ${q.quiz_id} missing`);
      continue;
    }
    const options = parseJson<string[]>(q.options, `question#${q.id}.options`, []);
    const correctIdx = parseJson<(string | number)[]>(q.correct_answers, `question#${q.id}.correct`, []);
    const correctStrings = correctIdx.map((idx) => options[Number(idx)]).filter((v) => v !== undefined);
    const questionType = String(q.type ?? "single_choice").toLowerCase();
    await db.insert(t.questions).values({
      id: uuid(),
      quizId,
      title: String(q.title),
      type: questionType.includes("fill")
        ? "fill_in_the_blank"
        : questionType.includes("multiple")
          ? "multiple_choice"
          : "single_choice",
      numberOfOptions: Number(q.number_of_options ?? options.length),
      options,
      correctAnswers: correctStrings.length > 0 ? correctStrings : correctIdx.map(String),
      order: Number(q.order ?? 0),
    });
  }

  const resources = await legacy("SELECT * FROM resource_files");
  for (const r of resources) {
    const lessonId = idm.lessons.get(Number(r.lesson_id));
    if (!lessonId) continue;
    await db.insert(t.resourceFiles).values({
      id: uuid(),
      lessonId,
      title: String(r.title),
      file: mediaUrl(r.file_name) ?? String(r.file_name ?? ""),
    });
  }
  return {
    sections: sections.length, lessons: lessons.length,
    questions: questions.length, resources: resources.length,
  };
}

// ── 5. enrollments ────────────────────────────────────────────────────────
async function migrateEnrollments(): Promise<number> {
  const rows = await legacy("SELECT * FROM enrol");
  for (const e of rows) {
    const userId = idm.users.get(Number(e.user_id));
    const courseId = idm.courses.get(Number(e.course_id));
    if (!userId || !courseId) {
      warn(`enrol#${e.id}: missing user/course`);
      continue;
    }
    await db
      .insert(t.enrollments)
      .values({
        id: uuid(),
        legacyId: Number(e.id),
        userId,
        courseId,
        giftedById: e.gifted_by ? (idm.users.get(Number(e.gifted_by)) ?? null) : null,
        source: e.gifted_by ? "gift" : "purchase",
        expiresAt: toDate(e.expiry_date),
        createdAt: intDate(e.date_added) ?? new Date(),
      })
      .onConflictDoNothing();
    await db.insert(t.courseProgress).values({ userId, courseId }).onConflictDoNothing();
  }
  return rows.length;
}

// ── 6. commerce: coupons, gateways, payments → orders ────────────────────
async function migrateCommerce() {
  const coupons = await legacy("SELECT * FROM coupons");
  for (const c of coupons) {
    await db
      .insert(t.coupons)
      .values({
        id: uuid(),
        code: String(c.code).toUpperCase(),
        discountPercentage: Number(c.discount_percentage ?? 0),
        expiryDate: intDate(c.expiry_date),
      })
      .onConflictDoNothing();
  }

  const gateways = await legacy("SELECT * FROM payment_gateways");
  for (const g of gateways) {
    await db
      .insert(t.gatewayConfigs)
      .values({
        id: uuid(),
        identifier: String(g.identifier),
        title: String(g.title),
        enabled: bool(g.status),
        testMode: bool(g.enabled_test_mode),
        keys: parseJson<Record<string, string>>(g.keys, `gateway#${g.id}.keys`, {}),
      })
      .onConflictDoNothing();
  }

  const payments = await legacy("SELECT * FROM payment");
  for (const p of payments) {
    const userId = idm.users.get(Number(p.user_id));
    const courseId = idm.courses.get(Number(p.course_id));
    if (!userId || !courseId) {
      warn(`payment#${p.id}: missing user/course`);
      continue;
    }
    const amount = toCents(p.amount);
    const tax = toCents(p.tax);
    const titleRows = await legacy(`SELECT title FROM course WHERE id = ${Number(p.course_id)}`);
    const orderId = uuid();
    await db.insert(t.orders).values({
      id: orderId,
      userId,
      status: "paid",
      gateway: String(p.payment_type ?? "legacy"),
      subtotal: amount - tax,
      tax,
      total: amount,
      paidAt: intDate(p.date_added) ?? new Date(),
      createdAt: intDate(p.date_added) ?? new Date(),
    });
    await db.insert(t.orderItems).values({
      id: uuid(),
      orderId,
      courseId,
      titleSnapshot: String(titleRows[0]?.title ?? `Course ${p.course_id}`),
      unitPrice: amount - tax,
    });
    await db.insert(t.payments).values({
      id: uuid(),
      orderId,
      userId,
      gateway: String(p.payment_type ?? "legacy"),
      amount,
      tax,
      adminRevenue: toCents(p.admin_revenue),
      instructorRevenue: toCents(p.instructor_revenue),
      transactionId: (p.transaction_id as string) ?? null,
      createdAt: intDate(p.date_added) ?? new Date(),
    });
  }
  return { coupons: coupons.length, gateways: gateways.length, payments: payments.length };
}

// ── 7. reviews + course Q&A comments ─────────────────────────────────────
async function migrateReviews() {
  const ratings = await legacy("SELECT * FROM rating");
  let reviewCount = 0;
  for (const r of ratings) {
    if (String(r.ratable_type) !== "course") {
      warn(`rating#${r.id}: non-course rating skipped (${r.ratable_type})`);
      continue;
    }
    const userId = idm.users.get(Number(r.user_id));
    const courseId = idm.courses.get(Number(r.ratable_id));
    if (!userId || !courseId) continue;
    await db
      .insert(t.reviews)
      .values({
        id: uuid(),
        userId,
        courseId,
        rating: Number(r.rating),
        review: (r.review as string) ?? null,
        createdAt: intDate(r.date_added) ?? new Date(),
      })
      .onConflictDoNothing();
    reviewCount++;
  }

  const comments = await legacy("SELECT * FROM comment WHERE commentable_type = 'course'");
  for (const c of comments) {
    const userId = idm.users.get(Number(c.user_id));
    const courseId = idm.courses.get(Number(c.commentable_id));
    if (!userId || !courseId) continue;
    const body = String(c.body ?? "").trim();
    if (!body) continue;
    await db.insert(t.forumQuestions).values({
      id: uuid(),
      courseId,
      userId,
      title: body.slice(0, 80) + (body.length > 80 ? "…" : ""),
      body,
      votes: [],
      createdAt: intDate(c.date_added) ?? new Date(),
    });
  }
  return { ratings: ratings.length, reviews: reviewCount, comments: comments.length };
}

// ── 8. progress: watch_histories + watched_duration ──────────────────────
async function migrateProgress() {
  const histories = await legacy("SELECT * FROM watch_histories");
  for (const h of histories) {
    const userId = idm.users.get(Number(h.student_id));
    const courseId = idm.courses.get(Number(h.course_id));
    if (!userId || !courseId) continue;
    const completed = parseJson<number[]>(h.completed_lesson, `watch#${h.watch_history_id}`, []);
    for (const legacyLessonId of completed) {
      const lessonId = idm.lessons.get(Number(legacyLessonId));
      if (!lessonId) continue;
      await db
        .insert(t.lessonProgress)
        .values({ id: uuid(), userId, lessonId, isCompleted: true })
        .onConflictDoNothing();
    }
    const totalRows = await legacy(`SELECT COUNT(*) AS n FROM lesson WHERE course_id = ${Number(h.course_id)}`);
    const totalLessons = Number(totalRows[0]?.n ?? 0);
    const percent = totalLessons > 0 ? Math.round((completed.length / totalLessons) * 100) : 0;
    await db
      .insert(t.courseProgress)
      .values({
        id: uuid(),
        userId,
        courseId,
        watchingLessonId: h.watching_lesson_id ? (idm.lessons.get(Number(h.watching_lesson_id)) ?? null) : null,
        completedLessons: completed.length,
        percent,
        completedAt: toDate(h.completed_date),
        updatedAt: toDate(h.date_updated) ?? new Date(),
      })
      .onConflictDoUpdate({
        target: [t.courseProgress.userId, t.courseProgress.courseId],
        set: { percent, completedLessons: completed.length },
      });
  }

  const durations = await legacy("SELECT * FROM watched_duration");
  for (const d of durations) {
    const userId = idm.users.get(Number(d.watched_student_id));
    const lessonId = idm.lessons.get(Number(d.watched_lesson_id));
    if (!userId || !lessonId) continue;
    const values = {
      lastPositionSeconds: Number(d.current_duration ?? 0) || 0,
      watchCount: Number(d.watched_counter ?? 0) || 0,
    };
    await db
      .insert(t.lessonProgress)
      .values({ id: uuid(), userId, lessonId, ...values })
      .onConflictDoUpdate({ target: [t.lessonProgress.userId, t.lessonProgress.lessonId], set: values });
  }
  return { histories: histories.length, durations: durations.length };
}

// ── 9. quiz results ──────────────────────────────────────────────────────
async function migrateQuizResults(): Promise<number> {
  const rows = await legacy("SELECT * FROM quiz_results");
  for (const r of rows) {
    const userId = idm.users.get(Number(r.user_id));
    const quizId = idm.quizzes.get(Number(r.quiz_id));
    if (!userId || !quizId) continue;
    const raw = parseJson<Row[]>(r.user_answers, `quiz_result#${r.quiz_result_id}`, []);
    const answers = raw.map((entry) => ({
      questionId: String(entry.question_id ?? ""),
      submitted: (Array.isArray(entry.submitted_answers) ? entry.submitted_answers : []).map(String),
      correct: (Array.isArray(entry.correct_answers) ? entry.correct_answers : []).map(String),
      status: Number(entry.submitted_answer_status ?? 0),
    }));
    await db.insert(t.quizResults).values({
      id: uuid(),
      quizId,
      userId,
      answers,
      obtainedMarks: answers.filter((a) => a.status === 1).length,
      totalMarks: answers.length,
      isSubmitted: bool(r.is_submitted),
      createdAt: toDate(r.date_added) ?? new Date(),
    });
  }
  return rows.length;
}

// ── 10. social: applications, followings, messages ───────────────────────
async function migrateSocial() {
  const apps = await legacy("SELECT * FROM applications");
  for (const a of apps) {
    const userId = idm.users.get(Number(a.user_id));
    if (!userId) continue;
    await db.insert(t.applications).values({
      id: uuid(),
      userId,
      address: String(a.address ?? ""),
      phone: String(a.phone ?? ""),
      message: String(a.message ?? ""),
      document: mediaUrl(a.document),
      status: Number(a.status) === 1 ? "approved" : "pending",
    });
  }

  const follows = await legacy("SELECT * FROM instructor_followings WHERE is_following = 1");
  for (const f of follows) {
    const followerId = idm.users.get(Number(f.user_id));
    const instructorId = idm.users.get(Number(f.instructor_id));
    if (!followerId || !instructorId) continue;
    await db.insert(t.followings).values({ followerId, instructorId }).onConflictDoNothing();
  }

  const threads = await legacy("SELECT * FROM message_thread");
  const messages = await legacy("SELECT * FROM message ORDER BY `timestamp`");
  for (const th of threads) {
    const senderId = idm.users.get(Number(th.sender));
    const receiverId = idm.users.get(Number(th.receiver));
    if (!senderId || !receiverId) continue;
    const id = uuid();
    idm.threads.set(String(th.message_thread_code), id);
    await db.insert(t.messageThreads).values({
      id,
      threadCode: String(th.message_thread_code),
      senderId,
      receiverId,
      lastMessageAt: toDate(th.last_message_timestamp) ?? new Date(),
    });
  }
  for (const m of messages) {
    const threadId = idm.threads.get(String(m.message_thread_code));
    const senderId = idm.users.get(Number(m.sender));
    if (!threadId || !senderId) continue;
    await db.insert(t.messages).values({
      id: uuid(),
      threadId,
      senderId,
      body: String(m.message ?? ""),
      readAt: bool(m.read_status) ? new Date() : null,
      createdAt: toDate(m.timestamp) ?? new Date(),
    });
  }
  return {
    applications: apps.length, follows: follows.length,
    threads: threads.length, messages: messages.length,
  };
}

// ── 11. content: blog, contact, pages, seo, live, badges, payouts ────────
async function migrateContent() {
  const blogCats = await legacy("SELECT * FROM blog_category");
  for (const bc of blogCats) {
    const id = uuid();
    idm.postCats.set(Number(bc.blog_category_id), id);
    await db.insert(t.postCategories).values({
      id,
      title: String(bc.title),
      slug: (bc.slug as string) || slugify(String(bc.title)),
      subtitle: (bc.subtitle as string) ?? null,
    });
  }

  const blogs = await legacy("SELECT * FROM blogs");
  for (const b of blogs) {
    const authorId = idm.users.get(Number(b.user_id));
    const categoryId = idm.postCats.get(Number(b.blog_category_id));
    if (!authorId || !categoryId) {
      warn(`blog#${b.blog_id}: missing author/category`);
      continue;
    }
    const id = uuid();
    idm.posts.set(Number(b.blog_id), id);
    const likes = String(b.likes ?? "").split(",").filter(Boolean).length;
    await db.insert(t.posts).values({
      id,
      title: String(b.title),
      slug: slugify(String(b.title)) || `post-${b.blog_id}`,
      categoryId,
      authorId,
      thumbnail: mediaUrl(b.thumbnail),
      keywords: (b.keywords as string) ?? null,
      description: String(b.description ?? ""),
      isPopular: bool(b.is_popular),
      likes,
      status: b.status === "pending" ? "pending" : "published",
      publishedAt: toDate(b.added_date) ?? new Date(),
    });
  }

  const comments = await legacy("SELECT * FROM blog_comments");
  for (const c of comments) {
    const postId = idm.posts.get(Number(c.blog_id));
    const userId = idm.users.get(Number(c.user_id));
    if (!postId || !userId) continue;
    await db.insert(t.postComments).values({
      id: uuid(),
      postId,
      userId,
      body: String(c.comment ?? ""),
      createdAt: toDate(c.added_date) ?? new Date(),
    });
  }

  const contacts = await legacy("SELECT * FROM contact");
  for (const c of contacts) {
    await db.insert(t.contactMessages).values({
      id: uuid(),
      name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      email: String(c.email),
      phone: (c.phone as string) ?? null,
      message: String(c.message ?? ""),
      hasRead: bool(c.has_read),
      replied: bool(c.replied),
      createdAt: toDate(c.created_at) ?? new Date(),
    });
  }

  const pages = await legacy("SELECT * FROM custom_page");
  for (const p of pages) {
    await db
      .insert(t.customPages)
      .values({
        id: uuid(),
        title: String(p.page_title),
        url: String(p.page_url),
        content: String(p.page_content ?? ""),
        buttonTitle: (p.button_title as string) ?? null,
        buttonPosition: (p.button_position as string) ?? null,
        status: bool(p.status),
      })
      .onConflictDoNothing();
  }

  const seo = await legacy("SELECT * FROM seo_fields");
  for (const r of seo) {
    await db
      .insert(t.seoMeta)
      .values({
        route: String(r.route ?? r.url ?? "home"),
        metaTitle: (r.meta_title as string) ?? null,
        metaKeywords: (r.meta_keywords as string) ?? null,
        metaDescription: (r.meta_description as string) ?? null,
        metaRobots: (r.meta_robot as string) ?? null,
        canonicalUrl: (r.canonical_url as string) ?? null,
        ogTitle: (r.og_title as string) ?? null,
        ogDescription: (r.og_description as string) ?? null,
        ogImage: mediaUrl(r.og_image),
        jsonLd: parseJson(r.json_ld, `seo#${r.id}`, undefined) as never,
      })
      .onConflictDoNothing();
  }

  const meetings = await legacy("SELECT * FROM bbb_meetings");
  for (const m of meetings) {
    const courseId = idm.courses.get(Number(m.course_id));
    if (!courseId) continue;
    await db.insert(t.liveClasses).values({
      id: uuid(),
      courseId,
      title: "BigBlueButton session (migrated)",
      provider: "bbb",
      joinUrl: m.meeting_id ? `https://bbb.example.com/${m.meeting_id}` : null,
      startsAt: toDate(m.created_at) ?? new Date(),
    });
  }

  const badges = await legacy("SELECT * FROM badges");
  for (const b of badges) {
    await db.insert(t.badges).values({
      id: uuid(),
      type: String(b.type),
      title: String(b.title),
      description: (b.description as string) ?? null,
      image: mediaUrl(b.image),
      conditionFrom: Number(b.condition_from ?? 1),
      conditionTo: b.condition_to ? Number(b.condition_to) : null,
    });
  }

  const payouts = await legacy("SELECT * FROM payout");
  for (const p of payouts) {
    const instructorId = idm.users.get(Number(p.user_id));
    if (!instructorId) continue;
    await db.insert(t.payouts).values({
      id: uuid(),
      instructorId,
      amount: toCents(p.amount),
      method: String(p.payment_type ?? "paypal"),
      status: Number(p.status) === 1 ? "paid" : "requested",
      createdAt: intDate(p.date_added) ?? new Date(),
    });
  }
  return {
    blogCats: blogCats.length, blogs: blogs.length, comments: comments.length,
    contacts: contacts.length, pages: pages.length, seo: seo.length,
    meetings: meetings.length, badges: badges.length, payouts: payouts.length,
  };
}

// ── 12. platform: newsletters, notifications, settings, home pages ───────
async function migratePlatform() {
  const subscribers = await legacy("SELECT * FROM newsletter_subscriber");
  for (const s of subscribers) {
    await db
      .insert(t.subscribers)
      .values({ id: uuid(), email: String(s.email).toLowerCase() })
      .onConflictDoNothing();
  }

  const newsletters = await legacy("SELECT * FROM newsletters");
  const histories = await legacy("SELECT * FROM newsletter_histories");
  for (const n of newsletters) {
    const sent = histories.filter((h) => h.subject === n.subject);
    await db.insert(t.newsletterCampaigns).values({
      id: uuid(),
      subject: String(n.subject),
      body: String(n.description ?? ""),
      status: sent.length > 0 ? "sent" : "draft",
      sentAt: sent.length > 0 ? (toDate(sent[0].sent_at) ?? new Date()) : null,
      stats:
        sent.length > 0
          ? {
              sent: sent.filter((h) => h.status === "sent").length,
              failed: sent.filter((h) => h.status !== "sent").length,
            }
          : null,
    });
  }

  const notifications = await legacy("SELECT * FROM notifications");
  for (const n of notifications) {
    const userId = idm.users.get(Number(n.to_user));
    if (!userId) continue;
    await db.insert(t.notifications).values({
      id: uuid(),
      userId,
      type: String(n.type ?? "legacy"),
      title: String(n.title ?? ""),
      body: (n.description as string) ?? null,
      readAt: bool(n.status) ? new Date() : null,
      createdAt: toDate(n.created_at) ?? new Date(),
    });
  }

  // settings + frontend_settings → typed domains + full legacy.* bucket
  const settings = await legacy("SELECT * FROM settings");
  const frontendRows = await legacy("SELECT * FROM frontend_settings");
  const merged: Record<string, string> = {};
  for (const r of [...settings, ...frontendRows]) merged[String(r.key)] = String(r.value ?? "");

  const system = {
    name: merged.system_name ?? "Academy LMS",
    title: merged.system_title ?? merged.system_name ?? "Academy LMS",
    email: merged.system_email ?? null,
    timezone: merged.timezone ?? "UTC",
    language: merged.language ?? "english",
    currencyCode: merged.system_currency ?? "USD",
    currencySymbol: "$",
    instructorRevenuePercent: Number(merged.instructor_revenue ?? 70),
    courseSellingTax: Number(merged.course_selling_tax ?? 0),
  };
  const frontendOut = {
    heroTitle: merged.banner_title ?? "Learn anything, anywhere",
    heroSubTitle: merged.banner_sub_title ?? "",
    footerText: merged.footer_text ?? "",
    facebook: merged.facebook ?? "",
    twitter: merged.twitter ?? "",
    linkedin: merged.linkedin ?? "",
  };
  const notificationTemplates = Object.fromEntries(
    (await legacy("SELECT * FROM notification_settings")).map((n) => [String(n.type), n]),
  );

  await db
    .insert(t.settings)
    .values([
      { key: "system", value: system },
      { key: "frontend", value: frontendOut },
      { key: "notificationTemplates", value: notificationTemplates },
      { key: "legacy", value: merged },
    ])
    .onConflictDoNothing();

  const homePages = await legacy("SELECT * FROM home_pages");
  const activeIdentifier = String(merged.home_page ?? "home_1");
  for (const h of homePages) {
    await db
      .insert(t.homePageConfigs)
      .values({
        id: uuid(),
        identifier: String(h.identifier ?? `legacy-${h.id}`),
        title: String(h.title),
        description: (h.description as string) ?? null,
        sections: [
          { type: "hero", props: {} },
          { type: "topCourses", props: {} },
          { type: "topCategories", props: {} },
          { type: "topInstructors", props: {} },
        ],
        isPermanent: bool(h.is_permanent),
        isActive: activeIdentifier === String(h.identifier),
      })
      .onConflictDoNothing();
  }
  warn("home_pages: legacy layouts were PHP templates — migrated as default section sets (edit in the admin builder)");
  warn("currency table not ported (single-currency model) — reference kept in settings.legacy");
  return {
    subscribers: subscribers.length, campaigns: newsletters.length,
    notifications: notifications.length, homePages: homePages.length,
  };
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  const target = process.env.DATABASE_URL?.split("@")[1] ?? "?";
  console.log(`ETL → ${target}${DRY ? " (DRY RUN)" : ""}`);
  const started = Date.now();
  await getMysql();

  const tableCheck = await legacy("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()");
  console.log(`legacy tables present: ${Number(tableCheck[0]?.n ?? 0)}`);

  if (DRY) {
    const counts = await legacy(
      "SELECT (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM course) courses, (SELECT COUNT(*) FROM lesson) lessons, (SELECT COUNT(*) FROM enrol) enrols, (SELECT COUNT(*) FROM payment) payments, (SELECT COUNT(*) FROM rating) ratings, (SELECT COUNT(*) FROM blogs) blogs",
    );
    console.log("source counts:", counts[0]);
    await mysqlDb?.end();
    return;
  }

  if (WIPE) {
    console.log("wiping target domains…");
    await truncateTarget();
  }

  const report: Record<string, unknown> = {};
  const categoryMap = await migrateCategories();
  report.categories = categoryMap.size;
  report.users = await migrateUsers();
  report.courses = await migrateCourses(categoryMap);
  report.wishlists = await migrateWishlists();
  report.curriculum = await migrateCurriculum();
  report.enrollments = await migrateEnrollments();
  report.commerce = await migrateCommerce();
  report.reviews = await migrateReviews();
  report.progress = await migrateProgress();
  report.quizResults = await migrateQuizResults();
  report.social = await migrateSocial();
  report.content = await migrateContent();
  report.platform = await migratePlatform();

  const orphanEnrollments = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(t.enrollments)
    .leftJoin(t.courses, eq(t.courses.id, t.enrollments.courseId))
    .where(sql`${t.courses.id} is null`);
  const orphanPayments = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(t.payments)
    .leftJoin(t.orders, eq(t.orders.id, t.payments.orderId))
    .where(sql`${t.orders.id} is null`);

  console.log("\n=== ETL REPORT ===");
  for (const [k, v] of Object.entries(report)) console.log(` ${k}:`, v);
  console.log(` orphan enrollments: ${orphanEnrollments[0]?.n ?? 0} | orphan payments: ${orphanPayments[0]?.n ?? 0}`);
  console.log(` warnings: ${warnings.length}`);
  for (const w of [...new Set(warnings)].slice(0, 15)) console.log("  ⚠", w);
  console.log(` done in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  await mysqlDb?.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("ETL FAILED:", err);
  await mysqlDb?.end().catch(() => {});
  process.exit(1);
});
