import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/shared/contact-form";

export const metadata = { title: "Contact" };

export default async function ContactPage() {
  const t = await getTranslations("contact");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <p className="kicker">{t("kicker")}</p>
      <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        {t("title1")} <span className="mark italic">{t("titleAccent")}</span>
      </h1>
      <div className="rule-dash my-8" aria-hidden />
      <ContactForm
        labels={{
          name: t("name"),
          email: t("email"),
          phone: t("phone"),
          message: t("message"),
          send: t("send"),
          sent: t("sent"),
          error: "Error",
        }}
      />
    </div>
  );
}
