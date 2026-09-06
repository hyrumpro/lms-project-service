"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowBigUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { askForumQuestion, replyToQuestion, toggleForumVote } from "@/server/actions/platform";

type Question = {
  id: string;
  title: string;
  body: string;
  votes: string[];
  authorName: string;
  replies: { id: string; body: string; authorName: string }[];
};

export function CourseForum({
  courseId,
  questions,
  enrolled,
  labels,
}: {
  courseId: string;
  questions: Question[];
  enrolled: boolean;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!enrolled) {
    return (
      <p className="text-muted-foreground rounded-lg border bg-secondary/40 p-4 text-sm">
        {labels.enrollFirst}
      </p>
    );
  }

  function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "");
    const body = String(fd.get("body") ?? "");
    if (title.length < 6 || body.length < 10) {
      toast.error(labels.needDetails);
      return;
    }
    startTransition(async () => {
      const result = await askForumQuestion({ courseId, title, body });
      if (result.ok) {
        form.reset();
        router.refresh();
      } else toast.error(labels.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={ask} className="flex flex-col gap-3 rounded-xl border bg-secondary/30 p-4">
        <p className="kicker">{labels.askTitle}</p>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="forum-title">{labels.question}</FieldLabel>
            <Input id="forum-title" name="title" required minLength={6} />
          </Field>
          <Field>
            <FieldLabel htmlFor="forum-body">{labels.details}</FieldLabel>
            <Textarea id="forum-body" name="body" rows={3} minLength={10} />
          </Field>
        </FieldGroup>
        <Button type="submit" size="sm" disabled={pending} className="w-fit">
          {pending && <Spinner data-icon="inline-start" />}
          {labels.ask}
        </Button>
      </form>

      <ul className="flex flex-col gap-4">
        {questions.map((question) => (
          <QuestionRow key={question.id} courseId={courseId} question={question} labels={labels} />
        ))}
        {questions.length === 0 && (
          <li className="text-muted-foreground rounded-lg border-2 border-dashed p-6 text-center text-sm">
            {labels.empty}
          </li>
        )}
      </ul>
    </div>
  );
}

function QuestionRow({
  courseId,
  question,
  labels,
}: {
  courseId: string;
  question: Question;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex gap-3 rounded-xl border bg-card p-4">
      <button
        aria-label={labels.votes}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await toggleForumVote(question.id);
            router.refresh();
          })
        }
        className="text-muted-foreground hover:text-coral flex h-fit flex-col items-center rounded-lg border px-2 py-1.5 text-xs font-semibold"
      >
        <ArrowBigUp className="size-4" />
        {question.votes.length}
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-heading font-semibold">{question.title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{question.body}</p>
        <p className="text-muted-foreground mt-2 text-xs">{question.authorName}</p>

        {question.replies.length > 0 && (
          <ul className="border-l-2 pl-4">
            {question.replies.map((reply) => (
              <li key={reply.id} className="mt-3">
                <p className="text-sm">{reply.body}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">{reply.authorName}</p>
              </li>
            ))}
          </ul>
        )}

        <ReplyForm questionId={question.id} courseId={courseId} labels={labels} />
      </div>
    </li>
  );
}

function ReplyForm({
  questionId,
  courseId,
  labels,
}: {
  questionId: string;
  courseId: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (body.length < 2) return;
    startTransition(async () => {
      const result = await replyToQuestion({ questionId, courseId, body });
      if (result.ok) {
        form.reset();
        router.refresh();
      } else toast.error(labels.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex gap-2">
      <Input name="body" placeholder={labels.writeReply} aria-label={labels.reply} required />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending && <Spinner />}
        {labels.reply}
      </Button>
    </form>
  );
}
