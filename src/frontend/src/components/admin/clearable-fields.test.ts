import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// #817 — `field: form.field || undefined` drops an emptied field from the JSON
// body, and every admin update route leaves alone what it does not receive.
// The save answered 200, the screen said "enregistré", and a reload brought the
// old value back: a speaker's former employer could not be removed. Send the
// empty string instead; the routes store it as null.

const SRC = join(__dirname, "..", "..");
const ADMIN_ROOTS = [join(SRC, "app", "(app)", "admin"), join(SRC, "components", "admin")];
// Dates are left out: an edition's dates cannot be erased, the route keeps the
// stored ones whatever it receives (GeneralTab says so next to the payload).
const DROPPED_WHEN_EMPTY = /^\s*((?!\w*Date:)\w+): form\.\w+ \|\| undefined,/gm;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("Admin forms — an emptied field reaches the backend (#817)", () => {
  it("never turns an empty form field into undefined", () => {
    const offenders = ADMIN_ROOTS.flatMap(sourceFiles).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(DROPPED_WHEN_EMPTY)].map(
        (match) => `${relative(SRC, file)}: ${match[1]}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});
