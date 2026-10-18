import { describe, it, expect } from "vitest";

// #700 — a public page is cached after its first render, and that includes the
// 404 of a slug nobody owns: `/fr/speakers/<anything>` left ~150 KB of
// html/rsc/meta on disk per invented URL, with no limit (349 MB after 2,300
// requests in a local run). The cache handler (cache-handler.js) refuses to
// store a 404 page; an existing page is still stored.
// Next types its handler context and kinds as internal enums; the test speaks
// the plain values the server passes.
type Cache = {
  set(key: string, data: unknown, ctx: object): Promise<void>;
  get(key: string, ctx: object): Promise<unknown>;
};
const { default: SkippingCache404 } = (await import("../cache-handler.js")) as unknown as {
  default: new (ctx: object) => Cache;
};

const ctx = {
  fs: {},
  serverDistDir: "/tmp/does-not-exist",
  flushToDisk: false,
  maxMemoryCacheSize: 1024 * 1024,
  revalidatedTags: [],
};
const page = (status: number) => ({
  kind: "APP_PAGE",
  html: "<html></html>",
  rscData: undefined,
  headers: undefined,
  postponed: undefined,
  status,
});
const read = (cache: Cache, key: string) =>
  cache.get(key, { kind: "APP_PAGE" });

describe("Cache handler (#700)", () => {
  const cache = new SkippingCache404(ctx);

  it("should keep the rendered page of a slug that exists", async () => {
    await cache.set("/render-200", page(200), {});

    expect(await read(cache, "/render-200")).not.toBeNull();
  });

  it("should not keep the 404 page of an invented slug", async () => {
    await cache.set("/render-404", page(404), {});

    expect(await read(cache, "/render-404")).toBeNull();
  });
});
