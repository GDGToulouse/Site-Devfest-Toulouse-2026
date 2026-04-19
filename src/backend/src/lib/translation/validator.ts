import type { Format } from "./types.js";

// Counts every HTML tag occurrence (opening, closing, self-closing) so a
// translation that drops or adds a tag fails validation. We don't try to
// match opens/closes — the model has been known to convert <br> into <br/>
// or vice versa, which is fine; what matters is that the same tag *names*
// appear the same number of times.
function countTags(html: string): Map<string, number> {
  const counts = new Map<string, number>();
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = m[1].toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

// Placeholders we expect to be preserved across any format: {{var}}, {var},
// %s, %d, ${var}. Each pattern is matched globally and we compare counts.
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\{\{[^}]+\}\}/g,        // {{var}}
  /(?<!\{)\{[a-zA-Z_][\w]*\}(?!\})/g, // {var} but not {{ }}
  /%[sd]/g,                // %s, %d
  /\$\{[^}]+\}/g,          // ${var}
];

// Markdown link/image counts: [text](url) and ![alt](url). Code fences and
// inline code are checked too — the model frequently translates code by
// mistake.
function countMarkdownStructures(md: string): Map<string, number> {
  const counts = new Map<string, number>();
  const patterns: Record<string, RegExp> = {
    link: /(?<!!)\[[^\]]+\]\([^)]+\)/g,
    image: /!\[[^\]]*\]\([^)]+\)/g,
    fence: /```/g,
  };
  for (const [name, re] of Object.entries(patterns)) {
    counts.set(name, (md.match(re) ?? []).length);
  }
  return counts;
}

function diff(a: Map<string, number>, b: Map<string, number>): string[] {
  const all = new Set([...a.keys(), ...b.keys()]);
  const issues: string[] = [];
  for (const k of all) {
    const av = a.get(k) ?? 0;
    const bv = b.get(k) ?? 0;
    if (av !== bv) issues.push(`${k}: ${av} -> ${bv}`);
  }
  return issues;
}

export interface ValidationOutcome {
  ok: boolean;
  reason?: "tag_mismatch" | "placeholder_mismatch";
  issues?: string[];
}

export function validatePreservation(
  original: string,
  translated: string,
  format: Format,
): ValidationOutcome {
  // Tag parity (HTML only).
  if (format === "html") {
    const tagIssues = diff(countTags(original), countTags(translated));
    if (tagIssues.length > 0) {
      return { ok: false, reason: "tag_mismatch", issues: tagIssues };
    }
  }

  // Markdown structure parity.
  if (format === "markdown") {
    const mdIssues = diff(countMarkdownStructures(original), countMarkdownStructures(translated));
    if (mdIssues.length > 0) {
      return { ok: false, reason: "tag_mismatch", issues: mdIssues };
    }
  }

  // Placeholder parity (all formats).
  const phIssues: string[] = [];
  for (const re of PLACEHOLDER_PATTERNS) {
    const a = original.match(re) ?? [];
    const b = translated.match(re) ?? [];
    if (a.length !== b.length) {
      phIssues.push(`${re.source}: ${a.length} -> ${b.length}`);
    }
  }
  if (phIssues.length > 0) {
    return { ok: false, reason: "placeholder_mismatch", issues: phIssues };
  }

  return { ok: true };
}
