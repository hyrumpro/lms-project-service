import { getTranslations } from "next-intl/server";

export const metadata = { title: "FAQ" };

const DEFAULT_FAQS = [
  { q: "Do courses expire?", a: "Each course can set an access window. If it has one, you'll see the expiry date in My courses and get a notification before it lapses." },
  { q: "How do certificates work?", a: "Finish 100% of a course's lessons and your certificate is issued automatically — claim it from the player's Certificate tab. Every certificate has a public verification URL." },
  { q: "Are there free courses?", a: "Yes — filter the catalog by Free. Free courses enroll you instantly, no checkout." },
  { q: "Can I teach here?", a: "Apply from the studio page. A human reviews every application; once approved you get the full instructor studio — curriculum builder, quizzes, sales and payouts." },
  { q: "What lesson types exist?", a: "Video (upload or YouTube/Vimeo), audio, documents, rich text and quizzes with a grading answer sheet." },
  { q: "How do refunds work?", a: "See the Refund Policy page — in short, offline bank transfers are confirmed manually by admins and purchases carry the instructor revenue split at purchase time." },
];

export default async function FaqPage() {
  const t = await getTranslations("faq");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <p className="kicker">{t("kicker")}</p>
      <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        {t("title1")} <span className="mark italic">{t("titleAccent")}</span>
      </h1>
      <div className="rule-dash my-8" aria-hidden />
      <div className="flex flex-col gap-3">
        {DEFAULT_FAQS.map((item, i) => (
          <details key={i} open={i === 0} className="group rounded-lg border">
            <summary className="cursor-pointer list-none p-4 font-medium select-none">
              {item.q}
              <span className="text-muted-foreground float-right text-sm group-open:hidden">+</span>
            </summary>
            <p className="text-muted-foreground border-t p-4 text-sm leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
