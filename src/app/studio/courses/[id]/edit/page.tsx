import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/server/queries/community";
import { getCourseForEdit } from "@/server/queries/studio";
import { CourseSettingsForms } from "@/components/studio/course-settings-forms";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Edit course" };

export default async function EditCoursePage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const course = await getCourseForEdit(id, session.user.id);
  if (!course) notFound();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <p className="kicker">02 · Settings</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{course.title}</h1>
        </div>
        <Badge variant="outline" className="ml-auto">
          {course.status}
        </Badge>
      </header>

      <nav className="flex gap-3 text-sm">
        <Link href={`/studio/courses/${id}/curriculum`} className="text-coral font-medium hover:underline">
          Curriculum builder →
        </Link>
        <span className="text-muted-foreground">Media · pricing · details below</span>
      </nav>

      <CourseSettingsForms
        course={{
          id: course.id,
          thumbnail: course.thumbnail,
          promoVideoUrl: course.promoVideoUrl,
          isFree: course.isFree,
          price: course.price,
          discountEnabled: course.discountEnabled,
          discountedPrice: course.discountedPrice,
          outcomes: course.outcomes,
          requirements: course.requirements,
          faqs: course.faqs,
        }}
      />
    </div>
  );
}
