"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { startCheckout, checkCoupon } from "@/server/actions/payments";

type Line = { courseId: string; title: string; net: number; payable: number };

export function CheckoutPanel({
  lines,
  subtotal,
  tax,
  buyNowCourseId,
}: {
  lines: Line[];
  subtotal: number;
  tax: number;
  buyNowCourseId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ discount: number; percentage: number } | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftEmail, setGiftEmail] = useState("");

  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount + tax);

  async function applyCoupon() {
    const result = await checkCoupon({ code: couponCode, subtotal });
    if (result.valid) {
      setCoupon({ discount: result.discount, percentage: result.percentage });
      toast.success(result.message);
    } else {
      setCoupon(null);
      toast.error(result.message);
    }
  }

  function checkout(gateway: "mock" | "offline") {
    startTransition(async () => {
      const result = await startCheckout({
        gateway,
        couponCode: coupon ? couponCode : null,
        giftToEmail: giftOpen && giftEmail ? giftEmail : null,
        buyNowCourseId,
      });
      if (!result.ok) {
        const messages: Record<string, string> = {
          already_enrolled: "You already own one of these courses.",
          invalid_coupon: "That coupon didn't make it.",
          use_free_enrollment: "These courses are free — enroll directly from the course page.",
          empty_cart: "Your cart is empty.",
        };
        toast.error(messages[result.error ?? ""] ?? "Checkout failed.");
        return;
      }
      router.push(`/checkout/pay/${result.orderId}`);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground text-sm">Subtotal</span>
        <span className="font-medium">${(subtotal / 100).toFixed(2)}</span>
      </div>

      <Field>
        <FieldLabel htmlFor="coupon">Coupon</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="coupon"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="WELCOME10"
          />
          <Button variant="outline" onClick={applyCoupon} type="button">
            Apply
          </Button>
        </div>
      </Field>

      {coupon && (
        <Badge variant="secondary" className="w-fit">
          −${(coupon.discount / 100).toFixed(2)} ({coupon.percentage}%)
        </Badge>
      )}

      <button
        type="button"
        className="text-coral text-left text-sm font-medium hover:underline"
        onClick={() => setGiftOpen((v) => !v)}
      >
        {giftOpen ? "− This is a gift for me" : "+ This course is a gift"}
      </button>
      {giftOpen && (
        <Input
          type="email"
          placeholder="recipient@email.com"
          value={giftEmail}
          onChange={(e) => setGiftEmail(e.target.value)}
          aria-label="Gift recipient email"
        />
      )}

      <Separator />
      {tax > 0 && (
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Tax</span>
          <span>${(tax / 100).toFixed(2)}</span>
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <span className="font-heading text-lg font-semibold">Total</span>
        <span className="font-heading text-2xl font-semibold">${(total / 100).toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-md border bg-secondary/50 px-2 py-1.5">
          💳 Sandbox Bank
          <span className="text-muted-foreground block">instant (demo)</span>
        </div>
        <div className="rounded-md border bg-secondary/50 px-2 py-1.5">
          🏦 Bank transfer
          <span className="text-muted-foreground block">admin approval</span>
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        disabled={pending}
        onClick={() => checkout("mock")}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {total === 0 ? "Complete free order" : "Pay with Sandbox Bank"}
      </Button>
      <Button
        className="w-full"
        size="lg"
        variant="outline"
        disabled={pending}
        onClick={() => checkout("offline")}
      >
        Reserve with bank transfer
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        Stripe / PayPal / Razorpay adapters activate when API keys are configured (spec §7.5).
      </p>
    </div>
  );
}

export function RemoveFromCartButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Remove from cart"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { removeFromCart } = await import("@/server/actions/payments");
          await removeFromCart(courseId);
          router.refresh();
        })
      }
    >
      {pending ? <Spinner /> : <Trash2 className="size-4" />}
    </Button>
  );
}
