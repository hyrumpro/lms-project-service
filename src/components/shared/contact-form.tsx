"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { sendContactMessage } from "@/server/actions/platform";

export function ContactForm({ labels }: { labels: Record<string, string> }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setPending(true);
    const result = await sendContactMessage({
      name: String(fd.get("name")),
      email: String(fd.get("email")),
      phone: String(fd.get("phone") ?? "") || undefined,
      message: String(fd.get("message")),
    });
    setPending(false);
    if (result.ok) setSent(true);
    else toast.error(labels.error);
  }

  if (sent) {
    return (
      <p className="rounded-lg border-2 border-dashed border-sun bg-sun/10 p-6 text-center text-sm font-medium">
        {labels.sent}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="max-w-xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">{labels.name}</FieldLabel>
            <Input id="name" name="name" required minLength={2} />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">{labels.email}</FieldLabel>
            <Input id="email" name="email" type="email" required />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="phone">{labels.phone}</FieldLabel>
          <Input id="phone" name="phone" type="tel" />
        </Field>
        <Field>
          <FieldLabel htmlFor="message">{labels.message}</FieldLabel>
          <Textarea id="message" name="message" rows={5} required minLength={10} />
        </Field>
        <Button type="submit" disabled={pending} className="w-fit">
          {pending && <Spinner data-icon="inline-start" />}
          {labels.send}
        </Button>
      </FieldGroup>
    </form>
  );
}
