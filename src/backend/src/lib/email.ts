import nodemailer from "nodemailer";

import { renderEmail } from "./email-template.js";

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
  // The message body. It is wrapped in the shared DevFest layout (#269) — pass
  // the content only, no <html>/<body>.
  html: string;
  // Optional Reply-To so replying to a notification reaches the person who
  // triggered it (e.g. the visitor who filled the contact form) instead of
  // the site's From address.
  replyTo?: string;
  // Optional CC recipients (e.g. the organizers, kept in copy of the brochure
  // confirmation sent to the requester).
  cc?: string[];
  // Recipient language, for the layout's footer. Defaults to French.
  locale?: "fr" | "en";
  // Snippet inboxes show next to the subject. Defaults to the subject.
  previewText?: string;
}

/**
 * Sends an email, wrapping `html` in the shared brand layout. Wrapping happens
 * here rather than at each call site so every email — including future ones —
 * is on-brand by construction, with no way to forget it.
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
  cc,
  locale = "fr",
  previewText,
}: SendEmailOptions) {
  await transporter.sendMail({
    from: FROM,
    to: to.join(", "),
    ...(cc?.length ? { cc: cc.join(", ") } : {}),
    ...(replyTo ? { replyTo } : {}),
    subject,
    text,
    html: renderEmail({ locale, previewText: previewText ?? subject, bodyHtml: html }),
  });
}

/**
 * Simple string template interpolation: replaces `{key}` tokens with
 * the corresponding value from `vars`. Unknown tokens are left as-is.
 * Use this for `text/plain` templates only — prefer `interpolateHtml`
 * when the output is rendered as HTML.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

/**
 * HTML-safe variant of `interpolate`: values are HTML-escaped before
 * substitution, so user-controlled input (firstName, lastName, email, etc.)
 * can't inject arbitrary markup into the rendered email.
 *
 * The template itself is NOT escaped — it may contain anchors, line breaks,
 * etc. This matches how the confirmation email bodies are authored.
 */
export function interpolateHtml(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined ? match : escapeHtml(value);
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
