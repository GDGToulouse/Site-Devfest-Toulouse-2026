import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import SponsorFeedback from "./SponsorFeedback";

// #427 — the sponsor space reported four of its five outcomes through a bare
// <p>. The text appeared, assistive tech said nothing, and an unheard failure
// reads as a success (#394).

describe("SponsorFeedback", () => {
  it("interrupts on a failure", () => {
    render(<SponsorFeedback message={{ isOk: false, text: "L'enregistrement a échoué." }} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("L'enregistrement a échoué.");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("waits its turn on a success", () => {
    render(<SponsorFeedback message={{ isOk: true, text: "Modifications enregistrées." }} />);

    // `status`, not `alert`: a save that worked has no business cutting into
    // whatever the screen reader is in the middle of saying.
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders nothing at all when there is nothing to say", () => {
    const { container } = render(<SponsorFeedback message={null} />);

    // An empty live region left in the DOM is a region that can announce
    // stray text later; there is no reason to keep one here.
    expect(container).toBeEmptyDOMElement();
  });
});
