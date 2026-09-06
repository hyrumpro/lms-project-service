"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Global error boundary (ux-designer: every error state gets a recovery path). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-28 text-center">
      <p className="kicker">Something broke</p>
      <h1 className="font-heading text-5xl font-semibold tracking-tight">
        {t("chalkTitle1")} <span className="mark italic">{t("chalkAccent")}</span>.
      </h1>
      <p className="text-muted-foreground max-w-md text-sm">
        An unexpected error interrupted this page. It has been logged — try again, and if it
        keeps happening, head back to the homepage.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>{t("tryAgain")}</Button>
        <Button variant="outline" render={<a href="/" />}>
          Front page
        </Button>
      </div>
    </div>
  );
}
