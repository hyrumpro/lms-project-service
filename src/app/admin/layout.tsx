import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/server/queries/community";
import { FolderTree, Megaphone } from "lucide-react";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { getAdminFlags } from "@/server/queries/admin";

const NAV = [
  { href: "/admin", labelKey: "dashboard", index: "01" },
  { href: "/admin/categories", labelKey: "categories", index: "02" },
  { href: "/admin/courses", labelKey: "courses", index: "03" },
  { href: "/admin/users", labelKey: "users", index: "04" },
  { href: "/admin/commerce", labelKey: "commerce", index: "05" },
  { href: "/admin/plans", labelKey: "plans", index: "06" },
  { href: "/admin/content", labelKey: "content", index: "07" },
  { href: "/admin/newsletters", labelKey: "newsletters", index: "08" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  if (session.user.role !== "admin") redirect("/dashboard");
  const t = await getTranslations("adminNav");
  const flags = await getAdminFlags(session.user.id);
  const allowedNav = NAV.filter((item) => {
    const section = item.href.split("/")[2] ?? "dashboard";
    return flags[section] !== false;
  }).map(({ href, labelKey, index }) => ({ href, label: t(labelKey), index }));

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-4 py-10 lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-lg border bg-card p-3">
          <p className="kicker">Admin</p>
          <p className="font-heading font-semibold">{session.user.name}</p>
        </div>
        <SidebarNav items={allowedNav} />
        <div className="rule-dash" aria-hidden />
        <p className="text-muted-foreground text-xs">
          Access flags per section are editable from the Users page — sections you lack
          disappear from this menu and their actions are blocked server-side.
        </p>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
