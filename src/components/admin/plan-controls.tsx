"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { savePlan, deletePlan } from "@/server/actions/subscriptions";
import type { Plan } from "@/db/schema";

export function PlanForm({ existing }: { existing?: Plan }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [interval, setIntervalValue] = useState<"month" | "year">(existing?.interval ?? "month");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await savePlan(existing?.id ?? null, {
        name: String(fd.get("name")),
        description: String(fd.get("description") ?? ""),
        price: Number(fd.get("price")),
        interval,
        features: String(fd.get("features") ?? ""),
        isActive,
      });
      if (result.ok) {
        toast.success(existing ? "Plan updated" : "Plan created");
        router.refresh();
      } else toast.error("Name 2+ chars, price required");
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="max-w-xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px_130px]">
          <Field>
            <FieldLabel htmlFor={`name-${existing?.id ?? "new"}`}>Name</FieldLabel>
            <Input
              id={`name-${existing?.id ?? "new"}`}
              name="name"
              required
              minLength={2}
              defaultValue={existing?.name}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`price-${existing?.id ?? "new"}`}>Price ($)</FieldLabel>
            <Input
              id={`price-${existing?.id ?? "new"}`}
              name="price"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={existing ? existing.price / 100 : undefined}
            />
          </Field>
          <Field>
            <FieldLabel>Billing</FieldLabel>
            <Select value={interval} onValueChange={(v) => setIntervalValue(v as "month")}>
              <SelectTrigger aria-label="Billing interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`desc-${existing?.id ?? "new"}`}>Short description</FieldLabel>
          <Input
            id={`desc-${existing?.id ?? "new"}`}
            name="description"
            defaultValue={existing?.description ?? ""}
            placeholder="Everything you need to go from zero to deployed."
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`feat-${existing?.id ?? "new"}`}>Features (one per line)</FieldLabel>
          <Textarea
            id={`feat-${existing?.id ?? "new"}`}
            name="features"
            rows={4}
            defaultValue={(existing?.features ?? []).join("\n")}
            placeholder={"All courses\nCertificates\nPriority support"}
          />
        </Field>
        <div className="flex items-center gap-3">
          <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Plan active" />
          <span className="text-sm">{isActive ? "Active (public on /pricing)" : "Hidden"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {existing ? "Save changes" : "Create plan"}
          </Button>
          {existing && <PlanDeleteButton id={existing.id} />}
        </div>
      </FieldGroup>
    </form>
  );
}

export function PlanDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deletePlan(id);
          if (result.ok) {
            toast.success("Plan deleted");
            router.refresh();
          } else if (result.error === "has_subscribers") {
            toast.error("This plan has subscribers — deactivate it instead.");
          } else toast.error("Could not delete");
        })
      }
    >
      {pending ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
      Delete
    </Button>
  );
}
