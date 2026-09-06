import { getTranslations } from "next-intl/server";

/** Shared policy renderer (legacy terms/refund/privacy/cookie pages). */
export async function PolicyPage({ which }: { which: "terms" | "privacy" | "refund" | "cookie" }) {
  const t = await getTranslations("policies");

  const BODY: Record<typeof which, string[]> = {
    terms: [
      "By creating an account you agree to use the academy honestly: one person per account, no sharing of course access outside a legitimate gift, and no redistribution of lesson materials.",
      "Instructors keep the rights to their content and grant the platform a license to host and sell it. Courses are reviewed before publishing and can be unpublished for policy violations.",
      "Purchases grant the access window stated on the course page. Where no window is stated, access does not expire.",
    ],
    privacy: [
      "We store what we need to run your account: your name, email, learning progress and purchase history. We do not sell personal data.",
      "Passwords are hashed with modern algorithms; instructor payout credentials are encrypted at rest. You can request account deletion at any time via the contact page.",
    ],
    refund: [
      "Free enrollments need no refund. Paid purchases made through the sandbox or offline bank transfer can be refunded within 14 days of purchase, provided less than 20% of the course has been completed.",
      "Refunds are processed by the platform admin and reverse the recorded revenue split.",
    ],
    cookie: [
      "Essential cookies keep you signed in and remember your language and theme preferences. We set no advertising or cross-site tracking cookies.",
      "Your consent choice is stored locally in your browser and can be changed by clearing site data.",
    ],
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <p className="kicker">
        {t("kicker")} · {t("updated")}: 2026-09-03
      </p>
      <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight">{t(which)}</h1>
      <div className="rule-dash my-8" aria-hidden />
      <div className="text-foreground/90 flex flex-col gap-4 [&_p]:leading-relaxed">
        {BODY[which].map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
