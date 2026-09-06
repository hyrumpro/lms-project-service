"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { subscribeToPlan } from "@/server/actions/subscriptions";

export function SubscribeButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await subscribeToPlan(planId);
          if (result.ok) {
            toast.success("Subscription active — every course is yours!");
            router.push("/dashboard/subscription");
          } else if (result.error === "auth_required") {
            router.push("/sign-in");
          } else if (result.error === "already_active") {
            toast("You're already on this plan.");
            router.push("/dashboard/subscription");
          } else {
            toast.error("Could not subscribe. Please try again.");
          }
        })
      }
    >
      {pending && <Spinner data-icon="inline-start" />}
      Subscribe
    </Button>
  );
}
