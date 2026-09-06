import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { courseHref } from "@/lib/slug";
import { getOrderForInvoice } from "@/server/queries/commerce";
import { PrintButton } from "@/components/player/print-button";

type Params = Promise<{ orderId: string }>;

export const metadata = { title: "Invoice" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  paid: "default",
  pending: "outline",
  pending_review: "secondary",
  cancelled: "destructive",
  failed: "destructive",
};

export default async function InvoicePage({ params }: { params: Params }) {
  const { orderId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const data = await getOrderForInvoice(session.user.id, orderId);
  if (!data) notFound();
  const { order, items, payment } = data;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="print:hidden flex items-center justify-between gap-3">
        <div>
          <p className="kicker">Invoice</p>
          <h1 className="font-heading text-2xl font-semibold">
            INV-{order.id.slice(0, 8).toUpperCase()}
          </h1>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <Button variant="outline" render={<Link href="/dashboard/purchases" />}>
            Back
          </Button>
        </div>
      </header>

      <article className="rounded-xl border bg-card p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-heading text-xl font-semibold">Academy LMS</p>
            <p className="text-muted-foreground text-sm">
              {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(order.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>{order.status}</Badge>
            <p className="text-muted-foreground mt-2 font-mono text-xs">
              {order.id.slice(0, 8).toUpperCase()}
            </p>
            {payment && (
              <p className="text-muted-foreground text-xs">
                via {payment.gateway} · {payment.transactionId}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <p className="kicker mb-2">Billed to</p>
          <p className="font-medium">{session.user.name}</p>
          <p className="text-muted-foreground text-sm">{session.user.email}</p>
          {order.giftToEmail && (
            <p className="text-muted-foreground text-sm">Gift for: {order.giftToEmail}</p>
          )}
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 font-medium">Course</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2.5">
                  <Link
                    href={`/dashboard/purchases`}
                    className="hover:underline"
                  >
                    {item.titleSnapshot}
                  </Link>
                </td>
                <td className="py-2.5 text-right">${(item.unitPrice / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-medium">
            {order.discount > 0 && (
              <tr>
                <td className="pt-2">Coupon discount</td>
                <td className="pt-2 text-right">−${(order.discount / 100).toFixed(2)}</td>
              </tr>
            )}
            {order.tax > 0 && (
              <tr>
                <td className="pt-2">Tax</td>
                <td className="pt-2 text-right">${(order.tax / 100).toFixed(2)}</td>
              </tr>
            )}
            <tr className="text-lg">
              <td className="pt-3">Total</td>
              <td className="font-heading pt-3 text-right">
                ${(order.total / 100).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </article>
    </div>
  );
}
