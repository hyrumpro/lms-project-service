import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getLearnData, getLearnAccess } from "@/server/queries/learn";

type Params = Promise<{ courseId: string }>;

/** /learn/[courseId] → resume the last-played lesson (legacy update_last_played_lesson). */
export default async function LearnCoursePage({ params }: { params: Params }) {
  const { courseId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const access = await getLearnAccess(session.user.id, courseId);
  if (!access.ok) redirect("/dashboard/my-courses");

  const data = await getLearnData(session.user.id, courseId);
  const allLessons = data?.sections.flatMap((s) => s.lessons) ?? [];
  const firstUncompleted =
    allLessons.find((l) => !l.locked && !l.isCompleted) ?? allLessons.find((l) => !l.locked);

  if (firstUncompleted) {
    redirect(`/learn/${courseId}/${firstUncompleted.id}`);
  }
  redirect("/dashboard/my-courses");
}
