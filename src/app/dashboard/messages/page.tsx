import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUnreadCount, getMessageThreads, requireSession } from "@/server/queries/community";

export async function generateMetadata() {
  const session = await requireSession();
  const unread = session ? await getUnreadCount(session.user.id) : 0;
  return { title: unread > 0 ? `Messages (${unread})` : "Messages" };
}

export default async function MessagesPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const threads = await getMessageThreads(session.user.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">06 · Direct lines</p>
        <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
        <p className="text-muted-foreground text-sm">
          Conversations with instructors and classmates.
        </p>
      </header>

      {threads.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border-2 border-dashed p-10 text-center text-sm">
          No conversations yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
          {threads.map((thread) => (
            <li key={thread.id} className="bg-card">
              <Link
                href={`/dashboard/messages/${thread.threadCode}`}
                className="flex items-center gap-4 p-5 transition-colors hover:bg-secondary/40"
              >
                <Avatar className="size-10">
                  <AvatarImage src={thread.partner?.image ?? undefined} alt={thread.partner?.name ?? ""} />
                  <AvatarFallback>{(thread.partner?.name ?? "?").charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{thread.partner?.name ?? "Unknown"}</p>
                  <p className="text-muted-foreground truncate text-sm">{thread.lastMessage?.body}</p>
                </div>
                <time className="text-muted-foreground shrink-0 text-xs">
                  {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
                    thread.lastMessageAt,
                  )}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
