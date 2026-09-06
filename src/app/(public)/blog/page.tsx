import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getBlogCategories, listPublishedPosts } from "@/server/queries/blog";

export async function generateMetadata() {
  const { getSeoForRoute } = await import("@/lib/seo-meta");
  const seo = await getSeoForRoute("blogs");
  if (seo) return { ...seo, title: seo.title ?? "Blog" };
  return {
    title: "Blog",
    description: "Teaching notes, product updates and learning science from the Academy.",
  };
}

function fmt(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(
    date,
  );
}

export const revalidate = 300;

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [categories, posts] = await Promise.all([
    getBlogCategories(),
    listPublishedPosts({ categorySlug: category }),
  ]);
  const [featured, ...rest] = posts;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-14">
      <header className="mb-10 max-w-2xl">
        <p className="kicker">04 · Journal</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          Notes from the <span className="mark italic">faculty</span>.
        </h1>
        <p className="text-muted-foreground mt-3">
          Teaching notes, learning science and product updates — written by the people who build
          the courses.
        </p>
      </header>

      <nav className="mb-10 flex flex-wrap gap-2" aria-label="Blog categories">
        <Link
          href="/blog"
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
            category
              ? "border-border hover:bg-secondary"
              : "border-transparent bg-primary text-primary-foreground"
          }`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/blog?category=${c.slug}`}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              category === c.slug
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border hover:bg-secondary"
            }`}
          >
            {c.title} · {c.postCount}
          </Link>
        ))}
      </nav>

      {featured && (
        <Link
          href={`/blog/${featured.slug}`}
          className="group mb-12 grid grid-cols-1 gap-6 rounded-2xl border-2 border-dashed p-6 transition-colors hover:bg-secondary/50 sm:p-10 lg:grid-cols-[1.4fr_1fr]"
        >
          <div className="flex flex-col items-start gap-4">
            <p className="kicker">Featured · {featured.categoryTitle}</p>
            <h2 className="font-heading text-3xl font-semibold leading-tight group-hover:underline sm:text-4xl">
              {featured.title}
            </h2>
            <p className="text-muted-foreground line-clamp-3">{featured.description}</p>
          </div>
          <div className="flex items-end gap-3 lg:justify-end">
            <Avatar className="size-10">
              <AvatarImage src={featured.authorImage ?? undefined} alt={featured.authorName} />
              <AvatarFallback>{featured.authorName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <p className="font-medium">{featured.authorName}</p>
              <p className="text-muted-foreground">{fmt(featured.publishedAt)}</p>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group flex flex-col gap-3 bg-card p-6 transition-colors hover:bg-secondary/50"
          >
            <p className="kicker">{post.categoryTitle}</p>
            <h3 className="font-heading text-xl font-semibold leading-snug group-hover:underline">
              {post.title}
            </h3>
            <p className="text-muted-foreground line-clamp-2 text-sm">{post.description}</p>
            <p className="text-muted-foreground mt-auto pt-3 text-xs">
              {post.authorName} · {fmt(post.publishedAt)}
            </p>
          </Link>
        ))}
        {posts.length === 0 && (
          <p className="text-muted-foreground bg-card p-6 text-sm">No posts yet.</p>
        )}
      </div>
    </div>
  );
}
