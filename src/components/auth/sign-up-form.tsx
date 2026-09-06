"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

export function SignUpForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const t = useTranslations("auth");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password"));
    const confirmPassword = String(formData.get("confirmPassword"));
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setPending(true);
    const firstName = String(formData.get("firstName"));
    const lastName = String(formData.get("lastName"));
    // firstName/lastName are input-enabled additionalFields server-side
    // (see src/lib/auth.ts); the untyped client passes them through.
    const { error } = await authClient.signUp.email({
      email: String(formData.get("email")),
      password,
      name: `${firstName} ${lastName}`.trim(),
      ...({ firstName, lastName } as Record<string, string>),
    });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Could not create your account");
      return;
    }
    toast.success("Account created — welcome to Academy!");
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="firstName">{t("firstName")}</FieldLabel>
            <Input id="firstName" name="firstName" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="lastName">{t("lastName")}</FieldLabel>
            <Input id="lastName" name="lastName" required />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
          <PasswordInput id="password" name="password" required minLength={8} ariaDescribedBy="password-description" />
          <FieldDescription id="password-description">At least 8 characters.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">{t("confirmPassword")}</FieldLabel>
          <PasswordInput id="confirmPassword" name="confirmPassword" required minLength={8} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Create account
        </Button>
      </FieldGroup>
    </form>
  );
}
