import { eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, courses } from "@/db/schema";
import { priceCart } from "@/server/services/checkout";
import { getSystemSettings } from "@/lib/settings";

/** Cart preview with legacy-parity pricing math (§3.9). */

const instructorNamesSql = sql<string>`(
  select coalesce(string_agg(u.name, ', '), '') from course_instructors ci
  join "user" u on u.id = ci.instructor_id where ci.course_id = ${courses.id}
)`;

export async function getCartPreview(userId: string, courseIdsOverride?: string[]) {
  const system = await getSystemSettings();
  const selection = { ...getTableColumns(courses), instructorNames: instructorNamesSql };

  const courseRows = courseIdsOverride?.length
    ? await db.select(selection).from(courses).where(inArray(courses.id, courseIdsOverride))
    : await db
        .select(selection)
        .from(cartItems)
        .innerJoin(courses, eq(courses.id, cartItems.courseId))
        .where(eq(cartItems.userId, userId));

  const cart = priceCart(courseRows, null, system.courseSellingTax);

  return {
    ...cart,
    lines: cart.lines.map((line, i) => ({
      ...line,
      slug: courseRows[i]?.slug ?? "",
      instructorNames: courseRows[i]?.instructorNames ?? "",
    })),
  };
}
