import { describe, it, expect } from "vitest";
import { validateWebhookUrl } from "./webhook-url.js";

describe("validateWebhookUrl", () => {
  it("accepts a public https URL", async () => {
    // webhook.site resolves to a public IP; this exercises the real DNS path.
    const url = await validateWebhookUrl("https://webhook.site/abc");
    expect(url.hostname).toBe("webhook.site");
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
    await expect(validateWebhookUrl("http://localhost/x")).rejects.toThrow("loopback_hostname");
    await expect(validateWebhookUrl("http://127.0.0.1/x")).rejects.toThrow("loopback_hostname");
    await expect(validateWebhookUrl("http://[::1]/x")).rejects.toThrow("loopback_hostname");
  });

  it("rejects bare service names (Docker DNS)", async () => {
    // Hostnames without a dot cannot be public by design.
    await expect(validateWebhookUrl("http://backend/x")).rejects.toThrow("internal_hostname");
    await expect(validateWebhookUrl("http://postfix/mail")).rejects.toThrow("internal_hostname");
  });

  it("rejects URLs whose hostname resolves to a private IP", async () => {
    // This test skips if the local resolver can't reach a public resolver;
    // we use a literal private IP via a nip.io-style FQDN that's always private.
    await expect(validateWebhookUrl("http://10.0.0.1.nip.io/x")).rejects.toThrow("private_ip");
    await expect(validateWebhookUrl("http://169.254.169.254.nip.io/metadata")).rejects.toThrow("private_ip");
  });
});
