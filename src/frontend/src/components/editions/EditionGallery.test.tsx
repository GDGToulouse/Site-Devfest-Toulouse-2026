import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import fr from "../../../messages/fr.json";

// #112 — the gallery opens a photo large, goes through the others and gives
// every photo a text alternative, the media library's or a generic one.

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const { default: EditionGallery } = await import("./EditionGallery");

beforeAll(() => {
  // jsdom has no modal dialogs: open and close by the attribute.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

const photos = [
  { url: "/uploads/a.jpg", alt: "La keynote d’ouverture" },
  { url: "/uploads/b.jpg", alt: null },
];

function renderGallery() {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <EditionGallery photos={photos} year={2025} />
    </NextIntlClientProvider>,
  );
}

describe("EditionGallery (#112)", () => {
  it("should name every thumbnail, with a generic text where the library has none", () => {
    renderGallery();

    expect(screen.getByRole("button", { name: "Agrandir : La keynote d’ouverture" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agrandir : Photo du DevFest Toulouse 2025 (2)" })).toBeInTheDocument();
  });

  it("should open a photo large and go to the next one", async () => {
    renderGallery();

    await userEvent.click(screen.getByRole("button", { name: "Agrandir : La keynote d’ouverture" }));
    expect(screen.getByText("La keynote d’ouverture · 1 sur 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Suivante" }));
    expect(screen.getByText("Photo du DevFest Toulouse 2025 (2) · 2 sur 2")).toBeInTheDocument();
  });

  it("should close and give the focus back to the thumbnail", async () => {
    renderGallery();
    const thumbnail = screen.getByRole("button", { name: "Agrandir : La keynote d’ouverture" });

    await userEvent.click(thumbnail);
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(thumbnail).toHaveFocus();
  });
});
