"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { markLessonComplete } from "@/server/actions/learning";

/** Manual completion for text/audio/document lessons (legacy mark-complete). */
export function LessonCompleteButton({
  courseId,
  lessonId,
  isCompleted,
}: {
  courseId: string;
  lessonId: string;
  isCompleted: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isCompleted) {
    return (
      <span className="text-sm font-medium text-teal-700 dark:text-teal-400">
        <CheckCircle2 className="mr-1 inline size-4" />
        Completed
      </span>
    );
  }

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markLessonComplete(courseId, lessonId);
          if (result.ok) {
            toast.success("Lesson complete ✓");
            router.refresh();
          } else {
            toast.error("Could not save progress.");
          }
        })
      }
    >
      {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
      Mark as complete
    </Button>
  );
}
