import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { courseHref } from "@/lib/slug";
import { getCompareCourses, listActiveCoursesForSelect } from "@/server/queries/compare";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "Compare" };

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("compare");
  const params = await searchParams;
  const slot = (n: number) => {
    const v = params[`c${n}`];
    return Array.isArray(v) ? v[0] : v;
  };
  const ids = [slot(1), slot(2), slot(3)].filter((v): v is string => Boolean(v));
  const uniqueIds = [...new Set(ids)].slice(0, 3);

  const [courses, options] = await Promise.all([
    getCompareCourses(uniqueIds),
    listActiveCoursesForSelect(),
  ]);

  const rows: { label: string; render: (course: (typeof courses)[number]) => React.ReactNode }[] = [
    {
      label: t("price"),
      render: (c) =>
        c.isFree ? (
          <Badge className="bg-sun text-sun-foreground rounded-sm font-bold">FREE</Badge>
        ) : (
          <span className="font-heading font-semibold">
            ${(c.discountEnabled ? c.discountedPrice : c.price) / 100}
          </span>
        ),
    },
    { label: t("rating"), render: (c) => (c.ratingAvg > 0 ? `★ ${c.ratingAvg.toFixed(1)}` : "—") },
    { label: t("students"), render: (c) => String(c.enrolledCount) },
    { label: t("lessons"), render: (c) => String(c.lessonCount) },
    {
      label: t("duration"),
      render: (c) => (c.totalDuration > 0 ? `${Math.round(c.totalDuration / 60)} min` : "—"),
    },
    { label: t("level"), render: (c) => c.level },
    { label: t("language"), render: (c) => c.language },
    { label: t("instructor"), render: (c) => c.instructorNames || "—" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-14">
      <p className="kicker">{t("kicker")}</p>
      <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <div className="rule-dash my-8" aria-hidden />

      <form action="/compare" method="GET" className="flex flex-col gap-3 sm:flex-row">
        {[1, 2, 3].map((n) => (
          <Select key={n} name={`c${n}`} defaultValue={slot(n) ?? ""}>
            <SelectTrigger aria-label={`${t("pick")} ${n}`} className="w-full">
              <SelectValue placeholder={`${t("pick")} ${n}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ))}
        <Button type="submit" variant="outline" className="shrink-0">
          {t("kicker").split(" ·")[0]}
        </Button>
      </form>

      {courses.length < 2 ? (
        <p className="text-muted-foreground mt-10 rounded-xl border-2 border-dashed p-10 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-125 text-sm">
            <thead>
              <tr className="bg-secondary/50">
                <th className="w-28 p-3 text-left" />
                {courses.map((course) => (
                  <th key={course.id} className="p-3 text-left align-top">
                    <Link
                      href={courseHref(course.slug, course.id)}
                      className="font-heading font-semibold hover:underline"
                    >
                      {course.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t">
                  <td className="text-muted-foreground p-3 text-xs font-medium tracking-wide uppercase">
                    {row.label}
                  </td>
                  {courses.map((course) => (
                    <td key={course.id} className="p-3">
                      {row.render(course)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t">
                <td />
                {courses.map((course) => (
                  <td key={course.id} className="p-3">
                    <Link
                      href={courseHref(course.slug, course.id)}
                      className="text-coral font-medium hover:underline"
                    >
                      {t("open")} →
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
