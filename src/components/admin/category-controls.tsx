"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
import { createCategory, renameCategory, deleteCategory } from "@/server/actions/platform";

const ERROR_MESSAGES: Record<string, string> = {
  slug_taken: "A category with that name already exists.",
  in_use: "This category has courses — move them first.",
  has_children: "Delete the sub-categories first.",
  invalid: "Name must be at least 2 characters.",
};

export function CategoryForm({ parents }: { parents: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asChild, setAsChild] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "");
    const parentId = asChild ? String(fd.get("parentId") ?? "") || null : null;
    startTransition(async () => {
      const result = await createCategory({ name, parentId });
      if (result.ok) {
        toast.success("Category created");
        form.reset();
        setAsChild(false);
        router.refresh();
      } else toast.error(ERROR_MESSAGES[result.error] ?? "Could not create");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-48 flex-1">
          <FieldLabel htmlFor="cat-name">New category name</FieldLabel>
          <Input id="cat-name" name="name" required minLength={2} placeholder="e.g. Photography" />
        </Field>
        <div className="flex items-center gap-2 pb-1">
          <input
            type="checkbox"
            id="as-child"
            checked={asChild}
            onChange={(e) => setAsChild(e.target.checked)}
            className="size-4"
          />
          <label htmlFor="as-child" className="text-sm">
            Sub-category
          </label>
        </div>
        {asChild && (
          <Select name="parentId" required>
            <SelectTrigger className="w-48" aria-label="Parent category">
              <SelectValue placeholder="Parent" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {parents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <Button type="submit" disabled={pending} className="pb-1">
          {pending && <Spinner data-icon="inline-start" />}
          Create
        </Button>
      </div>
    </form>
  );
}

export function CategoryRowActions({
  id,
  name,
  hasChildren,
}: {
  id: string;
  name: string;
  hasChildren: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} className="w-40" aria-label="Category name" />
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await renameCategory(id, value);
              if (result.ok) {
                toast.success("Renamed");
                setEditing(false);
                router.refresh();
              } else toast.error(ERROR_MESSAGES[result.error] ?? "Error");
            })
          }
        >
          {pending ? <Spinner /> : "Save"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="icon-sm" aria-label="Rename" disabled={pending} onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteCategory(id);
            if (result.ok) {
              toast.success("Deleted");
              router.refresh();
            } else toast.error(ERROR_MESSAGES[result.error] ?? "Could not delete");
          })
        }
      >
        {pending ? <Spinner /> : <Trash2 className="size-3.5" />}
      </Button>
    </div>
  );
}
