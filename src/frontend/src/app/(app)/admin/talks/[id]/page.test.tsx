import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #636 — the replay of a talk can be entered from its sheet. The backend keeps
// YouTube only; a refused URL must say what it expects, not "save failed".

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "7" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/admin-api")>()),
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));
vi.mock("@/components/admin/AuditTrail", () => ({ default: () => null }));

const { default: TalkEditorPage } = await import("./page");

const TALK = {
  id: 7,
  slug: "ia",
  title: "IA",
  description: "",
  format: "CONFERENCE",
  level: null,
  language: "fr",
  roomId: null,
  roomLabel: null,
  room: null,
  startsAt: null,
  endsAt: null,
  categoryId: null,
  category: null,
  speakerIds: [],
  speakers: [],
  simulcastRoomIds: [],
  publicationStatus: "PUBLISHED",
  isSpeakerEditable: false,
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  editionId: 1,
  edition: { year: 2026 },
};

function answer(put: { status: number; data?: unknown; error?: string; errorBody?: Record<string, unknown> }) {
  adminFetch.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method === "PUT") return { data: null, ...put };
    if (path === "/talks/7") return { status: 200, data: TALK };
    if (path === "/editions") return { status: 200, data: [{ id: 1, year: 2026 }] };
    if (path === "/editions/1") return { status: 200, data: { venueId: null } };
    return { status: 200, data: [] };
  });
}

beforeEach(() => adminFetch.mockReset());

describe("Talk editor replay (#636)", () => {
  it("should load the replay and send a cleared one as null", async () => {
    answer({ status: 200, data: TALK });
    render(<TalkEditorPage />);

    const field = await screen.findByLabelText(/^Replay \(YouTube\)/);
    expect(field).toHaveValue("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await userEvent.clear(field);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(adminFetch).toHaveBeenCalledWith("/talks/7", expect.objectContaining({ method: "PUT" })));
    const put = adminFetch.mock.calls.find(([, options]) => options?.method === "PUT");
    expect(JSON.parse(put![1].body)).toMatchObject({ videoUrl: null });
  });

  it("should show the backend's reason when the replay is refused", async () => {
    const message = "Le replay doit être l'adresse d'une vidéo YouTube (youtube.com/watch?v=… ou youtu.be/…).";
    answer({ status: 400, error: "invalid_video_url", errorBody: { error: "invalid_video_url", field: "videoUrl", message } });
    render(<TalkEditorPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});
