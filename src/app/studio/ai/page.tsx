import { redirect } from "next/navigation";
import { requireSession } from "@/server/queries/community";
import { AssistantPanel } from "@/components/studio/assistant-panel";

export const metadata = { title: "AI assistant" };

export default async function StudioAiPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">Studio · AI</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          GPT <span className="mark italic">assistant</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          Draft course descriptions, learning outcomes and quiz questions (spec §7.16). Needs{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">OPENAI_API_KEY</code> in .env.
        </p>
      </header>
      <AssistantPanel />
    </div>
  );
}
