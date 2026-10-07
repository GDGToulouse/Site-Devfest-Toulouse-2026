import { prisma } from "./prisma.js";
import { notDeleted } from "./admin-helpers.js";
import { sendEmail, escapeHtml } from "./email.js";
import { emailButton, emailHeading } from "./email-template.js";
import { generateEditToken } from "./edit-token.js";
import { normalizeLocale, type ContactLocale } from "./edit-link-email.js";
import { TALK_FEEDBACK_ITEMS } from "./talk-feedback.js";
import { resultsForTalks, type TalkResults } from "./talk-feedback-results.js";

// The audience feedback recap (#567): one email per speaker with the results
// of their sessions and the messages left to them. Sent when an admin decides,
// never on its own. Real votes only: the test mode's (#566) never go out, and
// neither does a message the team hid (#565).

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

interface RecapTalk {
  title: string;
  results: TalkResults;
}

interface Recipient {
  id: number;
  name: string;
  email: string | null;
  locale: ContactLocale;
  isLinkLocked: boolean;
  talks: RecapTalk[];
}

/** The speakers of an edition with at least one real vote on their sessions. */
export async function recapRecipients(editionId: number): Promise<Recipient[]> {
  const talks = await prisma.talk.findMany({
    where: { editionId, publicationStatus: "PUBLISHED", ...notDeleted },
    select: {
      id: true,
      title: true,
      speakers: {
        where: notDeleted,
        select: { id: true, name: true, contactEmail: true, locale: true, editLinkLocked: true },
      },
    },
    orderBy: { title: "asc" },
  });
  const results = await resultsForTalks(talks.map((t) => t.id), { realOnly: true });

  const bySpeaker = new Map<number, Recipient>();
  for (const talk of talks) {
    const result = results.get(talk.id)!;
    if (result.votes === 0) continue;
    for (const speaker of talk.speakers) {
      const recipient = bySpeaker.get(speaker.id) ?? {
        id: speaker.id,
        name: speaker.name,
        email: speaker.contactEmail?.trim() || null,
        locale: normalizeLocale(speaker.locale),
        isLinkLocked: speaker.editLinkLocked,
        talks: [],
      };
      recipient.talks.push({ title: talk.title, results: result });
      bySpeaker.set(speaker.id, recipient);
    }
  }
  return [...bySpeaker.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

const COPY = {
  fr: {
    subject: "DevFest Toulouse — les retours du public sur votre session",
    heading: "Les retours du public",
    hello: (name: string) => `Bonjour ${name},`,
    intro: "Merci encore pour votre session au DevFest Toulouse. Voici ce que le public en a pensé, points à améliorer compris.",
    votes: (n: number) => `${n} avis`,
    messages: "Les messages qu'on vous a laissés",
    noMessage: "Aucun message.",
    cta: "Voir le détail",
    ctaLead: "Le détail reste consultable depuis votre lien personnel :",
    signature: "L'équipe DevFest Toulouse",
  },
  en: {
    subject: "DevFest Toulouse — what the audience thought of your session",
    heading: "Audience feedback",
    hello: (name: string) => `Hello ${name},`,
    intro: "Thanks again for your session at DevFest Toulouse. Here is what the audience thought of it, areas to improve included.",
    votes: (n: number) => `${n} vote${n > 1 ? "s" : ""}`,
    messages: "Messages left for you",
    noMessage: "No message.",
    cta: "See the details",
    ctaLead: "The details remain available from your personal link:",
    signature: "The DevFest Toulouse team",
  },
};

/** The email of one speaker. `url` is null when their link is locked. */
export function buildRecapEmail(recipient: Recipient, url: string | null) {
  const c = COPY[recipient.locale];
  const label = (code: string) => TALK_FEEDBACK_ITEMS.find((i) => i.code === code)?.[recipient.locale] ?? code;
  const share = (count: number, votes: number) => `${count} (${Math.round((count / votes) * 100)} %)`;

  const textTalks = recipient.talks.map(({ title, results }) => {
    const items = results.items.map((i) => `  - ${label(i.code)} : ${share(i.count, results.votes)}`).join("\n");
    const messages = results.messages.filter((m) => !m.hidden);
    const quoted = messages.length ? messages.map((m) => `  « ${m.text} »`).join("\n") : `  ${c.noMessage}`;
    return `${title} — ${c.votes(results.votes)}\n${items}\n\n${c.messages} :\n${quoted}`;
  });

  const htmlTalks = recipient.talks.map(({ title, results }) => {
    const items = results.items
      .map((i) => `<li>${escapeHtml(label(i.code))} : <strong>${share(i.count, results.votes)}</strong></li>`)
      .join("");
    const messages = results.messages.filter((m) => !m.hidden);
    const quoted = messages.length
      ? messages.map((m) => `<blockquote style="margin:8px 0;padding:8px 12px;border-left:3px solid #ccc;">${escapeHtml(m.text).replace(/\n/g, "<br>")}</blockquote>`).join("")
      : `<p>${c.noMessage}</p>`;
    return `<h2 style="font-size:18px;margin:24px 0 4px;">${escapeHtml(title)}</h2>
      <p style="margin:0 0 8px;">${c.votes(results.votes)}</p>
      <ul>${items}</ul>
      <p><strong>${c.messages}</strong></p>${quoted}`;
  });

  return {
    subject: c.subject,
    text: [c.hello(recipient.name), c.intro, ...textTalks, url ? `${c.ctaLead}\n${url}` : "", c.signature]
      .filter(Boolean)
      .join("\n\n"),
    html: `
      ${emailHeading(c.heading)}
      <p>${escapeHtml(c.hello(recipient.name))}</p>
      <p>${c.intro}</p>
      ${htmlTalks.join("")}
      ${url ? `<p>${c.ctaLead}</p>${emailButton(url, c.cta)}` : ""}
      <p><em>${c.signature}</em></p>
    `,
  };
}

export interface RecapReport {
  sent: string[];
  withoutEmail: string[];
  failed: string[];
}

/**
 * Sends every speaker of the edition their recap. Each gets a fresh edit link:
 * the one they have may have expired (30 days), and the details live there.
 * Send first, persist the token second, as for the edit link (#223): a failed
 * send leaves the speaker's current link valid.
 */
export async function sendFeedbackRecaps(editionId: number): Promise<RecapReport> {
  const report: RecapReport = { sent: [], withoutEmail: [], failed: [] };
  for (const recipient of await recapRecipients(editionId)) {
    if (!recipient.email) {
      report.withoutEmail.push(recipient.name);
      continue;
    }
    // A locked link stays locked: the email carries the results, not a door
    // the team closed.
    const token = recipient.isLinkLocked ? null : generateEditToken();
    const email = buildRecapEmail(recipient, token ? `${baseUrl}/edit/${token}` : null);
    try {
      await sendEmail({ to: [recipient.email], subject: email.subject, text: email.text, html: email.html, locale: recipient.locale });
    } catch {
      report.failed.push(recipient.name);
      continue;
    }
    if (token) {
      await prisma.speaker.update({ where: { id: recipient.id }, data: { editToken: token, editTokenSentAt: new Date() } });
    }
    report.sent.push(recipient.name);
  }
  if (report.sent.length > 0) {
    await prisma.edition.update({ where: { id: editionId }, data: { feedbackRecapSentAt: new Date() } });
  }
  return report;
}
