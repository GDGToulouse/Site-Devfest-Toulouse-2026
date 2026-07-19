import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "./prisma.js";
import { getCfpNotificationEmail, DEFAULT_CFP_NOTIFICATION_EMAIL } from "./cfp-settings.js";

// The CFP notification address falls back to a default when the setting is
// missing or blank, so talk-edit notifications (#260) never land nowhere.

describe("getCfpNotificationEmail (#260)", () => {
  afterEach(async () => {
    await prisma.siteSetting.deleteMany({ where: { key: "cfp_notification_email" } });
  });

  it("returns the default when the setting is absent", async () => {
    expect(await getCfpNotificationEmail()).toBe(DEFAULT_CFP_NOTIFICATION_EMAIL);
  });

  it("returns the default when the setting is blank", async () => {
    await prisma.siteSetting.create({ data: { key: "cfp_notification_email", value: "   " } });
    expect(await getCfpNotificationEmail()).toBe(DEFAULT_CFP_NOTIFICATION_EMAIL);
  });

  it("returns the configured address when set", async () => {
    await prisma.siteSetting.create({ data: { key: "cfp_notification_email", value: "team@example.org" } });
    expect(await getCfpNotificationEmail()).toBe("team@example.org");
  });
});
