// Email integration. Sends through SMTP when configured; otherwise records the message as
// LOGGED in the OutboundEmail table (nothing leaves the server). Bodies are stored with
// links redacted so reset tokens never sit in the database in plain form.
import { createTransport, type Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { recordOutboundEmail } from "../repositories/notifications.repo";

let transport: Transporter | null = null;

export async function sendEmail(message: { to: string; subject: string; text: string }): Promise<void> {
  const stored = message.text.replace(/https?:\/\/\S+/g, "[link redacted]");
  if (!env.emailEnabled) {
    await recordOutboundEmail({ toEmail: message.to, subject: message.subject, body: stored, status: "LOGGED" });
    return;
  }
  try {
    transport ??= createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail({ from: env.EMAIL_FROM, to: message.to, subject: message.subject, text: message.text });
    await recordOutboundEmail({ toEmail: message.to, subject: message.subject, body: stored, status: "SENT" });
  } catch (error) {
    logger.warn("email_send_failed", { subject: message.subject, name: (error as Error).name });
    await recordOutboundEmail({ toEmail: message.to, subject: message.subject, body: stored, status: "FAILED", error: (error as Error).message });
  }
}
