import { prisma } from "./prisma.js";

// Where talk-edit notifications go when a speaker updates their session from
// the edit link (#260). Configurable in the admin CFP settings
// (cfp_notification_email); this default keeps notifications flowing even if
// the setting is never filled in.
export const DEFAULT_CFP_NOTIFICATION_EMAIL = "cfp@devfesttoulouse.fr";

export async function getCfpNotificationEmail(): Promise<string> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: "cfp_notification_email" },
  });
  return setting?.value?.trim() || DEFAULT_CFP_NOTIFICATION_EMAIL;
}
