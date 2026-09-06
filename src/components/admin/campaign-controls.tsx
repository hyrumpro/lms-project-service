"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createCampaign, sendCampaign } from "@/server/actions/platform";

export function CampaignForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await createCampaign({
        subject: String(fd.get("subject")),
        body: String(fd.get("body")),
      });
      if (result.ok) {
        toast.success("Campaign saved as draft");
        form.reset();
        router.refresh();
      } else toast.error("Subject 3+ chars, body 10+ chars");
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="subject">Subject</FieldLabel>
          <Input id="subject" name="subject" required minLength={3} />
        </Field>
        <Field>
          <FieldLabel htmlFor="body">Message</FieldLabel>
          <Textarea id="body" name="body" rows={5} required minLength={10} />
        </Field>
        <Button type="submit" disabled={pending} className="w-fit">
          {pending && <Spinner data-icon="inline-start" />}
          Save draft
        </Button>
      </FieldGroup>
    </form>
  );
}

export function SendCampaignButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await sendCampaign(campaignId);
          if (result.ok) {
            toast.success("Campaign sent");
            router.refresh();
          } else toast.error("Could not send");
        })
      }
    >
      {pending ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
      Send now
    </Button>
  );
}
