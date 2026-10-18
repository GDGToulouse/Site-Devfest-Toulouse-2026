// The sponsor space caps each rich description at TEXT_MAX characters
// (src/backend/src/routes/sponsor-space.ts). The server counts the HTML the
// editor produces, not the visible text: a pasted bullet list becomes
// <li><p>…</p></li> per item, and an offer of 4 594 visible characters went
// over without the sponsor being told why (#610).
export const SPONSOR_RICH_TEXT_MAX = 5_000;

// Past this share the gauge warns, so the sponsor trims before being refused.
const WARNING_RATIO = 0.9;

export type RichTextUsageState = "ok" | "warning" | "over";

export interface RichTextUsage {
  // Rounded share of the allowance, in percent. Shown instead of "x / 5000",
  // which would not match the text the sponsor sees.
  percent: number;
  state: RichTextUsageState;
}

export function richTextUsage(html: string, max = SPONSOR_RICH_TEXT_MAX): RichTextUsage {
  const ratio = html.length / max;
  return {
    percent: Math.round(ratio * 100),
    state: ratio > 1 ? "over" : ratio >= WARNING_RATIO ? "warning" : "ok",
  };
}

const FIELD_LABELS: Record<string, string> = {
  descriptionFr: "La description en français",
  descriptionEn: "La description en anglais",
};

export function tooLongMessage(field: "descriptionFr" | "descriptionEn"): string {
  return `${FIELD_LABELS[field]} est trop longue. Raccourcissez-la pour pouvoir l'enregistrer.`;
}

// Safety net for when the client check and the server disagree: Fastify
// rejects the body with FST_ERR_VALIDATION and names the field in `message`
// ("body/descriptionFr must NOT have more than 5000 characters"). Returns null
// when the error is not one we can explain, so the caller keeps its own text.
export function validationErrorMessage(code?: string, message?: string): string | null {
  if (code !== "FST_ERR_VALIDATION" || !message) return null;
  const field = /^body\/(\w+)/.exec(message)?.[1];
  if (field === "descriptionFr" || field === "descriptionEn") {
    return /more than \d+ characters/.test(message)
      ? tooLongMessage(field)
      : `${FIELD_LABELS[field]} n'est pas acceptée. Vérifiez-la puis réessayez.`;
  }
  return "Un des champs n'est pas accepté. Vérifiez votre saisie puis réessayez.";
}
