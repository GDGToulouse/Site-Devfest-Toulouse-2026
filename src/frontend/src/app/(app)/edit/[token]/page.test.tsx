import { Suspense } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

import EditByTokenPage from "./page";

// #687 — a photo pasted as an address is imported by the backend on save. The
// form shows the imported copy on success, and on a refusal says why in the
// speaker's language without leaving the form.

vi.mock("@/components/edit/SpeakerFeedback", () => ({ default: () => null }));

const LOADED = {
  kind: "speaker",
  locale: "fr",
  name: "Ada Lovelace",
  fields: { bioFr: "", bioEn: "", company: "", city: "", photoUrl: "", socialLinks: {} },
  talks: [],
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function renderPage(saveResponse: Response) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "PUT" ? saveResponse : json(200, LOADED),
  );
  vi.stubGlobal("fetch", fetchMock);
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <EditByTokenPage params={Promise.resolve({ token: "tok" })} />
      </Suspense>,
    );
  });
  await screen.findByText("Ada Lovelace");
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EditByTokenPage — photo given by its address (#687)", () => {
  it("should show the imported copy once saved", async () => {
    await renderPage(json(200, { saved: true, photoUrl: "/uploads/123-abc.png" }));
    const urlInput = screen.getByLabelText("ou collez l'adresse d'une image en ligne");
    fireEvent.change(urlInput, { target: { value: "https://cdn.example.org/me.png" } });

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText(/Enregistré/)).toBeInTheDocument();
    expect(urlInput).toHaveValue("/uploads/123-abc.png");
  });

  it("should say why the photo was not imported, and keep the form", async () => {
    await renderPage(
      json(422, { error: "image_import_failed", reason: "unsupported_type", field: "photoUrl", message: "…" }),
    );
    const urlInput = screen.getByLabelText("ou collez l'adresse d'une image en ligne");
    fireEvent.change(urlInput, { target: { value: "https://example.org/page.html" } });

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("l'adresse ne mène pas à une image");
    expect(urlInput).toHaveValue("https://example.org/page.html");
  });
});
