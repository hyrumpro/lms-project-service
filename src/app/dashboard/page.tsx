import Link from "next/link";
import { redirect } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { courseHref } from "@/lib/slug";
import { formatMoney } from "@/lib/money";
import { getSystemSettings } from "@/lib/settings";
import { getDashboardOverview, requireSession } from "@/server/queries/community";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const [overview, system] = await Promise.all([
    getDashboardOverview(session.user.id),
    getSystemSettings(),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="kicker">01 · Overview</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {greeting}, <span className="mark italic">{session.user.firstName ?? session.user.name}</span>.
        </h1>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        {[
          ["Enrolled", overview.myCourses.length],
          ["In progress", overview.inProgress.length],
          ["Completed", overview.completed.length],
          ["Unread alerts", overview.unread],
        ].map(([label, value]) => (
          <div key={label as string} className="flex flex-col gap-1 bg-card p-5">
            <dt className="kicker">{label}</dt>
            <dd className="font-heading text-3xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <h2 className="font-heading text-xl font-semibold">Continue learning</h2>
          <Link href="/dashboard/my-courses" className="text-coral text-sm font-medium hover:underline">
            All courses →
          </Link>
        </div>
        {overview.inProgress.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed p-8 text-center">
            <p className="text-muted-foreground text-sm">
              {overview.myCourses.length === 0
                ? "You haven't enrolled in anything yet — the free courses are a great start."
                : "Nothing mid-flight. Pick a course and finish a lesson today."}
            </p>
            <Link
              href="/courses?price=free"
              className="text-coral mt-3 inline-block text-sm font-medium hover:underline"
            >
              Find a free course →
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {overview.inProgress.slice(0, 4).map((course) => (
              <li key={course.id}>
                <Link
                  href={courseHref(course.slug, course.id)}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-heading font-medium">{course.title}</span>
                    <span className="text-coral text-sm font-bold">{course.percent}%</span>
                  </div>
                  <Progress value={course.percent} aria-label={`${course.percent}% complete`} />
                  <p className="text-muted-foreground text-xs">
                    {course.completedLessons} lessons done · {course.instructorNames}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {overview.notStarted.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold">Waiting for you</h2>
          <ul className="flex flex-wrap gap-2">
            {overview.notStarted.slice(0, 6).map((course) => (
              <li key={course.id}>
                <Link
                  href={courseHref(course.slug, course.id)}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
                >
                  {course.title}
                  <span className="text-muted-foreground text-xs">
                    {course.isFree ? "Free" : formatMoney(course.price, system)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
