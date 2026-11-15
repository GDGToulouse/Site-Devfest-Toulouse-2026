import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { ZXING_WASM_URL } from "./barcode-reader";

const digest = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

// #642 — the barcode reader's .wasm is copied into public/ so it is served
// from our origin. A package upgrade without a fresh copy pairs new JS glue
// with an old binary, and iOS phones stop reading tickets: only a real phone
// would show it.
describe("the barcode reader served to iOS phones", () => {
  it("should serve the .wasm of the installed zxing-wasm", () => {
    const served = path.join(process.cwd(), "public", ZXING_WASM_URL);
    const installed = path.join(process.cwd(), "node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm");

    expect(digest(served)).toBe(digest(installed));
  });
});
