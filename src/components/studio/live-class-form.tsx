"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { scheduleLiveClass } from "@/server/actions/platform";

export function LiveClassForm({
  courses,
}: {
  courses: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await scheduleLiveClass({
        courseId: String(fd.get("courseId") ?? ""),
        title: String(fd.get("title") ?? ""),
        provider: String(fd.get("provider") ?? "jitsi") as "jitsi",
        joinUrl: String(fd.get("joinUrl") ?? "") || null,
        startsAt: new Date(String(fd.get("startsAt"))).toISOString(),
      });
      if (result.ok) {
        toast.success("Live class scheduled");
        router.refresh();
      } else if (result.error === "not_your_course") {
        toast.error("That course isn't yours.");
      } else {
        toast.error("Could not schedule — check the fields.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <Field>
        <FieldLabel htmlFor="courseId">Course</FieldLabel>
        <Select name="courseId" required>
          <SelectTrigger aria-label="Course">
            <SelectValue placeholder="Pick a course" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="title">Session title</FieldLabel>
        <Input id="title" name="title" required placeholder="Week 2 Q&A + live coding" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="provider">Provider</FieldLabel>
          <Select name="provider" defaultValue="jitsi">
            <SelectTrigger aria-label="Provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="jitsi">Jitsi (auto room)</SelectItem>
                <SelectItem value="zoom">Zoom (join URL)</SelectItem>
                <SelectItem value="bbb">BigBlueButton</SelectItem>
                <SelectItem value="external">External link</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="startsAt">Starts at</FieldLabel>
          <Input id="startsAt" name="startsAt" type="datetime-local" required />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="joinUrl">Join URL (optional — auto for Jitsi)</FieldLabel>
        <Input id="joinUrl" name="joinUrl" type="url" placeholder="https://…" />
      </Field>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending && <Spinner data-icon="inline-start" />}
        Schedule session
      </Button>
    </form>
  );
}
