import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #617 — import a file by its URL: the imported file is handed back, and a
// refusal stays on screen in the backend's own words (#394).

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/admin-api")>()),
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const { default: ImportFromUrl } = await import("./ImportFromUrl");

beforeEach(() => adminFetch.mockReset());

describe("ImportFromUrl (#617)", () => {
  it("should send the URL and hand back the imported file", async () => {
    adminFetch.mockResolvedValue({ status: 201, data: { url: "/uploads/1-a.png", filename: "1-a.png" } });
    const onImported = vi.fn();
    render(<ImportFromUrl onImported={onImported} />);

    await userEvent.type(screen.getByLabelText("Importer depuis une URL"), "https://example.org/logo.png");
    await userEvent.click(screen.getByRole("button", { name: "Importer" }));

    expect(adminFetch).toHaveBeenCalledWith("/files/import-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.org/logo.png" }),
    });
    expect(onImported).toHaveBeenCalledWith({ url: "/uploads/1-a.png", filename: "1-a.png" });
  });

  it("should keep the reason of a refusal on screen", async () => {
    const message = "Cette adresse pointe vers un réseau privé : elle est refusée.";
    adminFetch.mockResolvedValue({ status: 400, data: null, error: "private_ip", errorBody: { error: "private_ip", message } });
    render(<ImportFromUrl onImported={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Importer depuis une URL"), "http://10.0.0.1/x.png{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});
