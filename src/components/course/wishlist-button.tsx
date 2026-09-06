"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { toggleWishlist } from "@/server/actions/community";

export function WishlistButton({
  courseId,
  wishlisted,
}: {
  courseId: string;
  wishlisted: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="icon"
      aria-pressed={wishlisted}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleWishlist(courseId);
          if (!result.ok) {
            if (result.error === "auth_required") router.push("/sign-in");
            else toast.error("Could not update your wishlist.");
            return;
          }
          toast.success(result.added ? "Saved to your wishlist." : "Removed from wishlist.");
          router.refresh();
        })
      }
    >
      {pending ? (
        <Spinner />
      ) : (
        <Heart className={cn("size-4", wishlisted && "fill-coral text-coral")} />
      )}
    </Button>
  );
}
