import nodemailer from 'nodemailer';
import { config } from '../config';

export function isSmtpConfigured(): boolean {
  return Boolean(config.smtpHost.trim() && config.smtpFrom.trim());
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth:
      config.smtpUser && config.smtpPass
        ? { user: config.smtpUser, pass: config.smtpPass }
        : undefined,
  });

  await transporter.sendMail({
    from: config.smtpFrom,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html ?? options.text.replace(/\n/g, '<br/>'),
  });

  return true;
}
