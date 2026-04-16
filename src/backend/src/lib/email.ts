import nodemailer from "nodemailer";

// SMTP_SECURE = true forces a TLS handshake on connect (port 465 typical).
// SMTP_AUTH = true enables plain SMTP auth via SMTP_USER / SMTP_PASSWORD.
// Default profile (secure=false, auth=false) matches the standalone
// Postfix relay we deploy through Coolify, which accepts any sender on
// the internal network without authentication.
const useSecure = process.env.SMTP_SECURE === "true";
const useAuth = process.env.SMTP_AUTH === "true";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: Number(process.env.SMTP_PORT) || 1025,
  secure: useSecure,
  ...(useAuth && {
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASSWORD || "",
    },
  }),
});

const FROM = process.env.SMTP_FROM || "contact@devfesttoulouse.fr";

interface SendEmailOptions {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  await transporter.sendMail({
    from: FROM,
    to: to.join(", "),
    subject,
    text,
    html,
  });
}

/**
 * Simple string template interpolation: replaces `{key}` tokens with
 * the corresponding value from `vars`. Unknown tokens are left as-is.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}
