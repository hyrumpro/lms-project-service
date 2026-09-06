import { desc } from "drizzle-orm";
import { db } from "@/db";
import { newsletterCampaigns } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignForm, SendCampaignButton } from "@/components/admin/campaign-controls";
import { listSubscribers } from "@/server/queries/admin";

export const metadata = { title: "Admin · Newsletters" };

export default async function AdminNewslettersPage() {
  const [campaigns, subscribers] = await Promise.all([
    db.select().from(newsletterCampaigns).orderBy(desc(newsletterCampaigns.createdAt)).limit(50),
    listSubscribers(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">06 · Outbound</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Newsletters</h1>
        <p className="text-muted-foreground text-sm">
          {subscribers.length} subscriber{subscribers.length === 1 ? "" : "s"}. Sending logs
          recipients in the sandbox — wire Resend/SMTP in `sendCampaign` for production
          (spec §12.4).
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Compose campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignForm />
        </CardContent>
      </Card>

      <ul className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
        {campaigns.map((campaign) => (
          <li key={campaign.id} className="flex flex-wrap items-center gap-3 bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{campaign.subject}</p>
              <p className="text-muted-foreground line-clamp-1 text-sm">{campaign.body}</p>
              {campaign.stats && (
                <p className="text-muted-foreground text-xs">
                  sent to {campaign.stats.sent} · failed {campaign.stats.failed}
                </p>
              )}
            </div>
            <Badge variant={campaign.status === "sent" ? "default" : "outline"}>
              {campaign.status}
            </Badge>
            {campaign.status === "draft" && <SendCampaignButton campaignId={campaign.id} />}
          </li>
        ))}
        {campaigns.length === 0 && (
          <li className="text-muted-foreground bg-card p-6 text-sm">No campaigns yet.</li>
        )}
      </ul>
    </div>
  );
}
