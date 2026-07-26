import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
