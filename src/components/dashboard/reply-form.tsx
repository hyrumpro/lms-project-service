"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { sendMessage } from "@/server/actions/community";

export function ReplyForm({ threadCode }: { threadCode: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) return;
    setPending(true);
    const result = await sendMessage({ threadCode, body });
    setPending(false);
    if (result.ok) {
      form.reset();
      router.refresh();
    } else {
      toast.error("Message could not be sent.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="sticky bottom-4">
      <Field>
        <Textarea
          name="body"
          rows={2}
          required
          placeholder="Write a reply…"
          aria-label="Write a reply"
          className="bg-card shadow-md"
        />
      </Field>
      <Button type="submit" size="sm" className="mt-2" disabled={pending}>
        {pending && <Spinner data-icon="inline-start" />}
        Send
      </Button>
    </form>
  );
}
