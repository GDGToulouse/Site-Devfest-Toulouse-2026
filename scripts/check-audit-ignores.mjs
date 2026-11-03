#!/usr/bin/env node
// Audit exceptions guard (#695).
//
// `pnpm audit` skips the GHSA ids listed in each app's
// `package.json` → `pnpm.auditConfig.ignoreGhsas`. JSON has no comments, so the
// reason and the date of each decision live next to it, under
// `pnpm.auditConfig["//"]`:
//
//   "auditConfig": {
//     "//": { "GHSA-xxxx-xxxx-xxxx": "why it is unreachable (2026-10-28)" },
//     "ignoreGhsas": ["GHSA-xxxx-xxxx-xxxx"]
//   }
//
// This refuses an ignored id without a reason, so an exception cannot be added
// silently. Run in CI before the audit itself.
//
// Usage: node scripts/check-audit-ignores.mjs

import { readFileSync } from "node:fs";

const APPS = ["frontend", "backend"];

let failed = false;
for (const app of APPS) {
  const pkg = JSON.parse(readFileSync(`src/${app}/package.json`, "utf8"));
  const audit = pkg.pnpm?.auditConfig ?? {};
  const reasons = audit["//"] ?? {};
  const missing = (audit.ignoreGhsas ?? []).filter((id) => !reasons[id]);
  if (missing.length > 0) {
    console.error(`✗ ${app}: ignored without a reason in pnpm.auditConfig["//"]: ${missing.join(", ")}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("✓ Every ignored advisory has a reason.");
