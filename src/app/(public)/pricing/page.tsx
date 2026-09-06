import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getActiveSubscription, listActivePlans } from "@/server/queries/subscriptions";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { SubscribeButton } from "@/components/subscription/subscribe-button";

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  const [plans, session, t] = await Promise.all([
    listActivePlans(),
    auth.api.getSession({ headers: await headers() }),
    getTranslations("pricing"),
  ]);
  const active = session ? await getActiveSubscription(session.user.id) : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="kicker">{t("kicker")}</p>
        <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("title1")} <span className="mark italic">{t("titleAccent")}</span>
        </h1>
        <p className="text-muted-foreground mt-4">{t("sub")}</p>
      </header>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, i) => {
          const isCurrent = active?.planSlug === plan.slug && active.status === "active";
          const featured = i === 1 && plans.length > 1;
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col",
                featured && "border-primary shadow-lg ring-1 ring-primary/30",
              )}
            >
              {featured && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full">
                  {t("popular")}
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="font-heading text-lg">{plan.name}</CardTitle>
                <p className="font-heading text-4xl font-semibold tracking-tight">
                  ${(plan.price / 100).toFixed(0)}
                  <span className="text-muted-foreground text-base font-normal">
                    /{plan.interval === "month" ? t("mo") : t("yr")}
                  </span>
                </p>
                {plan.description && (
                  <p className="text-muted-foreground text-sm">{plan.description}</p>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="flex flex-1 flex-col gap-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="text-primary mt-0.5 size-4 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button variant="secondary" className="w-full" disabled>
                    {t("current")}
                  </Button>
                ) : session ? (
                  <SubscribeButton planId={plan.id} />
                ) : (
                  <Button className="w-full" render={<Link href="/sign-up" />}>
                    {t("cta")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-10 text-center text-sm">
        {t("allAccessNote")}{" "}
        <Link href="/courses" className="text-coral font-medium hover:underline">
          {t("browse")}
        </Link>
      </p>
    </div>
  );
}
