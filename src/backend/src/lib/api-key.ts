import { randomBytes } from "node:crypto";
import { hash, verify, Algorithm } from "@node-rs/argon2";

// The prefix that visually identifies a DevFest Toulouse API key.
// Format: dft_<env>_<random>. The <env> segment mirrors the deployment
// environment (live, beta, dev) so a leaked key is immediately traceable.
const KEY_PREFIX = "dft";

// First N characters of the raw key that we also store in plaintext for
// identification/lookup. 12 characters give enough entropy to make the
// index lookup virtually collision-free while still hiding the full secret.
const PREFIX_LOOKUP_LENGTH = 12;

// argon2id is the recommended profile for secrets with high entropy (like
// random tokens). Default parameters are safe; we pin them explicitly so a
// library upgrade can't silently weaken hashes at rest.
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export type ApiKeyEnv = "live" | "beta" | "dev";

export interface GeneratedApiKey {
  /** Full plaintext key — returned once to the user, never stored. */
  raw: string;
  /** Indexed lookup prefix stored as-is in DB. */
  prefix: string;
  /** Argon2 hash of the full raw key. */
  hashedKey: string;
}

/**
 * Resolve the env segment baked into newly generated keys from the runtime
 * context. Production keys have `live`, the beta environment uses `beta`,
 * and every other case (dev-j, local, tests) falls back to `dev`.
 */
export function resolveApiKeyEnv(): ApiKeyEnv {
  if (process.env.NODE_ENV !== "production") return "dev";
  const baseUrl = process.env.BASE_URL ?? "";
  if (baseUrl.includes("beta.")) return "beta";
  return "live";
}

export async function generateApiKey(env: ApiKeyEnv): Promise<GeneratedApiKey> {
  const random = randomBytes(32).toString("base64url");
  const raw = `${KEY_PREFIX}_${env}_${random}`;
  const prefix = raw.slice(0, KEY_PREFIX.length + 1 + env.length + 1 + PREFIX_LOOKUP_LENGTH);
  const hashedKey = await hash(raw, ARGON2_OPTIONS);
  return { raw, prefix, hashedKey };
}

export function extractPrefix(raw: string): string | null {
  const match = raw.match(/^dft_(live|beta|dev)_[A-Za-z0-9_-]+$/);
  if (!match) return null;
  const envLen = match[1].length;
  return raw.slice(0, KEY_PREFIX.length + 1 + envLen + 1 + PREFIX_LOOKUP_LENGTH);
}

export async function verifyApiKey(raw: string, hashedKey: string): Promise<boolean> {
  try {
    return await verify(hashedKey, raw);
  } catch {
    return false;
  }
}
