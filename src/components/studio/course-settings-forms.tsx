"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UploadField } from "@/components/studio/upload-field";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import {
  updateCourseMedia,
  updateCoursePricing,
  updateCourseRequirements,
} from "@/server/actions/studio";

export function CourseSettingsForms({
  course,
}: {
  course: {
    id: string;
    thumbnail: string | null;
    promoVideoUrl: string | null;
    isFree: boolean;
    price: number;
    discountEnabled: boolean;
    discountedPrice: number;
    outcomes: string[] | null;
    requirements: string[] | null;
    faqs: { question: string; answer: string }[] | null;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean }>, success: string) {
    setPending(true);
    const result = await fn();
    setPending(false);
    if (result.ok) {
      toast.success(success);
      router.refresh();
    } else toast.error("Save failed.");
  }

  async function onMedia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await run(
      () =>
        updateCourseMedia({
          courseId: course.id,
          thumbnail: String(fd.get("thumbnail") ?? ""),
          promoVideoUrl: String(fd.get("promo") ?? ""),
        }),
      "Media saved.",
    );
  }

  async function onPricing(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await run(
      () =>
        updateCoursePricing({
          courseId: course.id,
          isFree: fd.get("isFree") === "on",
          price: Number(fd.get("price") ?? 0),
          discountEnabled: fd.get("discountEnabled") === "on",
          discountedPrice: Number(fd.get("discountedPrice") ?? 0),
        }),
      "Pricing saved.",
    );
  }

  async function onLists(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const lines = (name: string) =>
      String(fd.get(name) ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    const faqLines = String(fd.get("faqs") ?? "")
      .split("\n")
      .map((line) => {
        const [question, answer] = line.split("|").map((s) => s.trim());
        return { question: question ?? "", answer: answer ?? "" };
      })
      .filter((f) => f.question && f.answer);
    await run(
      () =>
        updateCourseRequirements({
          courseId: course.id,
          outcomes: lines("outcomes"),
          requirements: lines("requirements"),
          faqs: faqLines,
        }),
      "Details saved.",
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      {pending && <Spinner />}
      <form onSubmit={onMedia} className="flex flex-col gap-4">
        <p className="kicker">Media</p>
        <MediaThumbField initial={course.thumbnail ?? ""} />
        <Field>
          <FieldLabel htmlFor="promo">Promo video (YouTube or MP4 URL)</FieldLabel>
          <Input id="promo" name="promo" defaultValue={course.promoVideoUrl ?? ""} />
        </Field>
        <Button type="submit" className="w-fit" disabled={pending}>
          Save media
        </Button>
      </form>

      <Separator />

      <form onSubmit={onPricing} className="flex flex-col gap-4">
        <p className="kicker">Pricing</p>
        <label className="flex items-center gap-3 text-sm">
          <Switch name="isFree" defaultChecked={course.isFree} />
          Free course
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="price">Price ($)</FieldLabel>
            <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={(course.price / 100).toFixed(2)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="discountedPrice">Discounted price ($)</FieldLabel>
            <Input
              id="discountedPrice"
              name="discountedPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(course.discountedPrice / 100).toFixed(2)}
            />
          </Field>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Switch name="discountEnabled" defaultChecked={course.discountEnabled} />
          Discount enabled
        </label>
        <Button type="submit" className="w-fit" disabled={pending}>
          Save pricing
        </Button>
      </form>

      <Separator />

      <form onSubmit={onLists} className="flex flex-col gap-4">
        <p className="kicker">Outcomes, requirements & FAQs</p>
        <Field>
          <FieldLabel htmlFor="outcomes">What students learn (one per line)</FieldLabel>
          <Textarea id="outcomes" name="outcomes" rows={4} defaultValue={(course.outcomes ?? []).join("\n")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="requirements">Requirements (one per line)</FieldLabel>
          <Textarea id="requirements" name="requirements" rows={3} defaultValue={(course.requirements ?? []).join("\n")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="faqs">FAQs — one per line as “question | answer”</FieldLabel>
          <Textarea
            id="faqs"
            name="faqs"
            rows={3}
            defaultValue={(course.faqs ?? []).map((f) => `${f.question} | ${f.answer}`).join("\n")}
          />
        </Field>
        <Button type="submit" className="w-fit" disabled={pending}>
          Save details
        </Button>
      </form>
    </div>
  );
}

function MediaThumbField({ initial }: { initial: string }) {
  const [thumb, setThumb] = useState(initial);
  return (
    <>
      <input type="hidden" name="thumbnail" value={thumb ?? ""} />
      <UploadField
        bucket="thumbnails"
        accept="image/jpeg,image/png,image/webp,image/avif"
        label="Course thumbnail (5 MB max — JPG/PNG/WebP)"
        value={thumb}
        onChange={(url) => setThumb(url ?? "")}
        hint="Shown on the catalog card and course hero."
      />
    </>
  );
}
