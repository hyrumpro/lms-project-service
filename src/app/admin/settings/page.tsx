import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageIntro } from "@/components/shared/page-intro";
import { SettingsSection, SwitchSetting, TextSetting } from "@/components/shared/settings-section";
import { getSystemSettings } from "@/lib/settings";
import { saveSystemSettingsForm } from "@/server/actions/settings-admin";

export const metadata = { title: "Admin · Settings" };

export default async function SettingsPage() {
  const system = await getSystemSettings();
  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        kicker="Admin"
        title="Settings"
        description="Site identity, commerce, sign-in, mail, and content rules. Gateway secrets stay in the environment."
      />
      <form action={saveSystemSettingsForm} className="flex max-w-3xl flex-col gap-6">
        <SettingsSection title="Site" description="How the academy introduces itself.">
          <TextSetting label="Site name" name="name" defaultValue={system.name} autoComplete="organization" />
          <TextSetting label="System email" name="email" type="email" defaultValue={system.email} autoComplete="email" />
        </SettingsSection>

        <SettingsSection title="Commerce" description="Revenue split, tax, and affiliate commission.">
          <TextSetting
            label="Instructor revenue %"
            name="instructorRevenuePercent"
            type="number"
            defaultValue={system.instructorRevenuePercent}
          />
          <TextSetting label="Tax %" name="courseSellingTax" type="number" defaultValue={system.courseSellingTax} />
          <TextSetting
            label="Affiliate commission %"
            name="affiliateCommissionPercent"
            type="number"
            defaultValue={system.affiliateCommissionPercent}
          />
        </SettingsSection>

        <SettingsSection title="Sign-in" description="Who can create an account, and which social providers appear.">
          <TextSetting
            label="Device login cap"
            name="allowedDeviceLogins"
            type="number"
            defaultValue={system.allowedDeviceLogins}
            description="Use 0 for unlimited sessions."
          />
          <TextSetting
            label="reCAPTCHA site key"
            name="recaptchaSiteKey"
            defaultValue={system.recaptchaSiteKey}
            description="Public site key from the reCAPTCHA admin console. Leave blank to skip the challenge."
          />
          <TextSetting
            label="reCAPTCHA secret"
            name="recaptchaSecretKey"
            defaultValue={system.recaptchaSecretKey}
            description="Server secret used to verify the challenge. It is stored with system settings, not in the page source."
            autoComplete="off"
          />
          <SwitchSetting label="Allow instructor applications" name="allowInstructor" defaultChecked={system.allowInstructor} />
          <SwitchSetting
            label="Require email verification"
            name="studentEmailVerification"
            defaultChecked={system.studentEmailVerification}
          />
          <SwitchSetting label="Google login" name="googleLogin" defaultChecked={system.googleLogin} />
          <SwitchSetting label="Facebook login" name="facebookLogin" defaultChecked={system.facebookLogin} />
          <SwitchSetting label="LinkedIn login" name="linkedinLogin" defaultChecked={system.linkedinLogin} />
        </SettingsSection>

        <SettingsSection title="Mail" description="Outbound mail uses these SMTP details when Resend is not configured.">
          <TextSetting label="SMTP host" name="smtpHost" defaultValue={system.smtpHost} description="Hostname of the mail server, such as smtp.example.com." />
          <TextSetting label="SMTP port" name="smtpPort" type="number" defaultValue={system.smtpPort} />
          <TextSetting label="SMTP user" name="smtpUser" defaultValue={system.smtpUser} autoComplete="username" />
          <TextSetting label="SMTP from" name="smtpFrom" type="email" defaultValue={system.smtpFrom} description="Address students see in the From line." />
        </SettingsSection>

        <SettingsSection title="Content" description="Certificates, watermarks, and optional product features.">
          <TextSetting
            label="Certificate quiz threshold"
            name="certificateQuizThreshold"
            type="number"
            defaultValue={system.certificateQuizThreshold}
            description="Minimum quiz score required before a certificate can be claimed."
          />
          <TextSetting label="Watermark text" name="watermarkText" defaultValue={system.watermarkText} />
          <SwitchSetting label="OpenAI assistant" name="openaiEnabled" defaultChecked={system.openaiEnabled} />
          <SwitchSetting label="Cookie notice" name="cookieConsent" defaultChecked={system.cookieConsent} />
          <SwitchSetting label="Drip content" name="dripEnabled" defaultChecked={system.dripEnabled} />
        </SettingsSection>

        <Alert>
          <AlertDescription>
            Payment gateway secrets stay in environment variables (STRIPE_SECRET_KEY, PAYPAL_CLIENT_ID, RAZORPAY_KEY_ID, and each regional GATEWAY_SECRET).
          </AlertDescription>
        </Alert>
        <Button className="h-11 w-fit" type="submit">
          Save settings
        </Button>
      </form>
    </div>
  );
}
