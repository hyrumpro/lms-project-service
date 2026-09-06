import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  const t = await getTranslations("auth");
  return (
    <AuthShell
      title="Welcome back to class."
      accentWord="back"
      quote="The beautiful thing about learning is that no one can take it away from you."
      attribution="B.B. King"
    >
      <header className="flex flex-col gap-1">
        <p className="kicker">{t("signInKicker")}</p>
        <h2 className="font-heading text-3xl font-semibold tracking-tight">
          Good to see you again.
        </h2>
      </header>
      <SocialButtons label={"Sign in"} />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        or with email
        <Separator className="flex-1" />
      </div>
      <SignInForm />
      <p className="text-muted-foreground text-sm">
        No account yet?{" "}
        <Link href="/sign-up" className="text-coral font-medium hover:underline">
          Sign up
        </Link>{" "}
        ·{" "}
        <Link href="/forgot-password" className="text-coral font-medium hover:underline">
          Forgot password?
        </Link>
      </p>
    </AuthShell>
  );
}
