// Next's incremental cache (the ISR store) with one change: the 404 page of a
// slug nobody owns is not stored (#700).
//
// The public pages are cached after their first render (`x-nextjs-cache: HIT`),
// and `/fr/speakers/<anything>` is a page like another until the backend says it
// does not exist. Left alone, Next writes the html, rsc and meta of that 404 to
// `.next/server/route-cache` for every URL a crawler invents: ~150 KB each, no
// limit, on a disk the production site shares. A 404 is cheap to render again
// and worthless to keep, so it is answered but never stored; pages that exist
// are cached as before and purged by /api/revalidate as before.
//
// This extends Next's own FileSystemCache, imported from its dist folder: there
// is no public export for it. cache-handler.test.ts exercises it, so a Next
// upgrade that moves it fails the tests instead of the production start.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS, loaded by path by Next
const FileSystemCache = require("next/dist/server/lib/incremental-cache/file-system-cache").default;

module.exports = class SkippingCache404 extends FileSystemCache {
  async set(key, data, ctx) {
    if (data && data.kind === "APP_PAGE" && data.status === 404) return;
    return super.set(key, data, ctx);
  }
};
