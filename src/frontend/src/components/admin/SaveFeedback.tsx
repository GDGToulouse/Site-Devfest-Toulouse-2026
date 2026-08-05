"use client";

import { useEffect, useState } from "react";

// Feedback after a save (#394). The editor screens used to redirect to their
// list with no message at all — the same outcome as pressing Cancel, so nothing
// told the editor whether a long form had actually been written.
//
// Announced to assistive tech: `role="status"` rather than `role="alert"` for a
// success (polite, does not interrupt), `role="alert"` for a failure.

export type SaveState = { kind: "ok" | "error"; text: string } | null;

interface SaveFeedbackProps {
  state: SaveState;
  // Cleared by the parent so the message does not linger over a form the editor
  // has started changing again. Omit to keep it until the next save.
  onDismiss?: () => void;
  // How long a success stays before fading, in ms. Failures never auto-dismiss:
  // they usually need the editor to do something about them.
  successTimeout?: number;
}

export default function SaveFeedback({ state, onDismiss, successTimeout = 4000 }: SaveFeedbackProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(!!state);
    if (!state || state.kind !== "ok" || !onDismiss) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, successTimeout);
    return () => clearTimeout(timer);
  }, [state, onDismiss, successTimeout]);

  if (!state || !isVisible) return null;

  const isOk = state.kind === "ok";
  return (
    <p
      role={isOk ? "status" : "alert"}
      aria-live={isOk ? "polite" : "assertive"}
      className={`rounded-lg px-3 py-2 text-sm ${
        isOk ? "bg-malachite/10 text-malachite" : "bg-terre-cuite/10 text-terre-cuite"
      }`}
    >
      {state.text}
    </p>
  );
}
