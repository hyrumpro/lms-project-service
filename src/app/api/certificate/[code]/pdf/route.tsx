import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/db";
import { certificate, courses, user } from "@/db/schema";
import { CertificatePdf } from "@/components/certificate/certificate-pdf";

export const runtime = "nodejs";

/**
 * GET /api/certificate/[code]/pdf — downloadable diploma (legacy html2canvas
 * parity, upgraded to a true vector PDF).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const [row] = await db
    .select({
      code: certificate.code,
      issuedAt: certificate.issuedAt,
      studentName: user.name,
      courseTitle: courses.title,
    })
    .from(certificate)
    .innerJoin(user, eq(user.id, certificate.studentId))
    .innerJoin(courses, eq(courses.id, certificate.courseId))
    .where(eq(certificate.code, decodeURIComponent(code)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
  const buffer = await renderToBuffer(
    <CertificatePdf
      studentName={row.studentName}
      courseTitle={row.courseTitle}
      code={row.code}
      issuedAt={new Intl.DateTimeFormat("en", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(row.issuedAt)}
      verifyUrl={`${base}/certificate/${row.code}`}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="academy-certificate-${row.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
