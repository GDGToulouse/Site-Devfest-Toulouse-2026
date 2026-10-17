import { describe, it, expect, afterAll } from "vitest";

import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";

// Setting a new password is what someone does once they fear their account
// was taken: the sessions opened before must not outlive it.

const PASSWORD = "sessions-test-1234!";
const createdUserIds: string[] = [];

async function createAccount() {
  const email = `sessions-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.org`;
  const user = await prisma.user.create({ data: { email, name: "Sessions", role: "SPONSOR", emailVerified: true } });
  createdUserIds.push(user.id);
  const ctx = await auth.$context;
  await prisma.account.create({
    data: { userId: user.id, accountId: user.id, providerId: "credential", password: await ctx.password.hash(PASSWORD) },
  });
  return user;
}

async function signIn(email: string, password = PASSWORD) {
  const { headers } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  const setCookie = headers.get("set-cookie") ?? "";
  return new Headers({ cookie: setCookie.split(",").map((c) => c.split(";")[0].trim()).join("; ") });
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("a new password closes the sessions opened before it", () => {
  it("should sign out every session when the password is reset", async () => {
    const user = await createAccount();
    const before = await signIn(user.email);
    const token = `reset-${Date.now()}`;
    const ctx = await auth.$context;
    await ctx.internalAdapter.createVerificationValue({
      identifier: `reset-password:${token}`,
      value: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await auth.api.resetPassword({ body: { token, newPassword: "sessions-new-1234!" } });

    expect(await auth.api.getSession({ headers: before })).toBeNull();
  });

  it("should sign out the other sessions when the password is changed", async () => {
    const user = await createAccount();
    const other = await signIn(user.email);
    const current = await signIn(user.email);

    await auth.api.changePassword({
      headers: current,
      body: { currentPassword: PASSWORD, newPassword: "sessions-new-1234!", revokeOtherSessions: true },
    });

    expect(await auth.api.getSession({ headers: other })).toBeNull();
  });
});
