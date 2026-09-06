import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { followings, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function isFollowing(followerId: string, instructorId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: followings.id })
    .from(followings)
    .where(and(eq(followings.followerId, followerId), eq(followings.instructorId, instructorId)))
    .limit(1);
  return Boolean(row);
}

export async function getFollowedInstructors(userId: string) {
  return db
    .select({
      id: user.id,
      name: user.name,
      title: user.title,
      biography: user.biography,
      followedAt: followings.createdAt,
    })
    .from(followings)
    .innerJoin(user, eq(user.id, followings.instructorId))
    .where(eq(followings.followerId, userId))
    .orderBy(desc(followings.createdAt));
}

export async function getFollowerCount(instructorId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(followings)
    .where(eq(followings.instructorId, instructorId));
  return row?.total ?? 0;
}
