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
