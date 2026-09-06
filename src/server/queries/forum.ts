import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { forumQuestions, forumReplies, user } from "@/db/schema";

/** Course Q&A (legacy forum addon): questions with replies + vote counts. */
export async function getCourseForum(courseId: string) {
  const questions = await db
    .select({
      id: forumQuestions.id,
      title: forumQuestions.title,
      body: forumQuestions.body,
      votes: forumQuestions.votes,
      createdAt: forumQuestions.createdAt,
      authorName: user.name,
    })
    .from(forumQuestions)
    .innerJoin(user, eq(user.id, forumQuestions.userId))
    .where(eq(forumQuestions.courseId, courseId))
    .orderBy(desc(forumQuestions.createdAt))
    .limit(50);

  if (questions.length === 0) return [];

  const replies = await db
    .select({
      id: forumReplies.id,
      questionId: forumReplies.questionId,
      body: forumReplies.body,
      createdAt: forumReplies.createdAt,
      authorName: user.name,
    })
    .from(forumReplies)
    .innerJoin(user, eq(user.id, forumReplies.userId))
    .where(inArray(forumReplies.questionId, questions.map((q) => q.id)))
    .orderBy(forumReplies.createdAt);

  return questions.map((question) => ({
    ...question,
    replies: replies.filter((r) => r.questionId === question.id),
  }));
}
