import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// next/image reads its allowed hosts from next.config.ts, which vitest never
// loads: the real component throws "hostname is not configured" on a remote
// source (#474). Rendered as a plain <img> here, so these tests keep asserting
// what they are about — which URL, and nothing sent to YouTube before the
// click. The configuration itself is asserted at the bottom of this file, so
// the mock cannot hide a missing remotePattern.
vi.mock("next/image", () => ({
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} />
  ),
}));

import YouTubeFacade from "./YouTubeFacade";

// #348 — the facade is what lets a talk page embed its recording without paying
// YouTube's payload up front. These lock the two properties that matter: nothing
// is requested from YouTube before the click, and an URL the parser cannot read
// still leaves the visitor a way to reach the video.

const WATCH_URL = "https://www.youtube.com/watch?v=Jcs2Fp8jHEQ";

const iframe = () => document.querySelector("iframe");

describe("YouTubeFacade — before the click", () => {
  it("should show the thumbnail instead of the player", () => {
    render(<YouTubeFacade videoUrl={WATCH_URL} title="Un talk" />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      expect.stringContaining("Jcs2Fp8jHEQ"),
    );
    expect(iframe()).toBeNull();
  });

  it("should name the video in the play button, for screen readers", () => {
    render(<YouTubeFacade videoUrl={WATCH_URL} title="Un talk" />);

    expect(screen.getByRole("button", { name: /Un talk/ })).toBeInTheDocument();
  });
});

describe("YouTubeFacade — on click", () => {
  it("should load the player in place", async () => {
    render(<YouTubeFacade videoUrl={WATCH_URL} title="Un talk" />);

    await userEvent.click(screen.getByRole("button"));

    expect(iframe()).toHaveAttribute("src", expect.stringContaining("/embed/Jcs2Fp8jHEQ"));
  });

  // The whole reason for the facade: embedding must not cost anything until the
  // visitor asks for the video. The thumbnail is one image, the player is not.
  it("should keep the video playing on the page, not send the visitor away", async () => {
    render(<YouTubeFacade videoUrl={WATCH_URL} title="Un talk" />);

    await userEvent.click(screen.getByRole("button"));

    expect(screen.queryByRole("link")).toBeNull();
    expect(iframe()).toHaveAttribute("allowFullScreen");
  });
});

describe("YouTubeFacade — URL forms", () => {
  // The 244 imported talks are all `watch?v=`, but the admin types these by hand.
  it.each([
    ["short link", "https://youtu.be/Jcs2Fp8jHEQ"],
    ["embed link", "https://www.youtube.com/embed/Jcs2Fp8jHEQ"],
    ["with a start time", "https://www.youtube.com/watch?v=Jcs2Fp8jHEQ&t=42s"],
  ])("should read the id from a %s", (_label, url) => {
    render(<YouTubeFacade videoUrl={url} title="Un talk" />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      expect.stringContaining("Jcs2Fp8jHEQ"),
    );
  });

  // Rendering null here would silently drop the recording from the page — the
  // talk would look as if it had never been filmed.
  it("should fall back to a plain link when the id cannot be read", () => {
    const url = "https://vimeo.com/123456";
    render(<YouTubeFacade videoUrl={url} title="Un talk" />);

    expect(screen.getByRole("link", { name: /Un talk/ })).toHaveAttribute("href", url);
    expect(iframe()).toBeNull();
  });
});

describe("YouTubeFacade — the thumbnail goes through the proxy (#474)", () => {
  // Served straight from img.youtube.com, the thumbnail called Google on every
  // page load — before the visitor asked for anything, which is precisely what
  // a facade exists to prevent. It also arrived as an 80 kB JPEG for a 364 px
  // box; through /_next/image it is a 23 kB AVIF.
  it("asks next/image for it rather than YouTube directly", () => {
    render(<YouTubeFacade videoUrl={WATCH_URL} title="Un talk" />);

    // The mock renders whatever src the component passed to next/image, so a
    // raw <img> would show here as the same string — the guard below is what
    // proves the proxy can actually serve it.
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://img.youtube.com/vi/Jcs2Fp8jHEQ/maxresdefault.jpg",
    );
  });

  it.each(["img.youtube.com", "i.ytimg.com"])(
    "declares %s in next.config so the proxy accepts it",
    (hostname) => {
      // Without this the component throws "hostname is not configured" at
      // render — in production only, since vitest never loads the config.
      const config = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

      expect(config).toContain(hostname);
    },
  );

  it("falls back to hqdefault when maxresdefault does not exist", () => {
    render(<YouTubeFacade videoUrl={WATCH_URL} title="Un talk" />);

    // YouTube only generates maxresdefault above a source resolution; older
    // talks 404 on it, and the block would show an empty frame.
    fireEvent.error(screen.getByRole("img"));

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://img.youtube.com/vi/Jcs2Fp8jHEQ/hqdefault.jpg",
    );
  });
});
