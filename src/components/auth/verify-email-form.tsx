"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { consumeEmailCodeAction } from "@/server/actions/verify-code";

export function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const [pending, setPending] = useState(false);

  async function verifyLink() {
    setPending(true);
    const { error } = await authClient.verifyEmail({ query: { token } });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "This link is invalid or expired.");
      return;
    }
    toast.success("Email verified.");
    router.push("/sign-in");
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    setPending(true);
    const result = await consumeEmailCodeAction(email, code);
    setPending(false);
    if (!result.ok) {
      toast.error("That code is not valid.");
      return;
    }
    toast.success("Email verified.");
    router.push("/sign-in");
  }

  return (
    <div className="flex flex-col gap-4">
      {token ? (
        <Button type="button" disabled={pending} onClick={verifyLink}>
          {pending && <Spinner data-icon="inline-start" />}
          Confirm email
        </Button>
      ) : null}
      <form onSubmit={verifyCode}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="code">6-digit code</FieldLabel>
            <Input id="code" name="code" inputMode="numeric" minLength={6} maxLength={6} required />
          </Field>
          <Button type="submit" variant="outline" disabled={pending || !email}>
            Verify code
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
