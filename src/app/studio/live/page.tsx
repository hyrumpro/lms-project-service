import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { requireSession } from "@/server/queries/community";
import { listMyLiveClasses } from "@/server/actions/platform";
import { LiveClassForm } from "@/components/studio/live-class-form";

export const metadata = { title: "Live classes" };

export default async function StudioLivePage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const [classes, myCourses] = await Promise.all([
    listMyLiveClasses(),
    db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(
        sql`${courses.id} in (select course_id from course_instructors where instructor_id = ${session.user.id})`,
      )
      .orderBy(courses.title),
  ]);
  const now = Date.now();

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">Studio · Live</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Live classes</h1>
        <p className="text-muted-foreground text-sm">
          Jitsi rooms are generated automatically (no keys needed). Zoom/BBB take a join URL.
        </p>
      </header>

      <LiveClassForm courses={myCourses} />

      <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
        {classes.map((cls) => {
          const upcoming = cls.startsAt.getTime() > now;
          return (
            <li key={cls.id} className="flex flex-wrap items-center gap-3 bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{cls.title}</p>
                <p className="text-muted-foreground text-sm">
                  {cls.courseTitle} ·{" "}
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(cls.startsAt)}
                </p>
              </div>
              <Badge variant="secondary">{cls.provider}</Badge>
              {cls.joinUrl && upcoming && (
                <a
                  href={cls.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-coral text-sm font-medium hover:underline"
                >
                  Join →
                </a>
              )}
            </li>
          );
        })}
        {classes.length === 0 && (
          <li className="text-muted-foreground bg-card p-6 text-sm">No sessions scheduled yet.</li>
        )}
      </ul>
    </div>
  );
}
