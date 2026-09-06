import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, courses } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { CategoryForm, CategoryRowActions } from "@/components/admin/category-controls";

export const metadata = { title: "Admin · Categories" };

export default async function AdminCategoriesPage() {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      parentId: categories.parentId,
      courseCount: sql<number>`(select count(*) from ${courses} c where c.category_id = ${categories.id})::int`,
    })
    .from(categories)
    .orderBy(categories.order, categories.name);

  const parents = rows.filter((r) => !r.parentId);
  const childrenOf = (id: string) => rows.filter((r) => r.parentId === id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">02 · Catalog structure</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Categories</h1>
      </header>

      <CategoryForm
        parents={parents.map((p) => ({ id: p.id, name: p.name }))}
      />

      <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
        {parents.map((parent) => (
          <li key={parent.id} className="bg-card">
            <div className="flex items-center gap-3 p-4">
              <span className="font-heading font-medium">{parent.name}</span>
              <Badge variant="outline">{parent.courseCount} courses</Badge>
              <span className="text-muted-foreground text-xs">/{parent.slug}</span>
              <span className="ml-auto">
                <CategoryRowActions id={parent.id} name={parent.name} hasChildren={childrenOf(parent.id).length > 0} />
              </span>
            </div>
            {childrenOf(parent.id).length > 0 && (
              <ul className="border-t bg-secondary/30">
                {childrenOf(parent.id).map((child) => (
                  <li key={child.id} className="flex items-center gap-3 px-4 py-2.5 pl-10 text-sm">
                    <span className="text-muted-foreground">↳</span>
                    <span className="font-medium">{child.name}</span>
                    <Badge variant="outline">{child.courseCount} courses</Badge>
                    <span className="text-muted-foreground text-xs">/{child.slug}</span>
                    <span className="ml-auto">
                      <CategoryRowActions id={child.id} name={child.name} hasChildren={false} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-muted-foreground bg-card p-6 text-sm">No categories yet.</li>
        )}
      </ul>
    </div>
  );
}
