import { prisma } from "./prisma.js";
import { notDeleted } from "./admin-helpers.js";
import { revalidateAll, revalidatePaths } from "./revalidate.js";

// The public FAQ (#111): what the page shows, and the purge after an edit.

export const FAQ_THEMES = ["VENUE", "TICKETS", "PROGRAMME", "PRACTICAL", "OTHER"] as const;
export type FaqThemeKey = (typeof FAQ_THEMES)[number];

/** Published questions, theme by theme in the page's order, then as ordered by the team. */
export async function publishedFaq() {
  const items = await prisma.faqItem.findMany({
    where: { ...notDeleted, publicationStatus: "PUBLISHED" },
    select: { id: true, theme: true, questionFr: true, questionEn: true, answerFr: true, answerEn: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return items.sort((a, b) => FAQ_THEMES.indexOf(a.theme) - FAQ_THEMES.indexOf(b.theme));
}

/**
 * After an edit: the FAQ page itself, or the whole site when the published
 * set may have gone from empty to not or back — the header of every page
 * offers the FAQ only once it has a published question.
 */
export function revalidateFaq(publicationMayHaveChanged: boolean): Promise<unknown> {
  if (publicationMayHaveChanged) return revalidateAll();
  return revalidatePaths(["/fr/faq", "/en/faq"]);
}
