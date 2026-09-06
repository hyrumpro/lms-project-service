import Link from "next/link";
import { Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { courseHref } from "@/lib/slug";
import { coursePriceLabel, type CurrencyMeta, type CoursePricing } from "@/lib/money";
import type { CourseCardData } from "@/server/queries/catalog";

const GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-rose-500 to-orange-500",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-700",
  "from-fuchsia-500 to-pink-600",
  "from-amber-500 to-red-600",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

export function CourseCard({
  course,
  currency,
  className,
}: {
  course: CourseCardData;
  currency: CurrencyMeta;
  className?: string;
}) {
  const price = coursePriceLabel(course as CoursePricing, currency);

  return (
    <Link
      href={courseHref(course.slug, course.id)}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex aspect-video items-center justify-center bg-gradient-to-br",
          gradientFor(course.id),
        )}
      >
        <span className="font-heading text-5xl font-semibold text-white/85">
          {(course.categoryName ?? course.title).charAt(0).toUpperCase()}
        </span>
        {price.label === "Free" ? (
          <Badge className="absolute top-3 -right-1 rotate-3 rounded-sm border-2 border-foreground/10 bg-sun text-xs font-bold text-sun-foreground shadow-sm">
            FREE
          </Badge>
        ) : (
          <span className="absolute -right-1 bottom-3 rotate-[-3deg] rounded-sm border-2 border-ink/10 bg-card px-2 py-0.5 text-sm font-bold shadow-sm">
            {price.label}
          </span>
        )}
        {price.original && (
          <span className="text-white/70 absolute top-3 left-3 text-xs font-medium line-through">
            {price.original}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {course.categoryName && (
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {course.categoryName}
          </span>
        )}
        <h3 className="line-clamp-2 font-semibold leading-snug group-hover:underline">
          {course.title}
        </h3>
        {course.instructorNames && (
          <p className="text-muted-foreground text-sm">{course.instructorNames}</p>
        )}
        <div className="mt-auto flex items-center gap-3 pt-2 text-sm">
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Star className="size-3.5 fill-current" />
            {course.ratingAvg > 0 ? course.ratingAvg.toFixed(1) : "New"}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Users className="size-3.5" />
            {course.enrolledCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
