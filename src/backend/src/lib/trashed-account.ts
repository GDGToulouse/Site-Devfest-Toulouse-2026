import type { Prisma } from "../generated/prisma/client.js";

// The seed's plain client and the shared, extended one (lib/prisma.ts) differ
// in type; this is the part both have.
interface UserCounter {
  user: { count(args: { where: Prisma.UserWhereInput }): Promise<number> };
}

/**
 * Is there an account for this address in the trash? Its email is parked
 * (`__trash_<id>__<email>`, admin-helpers.ts), so a lookup by email misses it.
 *
 * The seed provisions every address of ADMIN_EMAILS at each start: without this
 * check, an organiser removed from the back-office came back as ADMIN on the
 * next restart (#658). Takes the client as an argument: the seed runs its own.
 */
export async function hasTrashedAccount(client: UserCounter, email: string): Promise<boolean> {
  const count = await client.user.count({
    where: { deletedAt: { not: null }, email: { endsWith: `__${email}`, mode: "insensitive" } },
  });
  return count > 0;
}
