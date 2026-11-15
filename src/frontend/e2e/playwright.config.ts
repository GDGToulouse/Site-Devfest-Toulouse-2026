import { defineConfig, devices } from "@playwright/test";

// The event-day screens in a phone-sized Chrome (#777). Run from src/frontend with
// `pnpm e2e`; aidd_docs/memory/testing.md § End-to-end tests says what has to be
// up first. Chrome only: Pixel and iPhone are Playwright's device descriptors
// (screen, touch, user agent) played by Chromium. Safari and the real camera
// are checked by hand on a phone.

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// The Chrome installed on the machine; E2E_CHANNEL=chromium takes Playwright's
// own build (`pnpm exec playwright install chromium` first).
const channel = process.env.E2E_CHANNEL === "chromium" ? undefined : (process.env.E2E_CHANNEL ?? "chrome");

const phone = (name: "Pixel 7" | "iPhone 14") => ({
  ...devices[name],
  defaultBrowserType: "chromium" as const,
  channel,
});

export default defineConfig({
  testDir: "./arrivals",
  outputDir: "./.run/results",
  globalSetup: "./arrivals/global-setup.ts",
  // One worker, no parallelism: the tests share one fixture edition and one
  // backend, and the outage test stops it.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    // The whole journey on an Android phone, but for the outage.
    { name: "pixel", use: phone("Pixel 7"), grepInvert: /@outage|@layout/ },
    // The layout on both phones.
    { name: "pixel-layout", use: phone("Pixel 7"), grep: /@layout/ },
    { name: "iphone-layout", use: phone("iPhone 14"), grep: /@layout/ },
    // Stops the backend and starts it again: slower than the rest, so apart.
    { name: "outage", use: phone("Pixel 7"), grep: /@outage/ },
  ],
});
