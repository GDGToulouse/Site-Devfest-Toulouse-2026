import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, it, expect } from "vitest";

// #700 — the root layout read the request headers to pick <html lang>, and a
// single request-bound call anywhere above a page makes every route under it
// dynamic: the whole public site was re-rendered per visit (~16 pages/s on one
// core). `next build` does print static/dynamic markers, but it cannot say
// *why* a page turned dynamic, and the markers are wrong for some segments
// (a `force-dynamic` page is listed as SSG). These checks pin the causes
// instead; the end result (`x-nextjs-cache: HIT`) is checked against a
// production server, see the PR.
const APP = __dirname;
const LOCALE = join(APP, "[locale]");

function files(dir: string, name: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files(path, name, out);
    else if (name.test(entry.name) && !entry.name.includes(".test.")) out.push(path);
  }
  return out;
}

const read = (file: string) => readFileSync(file, "utf8");
const rel = (list: string[]) => list.map((file) => relative(APP, file)).sort();

describe("Public pages are statically rendered (#700)", () => {
  it("should have no root layout above the two sites, so the language never comes from a request", () => {
    expect(existsSync(join(APP, "layout.tsx"))).toBe(false);
    expect(existsSync(join(APP, "(app)", "layout.tsx"))).toBe(true);
  });

  it("should not read the request in either root layout", () => {
    for (const layout of [join(LOCALE, "layout.tsx"), join(APP, "(app)", "layout.tsx")]) {
      expect(read(layout), relative(APP, layout)).not.toMatch(/\b(headers|cookies|connection)\(\)/);
    }
  });

  it("should take the language of <html> from the URL segment", () => {
    expect(read(join(LOCALE, "layout.tsx"))).toMatch(/<html lang=\{locale\}/);
    expect(read(join(APP, "(app)", "layout.tsx"))).toMatch(/<html lang="fr"/);
  });

  it("should prerender no page at build time, when the backend cannot answer", () => {
    expect(read(join(LOCALE, "layout.tsx"))).toMatch(/generateStaticParams\(\) \{\s*return \[\];/);
  });

  it("should tell next-intl the locale in every page instead of letting it read the headers", () => {
    const pages = files(LOCALE, /^page\.tsx$/);
    const missing = pages.filter((page) => !read(page).includes("setRequestLocale(locale)"));
    const readingHeaders = pages.filter((page) => /\bgetLocale\(/.test(read(page)));

    expect(rel(missing)).toEqual([]);
    expect(rel(readingHeaders)).toEqual([]);
  });

  it("should only read the querystring on the server in pages that opt out of the cache", () => {
    const offenders = files(LOCALE, /^page\.tsx$/).filter((page) => {
      const source = read(page);
      return /\bsearchParams\b/.test(source) && !/export const dynamic = "force-dynamic"/.test(source);
    });

    expect(rel(offenders)).toEqual([]);
  });

  it("should not call request-bound functions in the public pages", () => {
    const offenders = files(LOCALE, /\.tsx?$/).filter((file) =>
      /\b(headers|cookies|connection)\(\)/.test(read(file)),
    );

    expect(rel(offenders)).toEqual([]);
  });
});
