import { execFileSync } from "node:child_process";

// The local backend container (docker-compose.local.yml): the fixture is written
// from inside it, and the outage test stops it.

export const BACKEND_CONTAINER = process.env.E2E_BACKEND_CONTAINER ?? "devfest-local-backend";
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:4000";

export function docker(...args: string[]): string {
  return execFileSync("docker", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

/** Runs the fixture script in the backend container; `setup` answers the data as JSON. */
export function runFixture(command: "setup" | "clean"): string {
  return docker("exec", BACKEND_CONTAINER, "pnpm", "exec", "tsx", "scripts/e2e-arrivals-fixture.ts", command);
}

export async function isBackendUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Waits for the backend to answer after a start: the dev container reinstalls and regenerates first. */
export async function waitForBackend(timeoutMs = 180_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isBackendUp()) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`The backend did not answer on ${BACKEND_URL} within ${timeoutMs / 1000} s`);
}
