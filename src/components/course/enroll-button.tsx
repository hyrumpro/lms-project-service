"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { enrollInFreeCourse } from "@/server/actions/enrollment";

export function EnrollButton({
  courseId,
  slug,
  enrolled,
  disabled,
}: {
  courseId: string;
  slug: string;
  enrolled: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (enrolled) {
    return (
      <Button className="w-full" render={<a href={`/learn/${courseId}`} />}>
        Continue learning →
      </Button>
    );
  }

  return (
    <Button
      className="w-full"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const result = await enrollInFreeCourse(courseId, slug);
          if (result.ok) {
            toast.success("You are enrolled! 🎉");
            router.refresh();
          } else if (result.error === "auth_required") {
            router.push("/sign-in");
          } else if (result.error === "not_free") {
            toast.error("Checkout for paid courses arrives in milestone M4.");
          } else {
            toast.error("Something went wrong. Please try again.");
          }
        })
      }
    >
      {pending && <Spinner data-icon="inline-start" />}
      Enroll now
    </Button>
  );
}
