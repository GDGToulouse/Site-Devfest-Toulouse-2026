import { describe, it, expect, beforeEach, vi } from "vitest";

// sendEditLinkEmail goes through SMTP; stub the transport, as the route tests do.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

import { normalizeLocale, sendEditLinkEmail, sendSponsorInvitationEmail } from "./edit-link-email.js";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

describe("normalizeLocale", () => {
  it("should keep English when explicitly set", () => {
    expect(normalizeLocale("en")).toBe("en");
  });

  it("should keep French when explicitly set", () => {
    expect(normalizeLocale("fr")).toBe("fr");
  });

  // Rows created before #224 carry no locale; they must keep receiving French.
  it("should fall back to French when the locale is missing", () => {
    expect(normalizeLocale(null)).toBe("fr");
    expect(normalizeLocale(undefined)).toBe("fr");
    expect(normalizeLocale("")).toBe("fr");
  });

  it("should fall back to French on an unsupported locale", () => {
    expect(normalizeLocale("de")).toBe("fr");
    expect(normalizeLocale("es")).toBe("fr");
  });

  // An "EN" from an import or a hand-written call must not silently send French
  // mail to an English speaker.
  it("should accept English regardless of case or padding", () => {
    expect(normalizeLocale("EN")).toBe("en");
    expect(normalizeLocale(" en ")).toBe("en");
  });
});

// The mail speakers get with their modification link. Sponsors used to receive
// a variant of it, with logo guidance (#340); they are invited to open an
// account instead since #362, so only the speaker wording is left.
describe("sendEditLinkEmail", () => {
  beforeEach(() => sendMailMock.mockClear());

  const sent = () => sendMailMock.mock.calls[0][0] as { text: string; html: string };

  it("should carry the edit link", async () => {
    await sendEditLinkEmail({ to: "a@b.fr", name: "Ada", token: "tok123" });

    const { text, html } = sent();
    expect(text).toContain("/edit/tok123");
    expect(html).toContain("/edit/tok123");
  });

  it("should address a speaker in French by default", async () => {
    await sendEditLinkEmail({ to: "a@b.fr", name: "Ada", token: "t" });

    const { text } = sent();
    expect(text).toContain("votre fiche speaker");
  });

  it("should write to an English speaker in English (#224)", async () => {
    await sendEditLinkEmail({ to: "a@b.com", name: "Ada", token: "t", locale: "en" });

    const { text } = sent();
    expect(text).toContain("your speaker profile");
  });

  it("should no longer carry the sponsor logo guidance", async () => {
    await sendEditLinkEmail({ to: "a@b.fr", name: "Ada", token: "t" });

    // Not a bare /logo/ check: every mail carries the DevFest branding logo in
    // its header, so that would match the template rather than the guidance.
    const { text, html } = sent();
    for (const body of [text, html]) {
      expect(body).not.toContain("1000 px");
      expect(body).not.toContain("Pour le logo");
      expect(body).not.toContain("About the logo");
    }
  });
});

// The invitation used to say only "you have been invited to manage X's
// profile", and the team had to chase sponsors to explain what the space was
// for (#505). It now has to do that itself, in both languages.
describe("sendSponsorInvitationEmail (#505)", () => {
  beforeEach(() => sendMailMock.mockClear());

  const sent = () =>
    sendMailMock.mock.calls[0][0] as { subject: string; text: string; html: string };
  const invite = (locale: string) =>
    sendSponsorInvitationEmail({ to: "jane@acme.example", sponsorName: "Acme", token: "inv123", locale });

  it("says in French what the space is for and how to come back", async () => {
    await invite("fr");

    const { subject, text, html } = sent();
    expect(subject).toBe("Acme sur le site du DevFest Toulouse — mettez à jour votre fiche");
    for (const body of [text, html]) {
      expect(body).toContain("/sponsor/invitation/inv123");
      expect(body).toContain(`${BASE_URL}/sponsor`);
      expect(body).toContain("offres d'emploi");
      expect(body).toContain("répondez simplement à cet e-mail");
      expect(body).toContain("7 jours");
      expect(body).toContain("jane@acme.example");
    }
  });

  it("says the same in English", async () => {
    await invite("en");

    const { subject, text, html } = sent();
    expect(subject).toBe("Acme on the DevFest Toulouse website — update your listing");
    for (const body of [text, html]) {
      expect(body).toContain(`${BASE_URL}/sponsor`);
      expect(body).toContain("job offers");
      expect(body).toContain("simply reply to this email");
      expect(body).toContain("7 days");
    }
  });

  it("shows a preview line that does not repeat the subject", async () => {
    await invite("fr");

    const { subject, html } = sent();
    const preview = html.match(/display:none[^>]*>([^<]*)</)?.[1];
    expect(preview).toBeTruthy();
    expect(preview).not.toBe(subject);
  });

  it("keeps the do-not-reply notice out, since it asks for replies", async () => {
    await invite("fr");

    expect(sent().html).not.toContain("ne pas y répondre");
  });

  it("escapes the company name in the HTML", async () => {
    await sendSponsorInvitationEmail({ to: "a@b.fr", sponsorName: "Acme <script>", token: "t" });

    expect(sent().html).not.toContain("<script>");
    expect(sent().html).toContain("Acme &lt;script&gt;");
  });
});
