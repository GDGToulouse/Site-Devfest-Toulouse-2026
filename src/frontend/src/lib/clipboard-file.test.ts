import { describe, it, expect } from "vitest";

import { pastedFile } from "./clipboard-file";

// #372 — pasting into a media picker hands the clipboard's file to the same
// path as a drop. Text pastes must pass through untouched, and a file of the
// wrong kind is refused at paste time rather than at upload.

const IMAGES = { mimeTypes: ["image/png", "image/jpeg", "image/svg+xml"], extensions: [".svg"] };

function clipboard(...files: File[]) {
  return { files } as unknown as DataTransfer;
}

describe("pastedFile (#372)", () => {
  it("should hand back a pasted screenshot", () => {
    const shot = new File(["x"], "image.png", { type: "image/png" });

    expect(pastedFile(clipboard(shot), IMAGES)).toEqual({ kind: "file", file: shot });
  });

  it("should accept a file by its extension when the browser gives no type", () => {
    const logo = new File(["<svg/>"], "logo.SVG", { type: "" });

    expect(pastedFile(clipboard(logo), IMAGES)).toEqual({ kind: "file", file: logo });
  });

  it("should refuse a file the picker does not accept", () => {
    const pdf = new File(["%PDF"], "brochure.pdf", { type: "application/pdf" });

    expect(pastedFile(clipboard(pdf), IMAGES)).toEqual({ kind: "refused" });
  });

  it("should leave a text paste alone", () => {
    expect(pastedFile(clipboard(), IMAGES)).toBeNull();
  });
});
