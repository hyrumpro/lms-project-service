import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { bundleCourses, bundles, courses } from "@/db/schema";
import { courseHref } from "@/lib/slug";
import { PageIntro } from "@/components/shared/page-intro";
import { purchaseBundleForm } from "@/server/actions/addons";

export default async function BundlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [bundle] = await db.select().from(bundles).where(eq(bundles.slug, slug)).limit(1);
  if (!bundle) notFound();
  const included = await db
    .select({ title: courses.title, id: courses.id, slug: courses.slug })
    .from(bundleCourses)
    .innerJoin(courses, eq(courses.id, bundleCourses.courseId))
    .where(eq(bundleCourses.bundleId, bundle.id));
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <PageIntro
        kicker="Bundle"
        title={bundle.title}
        description={bundle.summary ?? "One checkout enrolls you in every course below."}
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-3xl tabular-nums">${(bundle.price / 100).toFixed(2)}</CardTitle>
        </CardHeader>
        <CardContent>
          {included.length === 0 ? (
            <p className="text-muted-foreground text-sm">This bundle does not list any courses yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {included.map((course) => (
                <li key={course.id}>
                  <Link href={courseHref(course.slug, course.id)} className="text-sm font-medium hover:underline">
                    {course.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <CardFooter>
          <form action={purchaseBundleForm}>
            <input type="hidden" name="slug" value={bundle.slug} />
            <Button className="h-11" type="submit">
              Buy bundle
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}
