import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getMessageRecipients,
  getMessageThreads,
  getUnreadCount,
  requireSession,
} from "@/server/queries/community";
import { NewConversationDialog } from "@/components/dashboard/new-conversation-dialog";

export async function generateMetadata() {
  const session = await requireSession();
  const unread = session ? await getUnreadCount(session.user.id) : 0;
  return { title: unread > 0 ? `Messages (${unread})` : "Messages" };
}

export default async function MessagesPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const [threads, recipients] = await Promise.all([
    getMessageThreads(session.user.id),
    getMessageRecipients(session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="kicker">06 · Direct lines</p>
          <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
          <p className="text-muted-foreground text-sm">
            Conversations with instructors and classmates.
          </p>
        </div>
        <NewConversationDialog recipients={recipients} />
      </header>

      {threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center">
          <p className="text-muted-foreground text-sm">No conversations yet.</p>
          <NewConversationDialog recipients={recipients} />
        </div>
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
