#!/usr/bin/env node
// Version guard (#288).
//
// The SemVer bump lives in the dev → main promotion PR, so release commits exist
// only on `main`. Nothing carries them back down, and in July `main` sat on
// 1.3.0 while `dev` was still on 1.1.3 — the beta advertised an older version
// than production, making the admin badge lie.
//
// This checks two things, and is meant to run in CI on pull requests:
//   1. the four version files agree with each other;
//   2. on a PR touching `dev`, its version is a `-beta` pre-release strictly
//      ahead of what `main` currently ships.
//
// Usage:
//   node scripts/check-version-consistency.mjs            # self-consistency only
//   node scripts/check-version-consistency.mjs --against-main   # + compare to main
//
// Exits non-zero with an actionable message when the invariant breaks.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const FILES = {
  appVersion: "src/backend/src/lib/version.ts",
  backendPkg: "src/backend/package.json",
  frontendPkg: "src/frontend/package.json",
};

function fail(message, hint) {
  console.error(`\n✗ ${message}`);
  if (hint) console.error(`\n  ${hint}`);
  process.exit(1);
}

/** APP_VERSION is a code constant, not a JSON field — read it with a regex. */
function readAppVersion(contents) {
  const match = contents.match(/APP_VERSION\s*=\s*process\.env\.APP_VERSION\s*\|\|\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function readPkgVersion(contents) {
  return JSON.parse(contents).version ?? null;
}

/** Read a file as it exists on a given git ref, or null when absent. */
function readFromRef(ref, path) {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" });
  } catch {
    return null;
  }
}

/**
 * Parse `1.5.1-beta` into comparable parts. The suffix is deliberately not
 * parsed further: the convention only uses a bare `-beta` marker.
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ?? null,
    raw: version,
  };
}

/**
 * SemVer ordering, restricted to what this repo uses: a pre-release sorts
 * before the same release (1.5.0-beta < 1.5.0), which is exactly why the
 * convention works — the beta announces the version it is heading towards.
 */
function compare(a, b) {
  for (const part of ["major", "minor", "patch"]) {
    if (a[part] !== b[part]) return a[part] < b[part] ? -1 : 1;
  }
  if (a.pre && !b.pre) return -1;
  if (!a.pre && b.pre) return 1;
  return 0;
}

// --- 1. The four version files must agree.

const current = {
  [FILES.appVersion]: readAppVersion(readFileSync(FILES.appVersion, "utf8")),
  [FILES.backendPkg]: readPkgVersion(readFileSync(FILES.backendPkg, "utf8")),
  [FILES.frontendPkg]: readPkgVersion(readFileSync(FILES.frontendPkg, "utf8")),
};

for (const [file, version] of Object.entries(current)) {
  if (!version) fail(`Version illisible dans ${file}.`);
}

const distinct = [...new Set(Object.values(current))];
if (distinct.length > 1) {
  const detail = Object.entries(current)
    .map(([file, version]) => `    ${version.padEnd(16)} ${file}`)
    .join("\n");
  fail(
    `Les fichiers de version divergent :\n\n${detail}`,
    "Alignez-les sur le même numéro (docs/mise-en-production.md, étape 2).",
  );
}

const version = distinct[0];
if (!parseVersion(version)) {
  fail(`Version « ${version} » non conforme à SemVer (attendu MAJEUR.MINEUR.CORRECTIF[-beta]).`);
}

console.log(`✓ Les 3 fichiers de version portent ${version}`);

// --- 2. On the dev line, compare with what production currently ships.

if (!process.argv.includes("--against-main")) process.exit(0);

const mainSource = readFromRef("origin/main", FILES.appVersion) ?? readFromRef("main", FILES.appVersion);
if (!mainSource) {
  // A shallow clone without `main` cannot answer the question. Say so rather
  // than passing silently — a guard that skips itself is worse than none.
  console.error("\n! Référence `main` introuvable : comparaison ignorée.");
  console.error("  En CI, vérifiez que le job récupère bien `main` (fetch-depth: 0).");
  process.exit(0);
}

const mainVersion = readAppVersion(mainSource);
const parsedMain = mainVersion ? parseVersion(mainVersion) : null;
if (!parsedMain) fail(`Version illisible sur \`main\` (${mainVersion ?? "absente"}).`);

const parsedCurrent = parseVersion(version);

if (!parsedCurrent.pre) {
  fail(
    `La ligne dev porte ${version}, sans suffixe de pre-release.`,
    "La bêta doit annoncer la version À VENIR, suffixée `-beta` " +
      `(ex. ${parsedMain.major}.${parsedMain.minor}.${parsedMain.patch + 1}-beta). ` +
      "Sans cela, bêta et prod affichent le même numéro pour du code différent.",
  );
}

if (compare(parsedCurrent, parsedMain) <= 0) {
  fail(
    `La ligne dev (${version}) n'est pas en avance sur la production (${mainVersion}).`,
    "C'est la dérive de #288 : la bêta annoncerait une version antérieure à la prod. " +
      "Après une mise en prod, repositionnez la ligne dev sur la version suivante en `-beta` " +
      "(docs/mise-en-production.md, étape 7).",
  );
}

console.log(`✓ ${version} (dev) est bien en avance sur ${mainVersion} (prod)`);
