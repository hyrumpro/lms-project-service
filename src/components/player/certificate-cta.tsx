"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Award, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { issueCertificateForCourse } from "@/server/actions/learning";

/** Shown in the player tabs when the course hits 100% (spec §7.10). */
export function CertificateCta({
  courseId,
  code,
}: {
  courseId: string;
  code: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (code) {
    return (
      <Button render={<a href={`/certificate/${code}`} />}>
        <Award data-icon="inline-start" />
        View your certificate
      </Button>
    );
  }

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await issueCertificateForCourse(courseId);
          if (result.ok) {
            router.push(`/certificate/${result.code}`);
          } else {
            toast.error("Course isn't marked complete yet.");
          }
        })
      }
    >
      {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
      <Award data-icon="inline-start" />
      Claim your certificate
    </Button>
  );
}
