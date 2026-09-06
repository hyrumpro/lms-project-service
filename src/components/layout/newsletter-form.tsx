"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { subscribeToNewsletter } from "@/server/actions/blog";

export function NewsletterForm() {
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email"));
    setPending(true);
    const result = await subscribeToNewsletter(email);
    setPending(false);
    if (result.ok) {
      toast.success("You're on the list!");
      form.reset();
    } else {
      toast.error("That email doesn't look right.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xs flex-col gap-2 sm:flex-row">
      <Input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        aria-label="Email for the newsletter"
        className="w-full"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Spinner data-icon="inline-start" />}
        Subscribe
      </Button>
    </form>
  );
}
