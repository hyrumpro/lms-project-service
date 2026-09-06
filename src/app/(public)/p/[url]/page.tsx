import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { customPages } from "@/db/schema";
import { Button } from "@/components/ui/button";

type Params = Promise<{ url: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { url } = await params;
  const [page] = await db.select().from(customPages).where(eq(customPages.url, url)).limit(1);
  return { title: page?.title ?? "Page not found" };
}


export default async function CustomPage({ params }: { params: Params }) {
  const { url } = await params;
  const [page] = await db.select().from(customPages).where(eq(customPages.url, url)).limit(1);
  if (!page || !page.status) notFound();

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16">
      <p className="kicker mb-2">Academy · Page</p>
      <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
      <div className="rule-dash my-8" aria-hidden />
      <div
        className="prose-academy text-foreground/90 [&_a]:text-coral [&_a]:underline [&_h2]:font-heading [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-4"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
      {page.buttonTitle && (
        <Button className="mt-8" render={<Link href="/courses" />}>
          {page.buttonTitle}
          <ArrowRight data-icon="inline-end" />
        </Button>
      )}
    </article>
  );
}

