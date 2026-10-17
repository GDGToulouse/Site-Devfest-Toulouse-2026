import { promises as dns } from "node:dns";
import net from "node:net";

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

// Ranges no outgoing request may reach: private networks, loopback,
// link-local (cloud metadata), shared address space (CGNAT), benchmarking,
// documentation, multicast and reserved.
const PRIVATE_V4 = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  PRIVATE_V4.addSubnet(network, prefix, "ipv4");
}

// IPv6: the same kinds of range, plus every transition prefix that carries an
// IPv4 address (IPv4-compatible, NAT64, Teredo, 6to4): a public web server
// has no reason to resolve to one, and each could smuggle a private IPv4 in.
// IPv4-mapped addresses (::ffff:0:0/96) are judged by their IPv4 part instead.
const PRIVATE_V6 = new net.BlockList();
for (const [network, prefix] of [
  ["::", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["2001::", 32],
  ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) {
  PRIVATE_V6.addSubnet(network, prefix, "ipv6");
}

/**
 * The IPv4 address inside an IPv4-mapped IPv6 one, whatever its notation:
 * the WHATWG parser turns `[::ffff:127.0.0.1]` into `[::ffff:7f00:1]`, and
 * reading only the dotted form let the hexadecimal one through (#658).
 */
function mappedIPv4(address: string): string | null {
  let text = address.split("%")[0].toLowerCase();
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number);
    text = `${text.slice(0, dotted.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.split("::");
  const headWords = head ? head.split(":") : [];
  const tailWords = tail ? tail.split(":") : [];
  const words = tail === undefined
    ? headWords
    : [...headWords, ...Array(8 - headWords.length - tailWords.length).fill("0"), ...tailWords];
  const values = words.map((word) => parseInt(word, 16));
  if (values.length !== 8 || values.slice(0, 5).some((v) => v !== 0) || values[5] !== 0xffff) return null;
  return `${values[6] >> 8}.${values[6] & 0xff}.${values[7] >> 8}.${values[7] & 0xff}`;
}

export function isPrivateAddress(address: string, family: number): boolean {
  if (family === 4) return PRIVATE_V4.check(address, "ipv4");
  const v4 = mappedIPv4(address);
  if (v4) return PRIVATE_V4.check(v4, "ipv4");
  return PRIVATE_V6.check(address.split("%")[0], "ipv6");
}
