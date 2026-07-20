// Article completeness rules (#263).
//
// Saving and publishing have different bars: a draft is work in progress and
// must always be storable, while publishing is what guarantees a complete
// bilingual article on the public site.

export interface ArticleFields {
  slug?: string | null;
  titleFr?: string | null;
  titleEn?: string | null;
  contentFr?: string | null;
  contentEn?: string | null;
}

// Rich-text content arrives as HTML: an "empty" Tiptap editor still sends
// <p></p>, so strip tags (and non-breaking spaces) before judging emptiness.
function isBlank(value: string | null | undefined): boolean {
  if (!value) return true;
  return !value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

// The minimum to store anything at all — without these an article has no
// identity and could not be listed or reopened.
const DRAFT_REQUIRED = ["slug", "titleFr"] as const;

// Everything a published article needs to stand on its own in both languages.
// Excerpt and image stay optional: the excerpt falls back to the content, and
// not every article carries an illustration.
const PUBLISHED_REQUIRED = ["slug", "titleFr", "titleEn", "contentFr", "contentEn"] as const;

/**
 * Returns the names of the fields missing for the target status, in the order
 * listed above. Empty array means the article may be saved / published.
 *
 * Pass the *resulting* article state, not just the request body: a partial
 * update that flips the status to PUBLISHED must be judged on what the article
 * will look like once merged, otherwise the check is trivially bypassed.
 */
export function missingArticleFields(
  article: ArticleFields,
  status: "DRAFT" | "PUBLISHED",
): string[] {
  const required = status === "PUBLISHED" ? PUBLISHED_REQUIRED : DRAFT_REQUIRED;
  return required.filter((field) => isBlank(article[field]));
}
