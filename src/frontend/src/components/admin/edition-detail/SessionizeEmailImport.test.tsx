import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #866 — the Excel export of Sessionize is sent as a file, and the report
// says what was filled, kept, or not found.

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  humanError: (_result: unknown, fallback: string) => fallback,
}));

const { default: SessionizeEmailImport } = await import("./SessionizeEmailImport");

const XLSX = new File(["fake"], "export.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

beforeEach(() => {
  adminFetch.mockReset();
});

describe("SessionizeEmailImport (#866)", () => {
  it("should send the chosen file and report what it changed", async () => {
    adminFetch.mockResolvedValue({
      status: 200,
      data: {
        added: ["Ada Lovelace"],
        unchanged: ["Grace Hopper"],
        different: [{ name: "Bob Martin", current: "bob@site.example", file: "bob@sessionize.example" }],
        notFound: ["Carl Inconnu"],
        invalid: [],
      },
    });
    render(<SessionizeEmailImport />);

    await userEvent.upload(screen.getByLabelText("Export Excel de Sessionize"), XLSX);
    await userEvent.click(screen.getByRole("button", { name: "Compléter les adresses" }));

    const [path, options] = adminFetch.mock.calls[0];
    expect(path).toBe("/import/sessionize/emails");
    expect((options.body as FormData).get("file")).toBe(XLSX);
    const report = await screen.findByRole("status");
    expect(report).toHaveTextContent("1 adresse ajoutée.");
    expect(report).toHaveTextContent("Bob Martin : bob@site.example sur le site, bob@sessionize.example dans Sessionize");
    expect(report).toHaveTextContent("Introuvables sur le site : Carl Inconnu");
  });

  it("should keep a refusal on screen", async () => {
    adminFetch.mockResolvedValue({ status: 422, data: null });
    render(<SessionizeEmailImport />);

    await userEvent.upload(screen.getByLabelText("Export Excel de Sessionize"), XLSX);
    await userEvent.click(screen.getByRole("button", { name: "Compléter les adresses" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("L'import des adresses a échoué");
  });
});
