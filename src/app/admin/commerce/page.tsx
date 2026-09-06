import { Badge } from "@/components/ui/badge";
import { OfflineApproveButton, PayoutButtons } from "@/components/admin/controls";
import { listOrdersForAdmin, listPayoutsForAdmin } from "@/server/queries/admin";

export const metadata = { title: "Admin · Commerce" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  paid: "default",
  pending: "outline",
  pending_review: "secondary",
  cancelled: "destructive",
  failed: "destructive",
};

export default async function AdminCommercePage() {
  const [orders, payouts] = await Promise.all([listOrdersForAdmin(), listPayoutsForAdmin()]);
  const offlinePending = orders.filter((o) => o.status === "pending_review");

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="kicker">04 · Money</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Commerce</h1>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          Orders{" "}
          {offlinePending.length > 0 && (
            <span className="text-coral">({offlinePending.length} bank transfers awaiting)</span>
          )}
        </h2>
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center gap-3 bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">{order.id.slice(0, 8).toUpperCase()}</span>
                  <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>{order.status}</Badge>
                  {order.giftToEmail && <Badge variant="outline">gift</Badge>}
                </div>
                <p className="text-muted-foreground text-sm">
                  {order.userName} · {order.gateway} ·{" "}
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(order.createdAt)}
                </p>
              </div>
              <span className="font-heading font-semibold">
                ${(order.total / 100).toFixed(2)}
              </span>
              {order.status === "pending_review" && <OfflineApproveButton orderId={order.id} />}
            </li>
          ))}
          {orders.length === 0 && (
            <li className="text-muted-foreground bg-card p-6 text-sm">No orders yet.</li>
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">Instructor payouts</h2>
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
          {payouts.map((payout) => (
            <li key={payout.id} className="flex flex-wrap items-center gap-3 bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{payout.instructorName}</p>
                <p className="text-muted-foreground text-sm">
                  {payout.method} · {payout.instructorEmail}
                </p>
              </div>
              <Badge variant={payout.status === "paid" ? "default" : "outline"}>{payout.status}</Badge>
              <span className="font-heading font-semibold">
                ${(payout.amount / 100).toFixed(2)}
              </span>
              <PayoutButtons payoutId={payout.id} status={payout.status} />
            </li>
          ))}
          {payouts.length === 0 && (
            <li className="text-muted-foreground bg-card p-6 text-sm">No withdrawal requests.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
