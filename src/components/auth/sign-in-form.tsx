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
import { RecaptchaField, readRecaptchaToken } from "@/components/auth/recaptcha-field";
import { authClient } from "@/lib/auth-client";
import { assertRecaptcha } from "@/server/actions/auth-extra";

export function SignInForm({ recaptchaSiteKey }: { recaptchaSiteKey?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const t = useTranslations("auth");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    if (recaptchaSiteKey) {
      const captcha = await assertRecaptcha(readRecaptchaToken());
      if (!captcha.ok) {
        setPending(false);
        toast.error("Complete the captcha first.");
        return;
      }
    }
    const { error } = await authClient.signIn.email({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    setPending(false);
    if (error) {
      const message = error.message ?? "Could not sign in";
      if (/disabled/i.test(message)) {
        router.push("/account-disabled");
        return;
      }
      toast.error(message);
      return;
    }
    toast.success("Welcome back!");
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
          <PasswordInput id="password" name="password" required minLength={8} />
        </Field>
        <FieldDescription>
          Demo accounts live in the README — e.g. student@academy-next.test / SuperSecret123!
        </FieldDescription>
        <RecaptchaField siteKey={recaptchaSiteKey ?? ""} />
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Sign in
        </Button>
      </FieldGroup>
    </form>
  );
}
