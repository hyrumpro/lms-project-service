"use client";

import { useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { mockPay } from "@/server/actions/payments";

export function MockPayButtons({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() => startTransition(async () => mockPay(orderId))}
    >
      {pending ? <Spinner data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" />}
      Authorize payment
    </Button>
  );
}
