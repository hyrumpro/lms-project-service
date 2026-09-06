import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { plans, subscriptions } from "@/db/schema";

/** Subscription queries + the all-access gate (spec §7.5 extension). */

export type ActiveSubscription = {
  id: string;
  planId: string;
  planName: string;
  planSlug: string;
  price: number;
  interval: "month" | "year";
  status: string;
  currentPeriodEnd: Date;
};

/** The user's governing subscription: active now, or canceled but not yet expired. */
export async function getActiveSubscription(userId: string): Promise<ActiveSubscription | null> {
  const [row] = await db
    .select({
      id: subscriptions.id,
      planId: plans.id,
      planName: plans.name,
      planSlug: plans.slug,
      price: plans.price,
      interval: plans.interval,
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(
      and(
        eq(subscriptions.userId, userId),
        gt(subscriptions.currentPeriodEnd, new Date()),
      ),
    )
    .orderBy(subscriptions.currentPeriodEnd);
  return row ?? null;
}

export async function listActivePlans() {
  return db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.sortOrder), asc(plans.price));
}

export async function listAllPlans() {
  return db.select().from(plans).orderBy(asc(plans.sortOrder), asc(plans.price));
}

export async function countActiveSubscribers(planId: string): Promise<number> {
  const [row] = await db
    .select({ n: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.planId, planId))
    .limit(1);
  return row ? 1 : 0;
}
