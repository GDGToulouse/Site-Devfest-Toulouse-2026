import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import SaveFeedback from "./SaveFeedback";

// SaveFeedback is the only thing telling an editor a long form was written
// (#394). What matters: it says something, screen readers hear it, a success
// fades on its own, and a failure does not — it usually needs acting on.

afterEach(() => {
  vi.useRealTimers();
});

describe("SaveFeedback", () => {
  it("renders nothing when there is no state", () => {
    const { container } = render(<SaveFeedback state={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces a success politely", () => {
    render(<SaveFeedback state={{ kind: "ok", text: "Modifications enregistrées." }} />);
    const message = screen.getByRole("status");
    expect(message).toHaveTextContent("Modifications enregistrées.");
    // Polite: a save confirmation must not cut into what is being read.
    expect(message).toHaveAttribute("aria-live", "polite");
  });

  it("announces a failure assertively", () => {
    render(<SaveFeedback state={{ kind: "error", text: "Échec de l'enregistrement." }} />);
    const message = screen.getByRole("alert");
    expect(message).toHaveTextContent("Échec de l'enregistrement.");
    expect(message).toHaveAttribute("aria-live", "assertive");
  });

  it("dismisses a success after its timeout", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <SaveFeedback
        state={{ kind: "ok", text: "Modifications enregistrées." }}
        onDismiss={onDismiss}
        successTimeout={1000}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps a failure on screen", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <SaveFeedback
        state={{ kind: "error", text: "Échec de l'enregistrement." }}
        onDismiss={onDismiss}
        successTimeout={1000}
      />,
    );

    act(() => { vi.advanceTimersByTime(5000); });

    // An error that vanishes on its own leaves the editor thinking it saved.
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
