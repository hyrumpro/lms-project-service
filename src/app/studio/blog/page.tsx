import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/server/queries/community";
import { getStudioBlogPosts } from "@/server/queries/studio";
import { NewPostForm } from "@/components/studio/new-post-form";

export const metadata = { title: "Studio blog" };

export default async function StudioBlogPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");
  const posts = await getStudioBlogPosts(session.user.id);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">05 · Writing</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Blog</h1>
        <p className="text-muted-foreground text-sm">
          Instructor posts go live after admin moderation.
        </p>
      </header>

      <NewPostForm />

      {posts.length > 0 && (
        <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center gap-3 bg-card p-4 text-sm">
              <Badge variant={post.status === "published" ? "default" : "secondary"}>
                {post.status}
              </Badge>
              <span className="min-w-0 flex-1 truncate font-medium">{post.title}</span>
              <span className="text-muted-foreground text-xs">
                {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(post.publishedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
