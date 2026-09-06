const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Canonical course URL: /course/{slug}-{id} (legacy SEO parity, spec §3.1). */
export function courseHref(slug: string, id: string): string {
  return `/course/${slug}-${id}`;
}

/** Accepts "learn-ecommerce", "learn-ecommerce-<uuid>" or a bare id. */
export function parseCourseSlugParam(param: string): { slug: string; id?: string } {
  const match = param.match(UUID_RE);
  if (match) {
    return {
      slug: param.slice(0, param.length - match[0].length - 1),
      id: match[0],
    };
  }
  return { slug: param };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
