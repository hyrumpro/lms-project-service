"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { addCourseInstructorByEmail, removeCourseInstructor } from "@/server/actions/studio";

export function CoInstructorManager({
  courseId,
  canManage,
  instructors,
}: {
  courseId: string;
  canManage: boolean;
  instructors: { instructorId: string; isOwner: boolean; name: string; email: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setPending(true);
    const result = await addCourseInstructorByEmail(courseId, email);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error.replaceAll("_", " "));
      return;
    }
    toast.success("Co-instructor added.");
    event.currentTarget.reset();
    router.refresh();
  }

  async function onRemove(instructorId: string) {
    setPending(true);
    const result = await removeCourseInstructor(courseId, instructorId);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error.replaceAll("_", " "));
      return;
    }
    toast.success("Co-instructor removed.");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <p className="kicker">Teaching team</p>
      <ul className="flex flex-col gap-2 text-sm">
        {instructors.map((instructor) => (
          <li key={instructor.instructorId} className="flex items-center justify-between gap-3">
            <span>
              {instructor.name}{" "}
              <span className="text-muted-foreground">{instructor.email}</span>
              {instructor.isOwner ? " · owner" : ""}
            </span>
            {canManage && !instructor.isOwner && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => onRemove(instructor.instructorId)}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <form onSubmit={onAdd} className="flex flex-wrap items-center gap-2">
          <Input name="email" type="email" required placeholder="instructor@school.com" className="max-w-xs" />
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Add co-instructor
          </Button>
        </form>
      )}
    </section>
  );
}
