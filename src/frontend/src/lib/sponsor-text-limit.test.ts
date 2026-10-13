import { describe, expect, it } from "vitest";

import { richTextUsage, SPONSOR_RICH_TEXT_MAX, validationErrorMessage } from "./sponsor-text-limit";

describe("richTextUsage (#610)", () => {
  it("counts the HTML markup, not the visible text", () => {
    // 4 600 visible characters, pasted as a bullet list: the markup tips it over.
    const html = `<ul>${"<li><p>Une ligne de quarante-six caractères au total.</p></li>".repeat(100)}</ul>`;

    expect(richTextUsage(html).state).toBe("over");
  });

  it("warns from 90 % of the allowance", () => {
    expect(richTextUsage("a".repeat(SPONSOR_RICH_TEXT_MAX * 0.9)).state).toBe("warning");
  });

  it("accepts a description exactly at the limit", () => {
    expect(richTextUsage("a".repeat(SPONSOR_RICH_TEXT_MAX))).toEqual({ percent: 100, state: "warning" });
  });

  it("is ok well under the limit", () => {
    expect(richTextUsage("<p>Bonjour</p>").state).toBe("ok");
  });
});

describe("validationErrorMessage (#610)", () => {
  it("names the English description when Fastify rejects its length", () => {
    const message = validationErrorMessage(
      "FST_ERR_VALIDATION",
      "body/descriptionEn must NOT have more than 5000 characters",
    );

    expect(message).toBe("La description en anglais est trop longue. Raccourcissez-la pour pouvoir l'enregistrer.");
  });

  it("names the French description", () => {
    expect(
      validationErrorMessage("FST_ERR_VALIDATION", "body/descriptionFr must NOT have more than 5000 characters"),
    ).toMatch(/^La description en français est trop longue/);
  });

  it("never tells the sponsor to simply retry on another schema error", () => {
    expect(validationErrorMessage("FST_ERR_VALIDATION", "body/title must NOT have more than 200 characters")).toBe(
      "Un des champs n'est pas accepté. Vérifiez votre saisie puis réessayez.",
    );
  });

  it("leaves non-validation errors to the caller", () => {
    expect(validationErrorMessage(undefined, undefined)).toBeNull();
  });
});
