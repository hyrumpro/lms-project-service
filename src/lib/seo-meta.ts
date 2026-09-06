import { eq } from "drizzle-orm";
import { db } from "@/db";
import { seoMeta } from "@/db/schema";

/** Per-route SEO consumption (legacy seo_fields / get_seo_by_route parity). */
export async function getSeoForRoute(route: string) {
  const [row] = await db
    .select()
    .from(seoMeta)
    .where(eq(seoMeta.route, route))
    .limit(1);
  if (!row) return null;
  return {
    title: row.metaTitle ?? undefined,
    description: row.metaDescription ?? undefined,
    keywords: row.metaKeywords ?? undefined,
    robots: row.metaRobots ? { index: !/noindex/i.test(row.metaRobots) } : undefined,
    alternates: row.canonicalUrl ? { canonical: row.canonicalUrl } : undefined,
    openGraph: row.ogTitle || row.ogDescription
      ? { title: row.ogTitle ?? undefined, description: row.ogDescription ?? undefined, images: row.ogImage ? [row.ogImage] : undefined }
      : undefined,
  };
}
