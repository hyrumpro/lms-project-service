import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { SocialButtons, type SocialProvider } from "@/components/auth/social-buttons";
import { Separator } from "@/components/ui/separator";
import { getSystemSettings } from "@/lib/settings";

export const metadata = { title: "Sign up" };

export default async function SignUpPage() {
  const t = await getTranslations("auth");
  const system = await getSystemSettings();
  const providers: SocialProvider[] = [];
  if (system.googleLogin) providers.push("google");
  if (system.facebookLogin) providers.push("facebook");
  if (system.linkedinLogin) providers.push("linkedin");

  return (
    <AuthShell
      title="Your first day starts now."
      accentWord="now"
      quote="Live as if you were to die tomorrow. Learn as if you were to live forever."
      attribution="Mahatma Gandhi"
    >
      <header className="flex flex-col gap-1">
        <p className="kicker">{t("signUpKicker")}</p>
        <h2 className="font-heading text-3xl font-semibold tracking-tight">Join the academy.</h2>
      </header>
      <SocialButtons label="Sign up" providers={providers} />
      {providers.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Separator className="flex-1" />
          or with email
          <Separator className="flex-1" />
        </div>
      )}
      <SignUpForm
        recaptchaSiteKey={system.recaptchaSiteKey}
        allowInstructor={system.allowInstructor}
        requireEmailVerification={system.studentEmailVerification}
      />
      <p className="text-muted-foreground text-sm">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-coral font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
