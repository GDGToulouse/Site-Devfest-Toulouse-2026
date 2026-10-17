import { describe, it, expect, vi, afterEach } from "vitest";
import { promises as dns } from "node:dns";
import { isPrivateAddress, validateWebhookUrl } from "./webhook-url.js";

// The SSRF check ends in a real `dns.lookup`. We stub it so the DNS-dependent
// cases are deterministic in CI (no Internet, no reliance on third-party
// resolvers like nip.io). Cases that reject *before* the lookup — bad
// protocol, malformed URL, dot-less internal names, loopback literals — never
// hit the stub and exercise the real branch order.
function stubLookup(address: string, family: 4 | 6 = 4) {
  vi.spyOn(dns, "lookup").mockResolvedValue([{ address, family }] as never);
}

describe("validateWebhookUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a public URL that resolves to a public IP", async () => {
    stubLookup("93.184.216.34"); // example.com's public IP
    const url = await validateWebhookUrl("https://webhook.example/abc");
    expect(url.hostname).toBe("webhook.example");
  });

  it("rejects unknown protocols", async () => {
    await expect(validateWebhookUrl("file:///etc/passwd")).rejects.toThrow("invalid_protocol");
    await expect(validateWebhookUrl("gopher://example.com/")).rejects.toThrow("invalid_protocol");
  });

  it("rejects malformed URLs", async () => {
    await expect(validateWebhookUrl("not a url")).rejects.toThrow("invalid_url");
    await expect(validateWebhookUrl("")).rejects.toThrow("invalid_url");
  });

  it("rejects loopback literals", async () => {
    // 127.0.0.1 and [::1] carry a dot/colon, so they pass the dot-less check
    // and are caught by the loopback rule. `localhost` has no dot and is
    // caught earlier as an internal_hostname — asserted in the next test.
    await expect(validateWebhookUrl("http://127.0.0.1/x")).rejects.toThrow("loopback_hostname");
    await expect(validateWebhookUrl("http://[::1]/x")).rejects.toThrow("loopback_hostname");
  });

  it("rejects bare service names (Docker DNS), including localhost", async () => {
    // Hostnames without a dot cannot be public by design — this runs before
    // the loopback check, so `localhost` trips internal_hostname first.
    await expect(validateWebhookUrl("http://localhost/x")).rejects.toThrow("internal_hostname");
    await expect(validateWebhookUrl("http://backend/x")).rejects.toThrow("internal_hostname");
    await expect(validateWebhookUrl("http://postfix/mail")).rejects.toThrow("internal_hostname");
  });

  it("rejects URLs whose hostname resolves to a private IP", async () => {
    stubLookup("10.0.0.1");
    await expect(validateWebhookUrl("http://sneaky.example/x")).rejects.toThrow("private_ip");
  });

  it("rejects URLs whose hostname resolves to the cloud metadata IP", async () => {
    stubLookup("169.254.169.254");
    await expect(validateWebhookUrl("http://metadata.example/latest")).rejects.toThrow("private_ip");
  });
});

// The WHATWG parser rewrites `[::ffff:127.0.0.1]` as `[::ffff:7f00:1]`: an
// IPv4 address embedded in IPv6 must be judged by its IPv4 part whatever the
// notation, and the shared-address and benchmark ranges are not public either.
describe("isPrivateAddress", () => {
  it.each([
    ["::ffff:7f00:1", 6],
    ["::ffff:127.0.0.1", 6],
    ["::ffff:a00:1", 6],
    ["::ffff:c0a8:101", 6],
    ["::ffff:a9fe:a9fe", 6],
    ["64:ff9b::7f00:1", 6],
    ["::7f00:1", 6],
    ["2002:7f00:1::", 6],
    ["::", 6],
    ["::1", 6],
    ["fe80::1", 6],
    ["fd00::1", 6],
    ["100.64.0.1", 4],
    ["198.18.0.1", 4],
    ["192.0.0.1", 4],
    ["0.0.0.0", 4],
    ["255.255.255.255", 4],
  ] as const)("should treat %s as private", (address, family) => {
    expect(isPrivateAddress(address, family)).toBe(true);
  });

  it.each([
    ["93.184.216.34", 4],
    ["8.8.8.8", 4],
    ["::ffff:808:808", 6],
    ["2606:4700:4700::1111", 6],
  ] as const)("should treat %s as public", (address, family) => {
    expect(isPrivateAddress(address, family)).toBe(false);
  });

  it("should refuse a webhook to an IPv4-mapped loopback literal", async () => {
    await expect(validateWebhookUrl("http://[::ffff:127.0.0.1]:18765/hook")).rejects.toThrow();
  });
});
