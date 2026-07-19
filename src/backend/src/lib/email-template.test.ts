import { describe, it, expect, afterEach } from "vitest";
import { renderEmail, emailButton, emailHeading } from "./email-template.js";

// The shared email layout (#269): brand wrapper, bilingual footer, and the
// email-client constraints that make it table-based with inline styles.

const originalBase = process.env.BASE_URL;
const originalLogo = process.env.EMAIL_LOGO_URL;

afterEach(() => {
  process.env.BASE_URL = originalBase;
  if (originalLogo === undefined) delete process.env.EMAIL_LOGO_URL;
  else process.env.EMAIL_LOGO_URL = originalLogo;
});

describe("renderEmail", () => {
  it("wraps the body in a full HTML document with the brand colours", () => {
    const html = renderEmail({ bodyHtml: "<p>Bonjour</p>" });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<p>Bonjour</p>");
    // Brand green header + off-white page background.
    expect(html).toContain("#0B7350");
    expect(html).toContain("#FDF0EB");
  });

  it("uses inline styles only — no <style> block that Gmail would drop", () => {
    const html = renderEmail({ bodyHtml: "<p>x</p>" });
    expect(html).not.toContain("<style");
  });

  it("localizes the footer", () => {
    expect(renderEmail({ bodyHtml: "", locale: "fr" })).toContain("merci de ne pas y répondre");
    expect(renderEmail({ bodyHtml: "", locale: "en" })).toContain("please do not reply");
  });

  it("defaults to French when no locale is given", () => {
    expect(renderEmail({ bodyHtml: "" })).toContain("La conférence Toulousaine");
  });

  it("derives the logo from BASE_URL and lets EMAIL_LOGO_URL override it", () => {
    process.env.BASE_URL = "https://devfesttoulouse.fr";
    delete process.env.EMAIL_LOGO_URL;
    expect(renderEmail({ bodyHtml: "" })).toContain(
      "https://devfesttoulouse.fr/images/logo-devfest-96.png",
    );

    process.env.EMAIL_LOGO_URL = "https://cdn.example.org/logo.png";
    expect(renderEmail({ bodyHtml: "" })).toContain("https://cdn.example.org/logo.png");
  });

  it("hides the preview text from the rendered body", () => {
    const html = renderEmail({ bodyHtml: "<p>x</p>", previewText: "Votre lien" });
    expect(html).toContain("Votre lien");
    expect(html).toContain("display:none");
  });

  it("omits the preview block entirely when no preview text is given", () => {
    expect(renderEmail({ bodyHtml: "<p>x</p>" })).not.toContain("display:none");
  });
});

describe("emailButton", () => {
  it("renders an anchor inside a table so Outlook keeps the background", () => {
    const html = emailButton("https://example.org/edit", "Modifier ma fiche");
    expect(html).toContain('href="https://example.org/edit"');
    expect(html).toContain("Modifier ma fiche");
    expect(html).toContain("<table");
  });
});

describe("emailHeading", () => {
  it("renders an h1 in the brand green", () => {
    expect(emailHeading("Titre")).toContain("#0B7350");
    expect(emailHeading("Titre")).toContain("Titre");
  });
});
