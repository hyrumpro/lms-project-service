import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import { getSystemSettings } from "@/lib/settings";
import {
  getInstructorEarnings,
  getInstructorPayouts,
} from "@/server/queries/commerce";
import { requireSession } from "@/server/queries/community";
import { WithdrawForm } from "@/components/studio/withdraw-form";

export const metadata = { title: "Payouts" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  requested: "outline",
  approved: "secondary",
  paid: "default",
  rejected: "destructive",
};

export default async function StudioPayoutsPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const [earnings, payoutRows, system] = await Promise.all([
    getInstructorEarnings(session.user.id),
    getInstructorPayouts(session.user.id),
    getSystemSettings(),
  ]);
  const requestedTotal = payoutRows
    .filter((p) => p.status !== "rejected")
    .reduce((sum, p) => sum + p.amount, 0);
  const available = earnings - requestedTotal;

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">04 · Money out</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Payouts</h1>
      </header>

      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border">
        {[
          ["Earned", earnings],
          ["Requested", requestedTotal],
          ["Available", available],
        ].map(([label, value]) => (
          <div key={label as string} className="flex flex-col gap-1 bg-card p-4">
            <dt className="kicker">{label}</dt>
            <dd className="font-heading text-xl font-semibold">
              {formatMoney(value as number, system)}
            </dd>
          </div>
        ))}
      </dl>

      <WithdrawForm available={available / 100} disabled={available <= 0} />

      {payoutRows.length > 0 && (
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
          {payoutRows.map((payout) => (
            <li key={payout.id} className="flex items-center gap-3 bg-card p-4 text-sm">
              <Badge variant={STATUS_VARIANT[payout.status] ?? "outline"}>{payout.status}</Badge>
              <span className="text-muted-foreground flex-1">
                {payout.method} ·{" "}
                {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(payout.createdAt)}
              </span>
              <span className="font-heading font-semibold">
                {formatMoney(payout.amount, system)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
