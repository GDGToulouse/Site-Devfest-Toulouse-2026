import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ListPagination from "./ListPagination";

describe("ListPagination (#572)", () => {
  it("should say which rows are shown and move to the next page", async () => {
    const onPageChange = vi.fn();
    render(<ListPagination page={2} limit={50} total={327} onPageChange={onPageChange} />);

    expect(screen.getByText("51–100 sur 327")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("should not offer a next page after the last one", () => {
    render(<ListPagination page={7} limit={50} total={327} onPageChange={vi.fn()} />);

    expect(screen.getByText("301–327 sur 327")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suivant" })).toBeDisabled();
  });

  it("should stay out of the way when everything fits on one page", () => {
    const { container } = render(<ListPagination page={1} limit={50} total={12} onPageChange={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
