"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { addPostComment } from "@/server/actions/blog";

export function CommentForm({ postId, slug }: { postId: string; slug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (body.length < 2) {
      toast.error("Write at least a couple of words.");
      return;
    }
    setPending(true);
    const result = await addPostComment({ postId, slug, body });
    setPending(false);
    if (result.ok) {
      toast.success("Comment posted.");
      form.reset();
      router.refresh();
    } else {
      toast.error("Could not post your comment.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Field>
        <FieldLabel htmlFor="comment-body">Add to the discussion</FieldLabel>
        <Textarea
          id="comment-body"
          name="body"
          rows={3}
          required
          placeholder="Share your thoughts…"
        />
      </Field>
      <Button type="submit" className="mt-3" disabled={pending}>
        {pending && <Spinner data-icon="inline-start" />}
        Post comment
      </Button>
    </form>
  );
}
