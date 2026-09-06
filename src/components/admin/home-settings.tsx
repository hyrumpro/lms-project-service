"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { saveHomeSections, saveSettings } from "@/server/actions/admin";

const SECTION_TYPES = [
  { type: "hero", label: "Hero banner + search" },
  { type: "topCourses", label: "Top courses" },
  { type: "topCategories", label: "Top categories" },
  { type: "topInstructors", label: "Top instructors" },
  { type: "testimonials", label: "Testimonials (reviews)" },
  { type: "faqPreview", label: "FAQ preview" },
  { type: "latestBlog", label: "Latest blog posts" },
  { type: "becomeInstructor", label: "Become an instructor CTA" },
] as const;

export function HomeSettingsForm({
  system,
  frontend,
}: {
  system?: { name?: string; currencySymbol?: string; instructorRevenuePercent?: number; courseSellingTax?: number };
  frontend?: { heroTitle?: string; heroSubTitle?: string; footerText?: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget as HTMLFormElement);
    startTransition(async () => {
      const result = await saveSettings({
        system: {
          name: String(fd.get("name") ?? ""),
          currencySymbol: String(fd.get("currencySymbol") ?? ""),
          instructorRevenuePercent: Number(fd.get("revenuePercent") ?? 70),
          courseSellingTax: Number(fd.get("tax") ?? 0),
        },
        frontend: {
          heroTitle: String(fd.get("heroTitle") ?? ""),
          heroSubTitle: String(fd.get("heroSubTitle") ?? ""),
          footerText: String(fd.get("footerText") ?? ""),
        },
      });
      if (result.ok) {
        toast.success("Settings saved");
        router.refresh();
      } else toast.error("Could not save settings");
    });
  }

  return (
    <form onSubmit={onSave} className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <p className="font-heading font-semibold">Platform settings</p>
        <Field>
          <FieldLabel htmlFor="name">Site name</FieldLabel>
          <Input id="name" name="name" defaultValue={system?.name ?? "Academy LMS"} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field>
            <FieldLabel htmlFor="currencySymbol">Symbol</FieldLabel>
            <Input id="currencySymbol" name="currencySymbol" defaultValue={system?.currencySymbol ?? "$"} />
          </Field>
          <Field>
            <FieldLabel htmlFor="revenuePercent">Instructor %</FieldLabel>
            <Input id="revenuePercent" name="revenuePercent" type="number" min={0} max={100} defaultValue={system?.instructorRevenuePercent ?? 70} />
          </Field>
          <Field>
            <FieldLabel htmlFor="tax">Tax %</FieldLabel>
            <Input id="tax" name="tax" type="number" min={0} max={50} defaultValue={system?.courseSellingTax ?? 0} />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <p className="font-heading font-semibold">Homepage copy</p>
        <Field>
          <FieldLabel htmlFor="heroTitle">Hero title</FieldLabel>
          <Input id="heroTitle" name="heroTitle" defaultValue={frontend?.heroTitle ?? ""} />
        </Field>
        <Field>
          <FieldLabel htmlFor="heroSubTitle">Hero subtitle</FieldLabel>
          <Input id="heroSubTitle" name="heroSubTitle" defaultValue={frontend?.heroSubTitle ?? ""} />
        </Field>
        <Field>
          <FieldLabel htmlFor="footerText">Footer text</FieldLabel>
          <Input id="footerText" name="footerText" defaultValue={frontend?.footerText ?? ""} />
        </Field>
      </div>

      <div className="xl:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Save settings
        </Button>
      </div>
    </form>
  );
}

export function HomeSectionsEditor({ sections }: { sections: { type: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(
    sections.length > 0 ? sections.map((s) => s.type) : ["hero", "topCourses", "topCategories", "topInstructors", "testimonials", "faqPreview", "latestBlog", "becomeInstructor"],
  );

  function toggle(type: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, type] : prev.filter((t) => t !== type)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <p className="font-heading font-semibold">Home page sections</p>
      <p className="text-muted-foreground text-sm">
        Toggle the blocks on the public homepage — order follows this list.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SECTION_TYPES.map((section) => (
          <label key={section.type} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(section.type)}
              onCheckedChange={(checked) => toggle(section.type, checked === true)}
            />
            {section.label}
          </label>
        ))}
      </div>
      <Button
        className="w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await saveHomeSections(
              selected.map((type) => ({ type, props: {} })),
            );
            if (result.ok) {
              toast.success("Homepage updated");
              router.refresh();
            } else toast.error("Could not save");
          })
        }
      >
        {pending && <Spinner data-icon="inline-start" />}
        Publish homepage
      </Button>
    </div>
  );
}
