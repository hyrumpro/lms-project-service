import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/shared/page-intro";

export const metadata = { title: "Payment" };

export default async function MobilePayPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
      <PageIntro kicker="Mobile" title="Payment" description="Finish this order in checkout." />
      <Card>
        <CardHeader>
          <CardTitle>{orderId ? "Order ready" : "Missing order"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {orderId
              ? `Order ${orderId.slice(0, 8).toUpperCase()} is waiting for payment.`
              : "Open the cart and start checkout again."}
          </p>
        </CardContent>
        <CardFooter>
          <Button
            className="h-11"
            nativeButton={false}
            render={<Link href={orderId ? `/checkout/pay/${orderId}` : "/dashboard/shopping-cart"} />}
          >
            {orderId ? "Continue checkout" : "Open cart"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
