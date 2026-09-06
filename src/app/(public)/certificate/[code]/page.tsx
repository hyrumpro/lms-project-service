import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Printer } from "lucide-react";
import { db } from "@/db";
import { certificate, courses, user } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/player/print-button";
import { Download } from "lucide-react";

type Params = Promise<{ code: string }>;

export const metadata = { title: "Certificate verification" };

export default async function CertificatePage({ params }: { params: Params }) {
  const { code } = await params;
  const [row] = await db
    .select({
      studentName: user.name,
      courseTitle: courses.title,
      issuedAt: certificate.issuedAt,
    })
    .from(certificate)
    .innerJoin(user, eq(user.id, certificate.studentId))
    .innerJoin(courses, eq(courses.id, certificate.courseId))
    .where(eq(certificate.code, code))
    .limit(1);
  if (!row) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="kicker">Certificate verification</p>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <BadgeCheck className="size-4 text-teal-600" />
            Valid certificate · code{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{code}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Button render={<a href={`/api/certificate/${encodeURIComponent(code)}/pdf`} download />}>
            <Download data-icon="inline-start" />
            Download PDF
          </Button>
          <PrintButton />
          <Button variant="outline" render={<Link href="/courses" />}>
            Browse courses
          </Button>
        </div>
      </div>

      {/* the certificate — ornate print view */}
      <article className="relative mx-auto border-8 border-double border-coral/60 bg-card p-2 shadow-lg">
        <div className="border border-coral/30 px-8 py-12 text-center sm:px-16">
          <p className="font-heading text-xs font-semibold tracking-[0.35em] text-muted-foreground uppercase">
            Academy LMS
          </p>
          <div className="mx-auto my-6 h-px w-24 bg-coral" aria-hidden />
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Certificate <span className="mark italic">of Completion</span>
          </h1>
          <p className="text-muted-foreground mt-8 text-sm">This certifies that</p>
          <p className="font-heading mt-2 text-3xl font-semibold sm:text-4xl">{row.studentName}</p>
          <p className="text-muted-foreground mt-6 text-sm">
            has successfully completed the course
          </p>
          <p className="font-heading mt-2 text-2xl font-medium italic">{row.courseTitle}</p>

          <div className="mt-12 flex items-end justify-between gap-6 text-left">
            <div className="flex flex-col gap-1">
              <span className="kicker">Issued</span>
              <span className="text-sm font-medium">
                {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(row.issuedAt)}
              </span>
            </div>
            {/* seal */}
            <div
              aria-hidden
              className="flex size-24 rotate-6 flex-col items-center justify-center rounded-full border-4 border-sun bg-sun/20 text-center"
            >
              <span className="font-heading text-[10px] font-bold tracking-widest text-sun-foreground uppercase">
                Academy
              </span>
              <span className="font-heading text-lg font-semibold text-sun-foreground">✓</span>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="kicker">Certificate ID</span>
              <span className="font-mono text-sm">{code}</span>
            </div>
          </div>
        </div>
      </article>

      <p className="text-muted-foreground no-print mt-6 text-center text-xs">
        Anyone can verify this certificate by visiting this page.
      </p>
    </div>
  );
}
