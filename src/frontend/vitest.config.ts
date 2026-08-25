import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// First test tooling for the frontend (#308). jsdom gives component tests a DOM;
// the pure lib/ tests here don't need it but it's the sensible default. The `@/`
// alias mirrors tsconfig so imports match the app code.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    // The DevFest happens in Toulouse, so the tests run on Toulouse time (#105).
    //
    // Not cosmetic: a UTC runner has a zero offset, and every UTC/local bug is
    // invisible under it. The talk editor lost an hour on each save by reading
    // a UTC wall-clock into a local input — a fault that reproduces here and
    // cannot reproduce on a UTC CI. Pinning the zone is what makes those tests
    // mean something away from a developer's machine.
    env: { TZ: "Europe/Paris" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
