"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Heart, HeartOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toggleFollow } from "@/server/actions/platform";

export function FollowButton({
  instructorId,
  following,
  label,
  followingLabel,
}: {
  instructorId: string;
  following: boolean;
  label: string;
  followingLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={following ? "secondary" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleFollow(instructorId);
          if (!result.ok) {
            if (result.error === "auth_required") router.push("/sign-in");
            else toast.error("Error");
            return;
          }
          toast.success(result.following ? followingLabel : label);
          router.refresh();
        })
      }
    >
      {pending ? (
        <Spinner data-icon="inline-start" />
      ) : following ? (
        <HeartOff data-icon="inline-start" />
      ) : (
        <Heart data-icon="inline-start" />
      )}
      {following ? followingLabel : label}
    </Button>
  );
}
