/** One row using an upload, as `GET /api/admin/files` reports it (#483). */
export interface FileUsage {
  model: string;
  id: number | string;
  label: string;
  isTrashed: boolean;
}

const KINDS: Record<string, string> = {
  speaker: "Speaker",
  sponsor: "Sponsor",
  // The year's logo or a com-kit file (charter, print logo): the year says which.
  editionSponsor: "Sponsor",
  article: "Article",
  contentPage: "Page",
  siteSetting: "Réglages",
};

/** "Speaker · Marie Dupont", "Édition 2026" — what a file is used by (#483). */
export function describeUsage(usage: FileUsage): string {
  const base =
    usage.model === "edition" ? `Édition ${usage.label}` : `${KINDS[usage.model] ?? usage.model} · ${usage.label}`;
  return usage.isTrashed ? `${base} (corbeille)` : base;
}
