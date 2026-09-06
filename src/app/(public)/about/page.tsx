import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listCourses } from "@/server/queries/catalog";

export const metadata = { title: "About" };

export const revalidate = 3600;

export default async function AboutPage() {
  const [{ total: courseCount }, t] = await Promise.all([
    listCourses({ limit: 1 }),
    getTranslations("about"),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <p className="kicker">{t("kicker")}</p>
      <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        {t("title1")} <span className="mark italic">{t("titleAccent")}</span>
      </h1>
      <div className="rule-dash my-8" aria-hidden />

      <div className="text-foreground/90 flex flex-col gap-4 [&_p]:leading-relaxed">
        <p>{t("p1")}</p>
        <p>{t("p2")}</p>
        <p>{t("p3")}</p>
      </div>

      <dl className="mt-12 grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border">
        {[
          [t("statCourses"), String(courseCount)],
          [t("statLanguages"), "16 → 2"],
          [t("statLessons"), "∞"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 bg-card p-5 text-center">
            <dt className="kicker">{label}</dt>
            <dd className="font-heading text-3xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 flex gap-3">
        <Link href="/courses" className="text-coral font-medium hover:underline">
          {t("cta")} →
        </Link>
      </div>
    </div>
  );
}
