"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { markContactRead } from "@/server/actions/platform";

export function MarkContactReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markContactRead(id);
          router.refresh();
        })
      }
    >
      {pending && <Spinner data-icon="inline-start" />}
      Mark read
    </Button>
  );
}
