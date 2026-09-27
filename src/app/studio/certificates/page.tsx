import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { certificate, courseInstructors, courses, user } from "@/db/schema";
import { auth } from "@/lib/auth";

export const metadata = { title: "Studio · Certificates" };

export default async function StudioCertificatesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const owned = await db
    .select({ courseId: courseInstructors.courseId })
    .from(courseInstructors)
    .where(eq(courseInstructors.instructorId, session.user.id));
  const ids = owned.map((row) => row.courseId);
  const rows =
    ids.length === 0
      ? []
      : await db
          .select({
            code: certificate.code,
            issuedAt: certificate.issuedAt,
            student: user.name,
            course: courses.title,
          })
          .from(certificate)
          .innerJoin(user, eq(user.id, certificate.studentId))
          .innerJoin(courses, eq(courses.id, certificate.courseId))
          .where(and(inArray(certificate.courseId, ids)))
          .orderBy(desc(certificate.issuedAt))
          .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-3xl font-semibold">Certificates issued</h1>
      <ul className="flex flex-col gap-2 text-sm">
        {rows.length === 0 && <li className="text-muted-foreground">None yet.</li>}
        {rows.map((row) => (
          <li key={row.code} className="flex justify-between gap-3 rounded-lg border px-3 py-2">
            <span>
              {row.student} · {row.course}
            </span>
            <Link className="text-coral hover:underline" href={`/certificate/${row.code}`}>
              {row.code}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
