import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { getSystemSettings } from "@/lib/settings";
import { getMyOrders } from "@/server/queries/commerce";
import { requireSession } from "@/server/queries/community";

export const metadata = { title: "Purchases" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  paid: "default",
  pending: "outline",
  pending_review: "secondary",
  cancelled: "destructive",
  failed: "destructive",
};

export default async function PurchasesPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const [orders, system] = await Promise.all([getMyOrders(session.user.id), getSystemSettings()]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">04 · Orders</p>
        <h1 className="text-3xl font-semibold tracking-tight">Purchases</h1>
      </header>

      {orders.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border-2 border-dashed p-10 text-center text-sm">
          No orders yet.{" "}
          <Link href="/courses" className="text-coral font-medium hover:underline">
            Find a course →
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center gap-3 bg-card p-5">
              <div className="min-w-0 flex-1">
                <p className="font-heading font-medium">
                  {order.itemCount} course{order.itemCount === 1 ? "" : "s"} ·{" "}
                  <span className="text-muted-foreground font-normal">{order.titles}</span>
                </p>
                <p className="text-muted-foreground text-sm">
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(order.createdAt)}
                  {order.giftToEmail && ` · gift → ${order.giftToEmail}`}
                  {order.gateway && ` · via ${order.gateway}`}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>{order.status}</Badge>
              <span className="font-heading w-20 text-right font-semibold">
                {formatMoney(order.total, system)}
              </span>
              {order.status === "paid" && (
                <Button variant="outline" size="sm" render={<Link href={`/dashboard/invoices/${order.id}`} />}>
                  Invoice
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
