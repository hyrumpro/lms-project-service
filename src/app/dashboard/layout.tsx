import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getTranslations } from "next-intl/server";
import { requireSession, getUnreadCount } from "@/server/queries/community";
import { SignOutMenuItem } from "@/components/layout/sign-out-button";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { href: "/dashboard", labelKey: "overview", index: "01" },
  { href: "/dashboard/my-courses", labelKey: "myCourses", index: "02" },
  { href: "/dashboard/wishlist", labelKey: "wishlist", index: "03" },
  { href: "/dashboard/shopping-cart", labelKey: "cart", index: "04" },
  { href: "/dashboard/purchases", labelKey: "purchases", index: "05" },
  { href: "/dashboard/subscription", labelKey: "subscription", index: "06" },
  { href: "/dashboard/notifications", labelKey: "notifications", index: "07" },
  { href: "/dashboard/messages", labelKey: "messages", index: "08" },
  { href: "/dashboard/following", labelKey: "following", index: "09" },
  { href: "/dashboard/badges", labelKey: "badges", index: "10" },
  { href: "/dashboard/profile", labelKey: "profile", index: "11" },
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const unread = await getUnreadCount(session.user.id);
  const user = session.user;
  const t = await getTranslations("dashboardNav");
  const navItems = NAV.map(({ href, labelKey, index }) => ({ href, label: t(labelKey), index }));

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-4 py-10 lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center gap-3 rounded-lg border bg-card p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <Avatar className="size-10">
                  <AvatarImage src={user.image ?? undefined} alt={user.name} />
                  <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                </span>
              </button>
            }
          />
          <DropdownMenuContent align="start">
            <SignOutMenuItem />
          </DropdownMenuContent>
        </DropdownMenu>

        <SidebarNav
          items={navItems}
          badgeCounts={{ "/dashboard/notifications": unread }}
        />

        <div className="rule-dash" aria-hidden />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Finished a course? Claim your certificate from the player&apos;s{" "}
          <span className="font-medium text-foreground">Certificate</span> tab.
        </p>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
