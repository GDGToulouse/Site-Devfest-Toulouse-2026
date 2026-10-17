import { describe, it, expect, vi, beforeEach } from "vitest";

// The Sessionize URL is typed in the back-office. It is downloaded through
// fetchRemoteFile, which checks every redirect hop, pins the resolved address,
// caps the size and gives up after a delay; a plain fetch followed redirects
// unchecked and could hang forever.
vi.mock("./safe-fetch.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./safe-fetch.js")>();
  return { ...actual, fetchRemoteFile: vi.fn() };
});

const { fetchRemoteFile } = await import("./safe-fetch.js");
const { loadSessionizeData } = await import("./sessionize-import.js");
const { loadServiceSlots } = await import("./sessionize-service-slots.js");

const URL_ALL = "https://sessionize.com/api/v2/abcd1234/view/All";

function answer(body: string) {
  vi.mocked(fetchRemoteFile).mockResolvedValue({ buffer: Buffer.from(body), url: new URL(URL_ALL) });
}

beforeEach(() => vi.mocked(fetchRemoteFile).mockReset());

describe("Sessionize download", () => {
  it("should go through the guarded fetcher", async () => {
    answer(JSON.stringify({ sessions: [], speakers: [] }));

    await loadSessionizeData({ url: URL_ALL });

    expect(fetchRemoteFile).toHaveBeenCalledWith(URL_ALL, expect.objectContaining({ maxBytes: expect.any(Number) }));
  });

  it("should not quote a response that is not JSON", async () => {
    answer("internal-secret-OK");

    await expect(loadSessionizeData({ url: URL_ALL })).rejects.toThrow(/^(?!.*internal-secret).*$/s);
  });

  it("should fetch the GridSmart view through the guarded fetcher too", async () => {
    answer("[]");

    await loadServiceSlots(URL_ALL);

    expect(fetchRemoteFile).toHaveBeenCalledWith(expect.stringContaining("/view/GridSmart"), expect.anything());
  });
});
