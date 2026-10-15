import { describe, it, expect, vi, beforeEach } from "vitest";

// #618 — the route that opens a draft preview. Draft mode must only switch on
// once the backend served the draft to this caller, and the redirect must be
// built from the record, never from what the query asks.

const enable = vi.fn();
const disable = vi.fn();
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false, enable, disable }),
  cookies: async () => ({ toString: () => "better-auth.session_token=abc" }),
}));

const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { url });
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

// 2026 is the featured edition: its talks have one page, /conferences (#633).
vi.mock("@/lib/api", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/api")>()),
  getCurrentEdition: async () => ({ year: 2026 }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { GET } = await import("./route");
const { GET: EXIT } = await import("./exit/route");

function open(query: string) {
  return GET(new Request(`http://localhost:3000/api/preview?${query}`));
}

async function redirectedTo(call: Promise<unknown>): Promise<string> {
  const error = await call.then(() => null, (e: { url?: string }) => e);
  return error?.url ?? "";
}

beforeEach(() => {
  enable.mockReset();
  disable.mockReset();
  redirect.mockClear();
  fetchMock.mockReset();
});

describe("GET /api/preview (#618)", () => {
  it("should check the draft with the caller's cookie, then open the page in draft mode", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ slug: "ada" }), { status: 200 }));

    const url = await redirectedTo(open("type=talk&year=2019&slug=un%20talk&locale=en"));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/preview\/editions\/2019\/talks\/un%20talk$/),
      expect.objectContaining({ cache: "no-store", headers: { cookie: "better-auth.session_token=abc" } }),
    );
    expect(enable).toHaveBeenCalled();
    expect(url).toBe("/en/editions/2019/conferences/un%20talk");
  });

  it("should open a talk of the featured edition on its one page, /conferences (#633)", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ slug: "ia" }), { status: 200 }));

    const url = await redirectedTo(open("type=talk&year=2026&slug=ia"));

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/admin\/preview\/talks\/ia$/), expect.anything());
    expect(url).toBe("/fr/conferences/ia");
  });

  it("should leave draft mode off when the backend refuses the caller", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 403 }));

    const res = (await open("type=speaker&slug=ada")) as Response;

    expect(res.status).toBe(403);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(enable).not.toHaveBeenCalled();
  });

  it("should answer 404 without draft mode for a record that does not exist", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));

    const res = (await open("type=sponsor&slug=ghost")) as Response;

    expect(res.status).toBe(404);
    expect(enable).not.toHaveBeenCalled();
  });

  it("should refuse an unknown type or locale before calling the backend", async () => {
    const badType = (await open("type=article&slug=x")) as Response;
    const badLocale = (await open("type=speaker&slug=x&locale=de")) as Response;

    expect([badType.status, badLocale.status]).toEqual([400, 400]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/preview/exit (#618)", () => {
  it("should end draft mode and return to the same public page", async () => {
    const url = await redirectedTo(EXIT(new Request("http://localhost:3000/api/preview/exit?path=%2Fen%2Fsponsors%2Facme")));

    expect(disable).toHaveBeenCalled();
    expect(url).toBe("/en/sponsors/acme");
  });

  it("should not send anyone off-site", async () => {
    const protocolRelative = await redirectedTo(EXIT(new Request("http://localhost:3000/api/preview/exit?path=%2F%2Fevil.example")));
    const backslash = await redirectedTo(EXIT(new Request("http://localhost:3000/api/preview/exit?path=%2Ffr%2F%5Cevil.example")));
    const absolute = await redirectedTo(EXIT(new Request("http://localhost:3000/api/preview/exit?path=https%3A%2F%2Fevil.example")));

    expect([protocolRelative, backslash, absolute]).toEqual(["/", "/", "/"]);
  });
});
