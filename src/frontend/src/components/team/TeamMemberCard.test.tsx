import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";

import TeamMemberCard from "./TeamMemberCard";

// #110 — an organiser's links are bare icons: the network must still reach
// assistive tech, in the page's language, and absent links must not render.
const member = {
  id: 1,
  firstName: "Ada",
  lastName: "Lovelace",
  photoUrl: null,
  websiteUrl: "https://ada.example.com",
  linkedinUrl: null,
  twitterUrl: null,
  githubUrl: "https://github.com/ada",
  blueskyUrl: null,
};

function renderCard(locale: "fr" | "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <ul>
        <TeamMemberCard member={member} />
      </ul>
    </NextIntlClientProvider>,
  );
}

describe("TeamMemberCard (#110)", () => {
  it("should name each link's network for screen readers and skip the empty ones", () => {
    renderCard("fr");

    expect(screen.getByRole("link", { name: "GitHub de Ada Lovelace" })).toHaveAttribute("href", "https://github.com/ada");
    expect(screen.getByRole("link", { name: "Site web de Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("should label the links in English on the English page", () => {
    renderCard("en");

    expect(screen.getByRole("link", { name: "Ada Lovelace's GitHub" })).toBeInTheDocument();
  });
});
