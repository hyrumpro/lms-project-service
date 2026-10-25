"use client";

import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Portfolio referral modal — shows once per visitor when arriving with
 * ?ref=portfolio. Independent EN/ES switcher (default English).
 */
const SEEN_KEY = "academy-portfolio-intro";

const COPY = {
  en: {
    kicker: "Portfolio · Case study",
    role: "Full Stack Developer",
    tags: "MERN · Next.js · Web3 & AI",
    uni: "Brigham Young University – Idaho",
    lead: "This is a production-grade LMS marketplace built end-to-end — a complete rebuild of a legacy PHP system into modern Next.js, with courses, video lessons, quizzes, subscriptions, payments and a full admin suite.",
    skillsTitle: "Skills showcased in this project",
    skills: [
      {
        group: "Full Stack",
        items: ["Next.js 16", "React 19", "TypeScript", "Server Actions"],
      },
      {
        group: "Data & Infra",
        items: ["PostgreSQL (Neon)", "Drizzle ORM", "Data migration ETL", "REST API"],
      },
      {
        group: "Auth & Payments",
        items: ["Better Auth", "OAuth", "Stripe adapters", "Subscriptions"],
      },
      {
        group: "UI/UX",
        items: ["Tailwind CSS", "shadcn/ui", "i18n EN/ES", "Dark mode"],
      },
    ],
    ok: "OK",
    once: "This introduction appears once per visitor.",
  },
  es: {
    kicker: "Portafolio · Caso de estudio",
    role: "Desarrollador Full Stack",
    tags: "MERN · Next.js · Web3 & AI",
    uni: "Brigham Young University – Idaho",
    lead: "Un marketplace educativo de nivel producción construido de punta a punta — la reconversión completa de un sistema legacy en PHP a Next.js moderno: cursos, lecciones en video, cuestionarios, suscripciones, pagos y un panel administrativo completo.",
    skillsTitle: "Habilidades demostradas en este proyecto",
    skills: [
      {
        group: "Full Stack",
        items: ["Next.js 16", "React 19", "TypeScript", "Server Actions"],
      },
      {
        group: "Datos e Infra",
        items: ["PostgreSQL (Neon)", "Drizzle ORM", "ETL de migración", "API REST"],
      },
      {
        group: "Auth y Pagos",
        items: ["Better Auth", "OAuth", "Adaptadores Stripe", "Suscripciones"],
      },
      {
        group: "UI/UX",
        items: ["Tailwind CSS", "shadcn/ui", "i18n ES/EN", "Modo oscuro"],
      },
    ],
    ok: "OK",
    once: "Esta presentación se muestra una sola vez por visitante.",
  },
} as const;

export function PortfolioModal() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "es">("en");
  const t = COPY[lang];

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      const seen = localStorage.getItem(SEEN_KEY);
      if (ref === "portfolio" && !seen) setOpen(true);
    } catch {
      /* private mode — simply don't show */
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <div className="flex items-start justify-between gap-3">
          <p className="kicker">{t.kicker}</p>
          <div
            role="group"
            aria-label="Language"
            className="bg-secondary flex shrink-0 items-center gap-0.5 rounded-full p-0.5"
          >
            {(["en", "es"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  lang === code
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="bg-primary text-primary-foreground font-heading flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold">
              HP
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-heading text-xl leading-tight">
                Hyrum David Perez Abanto
              </DialogTitle>
              <p className="text-coral text-sm font-medium">{t.role}</p>
              <p className="text-muted-foreground text-xs">{t.tags}</p>
            </div>
          </div>
          <div className="text-muted-foreground mt-2 flex flex-col gap-1 text-xs">
            <span className="flex items-center gap-1.5">
              <GraduationCap className="size-3.5" /> {t.uni}
            </span>
          </div>
        </DialogHeader>

        <p className="text-sm leading-relaxed">{t.lead}</p>

        <div>
          <p className="kicker mb-2">{t.skillsTitle}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {t.skills.map((block) => (
              <div key={block.group} className="flex flex-col gap-1.5">
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  {block.group}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {block.items.map((item) => (
                    <Badge key={item} variant="secondary" className="font-normal">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" render={<a href="https://github.com/hyrumpro" target="_blank" rel="noreferrer" />}>
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" data-icon="inline-start" aria-hidden><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.91c.58.1.79-.25.79-.55v-2.1c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.09 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.05.78 2.13v3.16c0 .3.2.66.8.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/></svg>
            GitHub
          </Button>
          <Button variant="outline" size="sm" render={<a href="https://www.linkedin.com/in/hyrumdavid/" target="_blank" rel="noreferrer" />}>
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" data-icon="inline-start" aria-hidden><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z"/></svg>
            LinkedIn
          </Button>
          <Button size="sm" className="ml-auto" onClick={dismiss}>
            {t.ok}
          </Button>
        </div>

        <p className="text-muted-foreground text-center text-[11px]">{t.once}</p>
      </DialogContent>
    </Dialog>
  );
}
