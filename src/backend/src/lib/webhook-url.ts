import { promises as dns } from "node:dns";

/**
 * Validate a webhook URL against SSRF attacks:
 *  - protocol must be http(s) only (no file:, gopher:, etc.)
 *  - hostname must not resolve to a private/loopback/link-local range
 *
 * Throws with a short reason if invalid. Resolves to the parsed URL on success.
 *
 * Why: webhook URLs are admin-configurable, so a malicious (or compromised)
 * admin could otherwise probe internal cloud metadata endpoints
 * (169.254.169.254), reach the database (db:5432), or use the backend as an
 * SSRF relay inside the shared Coolify network.
 */
export async function validateWebhookUrl(raw: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }

  // In development we allow http:// for local webhook.site-style targets,
  // but production should always enforce https:. Keep http allowed everywhere
  // for now — the reverse proxy terminates TLS and an admin knows what they're
  // pointing at. Still reject non-web schemes outright.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("invalid_protocol");
  }

  // Disallow bare hostnames that look like internal service names
  // (no dots, typical of Docker service DNS — `backend`, `db`, `postfix`).
  // This catches the "probe another Coolify project" attack path even before
  // DNS resolution.
  if (!parsed.hostname.includes(".") && !parsed.hostname.includes(":")) {
    throw new Error("internal_hostname");
  }

  // Reject explicit loopback / localhost literals early. Node keeps the
  // brackets on IPv6 hostnames (`new URL("http://[::1]/").hostname === "[::1]"`),
  // so strip them before comparing or `[::1]` slips through the SSRF guard.
  const lower = parsed.hostname.toLowerCase();
  const bare = lower.startsWith("[") && lower.endsWith("]") ? lower.slice(1, -1) : lower;
  if (bare === "localhost" || bare === "127.0.0.1" || bare === "::1") {
    throw new Error("loopback_hostname");
  }

  // Resolve all IPv4/IPv6 addresses the hostname points to — each one must be
  // public. A malicious DNS record pointing `evil.example.com` to 10.0.0.1 is
  // caught here. `dns.lookup` wants the bracket-less form for IPv6 literals.
  const addrs = await dns.lookup(bare, { all: true }).catch(() => []);
  for (const { address, family } of addrs) {
    if (isPrivateAddress(address, family)) {
      throw new Error("private_ip");
    }
  }

  return parsed;
}

function isPrivateAddress(address: string, family: number): boolean {
  if (family === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  // IPv6
  const lower = address.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  // Link-local fe80::/10
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
  // Unique local fc00::/7
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // IPv4-mapped ::ffff:xxx.xxx.xxx.xxx — check the v4 part
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isPrivateAddress(v4, 4);
  }
  return false;
}
