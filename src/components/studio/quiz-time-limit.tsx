"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { updateQuizTimeLimit } from "@/server/actions/platform";

/** Quiz time-limit editor inside the studio quiz builder (minutes, 0 = untimed). */
export function QuizTimeLimitInput({
  lessonId,
  initialMinutes,
}: {
  lessonId: string;
  initialMinutes: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialMinutes ? String(initialMinutes) : "");

  return (
    <div className="flex items-center gap-2">
      <Timer className="text-muted-foreground size-4" />
      <Input
        type="number"
        min={0}
        max={180}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="min (0 = untimed)"
        aria-label="Quiz time limit in minutes"
        className="w-40"
      />
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const minutes = Number(value);
            const result = await updateQuizTimeLimit(
              lessonId,
              Number.isFinite(minutes) && minutes > 0 ? minutes : null,
            );
            if (result.ok) {
              toast.success("Time limit saved");
              router.refresh();
            } else toast.error("Could not save");
          })
        }
      >
        {pending && <Spinner />}
        Set
      </Button>
    </div>
  );
}
