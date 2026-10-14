import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #377 — an image pasted into the editor goes in first; its alt text is asked
// right after, stored on the file like a picker upload, and skippable.
const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: PastedImageAltDialog } = await import("./PastedImageAltDialog");

const IMAGE = { filename: "1791963273362-3ffa021e.png", url: "/uploads/1791963273362-3ffa021e.png" };

beforeEach(() => {
  adminFetch.mockReset();
  adminFetch.mockResolvedValue({ data: { alt: "x" }, status: 200 });
});

describe("PastedImageAltDialog (#377)", () => {
  it("stores the description on the file and hands it back for the image", async () => {
    const onSaved = vi.fn();
    render(<PastedImageAltDialog image={IMAGE} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText("Texte alternatif"), "Le public dans l'amphi");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Le public dans l'amphi"));
    expect(adminFetch).toHaveBeenCalledWith(`/files/${IMAGE.filename}/metadata`, {
      method: "PUT",
      body: JSON.stringify({ alt: "Le public dans l'amphi" }),
    });
  });

  it("can be skipped, writing nothing", async () => {
    const onClose = vi.fn();
    render(<PastedImageAltDialog image={IMAGE} onClose={onClose} onSaved={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Plus tard" }));

    expect(onClose).toHaveBeenCalled();
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it("keeps the prompt open and says so when the description cannot be stored", async () => {
    adminFetch.mockResolvedValue({ data: null, status: 0 });
    const onSaved = vi.fn();
    render(<PastedImageAltDialog image={IMAGE} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText("Texte alternatif"), "Une description");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("n'a pas pu être enregistré");
    expect(onSaved).not.toHaveBeenCalled();
  });
});
