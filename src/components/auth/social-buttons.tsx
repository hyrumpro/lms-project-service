"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

/** Social sign-in (legacy fb_validate_login parity) — Google + Facebook. */
export function SocialButtons({ label }: { label: string }) {
  const [pending, setPending] = useState<string | null>(null);

  async function social(provider: "google" | "facebook") {
    setPending(provider);
    const { error } = await authClient.signIn.social({ provider, callbackURL: "/" });
    setPending(null);
    if (error) {
      toast.error("Social sign-in isn't configured yet — add the provider keys in .env.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" disabled={pending !== null} onClick={() => social("google")}>
        {pending === "google" ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z" />
          </svg>
        )}
        {label} Google
      </Button>
      <Button variant="outline" disabled={pending !== null} onClick={() => social("facebook")}>
        {pending === "facebook" ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
            <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z" />
          </svg>
        )}
        {label} Facebook
      </Button>
    </div>
  );
}
