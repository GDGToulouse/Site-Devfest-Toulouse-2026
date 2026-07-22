import { prisma } from "./prisma.js";
import { notDeleted } from "./admin-helpers.js";

// Where sponsor-related notifications go (e.g. a sponsor sending com-kit
// complements, #249). Reuses the "sponsoring" contact category recipients so
// the address stays configurable in the admin, with a safe fallback.
export async function getSponsorContactRecipients(): Promise<string[]> {
  // findFirst carries the trash filter (#147). A trashed category falls through
  // to the default address below — better a fallback that reaches someone than
  // recipients the organizers deleted.
  const category = await prisma.contactCategory.findFirst({
    where: { slug: "sponsoring", ...notDeleted },
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
