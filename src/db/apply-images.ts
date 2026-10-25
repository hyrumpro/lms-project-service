import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, courses, user } from "@/db/schema";
import { CATEGORY_IMAGES, COURSE_IMAGES, INSTRUCTOR_IMAGES } from "@/lib/media";

/**
 * Backfills Pexels cover/portrait paths onto existing demo rows without
 * reseeding (the seed wipes accounts, enrollments and reviews).
 * Run: npx tsx src/db/apply-images.ts
 */
async function main() {
  const result = { courses: 0, categories: 0, instructors: 0 };

  for (const [title, thumbnail] of Object.entries(COURSE_IMAGES)) {
    const rows = await db
      .update(courses)
      .set({ thumbnail })
      .where(eq(courses.title, title))
      .returning({ id: courses.id });
    result.courses += rows.length;
  }

  for (const [name, thumbnail] of Object.entries(CATEGORY_IMAGES)) {
    const rows = await db
      .update(categories)
      .set({ thumbnail })
      .where(eq(categories.name, name))
      .returning({ id: categories.id });
    result.categories += rows.length;
  }

  // Sub-categories reuse their parent's cover so no category card is blank.
  const all = await db
    .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
    .from(categories);
  const byId = new Map(all.map((c) => [c.id, c]));
  for (const child of all) {
    if (!child.parentId) continue;
    const parent = byId.get(child.parentId);
    const thumbnail = parent ? CATEGORY_IMAGES[parent.name] : undefined;
    if (thumbnail) {
      await db.update(categories).set({ thumbnail }).where(eq(categories.id, child.id));
      result.categories += 1;
    }
  }

  for (const [email, image] of Object.entries(INSTRUCTOR_IMAGES)) {
    const rows = await db.update(user).set({ image }).where(eq(user.email, email)).returning({ id: user.id });
    result.instructors += rows.length;
  }

  console.log("Image backfill complete:", result);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
