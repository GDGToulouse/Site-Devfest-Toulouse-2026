import { describe, it, expect, vi, beforeEach } from "vitest";

// The CFP notification address falls back to a default when the setting is
// missing or blank, so talk-edit notifications (#260) never land nowhere.
//
// The read is mocked (#555): this file tests the fallback, not the database,
// and writing the real `cfp_notification_email` row raced admin-settings.test.ts,
// which rewrites that same row through PUT /api/admin/settings/cfp in parallel.
const findUnique = vi.fn();
vi.mock("./prisma.js", () => ({ prisma: { siteSetting: { findUnique: (...args: unknown[]) => findUnique(...args) } } }));

const { getCfpNotificationEmail, DEFAULT_CFP_NOTIFICATION_EMAIL } = await import("./cfp-settings.js");

describe("getCfpNotificationEmail (#260)", () => {
  beforeEach(() => findUnique.mockReset());

  it("returns the default when the setting is absent", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getCfpNotificationEmail()).toBe(DEFAULT_CFP_NOTIFICATION_EMAIL);
  });

  it("returns the default when the setting is blank", async () => {
    findUnique.mockResolvedValue({ key: "cfp_notification_email", value: "   " });
    expect(await getCfpNotificationEmail()).toBe(DEFAULT_CFP_NOTIFICATION_EMAIL);
  });

  it("returns the configured address when set", async () => {
    findUnique.mockResolvedValue({ key: "cfp_notification_email", value: "team@example.org" });
    expect(await getCfpNotificationEmail()).toBe("team@example.org");
    expect(findUnique).toHaveBeenCalledWith({ where: { key: "cfp_notification_email" } });
  });
});
