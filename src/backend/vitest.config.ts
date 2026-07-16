import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run the TypeScript source tests — the compiled `dist/` output
    // is a stale artefact of an earlier build and re-running those
    // generated .js copies produces duplicate, outdated results.
    include: ["src/**/*.{test,spec}.ts", "scripts/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist"],
    // The integration tests boot a real Fastify app and hit Postgres. The
    // first few pay the one-off tsx transform + cold connection cost, which
    // blows past Vitest's 5s default on a shared CI runner. 30s is a safety
    // margin for that startup latency, not for any single slow assertion.
    testTimeout: 30000,
  },
});
