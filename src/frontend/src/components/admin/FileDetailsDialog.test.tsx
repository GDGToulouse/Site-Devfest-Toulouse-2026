import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #373 — a file is tagged from its sheet: tags of the media library's own, an
// unknown name created on the fly, and a name already taken reuses that tag
// instead of leaving the editor on a refusal.

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/admin-api")>()),
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));
vi.mock("./GenerateAltButton", () => ({ default: () => null }));

const { default: FileDetailsDialog } = await import("./FileDetailsDialog");

const LOGOS = { id: 1, name: "Logos", slug: "logos" };
const PHOTOS = { id: 2, name: "Photos 2024", slug: "photos-2024" };

const file = {
  filename: "1-a.pdf",
  url: "/uploads/1-a.pdf",
  size: 1000,
  uploadedAt: "2026-10-01T10:00:00Z",
  isImage: false,
  ext: ".pdf",
  alt: null,
  originalName: "brochure.pdf",
  usages: [],
  tags: [LOGOS],
};

beforeEach(() => {
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
    if (path === "/file-tags" && !options) return { status: 200, data: [LOGOS, PHOTOS] };
    if (path === "/file-tags") return { status: 201, data: { id: 3, name: "Kit presse", slug: "kit-presse" } };
    if (path.endsWith("/tags")) return { status: 200, data: { tags: [LOGOS, { id: 3, name: "Kit presse", slug: "kit-presse" }] } };
    return { status: 200, data: null };
  });
});

describe("FileDetailsDialog tags (#373)", () => {
  it("should create a tag on the fly and save the file's whole list, a document included", async () => {
    const onSaved = vi.fn();
    render(<FileDetailsDialog file={file} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText("Tags du fichier"), "Kit presse{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(adminFetch).toHaveBeenCalledWith("/files/1-a.pdf/tags", { method: "PUT", body: JSON.stringify({ tagIds: [1, 3] }) }),
    );
    expect(adminFetch).toHaveBeenCalledWith("/file-tags", { method: "POST", body: JSON.stringify({ name: "Kit presse" }) });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ tags: [LOGOS, expect.objectContaining({ id: 3 })] }));
  });

  it("should reuse the tag that already holds a name", async () => {
    adminFetch.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/file-tags" && !options) return { status: 200, data: [LOGOS] };
      if (path === "/file-tags") return { status: 409, data: null, error: "tag_exists", errorBody: { error: "tag_exists", existing: PHOTOS } };
      return { status: 200, data: { tags: [LOGOS, PHOTOS] } };
    });
    render(<FileDetailsDialog file={file} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Tags du fichier"), "photos 2024{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(adminFetch).toHaveBeenCalledWith("/files/1-a.pdf/tags", { method: "PUT", body: JSON.stringify({ tagIds: [1, 2] }) }),
    );
  });
});
