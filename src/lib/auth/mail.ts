import "server-only";
import nodemailer from "nodemailer";
import { smtpConfigured } from "../config";

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[peace-mode] Email delivery is not configured. ${subject} for ${to}: ${text}`);
    } else {
      console.info("[peace-mode] Email delivery is not configured. Message was not sent.");
    }
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
  });
  return true;
}
