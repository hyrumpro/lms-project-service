import { Radio } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { liveClasses } from "@/db/schema";

/** Upcoming live sessions on the course page (spec §7.11). */
export async function LiveClassesSection({ courseId }: { courseId: string }) {
  const sessions = await db
    .select()
    .from(liveClasses)
    .where(eq(liveClasses.courseId, courseId))
    .orderBy(asc(liveClasses.startsAt));
  const upcoming = sessions.filter((s) => s.startsAt.getTime() > Date.now() - 2 * 3_600_000);
  if (upcoming.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Live classes</h2>
      <ul className="flex flex-col gap-2">
        {upcoming.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4"
          >
            <Radio className="text-coral size-4" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{session.title}</p>
              <p className="text-muted-foreground text-xs">
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(session.startsAt)}{" "}
                · {session.provider}
              </p>
            </div>
            {session.joinUrl && (
              <a
                href={session.joinUrl}
                target="_blank"
                rel="noreferrer"
                className="text-coral text-sm font-medium hover:underline"
              >
                Join session →
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
