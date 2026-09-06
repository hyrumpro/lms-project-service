"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toggleFollow } from "@/server/actions/platform";

export function UnfollowButton({ instructorId, label }: { instructorId: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleFollow(instructorId);
          router.refresh();
        })
      }
    >
      {pending && <Spinner data-icon="inline-start" />}
      {label}
    </Button>
  );
}
