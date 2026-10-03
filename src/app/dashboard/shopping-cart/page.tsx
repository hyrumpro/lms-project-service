import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { auth } from "@/lib/auth";
import { courseHref } from "@/lib/slug";
import { getCart } from "@/server/queries/commerce";
import { getCartPreview } from "@/server/queries/cart-preview";
import { RemoveFromCartButton, CheckoutPanel } from "@/components/checkout/cart-controls";
import { db } from "@/db";
import { gatewayConfigs } from "@/db/schema";
import { allowMockGateway } from "@/lib/env";
import { eq } from "drizzle-orm";

export const metadata = { title: "Shopping cart" };

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ buy?: string }>;
}) {
  const { buy } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const cartRows = buy ? [] : await getCart(session.user.id);
  const preview = await getCartPreview(session.user.id, buy ? [buy] : cartRows.map((c) => c.id));
  const isBuyNow = Boolean(buy);
  const enabledRows = await db
    .select({ identifier: gatewayConfigs.identifier, title: gatewayConfigs.title })
    .from(gatewayConfigs)
    .where(eq(gatewayConfigs.enabled, true));
  const mockAllowed = allowMockGateway();
  const enabled = enabledRows.filter((g) => mockAllowed || g.identifier !== "mock");
  const gateways = enabled.length > 0 ? enabled : [
    ...(mockAllowed ? [{ identifier: "mock", title: "Sandbox Bank" }] : []),
    { identifier: "offline", title: "Bank transfer" },
  ];

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="kicker">Checkout · {isBuyNow ? "Buy now" : "Cart"}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isBuyNow ? "You're one step away" : "Your cart"}
          </h1>
        </header>

        {preview.lines.length === 0 ? (
          <Empty className="border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShoppingBag aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Your cart is empty</EmptyTitle>
              <EmptyDescription>Add a course, then come back here to check out.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button className="h-11" nativeButton={false} render={<Link href="/courses" />}>
                Browse courses
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
            {preview.lines.map((line) => (
              <li key={line.courseId} className="flex items-center gap-4 bg-card p-5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={courseHref(line.slug, line.courseId)}
                    className="font-heading font-medium hover:underline"
                  >
                    {line.title}
                  </Link>
                  <p className="text-muted-foreground text-sm">
                    {line.instructorNames}
                    {line.listPrice > line.payable && (
                      <span className="ml-2 line-through">
                        {(line.listPrice / 100).toFixed(2)}
                      </span>
                    )}
                  </p>
                </div>
                <span className="font-heading text-lg font-semibold">
                  {line.payable === 0 ? "Free" : `$${(line.payable / 100).toFixed(2)}`}
                </span>
                {!isBuyNow && <RemoveFromCartButton courseId={line.courseId} />}
              </li>
            ))}
          </ul>
        )}
      </div>

      {preview.lines.length > 0 && (
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <CheckoutPanel
            lines={preview.lines}
            subtotal={preview.subtotal}
            tax={preview.tax}
            buyNowCourseId={buy ?? null}
            gateways={gateways}
          />
        </aside>
      )}
    </div>
  );
}
