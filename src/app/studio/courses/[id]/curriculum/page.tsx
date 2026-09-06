import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/server/queries/community";
import { getCourseForEdit, getCurriculumForEdit } from "@/server/queries/studio";
import { CurriculumManager } from "@/components/studio/curriculum-manager";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Curriculum" };

export default async function CurriculumPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const course = await getCourseForEdit(id, session.user.id);
  if (!course) notFound();
  const curriculum = await getCurriculumForEdit(id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">02 · Curriculum builder</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{course.title}</h1>
        <p className="text-muted-foreground text-sm">
          Sections hold lessons. Video lessons play in the player; quiz lessons open the quiz
          builder with per-type questions.
        </p>
      </header>

      <CurriculumManager
        courseId={id}
        sections={curriculum.map((s) => ({
          id: s.id,
          title: s.title,
          lessons: s.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            type: l.type,
            isFreePreview: l.isFreePreview,
            durationSeconds: l.durationSeconds,
            questions: l.questions.map((q) => ({
              id: q.id,
              title: q.title,
              type: q.type,
              options: q.options,
              correctAnswers: q.correctAnswers,
            })),
          })),
        }))}
      />
    </div>
  );
}
