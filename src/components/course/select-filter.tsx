"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { getCategoryTree } from "@/server/queries/catalog";

type Tree = Awaited<ReturnType<typeof getCategoryTree>>;

const LEVELS = ["beginner", "intermediate", "expert"];
const SORTS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Highest rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export function SelectFilter({ tree, params }: { tree: Tree; params: Record<string, string | string[] | undefined> }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === null || value === "all") next.delete(key);
      else next.set(key, value);
      next.delete("page");
      router.push(`/courses?${next.toString()}`);
    },
    [router, searchParams],
  );

  const first = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]);

  return (
    <div className="mb-8 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
      <Select
        value={first("category") ?? "all"}
        onValueChange={(value) => setParam("category", value)}
      >
        <SelectTrigger className="w-full sm:w-48" aria-label="Category">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">All categories</SelectItem>
            {tree.map((parent) => (
              <div key={parent.id}>
                <SelectItem value={parent.slug}>{parent.name}</SelectItem>
                {parent.children.map((child) => (
                  <SelectItem key={child.id} value={child.slug}>
                    — {child.name}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select value={first("level") ?? "all"} onValueChange={(value) => setParam("level", value)}>
        <SelectTrigger className="w-full sm:w-40" aria-label="Level">
          <SelectValue placeholder="Level" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">All levels</SelectItem>
            {LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level[0].toUpperCase() + level.slice(1)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select value={first("price") ?? "all"} onValueChange={(value) => setParam("price", value)}>
        <SelectTrigger className="w-full sm:w-36" aria-label="Price">
          <SelectValue placeholder="Price" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">Any price</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        value={first("sort") ?? "newest"}
        onValueChange={(value) => setParam("sort", value === "newest" ? null : value)}
      >
        <SelectTrigger className="w-full sm:ml-auto sm:w-48" aria-label="Sort">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Sort by</SelectLabel>
            {SORTS.map((sort) => (
              <SelectItem key={sort.value} value={sort.value}>
                {sort.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
