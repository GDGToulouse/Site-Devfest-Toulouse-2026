import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Same faithful mock as SpeakerPhoto.test.tsx: an external src without
// `unoptimized` throws, like Next does at runtime. Without it, a bare <Image>
// would sail through jsdom and the guard would be worthless.
vi.mock("next/image", () => ({
  default: ({ src, unoptimized, alt }: { src: string; unoptimized?: boolean; alt: string }) => {
    if (typeof src === "string" && src.startsWith("http") && !unoptimized) {
      throw new Error(`Invalid src prop (${src}) on \`next/image\`: hostname is not configured`);
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { default: SpeakerCard } = await import("./SpeakerCard");

const speaker = {
  id: 1,
  slug: "ada-lovelace",
  name: "Ada Lovelace",
  photoUrl: null as string | null,
  company: "Analytical Engine",
};

describe("SpeakerCard (#352)", () => {
  it("renders a speaker whose photo lives on a third-party host", () => {
    // The card feeds /hall-of-fame since #352, so it now meets the 22 imported
    // profiles with external photos. A bare next/image would 500 the page.
    render(<SpeakerCard speaker={{ ...speaker, photoUrl: "https://pbs.twimg.com/profile_images/1/x.jpg" }} />);

    expect(screen.getByAltText("Ada Lovelace")).toBeInTheDocument();
  });

  it("links to the person's page, with no edition in the path", () => {
    render(<SpeakerCard speaker={speaker} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/speakers/ada-lovelace");
  });
});
