"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { generateCourseDraft } from "@/server/actions/platform";

export function AssistantPanel() {
  const [mode, setMode] = useState<string>("description");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const topic = String(new FormData(event.currentTarget).get("topic") ?? "");
    startTransition(async () => {
      const response = await generateCourseDraft({
        mode: (Array.isArray(mode) ? mode[0] : mode) as "description",
        topic,
      });
      if (response.ok) setResult(response.text ?? null);
      else toast.error(response.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <ToggleGroup
        variant="outline"
        value={[mode]}
        onValueChange={(value: string[]) =>
          setMode(value[0] ?? "description")
        }
        className="w-fit"
      >
        <ToggleGroupItem value="description">Description</ToggleGroupItem>
        <ToggleGroupItem value="outcomes">Outcomes</ToggleGroupItem>
        <ToggleGroupItem value="quiz">Quiz questions</ToggleGroupItem>
      </ToggleGroup>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Field className="flex-1">
          <FieldLabel htmlFor="topic" className="sr-only">
            Topic
          </FieldLabel>
          <Input id="topic" name="topic" required placeholder="e.g. beekeeping for beginners" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Generate
        </Button>
      </form>

      {result && (
        <div className="rounded-lg border bg-secondary/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {result}
        </div>
      )}
    </div>
  );
}
