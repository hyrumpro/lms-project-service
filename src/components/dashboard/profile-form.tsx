"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile } from "@/server/actions/community";

export function ProfileForm({
  user,
}: {
  user: { firstName: string; lastName: string; title: string; biography: string; email: string };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    const result = await updateProfile({
      firstName: String(formData.get("firstName")),
      lastName: String(formData.get("lastName")),
      title: String(formData.get("title") ?? ""),
      biography: String(formData.get("biography") ?? ""),
    });
    setPending(false);
    if (result.ok) {
      toast.success("Profile saved.");
      router.refresh();
    } else {
      toast.error("Could not save your profile.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="max-w-xl">
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <Input id="firstName" name="firstName" defaultValue={user.firstName} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <Input id="lastName" name="lastName" defaultValue={user.lastName} required />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" value={user.email} disabled aria-describedby="email-note" />
          <FieldDescription id="email-note">
            Email changes arrive with the M2 verification flow.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="title">Headline</FieldLabel>
          <Input
            id="title"
            name="title"
            defaultValue={user.title}
            placeholder="e.g. Aspiring data analyst"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="biography">Bio</FieldLabel>
          <Textarea
            id="biography"
            name="biography"
            rows={4}
            defaultValue={user.biography}
            placeholder="A line or two about you."
          />
        </Field>
        <Button type="submit" disabled={pending} className="w-fit">
          {pending && <Spinner data-icon="inline-start" />}
          Save changes
        </Button>
      </FieldGroup>
    </form>
  );
}
