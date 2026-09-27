import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courseProgress, lessonProgress, lessons, questions, quizResults, quizzes } from "@/db/schema";
import { answersMatch } from "@/lib/quiz-grade";

export async function gradeQuiz(
  userId: string,
  input: { courseId: string; lessonId: string; answers: Record<string, string[]> },
): Promise<
  | {
      ok: true;
      obtainedMarks: number;
      totalMarks: number;
      attemptsLeft: number;
      answers: { questionId: string; submitted: string[]; correct: string[]; status: number }[];
    }
  | { ok: false; error: string }
> {
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, input.lessonId), eq(lessons.courseId, input.courseId)))
    .limit(1);
  if (!lesson || lesson.type !== "quiz") return { ok: false, error: "not_found" };

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.lessonId, lesson.id)).limit(1);
  if (!quiz) return { ok: false, error: "not_found" };

  const attempts = await db
    .select({ id: quizResults.id })
    .from(quizResults)
    .where(and(eq(quizResults.quizId, quiz.id), eq(quizResults.userId, userId)));
  if (attempts.length >= lesson.quizMaxAttempts) return { ok: false, error: "no_attempts_left" };

  const questionRows = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quiz.id))
    .orderBy(asc(questions.order));

  const graded = questionRows.map((question) => {
    const submitted = input.answers[question.id] ?? [];
    const status = answersMatch(question.type, submitted, question.correctAnswers) ? 1 : 0;
    return { questionId: question.id, submitted, correct: question.correctAnswers, status };
  });
  const totalMarks = questionRows.length;
  const obtainedMarks = graded.reduce((sum, row) => sum + row.status, 0);

  await db.insert(quizResults).values({
    quizId: quiz.id,
    userId,
    answers: graded,
    obtainedMarks,
    totalMarks,
    isSubmitted: true,
  });

  await db
    .insert(lessonProgress)
    .values({ userId, lessonId: input.lessonId, isCompleted: true, watchCount: 1 })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { isCompleted: true, updatedAt: new Date() },
    });

  await db.insert(courseProgress).values({ userId, courseId: input.courseId }).onConflictDoNothing();

  const [progressRow] = await db
    .select({ quizSummary: courseProgress.quizSummary })
    .from(courseProgress)
    .where(and(eq(courseProgress.userId, userId), eq(courseProgress.courseId, input.courseId)))
    .limit(1);
  const nextSummary = [
    ...(progressRow?.quizSummary ?? []).filter((row) => row.lessonId !== input.lessonId),
    { lessonId: input.lessonId, obtainedMarks, totalMarks },
  ];
  await db
    .update(courseProgress)
    .set({ quizSummary: nextSummary, updatedAt: new Date() })
    .where(and(eq(courseProgress.userId, userId), eq(courseProgress.courseId, input.courseId)));

  return {
    ok: true,
    obtainedMarks,
    totalMarks,
    attemptsLeft: lesson.quizMaxAttempts - attempts.length - 1,
    answers: graded,
  };
}
