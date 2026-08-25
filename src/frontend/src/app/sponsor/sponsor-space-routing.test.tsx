import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// #466 — the WordPress site exposed sponsors at /sponsor/<slug>, and its 60 URLs
// are still in Google's index. They land on the sponsor space's [sponsorId]
// route, where Number("capgemini") is NaN: the guard that protected the API call
// left the page on "Chargement…" forever, served as a 200 with no title. A soft
// 404 for Google, an endless spinner for anyone following an old link.

// vi.mock factories are hoisted above the file, so the spies they hand out have
// to be created inside vi.hoisted rather than as plain top-level consts.
const { notFound, getSponsorProfile, router } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  getSponsorProfile: vi.fn(),
  // One object, not one per render: `load` depends on the router, and a fresh
  // identity each render re-runs the effect forever.
  router: { replace: vi.fn(), push: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  notFound,
  useRouter: () => router,
}));

vi.mock("@/lib/sponsor-api", () => ({ getSponsorProfile }));
vi.mock("@/lib/admin-api", () => ({ signOut: vi.fn() }));
vi.mock("@/components/sponsor-space/PublicTab", () => ({ default: () => null }));
vi.mock("@/components/sponsor-space/PrivateTab", () => ({ default: () => null }));
vi.mock("@/components/sponsor-space/TeamTab", () => ({ default: () => null }));
vi.mock("@/components/sponsor-space/JobOffersTab", () => ({ default: () => null }));
vi.mock("@/components/admin/Tabs", () => ({ default: () => null }));

import SponsorSpacePage from "./[sponsorId]/page";
import { metadata as sponsorMetadata } from "./layout";
import { metadata as editMetadata } from "../edit/layout";

// `params` is a promise the page unwraps with `use()`, so the render has to be
// flushed inside act for the suspended value to arrive.
async function renderAt(sponsorId: string) {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <SponsorSpacePage params={Promise.resolve({ sponsorId })} />
      </Suspense>,
    );
  });
}

beforeEach(() => {
  notFound.mockClear();
  getSponsorProfile.mockReset();
  getSponsorProfile.mockResolvedValue({ data: null, status: 404 });
});

describe("an old WordPress sponsor URL", () => {
  it("is a real 404, not a page that never finishes loading", async () => {
    await expect(renderAt("capgemini")).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
    // And the API is never called with NaN in the path.
    expect(getSponsorProfile).not.toHaveBeenCalled();
  });

  it("refuses /sponsor/0 too — there is no sponsor zero", async () => {
    await expect(renderAt("0")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("leaves a real identifier alone", async () => {
    getSponsorProfile.mockResolvedValue({ data: null, status: 403 });
    await renderAt("12");

    await screen.findByText(/n'est pas accessible avec votre compte/);
    expect(notFound).not.toHaveBeenCalled();
    expect(getSponsorProfile).toHaveBeenCalledWith(12);
  });
});

describe("a load that fails rather than a load that is refused", () => {
  it("says the space could not be loaded, not that access is denied", async () => {
    // A dropped connection comes back as status 0 (#428). Reported as a refusal,
    // it sends the sponsor asking for rights they already hold.
    getSponsorProfile.mockResolvedValue({ data: null, status: 0 });
    await renderAt("12");

    await screen.findByText(/n'a pas pu être chargé/);
    expect(screen.queryByText(/n'est pas accessible avec votre compte/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("treats a backend outage the same way", async () => {
    getSponsorProfile.mockResolvedValue({ data: null, status: 503 });
    await renderAt("12");

    await screen.findByText(/n'a pas pu être chargé/);
  });
});

describe("the private spaces", () => {
  it("tell crawlers to stay out — both of them", () => {
    // Two routes carry a token in the path: /sponsor/invitation/<token> and
    // /edit/<token>. robots.ts only ever disallowed /admin.
    expect(sponsorMetadata.robots).toEqual({ index: false, follow: false });
    expect(editMetadata.robots).toEqual({ index: false, follow: false });
  });
});
