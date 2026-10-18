import { afterEach, describe, it, expect, vi } from "vitest";

import { changeSponsorPassword } from "./sponsor-api";

afterEach(() => vi.unstubAllGlobals());

describe("changeSponsorPassword", () => {
  // A new password is what someone sets once they fear their account was
  // taken: the sessions opened elsewhere must close with it.
  it("should ask better-auth to sign out the account's other sessions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await changeSponsorPassword("old-password-1234", "new-password-1234");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ revokeOtherSessions: true });
  });
});
