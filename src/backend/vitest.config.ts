import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run the TypeScript source tests — the compiled `dist/` output
    // is a stale artefact of an earlier build and re-running those
    // generated .js copies produces duplicate, outdated results.
    include: ["src/**/*.{test,spec}.ts", "scripts/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist"],
  },
});
