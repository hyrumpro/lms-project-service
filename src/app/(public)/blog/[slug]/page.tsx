import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from "@/lib/auth";
import { getPostBySlug, getPostComments, getRelatedPosts } from "@/server/queries/blog";
import { CommentForm } from "@/components/blog/comment-form";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  return { title: post?.title ?? "Post not found", description: post?.description };
}

export const revalidate = 300;

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [post, session] = await Promise.all([
    getPostBySlug(slug),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!post) notFound();

  const [comments, related] = await Promise.all([
    getPostComments(post.id),
    getRelatedPosts(post.id, post.categoryId),
  ]);

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-14">
      <div className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
        <Link href="/blog" className="hover:text-foreground">
          Blog
        </Link>
        <span>/</span>
        <Link href={`/blog?category=${post.categorySlug}`} className="hover:text-foreground">
          {post.categoryTitle}
        </Link>
      </div>

      <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        {post.title}
      </h1>

      <div className="mt-6 flex items-center gap-3">
        <Avatar className="size-10">
          <AvatarImage src={post.authorImage ?? undefined} alt={post.authorName} />
          <AvatarFallback>{post.authorName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="text-sm">
          <Link href={`/instructor/${post.authorId}`} className="font-medium hover:underline">
            {post.authorName}
          </Link>
          <p className="text-muted-foreground">
            {new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(
              post.publishedAt,
            )}
          </p>
        </div>
      </div>

      <div className="rule-dash my-8" aria-hidden />

      <div
        className="text-foreground/90 [&_a]:text-coral [&_a]:underline [&_blockquote]:border-coral [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:font-heading [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:font-heading [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-4"
        dangerouslySetInnerHTML={{ __html: post.description }}
      />

      <section className="mt-14">
        <h2 className="font-heading text-2xl font-semibold">
          Discussion <span className="text-muted-foreground text-base">({comments.length})</span>
        </h2>
        <div className="rule-dash my-5" aria-hidden />
        {session ? (
          <CommentForm postId={post.id} slug={post.slug} />
        ) : (
          <p className="text-muted-foreground text-sm">
            <Link href="/sign-in" className="text-coral font-medium hover:underline">
              Sign in
            </Link>{" "}
            to join the discussion.
          </p>
        )}
        <ul className="mt-8 flex flex-col gap-6">
          {comments.map((comment) => (
            <li key={comment.id} className="flex items-start gap-3">
              <Avatar className="size-9">
                <AvatarImage src={comment.userImage ?? undefined} alt={comment.userName} />
                <AvatarFallback>{comment.userName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {comment.userName}{" "}
                  <span className="text-muted-foreground font-normal">
                    ·{" "}
                    {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
                      comment.createdAt,
                    )}
                  </span>
                </p>
                <p className="text-muted-foreground text-sm">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="font-heading text-2xl font-semibold">Keep reading</h2>
          <div className="rule-dash my-5" aria-hidden />
          <ul className="flex flex-col gap-4">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/blog/${r.slug}`} className="group flex flex-col gap-1">
                  <span className="font-heading text-lg font-medium group-hover:underline">
                    {r.title}
                  </span>
                  <span className="text-muted-foreground line-clamp-1 text-sm">{r.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/blog"
        className="text-coral mt-12 inline-block text-sm font-medium hover:underline"
      >
        ← All posts
      </Link>
    </article>
  );
}
