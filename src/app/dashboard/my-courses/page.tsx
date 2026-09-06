import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { courseHref } from "@/lib/slug";
import { coursePriceLabel } from "@/lib/money";
import { getSystemSettings } from "@/lib/settings";
import { getMyCourses, requireSession } from "@/server/queries/community";

export const metadata = { title: "My courses" };

export default async function MyCoursesPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const [courses, system] = await Promise.all([
    getMyCourses(session.user.id),
    getSystemSettings(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">02 · Library</p>
        <h1 className="text-3xl font-semibold tracking-tight">My courses</h1>
      </header>

      {courses.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 text-center">
          <p className="text-muted-foreground">No enrollments yet.</p>
          <Link href="/courses?price=free" className="text-coral mt-3 inline-block font-medium hover:underline">
            Start with a free course →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
          {courses.map((course) => {
            const price = coursePriceLabel(course, system);
            return (
              <li key={course.id} className="bg-card">
                <Link
                  href={courseHref(course.slug, course.id)}
                  className="flex flex-col gap-3 p-5 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading font-semibold">{course.title}</span>
                      {course.percent >= 100 && (
                        <Badge className="bg-sun text-sun-foreground rounded-sm font-bold">DONE</Badge>
                      )}
                      {course.percent === 0 && <Badge variant="outline">Not started</Badge>}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {course.instructorNames} · enrolled{" "}
                      {new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(
                        course.enrolledAt,
                      )}
                      {course.expiresAt && " · expires"}{" "}
                      {course.expiresAt &&
                        new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(course.expiresAt)}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress
                        value={course.percent}
                        className="max-w-64"
                        aria-label={`${course.percent}% complete`}
                      />
                      <span className="text-muted-foreground text-xs">{course.percent}%</span>
                    </div>
                  </div>
                  <span className="font-heading shrink-0 text-lg font-semibold">{price.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
