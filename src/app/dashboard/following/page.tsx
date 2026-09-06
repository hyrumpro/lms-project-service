import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { auth } from "@/lib/auth";
import { getFollowedInstructors } from "@/server/queries/social";
import { UnfollowButton } from "@/components/shared/unfollow-button";

export const metadata = { title: "Following" };

export default async function FollowingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const [instructors, t] = await Promise.all([
    getFollowedInstructors(session.user.id),
    getTranslations("following"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">{t("kicker")}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
      </header>

      {instructors.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border-2 border-dashed p-10 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
          {instructors.map((instructor) => (
            <li key={instructor.id} className="flex items-center gap-4 bg-card p-4">
              <Avatar className="size-10">
                <AvatarFallback>{instructor.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <a href={`/instructor/${instructor.id}`} className="font-medium hover:underline">
                  {instructor.name}
                </a>
                {instructor.title && (
                  <p className="text-muted-foreground text-sm">{instructor.title}</p>
                )}
              </div>
              <UnfollowButton instructorId={instructor.id} label={t("unfollow")} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
