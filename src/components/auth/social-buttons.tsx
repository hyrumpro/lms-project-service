"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

export type SocialProvider = "google" | "facebook" | "linkedin";

export function SocialButtons({
  label,
  providers,
}: {
  label: string;
  providers: SocialProvider[];
}) {
  const [pending, setPending] = useState<string | null>(null);

  async function social(provider: SocialProvider) {
    setPending(provider);
    const { error } = await authClient.signIn.social({ provider, callbackURL: "/" });
    setPending(null);
    if (error) {
      toast.error("Social sign-in isn't configured yet — add the provider keys in .env.");
    }
  }

  if (providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {providers.includes("google") && (
        <Button variant="outline" disabled={pending !== null} onClick={() => social("google")}>
          {pending === "google" ? <Spinner data-icon="inline-start" /> : null}
          {label} Google
        </Button>
      )}
      {providers.includes("facebook") && (
        <Button variant="outline" disabled={pending !== null} onClick={() => social("facebook")}>
          {pending === "facebook" ? <Spinner data-icon="inline-start" /> : null}
          {label} Facebook
        </Button>
      )}
      {providers.includes("linkedin") && (
        <Button variant="outline" disabled={pending !== null} onClick={() => social("linkedin")}>
          {pending === "linkedin" ? <Spinner data-icon="inline-start" /> : null}
          {label} LinkedIn
        </Button>
      )}
    </div>
  );
}
