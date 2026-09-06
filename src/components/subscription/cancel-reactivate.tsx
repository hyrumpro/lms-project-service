"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cancelSubscription, reactivateSubscription } from "@/server/actions/subscriptions";

export function CancelReactivateButton({
  planId,
  active,
}: {
  planId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: "cancel" | "reactivate") {
    startTransition(async () => {
      const result =
        action === "cancel" ? await cancelSubscription(planId) : await reactivateSubscription(planId);
      if (result.ok) {
        toast.success(action === "cancel" ? "Canceled — access continues until the period ends." : "Welcome back!");
        router.refresh();
      } else toast.error("Action failed.");
    });
  }

  return active ? (
    <Button variant="outline" disabled={pending} onClick={() => run("cancel")}>
      {pending && <Spinner data-icon="inline-start" />}
      Cancel subscription
    </Button>
  ) : (
    <Button disabled={pending} onClick={() => run("reactivate")}>
      {pending && <Spinner data-icon="inline-start" />}
      Re-activate
    </Button>
  );
}
