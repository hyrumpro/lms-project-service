import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkAllReadButton } from "@/components/dashboard/mark-all-read";
import { getNotifications, requireSession } from "@/server/queries/community";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const items = await getNotifications(session.user.id);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="kicker">05 · Signals</p>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
        </div>
        {unread > 0 && <MarkAllReadButton />}
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-10 text-center">
          <Bell className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            All quiet. Course and enrollment updates will land here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
          {items.map((n) => (
            <li
              key={n.id}
              className={`flex items-start gap-3 p-5 ${
                n.readAt ? "bg-card" : "bg-accent/60"
              }`}
            >
              <span
                aria-hidden
                className={`mt-1.5 size-2 shrink-0 rounded-full ${
                  n.readAt ? "bg-border" : "bg-coral"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-muted-foreground text-sm">{n.body}</p>}
              </div>
              <time className="text-muted-foreground shrink-0 text-xs">
                {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(n.createdAt)}
              </time>
              {n.url && (
                <Button variant="ghost" size="sm" render={<Link href={n.url} />}>
                  Open
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
