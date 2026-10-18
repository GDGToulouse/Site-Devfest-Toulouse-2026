import { describe, it, expect, afterAll } from "vitest";

import { prisma } from "./prisma.js";
import { parkUniqueValue } from "./admin-helpers.js";
import { hasTrashedAccount } from "./trashed-account.js";

const createdIds: string[] = [];

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
});

describe("hasTrashedAccount", () => {
  it("should find an account moved to the trash under its parked address", async () => {
    const email = `trashed-admin-${Date.now()}@example.org`;
    const user = await prisma.user.create({ data: { email, name: "Trashed", role: "ADMIN" } });
    createdIds.push(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), email: parkUniqueValue(email, user.id) },
    });

    expect(await hasTrashedAccount(prisma, email)).toBe(true);
  });

  it("should not find an address nobody trashed", async () => {
    expect(await hasTrashedAccount(prisma, `never-${Date.now()}@example.org`)).toBe(false);
  });
});
