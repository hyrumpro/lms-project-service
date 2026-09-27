import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata = { title: "Verify email" };

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Confirm it is you."
      accentWord="you"
      quote="Trust, but verify."
      attribution="Russian proverb"
    >
      <header className="flex flex-col gap-1">
        <p className="kicker">Account · Verify</p>
        <h2 className="font-heading text-3xl font-semibold tracking-tight">Verify your email.</h2>
      </header>
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <VerifyEmailForm />
      </Suspense>
      <p className="text-muted-foreground text-sm">
        <Link href="/sign-in" className="text-coral font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
