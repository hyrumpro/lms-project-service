import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { courseHref } from "@/lib/slug";
import { ModerateCourseButtons } from "@/components/admin/controls";
import { listAllCourses } from "@/server/queries/admin";

export const metadata = { title: "Admin · Courses" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  draft: "outline",
};

export default async function AdminCoursesPage() {
  const courses = await listAllCourses();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">02 · Catalog</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Courses</h1>
        <p className="text-muted-foreground text-sm">
          Approve submissions, unpublish anything, watch the student counts.
        </p>
      </header>

      <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
        {courses.map((course) => (
          <li key={course.id} className="flex flex-wrap items-center gap-3 bg-card p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={courseHref(course.slug, course.id)}
                  className="font-heading font-medium hover:underline"
                >
                  {course.title}
                </Link>
                <Badge variant={STATUS_VARIANT[course.status] ?? "outline"}>{course.status}</Badge>
                {course.isFree && <Badge variant="outline">free</Badge>}
              </div>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {course.instructorNames || "No instructor"} · {course.categoryName ?? "Uncategorized"}{" "}
                · {course.studentCount} students
              </p>
            </div>
            <ModerateCourseButtons courseId={course.id} status={course.status} />
          </li>
        ))}
        {courses.length === 0 && (
          <li className="text-muted-foreground bg-card p-6 text-sm">No courses yet.</li>
        )}
      </ul>
    </div>
  );
}
