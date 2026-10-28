// #673, #674 — the open sign-up endpoint must neither tell who has an account
// nor let anyone claim an ADMIN_EMAILS address without proving the mailbox.

process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";
// Read by auth.ts at import time: set before the dynamic import below.
const ADMIN_ADDRESS = `first-admin-${Date.now()}@example.org`;
process.env.ADMIN_EMAILS = ADMIN_ADDRESS;

import { describe, it, expect, afterAll } from "vitest";

import { prisma } from "../lib/prisma.js";

const { auth } = await import("../lib/auth.js");

const createdEmails: string[] = [];

function uniqueEmail(tag: string): string {
  const email = `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.org`;
  createdEmails.push(email);
  return email;
}

async function signUp(email: string, password = "attacker1234!test") {
  const res = await auth.api.signUpEmail({ body: { name: "Someone", email, password }, asResponse: true });
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, cookie: res.headers.get("set-cookie") };
}

async function createAccount(email: string, { emailVerified, password }: { emailVerified: boolean; password?: string }) {
  const user = await prisma.user.create({ data: { email, name: email, role: "EDITOR", emailVerified } });
  if (password) {
    const ctx = await auth.$context;
    await ctx.internalAdapter.createAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await ctx.password.hash(password),
    });
  }
  return user;
}

afterAll(async () => {
  createdEmails.push(ADMIN_ADDRESS);
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
});

// The shape of an answer, values aside: what a prober would compare.
function shape(res: { status: number; body: Record<string, unknown>; cookie: string | null }) {
  const user = res.body.user as Record<string, unknown> | undefined;
  return { status: res.status, token: res.body.token, userKeys: user ? Object.keys(user).sort() : null, cookie: res.cookie };
}

describe("Sign-up answers the same whether the address has an account (#673)", () => {
  it("gives an existing address the answer a free one gets", async () => {
    const taken = uniqueEmail("taken");
    await createAccount(taken, { emailVerified: true, password: "owner1234!test" });
    const free = uniqueEmail("free");

    const onTaken = await signUp(taken);
    const onFree = await signUp(free);

    expect(shape(onTaken)).toEqual(shape(onFree));
    expect(onTaken.status).toBe(200);
    // No session either way: a sign-up never signs anyone in.
    expect(onTaken.body.token).toBeNull();
    expect(onTaken.cookie).toBeNull();
    // Closed sign-up: the free, uninvited address got no account out of it.
    expect(await prisma.user.count({ where: { email: free } })).toBe(0);
  });

  it("leaves the existing account untouched", async () => {
    const taken = uniqueEmail("untouched");
    const owner = await createAccount(taken, { emailVerified: true, password: "owner1234!test" });

    await signUp(taken, "attacker1234!test");

    const signIn = await auth.api.signInEmail({ body: { email: taken, password: "owner1234!test" }, asResponse: true });
    expect(signIn.status).toBe(200);
    expect(await prisma.account.count({ where: { userId: owner.id } })).toBe(1);
  });

  // The price of the uniform answer: a password proves nothing about the
  // mailbox, so an unverified account cannot sign in with one.
  it("refuses a password sign-in on an unverified account", async () => {
    const email = uniqueEmail("unverified");
    await createAccount(email, { emailVerified: false, password: "owner1234!test" });

    const res = await auth.api.signInEmail({ body: { email, password: "owner1234!test" }, asResponse: true });
    expect(res.status).toBe(403);
  });
});

// An address in ADMIN_EMAILS is a target: whoever registers it first with a
// password of their own would wait for the owner to verify the mailbox and
// inherit the account. Only an identity provider's proof opens it.
describe("An ADMIN_EMAILS address needs a proven mailbox (#674)", () => {
  it("creates nothing on a plain password sign-up", async () => {
    const res = await signUp(ADMIN_ADDRESS);

    // The same answer as any refused address: nothing to learn from it.
    expect(shape(res)).toEqual(shape(await signUp(uniqueEmail("refused"))));
    expect(await prisma.user.count({ where: { email: ADMIN_ADDRESS } })).toBe(0);
  });

  it("refuses an identity provider that did not verify the address", async () => {
    const ctx = await auth.$context;
    // No endpoint context: the call stands for the OAuth callback itself.
    await expect(
      ctx.internalAdapter.createUser({ email: ADMIN_ADDRESS, name: "Unproven", emailVerified: false }, undefined as never),
    ).rejects.toThrow();
    expect(await prisma.user.count({ where: { email: ADMIN_ADDRESS } })).toBe(0);
  });

  it("lets an identity provider that verified it open the account, as ADMIN", async () => {
    const ctx = await auth.$context;
    await ctx.internalAdapter.createUser({ email: ADMIN_ADDRESS, name: "First Admin", emailVerified: true }, undefined as never);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_ADDRESS } });
    expect(user.role).toBe("ADMIN");
    expect(user.emailVerified).toBe(true);
  });
});
