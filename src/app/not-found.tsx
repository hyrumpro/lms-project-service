import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-28 text-center">
      <p className="kicker">404 · Missing page</p>
      <h1 className="font-heading text-6xl font-semibold tracking-tight">
        This chapter <span className="mark italic">doesn&apos;t</span> exist.
      </h1>
      <p className="text-muted-foreground max-w-md">
        {t("notFoundBody")}
      </p>
      <div className="flex gap-3">
        <Button render={<Link href="/" />}>{t("frontPage")}</Button>
        <Button variant="outline" render={<Link href="/courses" />}>
          Browse courses
        </Button>
      </div>
    </div>
  );
}
