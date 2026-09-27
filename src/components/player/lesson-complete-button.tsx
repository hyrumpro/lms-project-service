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

  return (
    <Button
      variant={isCompleted ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markLessonComplete(courseId, lessonId);
          if (result.ok) {
            toast.success(result.isCompleted ? "Lesson complete ✓" : "Lesson marked incomplete");
            router.refresh();
          } else {
            toast.error("Could not save progress.");
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" data-icon="inline-start" />
      ) : isCompleted ? (
        <CheckCircle2 className="text-teal-600 dark:text-teal-400" data-icon="inline-start" />
      ) : null}
      {isCompleted ? "Completed (click to unmark)" : "Mark as complete"}
    </Button>
  );
}
