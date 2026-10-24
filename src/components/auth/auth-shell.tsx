import Link from "next/link";
import { GraduationCap } from "lucide-react";

/**
 * Editorial split-screen auth shell (frontend-design: one memorable moment —
 * an ink "blackboard" panel with a rotating course-quote, form on paper).
 */
export function AuthShell({
  title,
  accentWord,
  quote,
  attribution,
  children,
  footer,
}: {
  title: string;
  accentWord: string;
  quote: string;
  attribution: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
      {/* blackboard panel */}
      <aside className="relative hidden overflow-hidden bg-primary px-10 py-14 text-primary-foreground lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(oklch(0.977 0.013 88 / 0.16) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "linear-gradient(160deg, black 40%, transparent 90%)",
          }}
        />
        <div className="relative flex flex-1 flex-col">
          <p className="kicker !text-primary-foreground/60">Academy LMS</p>
          <h1 className="font-heading mt-6 max-w-sm text-4xl font-semibold leading-tight tracking-tight">
            {title.split(" ").map((word, i) =>
              word.toLowerCase() === accentWord.toLowerCase() ? (
                <span key={i} className="mark italic">
                  {word}{" "}
                </span>
              ) : (
                <span key={i}>{word} </span>
              ),
            )}
          </h1>
          <blockquote className="mt-auto max-w-sm pt-16">
            <p className="font-heading text-xl italic leading-relaxed">“{quote}”</p>
            <footer className="text-primary-foreground/60 mt-3 text-sm">{attribution}</footer>
          </blockquote>
          <div className="text-primary-foreground/40 mt-10 flex items-center gap-2 text-xs">
            <GraduationCap className="size-4" />
            Est. 2017 · rebuilt in Next.js
          </div>
        </div>
      </aside>

      {/* form panel */}
      <div className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8">
          <Link href="/" className="kicker hover:text-foreground lg:hidden">
            ← Academy LMS
          </Link>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}
