import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { PageIntro } from "@/components/shared/page-intro";
import { SettingsSection, SwitchSetting } from "@/components/shared/settings-section";
import { saveEmailTemplate } from "@/server/actions/settings-admin";

const EVENTS = [
  "course_status",
  "purchase_instructor",
  "purchase_admin",
  "certificate",
  "gift",
  "withdrawal_requested",
  "withdrawal_approved",
  "withdrawal_cancelled",
] as const;

const EVENT_LABEL: Record<(typeof EVENTS)[number], string> = {
  course_status: "Course status",
  purchase_instructor: "Purchase, instructor",
  purchase_admin: "Purchase, admin",
  certificate: "Certificate",
  gift: "Gift",
  withdrawal_requested: "Withdrawal requested",
  withdrawal_approved: "Withdrawal approved",
  withdrawal_cancelled: "Withdrawal cancelled",
};

export const metadata = { title: "Admin · Emails" };

export default async function EmailsPage() {
  const [row] = await db.select().from(settings).where(eq(settings.key, "email_templates"));
  const templates = (row?.value ?? {}) as Record<string, { enabled?: boolean; subject?: string; body?: string }>;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageIntro
        kicker="Admin"
        title="Notification templates"
        description="Each event sends its own subject and body. Turn an event off to stop that message."
      />
      {EVENTS.map((event) => (
        <form key={event} action={saveEmailTemplate}>
          <input type="hidden" name="event" value={event} />
          <SettingsSection
            title={EVENT_LABEL[event]}
            description={event}
            footer={
              <Button className="h-11" type="submit">
                Save {EVENT_LABEL[event].toLowerCase()}
              </Button>
            }
          >
            <SwitchSetting label="Enabled" name="enabled" defaultChecked={templates[event]?.enabled ?? true} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${event}-subject`}>Subject</FieldLabel>
                <Input
                  id={`${event}-subject`}
                  name="subject"
                  defaultValue={templates[event]?.subject ?? event}
                  className="h-11"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${event}-body`}>Body</FieldLabel>
                <Textarea id={`${event}-body`} name="body" defaultValue={templates[event]?.body ?? ""} className="min-h-24" />
              </Field>
            </FieldGroup>
          </SettingsSection>
        </form>
      ))}
    </div>
  );
}
