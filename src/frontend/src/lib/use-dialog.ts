"use client";

import { useEffect, useRef } from "react";

/**
 * Makes a dialog accessible: Escape to close, focus trapped inside while
 * open, focus restored to the previously active element on close. Pair the
 * returned ref with the dialog's outermost element (the backdrop or the
 * dialog container itself), and give that element `role="dialog"`,
 * `aria-modal="true"` and `aria-labelledby`.
 *
 * Usage:
 *   const ref = useDialog({ open, onClose });
 *   <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="..."> ... </div>
 */
export function useDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;

    // Remember who had focus before the dialog opened so we can return
    // there on close. This keeps keyboard users from losing their place.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus inside the dialog — prefer the first focusable element,
    // fall back to the container itself (which needs tabIndex=-1).
    const focusables = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0] ?? container;
    first.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && focusables.length > 0) {
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return containerRef;
}
