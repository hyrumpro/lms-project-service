import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { getSystemSettings } from "@/lib/settings";
import { getInstructorSalesReport } from "@/server/queries/commerce";
import { requireSession } from "@/server/queries/community";

export const metadata = { title: "Sales" };

export default async function StudioSalesPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const [sales, system] = await Promise.all([
    getInstructorSalesReport(session.user.id),
    getSystemSettings(),
  ]);
  const total = sales.reduce((sum, s) => sum + s.instructorRevenue, 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="kicker">03 · Money in</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Sales</h1>
        </div>
        <p className="font-heading text-2xl font-semibold">
          {formatMoney(total, system)}{" "}
          <span className="text-muted-foreground text-sm font-normal">earned</span>
        </p>
      </header>

      {sales.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border-2 border-dashed p-10 text-center text-sm">
          No sales yet. Publish a course and share your instructor page.
        </p>
      ) : (
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
          {sales.map((sale, i) => (
            <li key={`${sale.orderId}-${sale.courseId}-${i}`} className="flex items-center gap-4 bg-card p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{sale.courseTitle}</p>
                <p className="text-muted-foreground">
                  {sale.studentName} · {sale.gateway} ·{" "}
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(sale.createdAt)}
                </p>
              </div>
              <span className="text-muted-foreground">${(sale.unitPrice / 100).toFixed(2)}</span>
              <span className="font-heading w-24 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                +{formatMoney(sale.instructorRevenue, system)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
