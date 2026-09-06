import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { courses, lessons } from "./catalog";

/**
 * Learning domain — legacy tables: enrol, watch_histories, watched_duration,
 * question, quiz_results (spec §5). Progress is one row per lesson
 * (replaces the legacy completed_lessons JSON array).
 */

export const enrollmentSourceEnum = pgEnum("enrollment_source", [
  "purchase",
  "free",
  "gift",
  "manual",
  "bundle",
  "subscription",
]);

export const questionTypeEnum = pgEnum("question_type", [
  "multiple_choice",
  "single_choice",
  "fill_in_the_blank",
]);

export const enrollments = pgTable(
  "enrollments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    legacyId: integer("legacy_id"), // legacy enrol.id (audit trail)
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    giftedById: text("gifted_by_id").references(() => user.id, { onDelete: "set null" }),
    source: enrollmentSourceEnum("source").notNull().default("purchase"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("enrollments_user_course_unique").on(t.userId, t.courseId)],
);

/** Legacy: watch_histories (per student × course aggregate). */
export const courseProgress = pgTable(
  "course_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    watchingLessonId: text("watching_lesson_id"),
    completedLessons: integer("completed_lessons").notNull().default(0),
    percent: integer("percent").notNull().default(0),
    quizSummary: jsonb("quiz_summary").$type<
      { lessonId: string; obtainedMarks: number; totalMarks: number }[]
    >(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("course_progress_user_course_unique").on(t.userId, t.courseId)],
);

/** Legacy: watched_duration (per student × lesson). */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    isCompleted: boolean("is_completed").notNull().default(false),
    lastPositionSeconds: integer("last_position_seconds").notNull().default(0),
    watchCount: integer("watch_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("lesson_progress_user_lesson_unique").on(t.userId, t.lessonId)],
);

export const quizzes = pgTable("quizzes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  lessonId: text("lesson_id")
    .notNull()
    .unique()
    .references(() => lessons.id, { onDelete: "cascade" }),
  /** strict quiz timer in minutes (legacy flipclock); null = untimed */
  timeLimitMinutes: integer("time_limit_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable("questions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: questionTypeEnum("type").notNull(),
  numberOfOptions: integer("number_of_options").notNull().default(4),
  options: jsonb("options").$type<string[]>().notNull(),
  correctAnswers: jsonb("correct_answers").$type<string[]>().notNull(),
  order: integer("order").notNull().default(0),
});

export const quizResults = pgTable("quiz_results", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** [{questionId, submitted: string[], correct: string[], status: 0|1}] — legacy shape */
  answers: jsonb("answers")
    .$type<{ questionId: string; submitted: string[]; correct: string[]; status: number }[]>()
    .notNull(),
  obtainedMarks: integer("obtained_marks").notNull().default(0),
  totalMarks: integer("total_marks").notNull().default(0),
  isSubmitted: boolean("is_submitted").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Legacy: rating (ratable_type=course in v1). One review per student per course. */
export const reviews = pgTable(
  "reviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // 1..5
    review: text("review"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("reviews_user_course_unique").on(t.userId, t.courseId)],
);

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(user, { fields: [enrollments.userId], references: [user.id] }),
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
  giftedBy: one(user, {
    fields: [enrollments.giftedById],
    references: [user.id],
    relationName: "gifts",
  }),
}));

export const courseProgressRelations = relations(courseProgress, ({ one }) => ({
  student: one(user, { fields: [courseProgress.userId], references: [user.id] }),
  course: one(courses, { fields: [courseProgress.courseId], references: [courses.id] }),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  student: one(user, { fields: [lessonProgress.userId], references: [user.id] }),
  lesson: one(lessons, { fields: [lessonProgress.lessonId], references: [lessons.id] }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  lesson: one(lessons, { fields: [quizzes.lessonId], references: [lessons.id] }),
  questions: many(questions),
  results: many(quizResults),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  quiz: one(quizzes, { fields: [questions.quizId], references: [quizzes.id] }),
}));

export const quizResultsRelations = relations(quizResults, ({ one }) => ({
  quiz: one(quizzes, { fields: [quizResults.quizId], references: [quizzes.id] }),
  user: one(user, { fields: [quizResults.userId], references: [user.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(user, { fields: [reviews.userId], references: [user.id] }),
  course: one(courses, { fields: [reviews.courseId], references: [courses.id] }),
}));

export type Enrollment = typeof enrollments.$inferSelect;
export type CourseProgressRow = typeof courseProgress.$inferSelect;
export type LessonProgressRow = typeof lessonProgress.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type QuizResult = typeof quizResults.$inferSelect;
export type Review = typeof reviews.$inferSelect;
