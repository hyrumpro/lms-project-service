"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ShoppingCart, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { addToCart } from "@/server/actions/payments";

export function PaidCourseActions({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function add(goToCart: boolean) {
    startTransition(async () => {
      const result = await addToCart(courseId);
      if (!result.ok) {
        if (result.error === "auth_required") router.push("/sign-in");
        else toast.error("Could not add to cart.");
        return;
      }
      if (goToCart) router.push("/dashboard/shopping-cart");
      else {
        toast.success("Added to cart.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button className="w-full" disabled={pending} onClick={() => add(true)}>
        {pending ? <Spinner data-icon="inline-start" /> : <Zap data-icon="inline-start" />}
        Buy now
      </Button>
      <Button variant="outline" className="w-full" disabled={pending} onClick={() => add(false)}>
        <ShoppingCart data-icon="inline-start" />
        Add to cart
      </Button>
    </div>
  );
}
