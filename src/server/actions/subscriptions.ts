"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { plans, subscriptions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { allowMockGateway } from "@/lib/env";

export type SimpleResult = { ok: true } | { ok: false; error: string };

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.role === "admin" ? session : null;
}

const periodEnd = (interval: "month" | "year"): Date => {
  const d = new Date();
  if (interval === "year") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
};

/* ── user actions ─────────────────────────────────────────────────────── */

/**
 * Subscribe via the Sandbox gateway (spec §7.5 extension). Real gateways
 * (Stripe subscriptions) plug in here behind the same signature.
 */
export async function subscribeToPlan(planId: string): Promise<SimpleResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };
  if (!allowMockGateway()) return { ok: false, error: "gateway_unavailable" };

  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!plan || !plan.isActive) return { ok: false, error: "not_found" };

  const existing = await db
    .select({ id: subscriptions.id, status: subscriptions.status })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.planId, planId)))
    .limit(1);
  if (existing[0]?.status === "active") return { ok: false, error: "already_active" };

  await db
    .insert(subscriptions)
    .values({
      userId,
      planId,
      status: "active",
      gateway: "mock",
      transactionId: `SUB-${Date.now()}`,
      currentPeriodEnd: periodEnd(plan.interval),
    })
    .onConflictDoUpdate({
      target: [subscriptions.userId, subscriptions.planId],
      set: { status: "active", currentPeriodEnd: periodEnd(plan.interval) },
    });

  revalidatePath("/dashboard/subscription");
  revalidatePath("/pricing");
  return { ok: true };
}

/** Cancel: status → canceled; access keeps running until currentPeriodEnd. */
export async function cancelSubscription(planId: string): Promise<SimpleResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };
  await db
    .update(subscriptions)
    .set({ status: "canceled", canceledAt: new Date() })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.planId, planId)));
  revalidatePath("/dashboard/subscription");
  return { ok: true };
}

/** Re-activate a canceled subscription that hasn't expired yet. */
export async function reactivateSubscription(planId: string): Promise<SimpleResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "auth_required" };
  await db
    .update(subscriptions)
    .set({ status: "active", canceledAt: null })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.planId, planId)));
  revalidatePath("/dashboard/subscription");
  return { ok: true };
}

/* ── admin CRUD (legacy-style, section: commerce) ─────────────────────── */

const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).optional(),
  price: z.coerce.number().min(0),
  interval: z.enum(["month", "year"]),
  features: z.string().optional(), // newline-separated
  isActive: z.boolean().default(true),
});

export async function savePlan(
  id: string | null,
  input: z.infer<typeof planSchema>,
): Promise<SimpleResult> {
  if (!(await requireAdmin())) return { ok: false, error: "forbidden" };
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const values = {
    name: parsed.data.name,
    slug: parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    description: parsed.data.description || null,
    price: Math.round(parsed.data.price * 100),
    interval: parsed.data.interval,
    features: (parsed.data.features ?? "")
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean),
    isActive: parsed.data.isActive,
    updatedAt: new Date(),
  };

  if (id) {
    await db.update(plans).set(values).where(eq(plans.id, id));
  } else {
    await db.insert(plans).values({ ...values, id: crypto.randomUUID(), sortOrder: 99 }).onConflictDoNothing();
  }
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true };
}

export async function deletePlan(id: string): Promise<SimpleResult> {
  if (!(await requireAdmin())) return { ok: false, error: "forbidden" };
  try {
    await db.delete(plans).where(eq(plans.id, id));
  } catch {
    return { ok: false, error: "has_subscribers" };
  }
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true };
}
