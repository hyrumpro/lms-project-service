import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthShell
      title="Locked out? Easily done."
      accentWord="Easily"
      quote="Mistakes are the portals of discovery."
      attribution="James Joyce"
    >
      <header className="flex flex-col gap-1">
        <p className="kicker">{t("resetKicker")}</p>
        <h2 className="font-heading text-3xl font-semibold tracking-tight">
          We&apos;ll send a reset link.
        </h2>
      </header>
      <ForgotPasswordForm />
      <p className="text-muted-foreground text-sm">
        Remembered it after all?{" "}
        <Link href="/sign-in" className="text-coral font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
