import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanForm, PlanDeleteButton } from "@/components/admin/plan-controls";
import { listAllPlans } from "@/server/queries/subscriptions";

export const metadata = { title: "Admin · Plans" };

export default async function AdminPlansPage() {
  const plans = await listAllPlans();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">06 · Membership</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Subscription plans
        </h1>
        <p className="text-muted-foreground text-sm">
          An active plan unlocks every course. Deleting a plan with subscribers is blocked —
          deactivate it instead.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Create plan</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanForm />
        </CardContent>
      </Card>

      <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
        {plans.map((plan) => (
          <li key={plan.id} className="bg-card p-5">
            <PlanForm existing={plan} />
          </li>
        ))}
        {plans.length === 0 && (
          <li className="text-muted-foreground bg-card p-6 text-sm">No plans yet.</li>
        )}
      </ul>
      {plans.some((p) => p.isActive) && (
        <p className="text-muted-foreground text-xs">
          Active plans are public at <Badge variant="outline">/pricing</Badge>
        </p>
      )}
    </div>
  );
}
