import { describe, it, expect, beforeEach, vi } from "vitest";

// sendEditLinkEmail goes through SMTP; stub the transport, as the route tests do.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

import { normalizeLocale, sendEditLinkEmail } from "./edit-link-email.js";

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

// #340 — sponsors are told what a usable logo looks like, in the mail that asks
// them for it. Speakers upload a photo, so the guidance must not reach them.
describe("sendEditLinkEmail — logo guidance", () => {
  beforeEach(() => sendMailMock.mockClear());

  const sent = () => sendMailMock.mock.calls[0][0] as { text: string; html: string };

  it("should tell a French sponsor what the logo must look like", async () => {
    await sendEditLinkEmail({ to: "a@b.fr", name: "Acme", token: "t", kind: "sponsor" });

    const { text, html } = sent();
    for (const body of [text, html]) {
      expect(body).toContain("haute définition");
      expect(body).toContain("1000 px");
      expect(body).toContain("sans marge");
      expect(body).toContain("transparent");
    }
  });

  it("should say the same to an English sponsor", async () => {
    await sendEditLinkEmail({
      to: "a@b.com",
      name: "Acme",
      token: "t",
      kind: "sponsor",
      locale: "en",
    });

    const { text, html } = sent();
    for (const body of [text, html]) {
      expect(body).toContain("high resolution");
      expect(body).toContain("1000 px");
      expect(body).toContain("no built-in margin");
      expect(body).toContain("transparent");
    }
  });

  it("should not mention the logo to a speaker", async () => {
    await sendEditLinkEmail({ to: "a@b.fr", name: "Ada", token: "t", kind: "speaker" });

    // Not a bare /logo/ check: every mail carries the DevFest branding logo in
    // its header, so that would match the template rather than the guidance.
    const { text, html } = sent();
    for (const body of [text, html]) {
      expect(body).not.toContain("1000 px");
      expect(body).not.toContain("Pour le logo");
      expect(body).not.toContain("About the logo");
    }
  });

  it("should not mention the logo to an English speaker either", async () => {
    await sendEditLinkEmail({
      to: "a@b.com",
      name: "Ada",
      token: "t",
      kind: "speaker",
      locale: "en",
    });

    // Not a bare /logo/ check: every mail carries the DevFest branding logo in
    // its header, so that would match the template rather than the guidance.
    const { text, html } = sent();
    for (const body of [text, html]) {
      expect(body).not.toContain("1000 px");
      expect(body).not.toContain("Pour le logo");
      expect(body).not.toContain("About the logo");
    }
  });

  // The guidance is informative: it must not disturb what the mail is for.
  it("should keep the edit link intact", async () => {
    await sendEditLinkEmail({ to: "a@b.fr", name: "Acme", token: "tok123", kind: "sponsor" });

    const { text, html } = sent();
    expect(text).toContain("/edit/tok123");
    expect(html).toContain("/edit/tok123");
  });
});
