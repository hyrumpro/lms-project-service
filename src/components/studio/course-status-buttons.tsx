"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { setCourseStatus } from "@/server/actions/studio";

export function CourseStatusButtons({
  courseId,
  status,
}: {
  courseId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: "submit" | "retract" | "delete") {
    startTransition(async () => {
      const result = await setCourseStatus(courseId, action);
      if (result.ok) {
        toast.success(
          action === "submit"
            ? "Submitted for review."
            : action === "retract"
              ? "Moved back to draft."
              : "Draft deleted.",
        );
        router.refresh();
      } else {
        toast.error("Action failed.");
      }
    });
  }

  if (pending) return <Spinner />;

  return (
    <div className="flex gap-2">
      {status === "draft" && (
        <Button size="sm" onClick={() => run("submit")}>
          Submit for review
        </Button>
      )}
      {status === "pending" && (
        <Button size="sm" variant="outline" onClick={() => run("retract")}>
          Retract
        </Button>
      )}
      {status === "draft" && (
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => run("delete")}>
          Delete
        </Button>
      )}
    </div>
  );
}
