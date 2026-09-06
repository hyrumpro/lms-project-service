import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { courseHref } from "@/lib/slug";
import { listStudioCourses } from "@/server/queries/studio";
import { requireSession } from "@/server/queries/community";
import { CourseStatusButtons } from "@/components/studio/course-status-buttons";

export const metadata = { title: "Studio courses" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  draft: "outline",
};

export default async function StudioCoursesPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  if (!session.user.isInstructor && session.user.role !== "admin") redirect("/studio");
  const courses = await listStudioCourses(session.user.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="kicker">02 · Catalog</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Courses</h1>
        </div>
        <Link
          href="/studio/courses/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + New
        </Link>
      </header>

      {courses.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border-2 border-dashed p-10 text-center text-sm">
          No courses yet — create your first one.
        </p>
      ) : (
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
          {courses.map((course) => (
            <li key={course.id} className="flex flex-wrap items-center gap-3 bg-card p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/studio/courses/${course.id}/edit`}
                    className="font-heading font-medium hover:underline"
                  >
                    {course.title}
                  </Link>
                  <Badge variant={STATUS_VARIANT[course.status] ?? "outline"}>
                    {course.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {course.lessonCount} lessons · {course.studentCount} students ·{" "}
                  {course.ratingAvg > 0 ? `★ ${course.ratingAvg.toFixed(1)}` : "unrated"}
                </p>
              </div>
              {course.status === "active" && (
                <Link
                  href={courseHref(course.slug, course.id)}
                  className="text-coral text-sm font-medium hover:underline"
                >
                  View public page →
                </Link>
              )}
              <CourseStatusButtons courseId={course.id} status={course.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
