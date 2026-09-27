import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password."
      accentWord="new"
      quote="The secret of getting ahead is getting started."
      attribution="Mark Twain"
    >
      <header className="flex flex-col gap-1">
        <p className="kicker">Account · Reset</p>
        <h2 className="font-heading text-3xl font-semibold tracking-tight">Set a new password.</h2>
      </header>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
      <p className="text-muted-foreground text-sm">
        <Link href="/sign-in" className="text-coral font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
