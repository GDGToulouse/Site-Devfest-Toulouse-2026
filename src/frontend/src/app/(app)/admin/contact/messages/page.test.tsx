import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #767 — suspicious contact messages are held in a quarantine of their own.
// The view is in the URL (the Slack alert links to it), a held message says why
// it was held, its address is not a mailto link, and releasing it is the one
// action that sends anything.
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/admin/contact/messages",
  useSearchParams: () => searchParams,
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  getAdminSession: async () => ({ role: "ADMIN" }),
}));

vi.mock("@/components/admin/ContactCategories", () => ({ default: () => null }));

const { default: ContactMessagesPage } = await import("./page");

const held = {
  id: 12,
  firstName: "Claire",
  lastName: "Dubois",
  email: "claire@prodmail.online",
  phone: null,
  company: "",
  jobTitle: "",
  categorySlug: null,
  categoryLabel: null,
  message: "Dossier ici : https://partagepro.online/fr/med/devfesttoulouse",
  isRead: true,
  createdAt: "2026-11-02T10:00:00.000Z",
  brochureDownloadCount: 0,
  brochureDownloadedAt: null,
  webhookStatus: "not_attempted",
  webhookAttemptedAt: null,
  webhookError: null,
  quarantinedAt: "2026-11-02T10:00:00.000Z",
  releasedAt: null,
  spamScore: 5,
  spamReasons: ["external_link", "risky_tld:.online", "site_pitch"],
};

function list(messages: unknown[], quarantineCount = 1) {
  return { data: { messages, total: messages.length, page: 1, totalPages: 1, quarantineCount }, status: 200 };
}

beforeEach(() => {
  replace.mockReset();
  adminFetch.mockReset();
  searchParams = new URLSearchParams();
});

describe("contact messages — quarantine (#767)", () => {
  it("should ask for the inbox without held messages by default, and switch through the URL", async () => {
    adminFetch.mockResolvedValue(list([]));
    const user = userEvent.setup();
    render(<ContactMessagesPage />);

    await screen.findByRole("button", { name: "Quarantaine (1)" });
    expect(adminFetch).toHaveBeenCalledWith("/contact/messages?page=1&limit=50");

    await user.click(screen.getByRole("button", { name: "Quarantaine (1)" }));
    expect(replace).toHaveBeenCalledWith("/admin/contact/messages?filtre=quarantaine", { scroll: false });
  });

  it("should list held messages with their reasons, a plain address, and no forward", async () => {
    searchParams = new URLSearchParams("filtre=quarantaine");
    adminFetch.mockResolvedValue(list([held]));
    const user = userEvent.setup();
    render(<ContactMessagesPage />);

    await user.click(await screen.findByRole("button", { name: /Claire Dubois/ }));

    expect(adminFetch).toHaveBeenCalledWith("/contact/messages?page=1&limit=50&filter=quarantine");
    expect(screen.getByText("Lien vers un site extérieur")).toBeInTheDocument();
    expect(screen.getByText("Domaine en .online")).toBeInTheDocument();
    expect(screen.getByText("Reprend la description du DevFest")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: held.email })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transférer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Relancer le webhook" })).not.toBeInTheDocument();
  });

  it("should release a held message, and keep a failure on screen", async () => {
    searchParams = new URLSearchParams("filtre=quarantaine");
    adminFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method === "POST") return { data: null, status: 0 };
      return list([held]);
    });
    const user = userEvent.setup();
    render(<ContactMessagesPage />);
    await user.click(await screen.findByRole("button", { name: /Claire Dubois/ }));

    await user.click(screen.getByRole("button", { name: "Libérer" }));

    expect(adminFetch).toHaveBeenCalledWith("/contact/messages/12/release", { method: "POST" });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("La libération a échoué. Réessayez dans un instant."),
    );
  });
});
