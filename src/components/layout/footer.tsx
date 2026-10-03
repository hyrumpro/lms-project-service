import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getFrontendSettings, getSystemSettings } from "@/lib/settings";
import { NewsletterForm } from "@/components/layout/newsletter-form";

export async function Footer() {
  const t = await getTranslations("footer");
  const [frontend, system] = await Promise.all([getFrontendSettings(), getSystemSettings()]);

  return (
    <footer className="border-t">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <span className="font-heading text-lg font-semibold">{system.name}</span>
          <p className="text-muted-foreground max-w-sm text-sm">{frontend.footerText}</p>
          <NewsletterForm />
        </div>
        <nav className="flex flex-col gap-2 text-sm" aria-label="Learn">
          <p className="kicker">{t("learn")}</p>
          <Link href="/courses" className="text-muted-foreground hover:text-foreground">
            Course catalog
          </Link>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <Link href="/blog" className="text-muted-foreground hover:text-foreground">
            Blog
          </Link>
          <Link href="/courses?price=free" className="text-muted-foreground hover:text-foreground">
            Free courses
          </Link>
        </nav>
        <nav className="flex flex-col gap-2 text-sm" aria-label="Academy">
          <p className="kicker">Academy</p>
          <Link href="/sign-up" className="text-muted-foreground hover:text-foreground">
            Become an instructor
          </Link>
          <Link href="/sign-in" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
