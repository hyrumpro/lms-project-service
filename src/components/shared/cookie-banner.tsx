"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const KEY = "academy-cookie-consent";

/** EU-cookie-banner parity (legacy eu-cookie.php) — localStorage consent, no tracking. */
export function CookieBanner() {
  const t = useTranslations("cookies");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  function decide(value: string) {
    localStorage.setItem(KEY, value);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-xl border bg-card p-5 shadow-lg sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold">{t("title")}</p>
        <p className="text-muted-foreground text-xs">{t("body")}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => decide("all")}>
          {t("accept")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => decide("essential")}>
          {t("decline")}
        </Button>
      </div>
    </div>
  );
}
