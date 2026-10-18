import { describe, it, expect } from "vitest";
import sharp from "sharp";

import "./image-store.js";

// Loading the media library blocks the decoders no upload needs (#658).
describe("image decoders", () => {
  it("should refuse a TIFF once the media library is loaded", async () => {
    const tiff = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).tiff().toBuffer();

    await expect(sharp(tiff).metadata()).rejects.toThrow();
  });

  it("should still read a PNG", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).png().toBuffer();

    expect((await sharp(png).metadata()).format).toBe("png");
  });
});
