import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// #352 — the bug this guards against is invisible in jsdom: `next/image` here
// just renders an <img>, while the `remotePatterns` check that throws
// "hostname is not configured" runs server-side. A test that simply renders a
// third-party URL would pass with a bare <Image> and prove nothing.
//
// So the mock reproduces the rule: an external src without `unoptimized` throws,
// exactly as Next does at runtime. That is what makes this a real regression test.
vi.mock("next/image", () => ({
  default: ({ src, unoptimized, alt }: { src: string; unoptimized?: boolean; alt: string }) => {
    if (typeof src === "string" && src.startsWith("http") && !unoptimized) {
      throw new Error(`Invalid src prop (${src}) on \`next/image\`: hostname is not configured`);
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} data-unoptimized={String(Boolean(unoptimized))} />;
  },
}));

const { default: SpeakerPhoto } = await import("./SpeakerPhoto");

describe("SpeakerPhoto (#352)", () => {
  it("does not blow up on a photo hosted by a third party", () => {
    // 22 imported speakers carry one of these. Before #352 they only appeared in
    // components that already used this one — the unified page changed that.
    render(<SpeakerPhoto photoUrl="https://pbs.twimg.com/profile_images/1/x.jpg" name="Ada" size={160} />);

    expect(screen.getByAltText("Ada")).toHaveAttribute("data-unoptimized", "true");
  });

  it("still optimizes an upload of our own", () => {
    render(<SpeakerPhoto photoUrl="/uploads/ada.jpg" name="Ada" size={160} />);

    expect(screen.getByAltText("Ada")).toHaveAttribute("data-unoptimized", "false");
  });

  it("falls back to the initial when there is no photo", () => {
    // 218 speakers have no photo at all.
    render(<SpeakerPhoto photoUrl={null} name="Ada" size={160} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
