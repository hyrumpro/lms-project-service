"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Notebook-style sidebar nav shared by dashboard / studio / admin shells.
 * Client component so the active row can highlight (usePathname).
 */
export function SidebarNav({
  items,
  badgeCounts,
}: {
  items: { href: string; label: string; index: string }[];
  badgeCounts?: Record<string, number>;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Section"
      className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0"
    >
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && item.href !== "/admin" && item.href !== "/studio"
            ? pathname.startsWith(item.href)
            : false);
        const badge = badgeCounts?.[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:border-coral hover:text-foreground lg:rounded-none lg:border-0 lg:border-l-2 lg:bg-transparent lg:py-2.5 lg:pl-4 lg:pr-0 ${
              active
                ? "border-coral font-medium text-foreground lg:bg-transparent"
                : "border-border text-muted-foreground lg:border-transparent"
            }`}
          >
            <span className="kicker w-6 text-[10px]">{item.index}</span>
            <span className="relative">
              {item.label}
              {badge !== undefined && badge > 0 && (
                <span className="text-coral ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-coral/10 px-1 text-[10px] font-bold">
                  {badge}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
