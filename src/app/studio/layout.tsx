import Link from "next/link";
import { redirect } from "next/navigation";
import { BookLock, CircleDollarSign, GraduationCap, Newspaper, PenSquare, Radio, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/server/queries/community";
import { SidebarNav } from "@/components/shared/sidebar-nav";

const NAV = [
  { href: "/studio", labelKey: "overview", icon: GraduationCap, index: "01" },
  { href: "/studio/courses", labelKey: "courses", icon: BookLock, index: "02" },
  { href: "/studio/sales", labelKey: "sales", icon: CircleDollarSign, index: "03" },
  { href: "/studio/payouts", labelKey: "payouts", icon: CircleDollarSign, index: "04" },
  { href: "/studio/live", labelKey: "live", icon: Radio, index: "05" },
  { href: "/studio/blog", labelKey: "blog", icon: Newspaper, index: "06" },
  { href: "/studio/ai", labelKey: "ai", icon: Sparkles, index: "07" },
  { href: "/studio/certificates", labelKey: "certificates", icon: Sparkles, index: "08" },
] as const;

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("studioNav");
  const isInstructor = session.user.isInstructor || session.user.role === "admin";

  if (!isInstructor) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-24">
        <p className="kicker">Instructor studio</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold">
          Teach what you <span className="mark italic">know</span>.
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Apply to become an instructor. Once an admin approves your application, your studio
          unlocks — courses, curriculum, quizzes, sales and payouts.
        </p>
        <ApplyForm />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-4 py-10 lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-lg border bg-card p-3">
          <p className="kicker">Studio</p>
          <p className="font-heading font-semibold">{session.user.name}</p>
        </div>
        <SidebarNav items={NAV.map(({ href, labelKey, index }) => ({ href, label: t(labelKey), index }))} />
        <div className="rule-dash" aria-hidden />
        <Link href="/studio/courses/new" className="text-coral text-sm font-medium hover:underline">
          <PenSquare className="mr-1 inline size-3.5" />
          {t("newCourse")}
        </Link>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ApplyForm() {
  return (
    <form
      className="mt-6 flex flex-col gap-3"
      action={async (formData: FormData) => {
        "use server";
        const { applyAsInstructor } = await import("@/server/actions/studio");
        await applyAsInstructor(String(formData.get("message") ?? ""));
      }}
    >
      <textarea
        name="message"
        rows={4}
        required
        placeholder="Tell the admins what you'd teach and why students would love it…"
        className="rounded-lg border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <button
        type="submit"
        className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Submit application
      </button>
    </form>
  );
}
