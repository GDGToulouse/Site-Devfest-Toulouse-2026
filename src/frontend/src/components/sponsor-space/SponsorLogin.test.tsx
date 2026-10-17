import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import SponsorLogin from "./SponsorLogin";

afterEach(() => vi.unstubAllGlobals());

function stubProviders() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ google: false, github: false }))));
}

// Opening an invited account goes through the invitation's token, for the
// invited address whatever is typed (#658): asking for an address there would
// suggest another one could be chosen.
describe("SponsorLogin", () => {
  it("should show the invited address instead of asking for one", () => {
    stubProviders();

    render(<SponsorLogin callbackURL="/sponsor" invitationToken="tok" emailHint="c•••••t@societe.fr" />);

    expect(screen.queryByRole("textbox", { name: /email/i })).toBeNull();
    expect(screen.getByText("c•••••t@societe.fr")).toBeTruthy();
  });

  it("should still ask for the address on the sign-in screen", () => {
    stubProviders();

    render(<SponsorLogin callbackURL="/sponsor" />);

    expect(screen.getByRole("textbox", { name: /email/i })).toBeTruthy();
  });
});
