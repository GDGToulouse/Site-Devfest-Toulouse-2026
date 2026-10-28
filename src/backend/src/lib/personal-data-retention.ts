import { prisma } from "./prisma.js";

// How long the site keeps what a visitor wrote to the team (#666): a year
// covers the edition the message was about and the follow-up of the next one.
// Past it, the row stays for the statistics (category, date, votes) and loses
// what names or quotes a person. The legal notice states the same duration.
export const PERSONAL_DATA_RETENTION_MONTHS = 12;

// What an anonymised contact message keeps in the fields the form required.
// An empty e-mail also marks the row as done: the form never accepts one.
const ANONYMIZED_CONTACT = {
  firstName: "Anonymisé",
  lastName: "",
  email: "",
  phone: null,
  company: "",
  jobTitle: "",
  message: "",
  webhookError: null,
};

export function personalDataCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - PERSONAL_DATA_RETENTION_MONTHS);
  return cutoff;
}

export interface AnonymizationReport {
  cutoff: string;
  contactMessages: number;
  feedbackMessages: number;
}

/**
 * Anonymise contact messages and feedback messages past the retention window.
 * Idempotent: a row already done no longer matches, so a second run is a no-op.
 *
 * The contact messages go through the audited client: their history lines name
 * the fields and mask the values (`PERSONAL_FIELDS` in audit.ts), so erasing
 * them does not copy them once more. Feedback is not audited at all.
 */
export async function anonymizeExpiredPersonalData(now = new Date()): Promise<AnonymizationReport> {
  const cutoff = personalDataCutoff(now);

  const contacts = await prisma.contactMessage.updateMany({
    // Trashed messages too: the trash purge may be weeks behind.
    where: { createdAt: { lt: cutoff }, email: { not: "" } },
    data: ANONYMIZED_CONTACT,
  });

  const feedback = await prisma.talkFeedback.updateMany({
    where: {
      message: { not: null },
      // The message may come after the vote: its own date counts when there is one.
      OR: [{ messageAt: { lt: cutoff } }, { messageAt: null, createdAt: { lt: cutoff } }],
    },
    data: { message: null },
  });

  return { cutoff: cutoff.toISOString(), contactMessages: contacts.count, feedbackMessages: feedback.count };
}
