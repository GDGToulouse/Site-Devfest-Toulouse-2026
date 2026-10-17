import { describe, it, expect, vi } from "vitest";

// #617 — DNS rebinding: a name that passed a check can resolve elsewhere when
// the socket connects. fetchRemoteFile checks inside the socket's own lookup,
// so the address refused is the one it was about to use. The resolver is faked:
// no real record points a public name at a private range on demand.
const answers: Record<string, { address: string; family: number }[]> = {
  "rebind.example.org": [{ address: "10.0.0.7", family: 4 }],
  "mixed.example.org": [
    { address: "93.184.215.14", family: 4 },
    { address: "169.254.169.254", family: 4 },
  ],
  "v6.example.org": [{ address: "fd00::1", family: 6 }],
};

vi.mock("node:dns", async (importActual) => {
  const actual = await importActual<typeof import("node:dns")>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      lookup: async (hostname: string) => answers[hostname] ?? [],
    },
  };
});

const { fetchRemoteFile, postJson, RemoteFetchError } = await import("./safe-fetch.js");

async function codeOf(url: string): Promise<string> {
  const err = await fetchRemoteFile(url, { maxBytes: 1000, timeoutMs: 2000 }).then(() => null, (e: unknown) => e);
  return err instanceof RemoteFetchError ? err.code : String(err);
}

describe("fetchRemoteFile against DNS rebinding (#617)", () => {
  it("should refuse a public name that resolves to a private address at connect time", async () => {
    expect(await codeOf("https://rebind.example.org/logo.png")).toBe("private_ip");
  });

  it("should refuse a name with one private address among public ones", async () => {
    expect(await codeOf("https://mixed.example.org/logo.png")).toBe("private_ip");
  });

  it("should refuse a private IPv6 answer", async () => {
    expect(await codeOf("https://v6.example.org/logo.png")).toBe("private_ip");
  });
});

// Webhooks were checked by a lookup of their own, then posted by fetch, which
// resolved the name again: between the two, a record could turn private
// (#658). postJson checks inside the socket's lookup, like fetchRemoteFile.
describe("postJson against DNS rebinding", () => {
  it("should refuse a webhook whose name resolves to a private address at connect time", async () => {
    const err = await postJson("https://rebind.example.org/hook", { ok: true }).then(() => null, (e: unknown) => e);

    expect(err instanceof RemoteFetchError ? err.code : String(err)).toBe("private_ip");
  });
});
