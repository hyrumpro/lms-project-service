"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { seoMeta } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAccessAdminSection } from "@/server/queries/admin";

export async function saveSeo(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/sign-in");
  if (!(await canAccessAdminSection(session.user.id, "content"))) redirect("/admin");
  const route = String(formData.get("route") ?? "");
  if (!route.startsWith("/")) return;
  await db
    .insert(seoMeta)
    .values({
      route,
      metaTitle: String(formData.get("metaTitle") ?? ""),
      metaDescription: String(formData.get("metaDescription") ?? ""),
    })
    .onConflictDoUpdate({
      target: seoMeta.route,
      set: {
        metaTitle: String(formData.get("metaTitle") ?? ""),
        metaDescription: String(formData.get("metaDescription") ?? ""),
      },
    });
  revalidatePath(route);
  redirect("/admin/seo");
}
