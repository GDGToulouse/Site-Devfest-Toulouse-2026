#!/usr/bin/env node
// Move the dev line onto the next `-beta` after a release (#288).
//
// Called by the version-backport workflow once a `v*` tag is published: takes
// the version just shipped (e.g. 1.5.0) and writes the next patch as a
// pre-release (1.5.1-beta) into the three version files.
//
// A patch bump is the safe default — it only claims "the next release will be
// at least this". If the upcoming scope turns out to be a feature or a breaking
// change, the promotion PR raises it (docs/mise-en-production.md, étape 1).
//
// Usage: node scripts/bump-beta-version.mjs 1.5.0

import { readFileSync, writeFileSync } from "node:fs";

const FILES = {
  appVersion: "src/backend/src/lib/version.ts",
  backendPkg: "src/backend/package.json",
  frontendPkg: "src/frontend/package.json",
};

const released = (process.argv[2] ?? "").replace(/^v/, "");
const match = released.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!match) {
  console.error(`Version publiée invalide : « ${process.argv[2] ?? ""} » (attendu vX.Y.Z).`);
  process.exit(1);
}

const [, major, minor, patch] = match;
const next = `${major}.${minor}.${Number(patch) + 1}-beta`;

// version.ts keeps the number as a code constant: package.json sits outside
// tsconfig's rootDir, so importing it would break the build.
const appSource = readFileSync(FILES.appVersion, "utf8");
const updatedApp = appSource.replace(
  /(APP_VERSION\s*=\s*process\.env\.APP_VERSION\s*\|\|\s*")[^"]+(")/,
  `$1${next}$2`,
);
if (updatedApp === appSource) {
  console.error(`APP_VERSION introuvable dans ${FILES.appVersion}.`);
  process.exit(1);
}
writeFileSync(FILES.appVersion, updatedApp);

for (const path of [FILES.backendPkg, FILES.frontendPkg]) {
  const source = readFileSync(path, "utf8");
  // Rewrite in place rather than JSON.stringify: that would reorder nothing but
  // would reformat the whole file and bury the change in noise.
  const updated = source.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`);
  if (updated === source) {
    console.error(`Champ "version" introuvable dans ${path}.`);
    process.exit(1);
  }
  writeFileSync(path, updated);
}

console.log(next);
