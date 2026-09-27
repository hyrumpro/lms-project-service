import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { PageIntro } from "@/components/shared/page-intro";
import { ensureAffiliateCode } from "@/server/actions/addons";

export const metadata = { title: "Affiliate" };

export default async function AffiliatePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const result = await ensureAffiliateCode();
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageIntro
        kicker="Account"
        title="Affiliate"
        description="Share your code at checkout. Commission is recorded on the payout ledger when a buyer uses it."
      />
      <Card>
        <CardHeader>
          <CardTitle>Your code</CardTitle>
          <CardDescription>Buyers enter this code during checkout.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-2xl font-semibold tracking-wide">
            {result.ok ? result.code : "Unavailable"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
