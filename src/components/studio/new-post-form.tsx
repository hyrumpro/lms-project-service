"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { createInstructorPost } from "@/server/actions/studio";

export function NewPostForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="rounded-xl border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await createInstructorPost({
            title: String(fd.get("title")),
            description: String(fd.get("description")),
            categorySlug: String(fd.get("categorySlug") ?? "teaching-learning"),
          });
          if (result.ok) {
            toast.success("Submitted — pending admin review.");
            router.refresh();
          } else {
            toast.error("Could not submit the post.");
          }
        });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="post-title">Title</FieldLabel>
          <Input id="post-title" name="title" required minLength={6} />
        </Field>
        <Field>
          <FieldLabel htmlFor="post-body">Body (HTML)</FieldLabel>
          <Textarea id="post-body" name="description" rows={5} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="post-cat">Category slug</FieldLabel>
          <Input id="post-cat" name="categorySlug" defaultValue="teaching-learning" required />
        </Field>
        <Button type="submit" disabled={pending} className="w-fit">
          {pending && <Spinner data-icon="inline-start" />}
          Submit for review
        </Button>
      </FieldGroup>
    </form>
  );
}
