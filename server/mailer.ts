import nodemailer, { type Transporter } from "nodemailer";
import { log } from "./vite";

export const APP_URL = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
const MAIL_FROM = process.env.MAIL_FROM ?? "CrochetNook <no-reply@localhost>";

let transporter: Transporter | null = null;

if (process.env.SMTP_HOST) {
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
} else {
  log(process.env.NODE_ENV === "production"
    ? "SMTP_HOST not set: outbound emails will fail until email is configured."
    : "SMTP_HOST not set: development emails will be printed to the server console.");
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (!transporter) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP_HOST must be configured before CrochetNook can send email.");
    }
    // Development fallback until email is configured
    console.log(`\n--- EMAIL (not sent, SMTP not configured) ---\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n---------------------------------------------\n`);
    return;
  }
  await transporter.sendMail({ from: MAIL_FROM, ...mail });
}

export const passwordResetEmail = (to: string, link: string): Mail => ({
  to,
  subject: "Reset your CrochetNook password",
  text: `We received a request to reset your password.\n\nUse this link within 1 hour:\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
});

export const inviteEmail = (to: string, link: string, invitedBy: string): Mail => ({
  to,
  subject: "You're invited to CrochetNook",
  text: `${invitedBy} invited you to CrochetNook.\n\nSet your password to activate your account (link valid for 7 days):\n${link}`,
});

export const otpEmail = (to: string, code: string, reason: string): Mail => ({
  to,
  subject: `Your CrochetNook code: ${code}`,
  text: `Your one-time code to ${reason} is ${code}.\n\nIt expires in 10 minutes. If you didn't request it, change your password.`,
});
