import { describe, it, expect, vi, beforeEach } from "vitest";

import { isLocalUpload, resolveSpeakerPhoto } from "./speaker-photo.js";
import { fetchAndStoreImage } from "./image-store.js";

// Both importers rely on this behaviour: Sessionize (#205) and the 2016-2025
// history (#356). The download lives in its own module, so stubbing it here
// leaves the functions under test intact.
vi.mock("./image-store.js", () => ({ fetchAndStoreImage: vi.fn() }));

describe("isLocalUpload", () => {
  it("recognizes locally stored images only", () => {
    expect(isLocalUpload("/uploads/123-abc.jpg")).toBe(true);
    expect(isLocalUpload("https://sessionize.com/image/abc.jpg")).toBe(false);
    expect(isLocalUpload("https://pbs.twimg.com/profile_images/1.jpeg")).toBe(false);
    expect(isLocalUpload(null)).toBe(false);
    expect(isLocalUpload(undefined)).toBe(false);
  });
});

describe("resolveSpeakerPhoto", () => {
  beforeEach(() => {
    vi.mocked(fetchAndStoreImage).mockReset();
  });

  it("downloads a remote picture and returns its local URL", async () => {
    vi.mocked(fetchAndStoreImage).mockResolvedValue("/uploads/1-a.jpg");
    const warnings: string[] = [];

    const url = await resolveSpeakerPhoto("https://sessionize.com/image/a.jpg", null, "Jane", warnings);

    expect(url).toBe("/uploads/1-a.jpg");
    expect(fetchAndStoreImage).toHaveBeenCalledWith("https://sessionize.com/image/a.jpg");
    expect(warnings).toEqual([]);
  });

  it("pulls in a picture hosted on a third party, as the history file has (#356)", async () => {
    vi.mocked(fetchAndStoreImage).mockResolvedValue("/uploads/9-twitter.jpg");
    const warnings: string[] = [];

    // The exact shape found in devfest-history.json for the 2016-2019 editions.
    const url = await resolveSpeakerPhoto(
      "https://pbs.twimg.com/profile_images/378800000410578599/f46ba12e.jpeg",
      null,
      "Ada Lovelace",
      warnings,
    );

    expect(url).toBe("/uploads/9-twitter.jpg");
    expect(url?.startsWith("/uploads/")).toBe(true);
    expect(warnings).toEqual([]);
  });

  it("keeps an existing local photo without re-downloading (idempotence)", async () => {
    const warnings: string[] = [];

    const url = await resolveSpeakerPhoto(
      "https://sessionize.com/image/a.jpg",
      "/uploads/existing.jpg",
      "Jane",
      warnings,
    );

    expect(url).toBe("/uploads/existing.jpg");
    expect(fetchAndStoreImage).not.toHaveBeenCalled();
  });

  it("re-downloads when the stored photo is still a remote URL", async () => {
    vi.mocked(fetchAndStoreImage).mockResolvedValue("/uploads/2-b.jpg");
    const warnings: string[] = [];

    const url = await resolveSpeakerPhoto(
      "https://sessionize.com/image/b.jpg",
      "https://sessionize.com/image/b.jpg",
      "Jane",
      warnings,
    );

    expect(url).toBe("/uploads/2-b.jpg");
    expect(fetchAndStoreImage).toHaveBeenCalled();
  });

  it("returns null without calling the network when there is no picture", async () => {
    const warnings: string[] = [];

    expect(await resolveSpeakerPhoto(null, null, "Jane", warnings)).toBeNull();
    expect(await resolveSpeakerPhoto("   ", null, "Jane", warnings)).toBeNull();
    expect(fetchAndStoreImage).not.toHaveBeenCalled();
    expect(warnings).toEqual([]);
  });

  it("warns and keeps importing when the download fails", async () => {
    vi.mocked(fetchAndStoreImage).mockRejectedValue(new Error("HTTP 404"));
    const warnings: string[] = [];

    const url = await resolveSpeakerPhoto("https://www.ekito.fr/people/gone.png", null, "Jane", warnings);

    // A dead URL is the normal case for a 2016 photo, not an exception: the
    // speaker is imported anyway and falls back to their initials.
    expect(url).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Jane");
    expect(warnings[0]).toContain("HTTP 404");
  });
});
