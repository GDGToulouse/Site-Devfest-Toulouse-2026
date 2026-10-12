import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

// #490 — `prose` comes from the Tailwind typography plugin, which this site
// does not install: the class generates nothing, and admin-authored h2/h3
// rendered as body text. Rich HTML is styled by `.article-content` (globals.css),
// the editor's own typography (#559 hit the same trap on the venue page).
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) out.push(path);
  }
  return out;
}

function classTokens(source: string): string[] {
  const values = [...source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)];
  return values.flatMap(([, quoted, templated]) => (quoted ?? templated).split(/\s+/));
}

describe("Rich content typography (#490)", () => {
  it("should not rely on the typography plugin's prose classes", () => {
    const root = join(__dirname, "..");
    const offenders = sourceFiles(root).filter((file) =>
      classTokens(readFileSync(file, "utf8")).some((token) => /^prose(-|$)/.test(token)),
    );

    expect(offenders).toEqual([]);
  });
});
