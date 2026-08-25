import { describe, it, expect, vi, beforeEach } from "vitest";

// #432 — the manifest declared the bundled 96×96 logo as 192×192 and again as
// 512×512. Chrome refuses an icon whose file does not match its declared size,
// so both entries were rejected and every page logged the refusal. What matters
// is not how many icons there are but that each one tells the truth about its
// file.

vi.mock("@/lib/api", () => ({ getIdentitySettings: vi.fn() }));

import { getIdentitySettings } from "@/lib/api";
import manifest from "./manifest";

beforeEach(() => {
  vi.mocked(getIdentitySettings).mockResolvedValue({});
});

describe("the manifest icons", () => {
  it("announces the bundled logo at the size it actually is", async () => {
    const { icons } = await manifest();

    // The failing case is the default one: nothing configured in the admin.
    expect(icons).toEqual([
      { src: "/images/logo-devfest-96.png", sizes: "96x96", type: "image/png", purpose: "any" },
    ]);
  });

  it("uses the configured favicons, each at its own size", async () => {
    vi.mocked(getIdentitySettings).mockResolvedValue({
      identity_favicon_png_192: "/uploads/icon-192.png",
      identity_favicon_png_512: "/uploads/icon-512.png",
    });

    const { icons } = await manifest();

    expect(icons?.map((i) => [i.src, i.sizes])).toEqual([
      ["/uploads/icon-192.png", "192x192"],
      ["/uploads/icon-512.png", "512x512"],
    ]);
  });

  it("does not pass the 192 off as a 512 when only one is configured", async () => {
    vi.mocked(getIdentitySettings).mockResolvedValue({
      identity_favicon_png_192: "/uploads/icon-192.png",
    });

    const { icons } = await manifest();

    // Reusing the smaller file under the larger size is the same lie that made
    // the bundled logo unusable — one honest entry beats two refused ones.
    expect(icons).toHaveLength(1);
    expect(icons?.[0].sizes).toBe("192x192");
  });

  it("never falls back once the admin has configured an icon", async () => {
    vi.mocked(getIdentitySettings).mockResolvedValue({
      identity_favicon_png_512: "/uploads/icon-512.png",
    });

    const { icons } = await manifest();

    expect(icons?.map((i) => i.src)).toEqual(["/uploads/icon-512.png"]);
  });
});
