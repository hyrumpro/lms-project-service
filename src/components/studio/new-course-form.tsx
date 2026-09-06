"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { Textarea } from "@/components/ui/textarea";
import { createCourse } from "@/server/actions/studio";

type CategoryOption = { id: string; name: string; parentId: string | null };

export function NewCourseForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    if (!categoryId) {
      toast.error("Pick a category.");
      return;
    }
    setPending(true);
    const result = await createCourse({
      title: String(fd.get("title")),
      shortDescription: String(fd.get("shortDescription") ?? ""),
      description: String(fd.get("description") ?? ""),
      categoryId,
      level: (String(fd.get("level")) || "beginner") as "beginner",
      language: "English",
    });
    setPending(false);
    if (result.ok) {
      toast.success("Course created — build the curriculum next.");
      router.push(`/studio/courses/${result.courseId}/curriculum`);
    } else {
      toast.error("Could not create the course.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="max-w-2xl">
        <Field>
          <FieldLabel htmlFor="title">Course title</FieldLabel>
          <Input id="title" name="title" required placeholder="e.g. Rust for JavaScript Developers" />
        </Field>
        <Field>
          <FieldLabel htmlFor="shortDescription">One-line pitch</FieldLabel>
          <Input id="shortDescription" name="shortDescription" maxLength={200} />
        </Field>
        <Field>
          <FieldLabel htmlFor="description">Full description (HTML allowed)</FieldLabel>
          <Textarea id="description" name="description" rows={5} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel>Category</FieldLabel>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {categories
                    .filter((c) => !c.parentId)
                    .map((parent) => (
                      <div key={parent.id}>
                        <SelectItem value={parent.id}>{parent.name}</SelectItem>
                        {categories
                          .filter((c) => c.parentId === parent.id)
                          .map((child) => (
                            <SelectItem key={child.id} value={child.id}>
                              — {child.name}
                            </SelectItem>
                          ))}
                      </div>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="level">Level</FieldLabel>
            <Select name="level" defaultValue="beginner">
              <SelectTrigger id="level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {["beginner", "intermediate", "expert", "any"].map((level) => (
                    <SelectItem key={level} value={level}>
                      {level[0].toUpperCase() + level.slice(1)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button type="submit" disabled={pending} className="w-fit">
          {pending && <Spinner data-icon="inline-start" />}
          Create course
        </Button>
      </FieldGroup>
    </form>
  );
}
