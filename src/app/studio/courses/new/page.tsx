import { getCategoryOptions } from "@/server/queries/studio";
import { NewCourseForm } from "@/components/studio/new-course-form";

export const metadata = { title: "New course" };

export default async function NewCoursePage() {
  const categories = await getCategoryOptions();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">02 · Create</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">New course</h1>
        <p className="text-muted-foreground text-sm">
          Basics first — then the curriculum builder. Courses start as drafts and go live after
          admin review.
        </p>
      </header>
      <NewCourseForm categories={categories} />
    </div>
  );
}
