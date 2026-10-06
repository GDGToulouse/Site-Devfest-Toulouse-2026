import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// #372 — a screenshot pasted into the image picker goes down the same path as
// a dropped file: straight to the preview, where the alt text gets written.

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: ImagePickerDialog } = await import("./ImagePickerDialog");

beforeEach(() => {
  adminFetch.mockReset();
  adminFetch.mockResolvedValue({ data: [], status: 200 });
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

function paste(target: Element, file?: File) {
  fireEvent.paste(target, { clipboardData: { files: file ? [file] : [] } });
}

describe("ImagePickerDialog paste (#372)", () => {
  it("should open the preview of a pasted screenshot, from the library tab too", async () => {
    render(<ImagePickerDialog open onClose={vi.fn()} onSelect={vi.fn()} />);

    paste(screen.getByRole("dialog"), new File(["x"], "capture.png", { type: "image/png" }));

    expect(await screen.findByText("capture.png")).toBeInTheDocument();
  });

  it("should refuse a pasted file that is not an image, and say so", async () => {
    render(<ImagePickerDialog open onClose={vi.fn()} onSelect={vi.fn()} />);

    paste(screen.getByRole("dialog"), new File(["%PDF"], "brochure.pdf", { type: "application/pdf" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("n'est pas une image acceptée");
    expect(screen.queryByText("brochure.pdf")).not.toBeInTheDocument();
  });
});
