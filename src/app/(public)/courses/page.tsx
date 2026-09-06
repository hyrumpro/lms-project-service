import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SearchX } from "lucide-react";
import { CourseCard } from "@/components/course/course-card";
import { SelectFilter } from "@/components/course/select-filter";
import { getSystemSettings } from "@/lib/settings";
import { getCategoryTree, listCourses, PAGE_SIZE } from "@/server/queries/catalog";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata() {
  const { getSeoForRoute } = await import("@/lib/seo-meta");
  return (await getSeoForRoute("home/courses")) ?? { title: "Courses" };
}

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [system, tree] = await Promise.all([getSystemSettings(), getCategoryTree()]);

  const filters = {
    q: first(params.q),
    categorySlug: first(params.category),
    level: first(params.level),
    price: first(params.price) as "free" | "paid" | undefined,
    sort: first(params.sort) as "newest" | "popular" | "rating" | "price_asc" | "price_desc" | undefined,
    page: Number(first(params.page) ?? 1) || 1,
  };

  const result = await listCourses(filters);
  const activeCategory = tree.find((c) => c.slug === filters.categorySlug);

  function pageHref(page: number): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      next.set(key, first(value)!);
    }
    next.set("page", String(page));
    return `/courses?${next.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {activeCategory ? activeCategory.name : "All courses"}
        </h1>
        <p className="text-muted-foreground">
          {result.total} course{result.total === 1 ? "" : "s"}
          {filters.q ? ` matching “${filters.q}”` : ""}
        </p>
      </header>

      <SelectFilter tree={tree} params={params} />

      {result.items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>No courses found</EmptyTitle>
            <EmptyDescription>
              Try different filters or clear your search.
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" render={<Link href="/courses" />}>
            Clear filters
          </Button>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((course) => (
            <CourseCard key={course.id} course={course} currency={system} />
          ))}
        </div>
      )}

      {result.pages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2">
          {Array.from({ length: result.pages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={page === result.page ? "default" : "outline"}
              size="icon-sm"
              render={<Link href={pageHref(page)} />}
            >
              {page}
            </Button>
          ))}
        </nav>
      )}

      <p className="text-muted-foreground mt-6 text-center text-xs">
        Showing {result.items.length} of {result.total} · {PAGE_SIZE} per page
      </p>
    </div>
  );
}
