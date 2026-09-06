import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { Award, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { badgeAwards, badges } from "@/db/schema";
import { auth } from "@/lib/auth";
import { Progress } from "@/components/ui/progress";

export const metadata = { title: "Badges" };

export default async function BadgesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const t = await getTranslations("badges");

  const allBadges = await db.select().from(badges).orderBy(badges.conditionFrom);
  const earned = await db
    .select({ badgeId: badgeAwards.badgeId, awardedAt: badgeAwards.awardedAt })
    .from(badgeAwards)
    .where(eq(badgeAwards.userId, session.user.id));
  const earnedMap = new Map(earned.map((e) => [e.badgeId, e.awardedAt]));

  // live counters for progress display (mirrors evaluateBadges)
  const counters = await db
    .select({
      lessons: sql<number>`(select count(*) from lesson_progress lp where lp.user_id = ${session.user.id} and lp.is_completed)::int`,
      coursesCompleted: sql<number>`(select count(*) from course_progress cp where cp.user_id = ${session.user.id} and cp.percent = 100)::int`,
      enrollments: sql<number>`(select count(*) from enrollments e where e.user_id = ${session.user.id})::int`,
      quizzesAced: sql<number>`(select count(*) from quiz_results qr where qr.user_id = ${session.user.id} and qr.obtained_marks = qr.total_marks)::int`,
    })
    .from(badges)
    .limit(1);
  const counts = counters[0] ?? { lessons: 0, coursesCompleted: 0, enrollments: 0, quizzesAced: 0 };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">{t("kicker")}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
      </header>

      {allBadges.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border-2 border-dashed p-10 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {allBadges.map((badge) => {
            const isEarned = earnedMap.has(badge.id);
            const target = badge.conditionTo ?? badge.conditionFrom;
            const value =
              badge.type === "lessons_completed"
                ? counts.lessons
                : badge.type === "courses_completed"
                  ? counts.coursesCompleted
                  : badge.type === "quizzes_aced"
                    ? counts.quizzesAced
                    : counts.enrollments;
            const percent = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
            return (
              <li
                key={badge.id}
                className={`flex flex-col gap-3 rounded-xl border p-5 ${
                  isEarned ? "border-sun bg-sun/10" : "bg-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-11 items-center justify-center rounded-full border-2 ${
                      isEarned
                        ? "border-coral bg-card text-coral"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {isEarned ? <Award className="size-5" /> : <Lock className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-semibold">{badge.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {isEarned ? t("earned") : t("locked")}
                    </p>
                  </div>
                </div>
                {badge.description && (
                  <p className="text-muted-foreground text-sm">{badge.description}</p>
                )}
                {!isEarned && (
                  <div className="flex flex-col gap-1">
                    <Progress value={percent} aria-label={`${percent}%`} />
                    <p className="text-muted-foreground text-[11px]">
                      {t("progress", { value: Math.min(value, target), target })} · {percent}%
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
