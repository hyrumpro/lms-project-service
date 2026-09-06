"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { enrollStudentManually } from "@/server/actions/admin";

export function ManualEnrollForm({
  courses,
}: {
  courses: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [courseId, setCourseId] = useState("");

  return (
    <form
      className="flex max-w-2xl flex-col gap-3 rounded-xl border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const email = String(new FormData(event.currentTarget).get("email"));
        if (!courseId) {
          toast.error("Pick a course.");
          return;
        }
        startTransition(async () => {
          const result = await enrollStudentManually({ userEmail: email, courseId });
          if (result.ok) {
            toast.success("Student enrolled.");
            router.refresh();
          } else {
            toast.error(result.error === "user_not_found" ? "No user with that email." : "Failed.");
          }
        });
      }}
    >
      <p className="kicker">Enroll a student manually</p>
      <div className="flex flex-wrap gap-2">
        <Input name="email" type="email" required placeholder="student@email.com" className="min-w-0 flex-1 sm:min-w-56" />
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          aria-label="Course"
          className="min-w-0 flex-1 sm:min-w-56 rounded-lg border bg-card px-3 py-2 text-sm"
        >
          <option value="">Pick a course…</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Enroll
        </Button>
      </div>
    </form>
  );
}
