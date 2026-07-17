import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

import { interpolate, interpolateHtml, sendEmail } from "./email.js";

describe("interpolate", () => {
  it("replaces known tokens", () => {
    const result = interpolate("Hello {firstName} {lastName}", {
      firstName: "John",
      lastName: "Doe",
    });
    expect(result).toBe("Hello John Doe");
  });

  it("leaves unknown tokens as-is", () => {
    expect(interpolate("{unknown} token", {})).toBe("{unknown} token");
  });

  it("handles brochureUrl with HTML link", () => {
    const tpl = 'Consultez la plaquette à <a href="{brochureUrl}">cette adresse</a>.';
    const result = interpolate(tpl, { brochureUrl: "https://example.com/sponsor.pdf" });
    expect(result).toBe('Consultez la plaquette à <a href="https://example.com/sponsor.pdf">cette adresse</a>.');
  });

  it("returns template unchanged when vars is empty", () => {
    expect(interpolate("No tokens here", {})).toBe("No tokens here");
  });

  it("replaces multiple occurrences of the same token", () => {
    expect(interpolate("{name} and {name}", { name: "X" })).toBe("X and X");
  });
});

describe("interpolateHtml", () => {
  it("escapes HTML special chars in values", () => {
    const result = interpolateHtml("Hello {firstName}", {
      firstName: "<script>alert(1)</script>",
    });
    expect(result).toBe("Hello &lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("preserves HTML in the template itself", () => {
    const tpl = '<p>Hi <strong>{name}</strong></p>';
    expect(interpolateHtml(tpl, { name: "Jane" })).toBe("<p>Hi <strong>Jane</strong></p>");
  });

  it("escapes quotes and ampersands", () => {
    expect(interpolateHtml("{x}", { x: 'A "B" & C' })).toBe("A &quot;B&quot; &amp; C");
  });

  it("leaves unknown tokens unchanged", () => {
    expect(interpolateHtml("{unknown}", {})).toBe("{unknown}");
  });
});

describe("sendEmail", () => {
  beforeEach(() => sendMailMock.mockClear());

  const base = { to: ["orga@devfesttoulouse.fr"], subject: "s", text: "t", html: "<p>t</p>" };

  it("passes replyTo through to the transporter", async () => {
    await sendEmail({ ...base, replyTo: "visitor@example.com" });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "visitor@example.com" }),
    );
  });

  it("joins cc recipients with a comma", async () => {
    await sendEmail({ ...base, cc: ["a@x.fr", "b@x.fr"] });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ cc: "a@x.fr, b@x.fr" }),
    );
  });

  it("omits replyTo and cc when not provided", async () => {
    await sendEmail(base);
    const arg = sendMailMock.mock.calls[0][0];
    expect(arg).not.toHaveProperty("replyTo");
    expect(arg).not.toHaveProperty("cc");
  });

  it("omits cc when the list is empty", async () => {
    await sendEmail({ ...base, cc: [] });
    expect(sendMailMock.mock.calls[0][0]).not.toHaveProperty("cc");
  });
});
