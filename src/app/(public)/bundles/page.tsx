import Link from "next/link";
import { desc } from "drizzle-orm";
import { Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { bundles } from "@/db/schema";
import { CatalogEmpty } from "@/components/shared/catalog-empty";
import { PageIntro } from "@/components/shared/page-intro";

export const metadata = { title: "Course bundles" };

export default async function BundlesPage() {
  const rows = await db.select().from(bundles).orderBy(desc(bundles.createdAt));
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12">
      <PageIntro
        kicker="Catalog"
        title="Course bundles"
        description="A bundle enrolls you in every included course at one price."
      />
      {rows.length === 0 ? (
        <CatalogEmpty
          icon={<Library />}
          title="No bundles yet"
          description="When an academy publishes a bundle, it will show up here with its price and courses."
          href="/courses"
          action="Browse courses"
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((bundle) => (
            <li key={bundle.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>
                    <Link href={`/bundles/${bundle.slug}`} className="hover:underline">
                      {bundle.title}
                    </Link>
                  </CardTitle>
                  {bundle.summary ? <CardDescription>{bundle.summary}</CardDescription> : null}
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-2xl font-semibold tabular-nums">
                    ${(bundle.price / 100).toFixed(2)}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button className="h-11" nativeButton={false} render={<Link href={`/bundles/${bundle.slug}`} />}>
                    View bundle
                  </Button>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
