import { describe, it, expect } from "vitest";

import { signedOAuthQuery } from "./connect-api";

// #514 — what /connect sends back to the provider must be exactly the signed
// part of its query string, or the signature no longer matches.

describe("signedOAuthQuery", () => {
  it("should keep the signed parameters, the signature and the list of signed names", () => {
    const search =
      "?client_id=agent&state=s1&exp=99&ba_param=client_id&ba_param=exp&ba_param=state&ba_param=ba_param&sig=abc%3D";

    expect(signedOAuthQuery(search)).toBe(
      "client_id=agent&state=s1&exp=99&ba_param=client_id&ba_param=exp&ba_param=state&ba_param=ba_param&sig=abc%3D",
    );
  });

  it("should drop a parameter added to the URL after signing", () => {
    const search = "?client_id=agent&utm_source=mail&ba_param=client_id&ba_param=ba_param&sig=abc";

    expect(signedOAuthQuery(search)).not.toContain("utm_source");
  });

  it("should have nothing to resume on a page reached without a signature", () => {
    expect(signedOAuthQuery("?client_id=agent")).toBeUndefined();
    expect(signedOAuthQuery("")).toBeUndefined();
  });
});
