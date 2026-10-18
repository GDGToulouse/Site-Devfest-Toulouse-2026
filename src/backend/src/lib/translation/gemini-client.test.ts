import { afterEach, describe, it, expect, vi } from "vitest";

import { callGemini } from "./gemini-client.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// A key in the query string lands in every log that records URLs (a proxy,
// an error trace); Gemini takes it as a header (#658).
describe("callGemini", () => {
  it("should send the API key as a header, never in the URL", async () => {
    vi.stubEnv("GEMINI_API_KEY", "secret-key-658");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await callGemini({ model: "gemini-test", systemInstruction: "s", userContent: "u", maxOutputTokens: 10 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("secret-key-658");
    expect(init.headers["x-goog-api-key"]).toBe("secret-key-658");
  });
});
