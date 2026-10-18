import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// #488 — an original French article carried the "automatic translation" banner.
// A translation from an empty language flagged the target anyway, the dialog
// never said the target was the original text, and the checkbox that removes
// the badge sat out of sight under the editor.

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "7" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const adminFetch = vi.fn();
vi.mock("@/lib/admin-api", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/admin-api")>()),
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

vi.mock("@/components/admin/RichTextEditor", () => ({
  default: ({ name }: { name: string }) => <textarea data-testid={name} />,
}));

const { default: ArticleEditorPage } = await import("./page");

const ARTICLE = {
  id: 7,
  slug: "les-coulisses",
  titleFr: "Les coulisses",
  titleEn: "Behind the scenes",
  contentFr: "<p>Texte d'origine</p>",
  contentEn: "<p>Machine text</p>",
  excerptFr: "",
  excerptEn: "",
  imageUrl: "",
  author: "",
  publicationStatus: "PUBLISHED",
  autoTranslatedFr: false,
  autoTranslatedEn: true,
  translatedAtFr: null,
  translatedAtEn: "2026-09-01T10:00:00.000Z",
  tags: [],
  editions: [],
};

function serve(article: Partial<typeof ARTICLE>, translate?: { status: number; body: Record<string, unknown> }) {
  adminFetch.mockImplementation((path: string) => {
    if (path === "/articles/7") return Promise.resolve({ data: { ...ARTICLE, ...article }, status: 200 });
    if (path === "/articles/7/translate-fields" && translate) {
      return Promise.resolve({
        data: null,
        status: translate.status,
        error: translate.body.error,
        errorBody: translate.body,
      });
    }
    return Promise.resolve({ data: [], status: 200 });
  });
}

beforeEach(() => {
  adminFetch.mockReset();
});

describe("Article editor — auto-translation badge (#488)", () => {
  it("warns that an original text will be overwritten", async () => {
    const user = userEvent.setup();
    serve({});
    render(<ArticleEditorPage />);

    await user.click(await screen.findByRole("tab", { name: "English · auto" }));
    await user.click(screen.getByRole("button", { name: "Traduire EN → FR" }));

    expect(screen.getByText(/le texte FR n'a pas été traduit automatiquement/)).toBeInTheDocument();
  });

  it("does not warn when the target is itself a machine translation", async () => {
    const user = userEvent.setup();
    serve({ autoTranslatedFr: true });
    render(<ArticleEditorPage />);

    await user.click(await screen.findByRole("tab", { name: "English · auto" }));
    await user.click(screen.getByRole("button", { name: "Traduire EN → FR" }));

    expect(screen.getByText(/Le contenu FR actuel sera écrasé/)).toBeInTheDocument();
    expect(screen.queryByText(/n'a pas été traduit automatiquement/)).not.toBeInTheDocument();
  });

  it("disables the translation when the source body is an emptied paragraph", async () => {
    const user = userEvent.setup();
    serve({ contentEn: "<p></p>" });
    render(<ArticleEditorPage />);

    await user.click(await screen.findByRole("tab", { name: "English · auto" }));

    expect(screen.getByRole("button", { name: "Traduire EN → FR" })).toBeDisabled();
  });

  it("shows the backend's own sentence when it refuses an empty source", async () => {
    const user = userEvent.setup();
    serve({}, { status: 400, body: { error: "empty_source", message: "Le contenu EN est vide : rien à traduire." } });
    render(<ArticleEditorPage />);

    await user.click(await screen.findByRole("tab", { name: "English · auto" }));
    await user.click(screen.getByRole("button", { name: "Traduire EN → FR" }));
    await user.click(screen.getByRole("button", { name: "Traduire" }));

    expect(await screen.findByText("Le contenu EN est vide : rien à traduire.")).toBeInTheDocument();
  });

  it("puts the review checkbox before the fields of a language marked auto", async () => {
    const user = userEvent.setup();
    serve({});
    render(<ArticleEditorPage />);

    await user.click(await screen.findByRole("tab", { name: "English · auto" }));

    const panel = document.getElementById("article-panel-en")!;
    const checkbox = screen.getByRole("checkbox", { name: /Traduit par IA, pas encore relu/ });
    expect(panel.firstElementChild).toContainElement(checkbox);
  });
});
