import nodemailer, { type Transporter } from "nodemailer";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

let smtpTransporter: Transporter | null = null;

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) return null;

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  return smtpTransporter;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
}: SendEmailOptions): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const fromAddress = from || process.env.EMAIL_FROM || "Academy LMS <no-reply@academy-lms.com>";
  const recipients = Array.isArray(to) ? to.join(", ") : to;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, " "),
        }),
      });

      const data = (await res.json()) as { id?: string; error?: { message: string } };
      if (!res.ok) {
        console.error("[email:resend] Error:", data);
        return { ok: false, error: data.error?.message || "Failed to send via Resend" };
      }
      return { ok: true, messageId: data.id };
    } catch (err) {
      console.error("[email:resend] Network error:", err);
      return { ok: false, error: String(err) };
    }
  }

  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: recipients,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, " "),
      });
      return { ok: true, messageId: info.messageId };
    } catch (err) {
      console.error("[email:smtp] Error:", err);
      return { ok: false, error: String(err) };
    }
  }

  console.info(`[EMAIL SANDBOX] To: ${recipients} | Subject: ${subject}`);
  return { ok: true, messageId: `sandbox-${Date.now()}` };
}

function emailLayout(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: sans-serif; background: #f4f5f7; color: #1e293b;">
  <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden;">
    <div style="background: #0f172a; padding: 24px 32px; color: #fff;"><h1 style="margin:0;font-size:20px;">Academy LMS</h1></div>
    <div style="padding: 32px; font-size: 15px; line-height: 1.6;">${contentHtml}</div>
    <div style="padding: 20px 32px; background: #f8fafc; font-size: 12px; color: #64748b; text-align: center;">&copy; ${new Date().getFullYear()} Academy LMS</div>
  </div>
</body>
</html>`;
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  userName,
}: {
  to: string;
  resetUrl: string;
  userName?: string;
}) {
  const name = userName ? `Hello ${userName},` : "Hello,";
  const html = emailLayout(
    "Reset your password",
    `<p>${name}</p>
     <p>We received a request to reset your password. Use the link below to choose a new one.</p>
     <p><a href="${resetUrl}">Reset password</a></p>
     <p style="font-size:12px;word-break:break-all;">${resetUrl}</p>`,
  );
  return sendEmail({ to, subject: "Reset your Academy LMS password", html });
}

export async function sendVerificationEmail({
  to,
  verifyUrl,
  userName,
}: {
  to: string;
  verifyUrl: string;
  userName?: string;
}) {
  const name = userName ? `Hello ${userName},` : "Hello,";
  const html = emailLayout(
    "Verify your email",
    `<p>${name}</p>
     <p>Confirm your Academy LMS account.</p>
     <p><a href="${verifyUrl}">Verify email</a></p>
     <p style="font-size:12px;word-break:break-all;">${verifyUrl}</p>`,
  );
  return sendEmail({ to, subject: "Verify your email address - Academy LMS", html });
}

export async function sendOrderConfirmationEmail({
  to,
  orderId,
  total,
  items,
  userName,
}: {
  to: string;
  orderId: string;
  total: number;
  items: { title: string; price: number }[];
  userName?: string;
}) {
  const name = userName ? `Hello ${userName},` : "Hello,";
  const itemsHtml = items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${item.title}</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">${(item.price / 100).toFixed(2)}</td></tr>`,
    )
    .join("");
  const html = emailLayout(
    "Order Confirmation",
    `<p>${name}</p>
     <p>Your order ${orderId} is confirmed.</p>
     <table style="width:100%;border-collapse:collapse;">${itemsHtml}
       <tr><td style="padding-top:12px;font-weight:bold;">Total</td><td style="padding-top:12px;text-align:right;font-weight:bold;">${(total / 100).toFixed(2)}</td></tr>
     </table>`,
  );
  return sendEmail({ to, subject: "Order Confirmation - Academy LMS", html });
}
