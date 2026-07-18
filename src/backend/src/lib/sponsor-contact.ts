import { prisma } from "./prisma.js";

// Where sponsor-related notifications go (e.g. a sponsor sending com-kit
// complements, #249). Reuses the "sponsoring" contact category recipients so
// the address stays configurable in the admin, with a safe fallback.
export async function getSponsorContactRecipients(): Promise<string[]> {
  const category = await prisma.contactCategory.findUnique({
    where: { slug: "sponsoring" },
  });
  const recipients = category?.emailRecipients
    ?.split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (recipients?.length) return recipients;

  const fallback = await prisma.siteSetting.findUnique({
    where: { key: "contact_default_email" },
  });
  return [fallback?.value || "contact@devfesttoulouse.fr"];
}
