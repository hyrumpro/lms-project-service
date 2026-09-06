import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { getSystemSettings } from "@/lib/settings";
import { getInstructorEarnings } from "@/server/queries/commerce";
import { getStudioStats } from "@/server/queries/studio";
import { requireSession } from "@/server/queries/community";

export const metadata = { title: "Studio" };

export default async function StudioPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  if (!session.user.isInstructor && session.user.role !== "admin") redirect("/studio");

  const [stats, earnings, system] = await Promise.all([
    getStudioStats(session.user.id),
    getInstructorEarnings(session.user.id),
    getSystemSettings(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="kicker">01 · Overview</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Your studio, <span className="mark italic">{session.user.firstName}</span>.
        </h1>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        {[
          ["Courses", `${stats.active}/${stats.total} active`],
          ["Pending review", String(stats.pending)],
          ["Students", String(stats.students)],
          ["Earned", formatMoney(earnings, system)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 bg-card p-5">
            <dt className="kicker">{label}</dt>
            <dd className="font-heading text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/studio/courses/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Create a course
        </Link>
        <Link
          href="/studio/sales"
          className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-secondary"
        >
          View sales
        </Link>
      </div>
    </div>
  );
}
