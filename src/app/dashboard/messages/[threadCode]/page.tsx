import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getThread, requireSession } from "@/server/queries/community";
import { ReplyForm } from "@/components/dashboard/reply-form";

type Params = Promise<{ threadCode: string }>;

export const metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: { params: Params }) {
  const { threadCode } = await params;
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const data = await getThread(threadCode, session.user.id);
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="kicker">06 · Conversation</p>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage src={data.partner?.image ?? undefined} alt={data.partner?.name ?? ""} />
            <AvatarFallback>{(data.partner?.name ?? "?").charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-heading text-xl font-semibold">{data.partner?.name}</h1>
            <Link href="/dashboard/messages" className="text-coral text-xs hover:underline">
              <ArrowLeft className="mr-1 inline size-3" />
              All conversations
            </Link>
          </div>
        </div>
      </header>

      <div className="rule-dash" aria-hidden />

      <ul className="flex flex-col gap-4" aria-label="Messages">
        {data.messages.map((message) => {
          const mine = message.senderId === session.user.id;
          return (
            <li key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-xl px-4 py-3 text-sm",
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border rounded-bl-sm",
                )}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    mine ? "text-primary-foreground/60" : "text-muted-foreground",
                  )}
                >
                  {new Intl.DateTimeFormat("en", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(message.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <ReplyForm threadCode={threadCode} />
    </div>
  );
}
