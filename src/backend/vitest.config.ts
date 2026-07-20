import { defineConfig } from "vitest/config";

// Only run the TypeScript source tests — the compiled `dist/` output is a stale
// artefact of an earlier build and re-running those generated .js copies
// produces duplicate, outdated results.
const include = ["src/**/*.{test,spec}.ts", "scripts/**/*.{test,spec}.ts"];
const exclude = ["node_modules", "dist"];

// The trash purge (#149) sweeps every soft-deletable entity of the shared test
// database in one pass, and its cascades reach past the rows it deletes
// (removing an Edition takes its KeyFigures with it). Run alongside the other
// files it races their fixtures — the same class of cross-file interference
// as #292.
//
// Vitest offers no per-file concurrency pragma; a project matched by glob is the
// documented way to isolate one file without dropping parallelism for the rest.
// `groupOrder` puts it in its own pass, after everything else.
const SEQUENTIAL = ["src/**/trash-purge.test.ts"];

// The integration tests boot a real Fastify app and hit Postgres. The first few
// pay the one-off tsx transform + cold connection cost, which blows past
// Vitest's 5s default on a shared CI runner. 30s is a safety margin for that
// startup latency, not for any single slow assertion.
const testTimeout = 30000;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "parallel",
          include,
          exclude: [...exclude, ...SEQUENTIAL],
          testTimeout,
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          name: "sequential",
          include: SEQUENTIAL,
          exclude,
          testTimeout,
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
