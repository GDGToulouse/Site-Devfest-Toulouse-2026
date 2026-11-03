import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import FileSearch, { EMPTY_FILE_SEARCH, fileSearchParams, parseFileSearch } from "./FileSearch";

// #768 — finding a file by text. The name is always searched; the alt text and
// the tags only when their box is ticked.

describe("fileSearchParams (#768)", () => {
  it("should send nothing without text, whatever the boxes", () => {
    expect(fileSearchParams({ text: "  ", alt: true, tags: true })).toEqual({});
  });

  it("should search the name and its users by default, leaving `in` to the API", () => {
    expect(fileSearchParams({ text: " diagora ", alt: false, tags: false })).toEqual({ q: "diagora" });
  });

  it("should add the ticked fields to the default ones", () => {
    expect(fileSearchParams({ text: "logo", alt: true, tags: true })).toEqual({ q: "logo", in: "name,usages,alt,tags" });
  });

  it("should read back what the page keeps in its URL", () => {
    expect(parseFileSearch("logo", "tags")).toEqual({ text: "logo", alt: false, tags: true });
  });
});

describe("FileSearch (#768)", () => {
  const onChange = vi.fn();
  beforeEach(() => onChange.mockReset());

  it("should search once typing pauses, not on every letter", async () => {
    render(<FileSearch value={EMPTY_FILE_SEARCH} onChange={onChange} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher un fichier" }), { target: { value: "diag" } });

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ text: "diag", alt: false, tags: false }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("should widen the search at once when a box is ticked", () => {
    render(<FileSearch value={{ text: "logo", alt: false, tags: false }} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Tags" }));

    expect(onChange).toHaveBeenCalledWith({ text: "logo", alt: false, tags: true });
  });

  it("should leave both boxes unticked by default", () => {
    render(<FileSearch value={EMPTY_FILE_SEARCH} onChange={onChange} />);

    expect(screen.getByRole("checkbox", { name: "Texte alternatif" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Tags" })).not.toBeChecked();
  });
});
