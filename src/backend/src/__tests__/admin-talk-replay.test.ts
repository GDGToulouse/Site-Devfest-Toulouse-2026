process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// Paths are asserted, not sent: the real builders stay, only the call is stubbed.
vi.mock("../lib/revalidate.js", async (importActual) => ({
  ...(await importActual<typeof import("../lib/revalidate.js")>()),
  revalidatePaths: vi.fn(),
}));

const { default: adminTalkRoutes } = await import("../routes/admin/talks.js");
const { revalidatePaths } = await import("../lib/revalidate.js");
const { canonicalYouTubeUrl } = await import("../lib/youtube.js");
const { prisma } = await import("../lib/prisma.js");

// #636 — no admin screen could set a talk's replay: only the history import
// filled videoUrl, so the 2026 replays had no way onto the site. The field takes
// a YouTube video only, the one thing the player, its thumbnail and the
// VideoObject can use.
const TEST_YEAR = 1550;

let app: FastifyInstance;
let editionId: number;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminTalkRoutes, { prefix: "/api/admin" });
  await app.ready();
  editionId = (await prisma.edition.create({ data: { year: TEST_YEAR } })).id;
});

afterAll(async () => {
  await app.close();
  if (editionId !== undefined) await prisma.talk.deleteMany({ where: { editionId } });
  await prisma.edition.delete({ where: { id: editionId } });
});

function createTalk(videoUrl?: unknown) {
  return app.inject({
    method: "POST",
    url: "/api/admin/talks",
    payload: { editionId, title: `Replay ${Math.random()}`, format: "CONFERENCE", language: "fr", videoUrl },
  });
}

describe("Talk replay URL (#636)", () => {
  it("should store a YouTube replay in its canonical form, and clear it", async () => {
    const created = await createTalk("https://youtu.be/dQw4w9WgXcQ?t=42");
    const id = created.json().id;

    const cleared = await app.inject({ method: "PUT", url: `/api/admin/talks/${id}`, payload: { videoUrl: "" } });

    expect(created.statusCode).toBe(201);
    expect(created.json().videoUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(cleared.json().videoUrl).toBeNull();
  });

  it("should refuse a video that is not on YouTube, naming the field", async () => {
    const res = await createTalk("https://vimeo.com/123456789");

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_video_url", field: "videoUrl" });
  });

  it("should purge the replays page when a replay is set", async () => {
    const id = (await createTalk()).json().id;
    vi.mocked(revalidatePaths).mockClear();

    await app.inject({ method: "PUT", url: `/api/admin/talks/${id}`, payload: { videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } });

    expect(vi.mocked(revalidatePaths).mock.calls.flatMap(([paths]) => paths ?? [])).toContain("/fr/replays");
  });
});

describe("canonicalYouTubeUrl (#636)", () => {
  it("should read the usual YouTube addresses", () => {
    expect(canonicalYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(canonicalYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(canonicalYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("should not be fooled by a YouTube address inside another URL", () => {
    // eslint-disable-next-line no-script-url
    expect(canonicalYouTubeUrl("javascript:alert('youtube.com/watch?v=dQw4w9WgXcQ')")).toBeNull();
    expect(canonicalYouTubeUrl("https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(canonicalYouTubeUrl("https://www.youtube.com/channel/UC123")).toBeNull();
  });
});
