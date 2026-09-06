import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Landmark, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cancelOrder } from "@/server/actions/payments";
import { MockPayButtons } from "@/components/checkout/mock-pay-buttons";

type Params = Promise<{ orderId: string }>;

export const metadata = { title: "Sandbox Bank" };

/** Dev/demo gateway — simulates the hosted-checkout + webhook round trip. */
export default async function MockGatewayPage({ params }: { params: Params }) {
  const { orderId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.userId !== session.user.id) notFound();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  if (order.status === "paid") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <ShieldCheck className="size-10 text-emerald-600" />
        <h1 className="font-heading text-2xl font-semibold">Already paid — thank you!</h1>
        <Button render={<Link href={`/dashboard/invoices/${orderId}`} />}>View invoice</Button>
      </div>
    );
  }

  if (order.status === "pending_review") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <Landmark className="text-muted-foreground size-10" />
        <h1 className="font-heading text-2xl font-semibold">Bank transfer reserved</h1>
        <p className="text-muted-foreground text-sm">
          Your order <strong>{orderId.slice(0, 8).toUpperCase()}</strong> is awaiting admin
          approval. You&apos;ll get a notification the moment it&apos;s confirmed.
        </p>
        <Button variant="outline" render={<Link href="/dashboard/purchases" />}>
          Back to purchases
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <div className="flex items-center gap-3">
        <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg font-bold">
          SB
        </div>
        <div>
          <p className="font-heading font-semibold">Sandbox Bank</p>
          <p className="text-muted-foreground text-xs">Demo gateway · no real money moves</p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          TEST MODE
        </Badge>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <p className="kicker mb-3">Order summary</p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <span className="truncate">{item.titleSnapshot}</span>
              <span>${(item.unitPrice / 100).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t pt-3 font-semibold">
          <span>Total{order.tax > 0 ? " (incl. tax)" : ""}</span>
          <span>${(order.total / 100).toFixed(2)}</span>
        </div>
      </div>

      <MockPayButtons orderId={orderId} />

      <form action={cancelOrder.bind(null, orderId)}>
        <Button variant="ghost" className="w-full" type="submit">
          <ArrowLeft data-icon="inline-start" />
          Cancel and go back
        </Button>
      </form>
    </div>
  );
}
