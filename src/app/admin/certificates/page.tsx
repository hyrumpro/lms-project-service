import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Award } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { certificate, courses, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { CatalogEmpty } from "@/components/shared/catalog-empty";
import { PageIntro } from "@/components/shared/page-intro";
import { canAccessAdminSection } from "@/server/queries/admin";

export const metadata = { title: "Admin · Certificates" };

export default async function AdminCertificatesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/dashboard");
  if (!(await canAccessAdminSection(session.user.id, "content"))) redirect("/admin");

  const rows = await db
    .select({
      code: certificate.code,
      issuedAt: certificate.issuedAt,
      student: user.name,
      course: courses.title,
    })
    .from(certificate)
    .innerJoin(user, eq(user.id, certificate.studentId))
    .innerJoin(courses, eq(courses.id, certificate.courseId))
    .orderBy(desc(certificate.issuedAt))
    .limit(100);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageIntro
        kicker="Admin"
        title="Issued certificates"
        description="The latest 100 certificates. Open a code to see the public certificate page."
      />
      {rows.length === 0 ? (
        <CatalogEmpty
          icon={<Award />}
          title="None issued yet"
          description="Certificates appear after a student finishes a course and claims one from the player."
          href="/admin/courses"
          action="Review courses"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.code}>
                <TableCell className="whitespace-normal">{row.student}</TableCell>
                <TableCell className="whitespace-normal">{row.course}</TableCell>
                <TableCell className="tabular-nums">{row.issuedAt.toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button variant="link" className="h-11 px-0" nativeButton={false} render={<Link href={`/certificate/${row.code}`} />}>
                    {row.code}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
