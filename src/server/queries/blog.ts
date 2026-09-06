import { and, desc, eq, getTableColumns, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { postCategories, postComments, posts, user } from "@/db/schema";

/** Blog queries (spec §7.13) — legacy Crud_model blog functions. */

export async function getBlogCategories() {
  return db
    .select({
      ...getTableColumns(postCategories),
      postCount: sql<number>`(
        select count(*) from ${posts} p where p.category_id = ${postCategories.id} and p.status = 'published'
      )::int`,
    })
    .from(postCategories)
    .orderBy(postCategories.title);
}

export async function listPublishedPosts(opts: { categorySlug?: string; limit?: number } = {}) {
  const conditions = [eq(posts.status, "published")];
  if (opts.categorySlug) {
    conditions.push(eq(postCategories.slug, opts.categorySlug));
  }
  return db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      description: posts.description,
      isPopular: posts.isPopular,
      publishedAt: posts.publishedAt,
      authorName: user.name,
      authorImage: user.image,
      authorId: user.id,
      categoryTitle: postCategories.title,
      categorySlug: postCategories.slug,
    })
    .from(posts)
    .innerJoin(user, eq(user.id, posts.authorId))
    .innerJoin(postCategories, eq(postCategories.id, posts.categoryId))
    .where(and(...conditions))
    .orderBy(desc(posts.isPopular), desc(posts.publishedAt))
    .limit(opts.limit ?? 30);
}

export async function getPostBySlug(slug: string) {
  const [post] = await db
    .select({
      ...getTableColumns(posts),
      authorName: user.name,
      authorImage: user.image,
      authorId: user.id,
      authorTitle: user.title,
      categoryTitle: postCategories.title,
      categorySlug: postCategories.slug,
    })
    .from(posts)
    .innerJoin(user, eq(user.id, posts.authorId))
    .innerJoin(postCategories, eq(postCategories.id, posts.categoryId))
    .where(and(eq(posts.slug, slug), eq(posts.status, "published")))
    .limit(1);
  return post ?? null;
}

export async function getPostComments(postId: string) {
  return db
    .select({
      id: postComments.id,
      body: postComments.body,
      createdAt: postComments.createdAt,
      userName: user.name,
      userImage: user.image,
    })
    .from(postComments)
    .innerJoin(user, eq(user.id, postComments.userId))
    .where(eq(postComments.postId, postId))
    .orderBy(desc(postComments.createdAt));
}

export async function getRelatedPosts(postId: string, categoryId: string, limit = 3) {
  return db
    .select({ id: posts.id, title: posts.title, slug: posts.slug, description: posts.description })
    .from(posts)
    .where(
      and(
        eq(posts.status, "published"),
        eq(posts.categoryId, categoryId),
        ne(posts.id, postId),
      ),
    )
    .limit(limit);
}
