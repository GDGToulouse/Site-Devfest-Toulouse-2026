"use client";

import { useId, useState } from "react";
import { useDialog } from "@/lib/use-dialog";

interface TypedConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  /** What the admin has to type, letter for letter, before the button works. */
  word: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// A confirmation for what cannot be undone from the screen (#774): a click is
// not enough, the word has to be typed.
export default function TypedConfirmDialog({
  isOpen,
  title,
  message,
  word,
  confirmLabel,
  onConfirm,
  onCancel,
}: TypedConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const containerRef = useDialog({ open: isOpen, onClose: onCancel });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-noir/50" onClick={onCancel}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="bg-blanc rounded-xl shadow-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="text-lg font-bold text-noir">{title}</h3>
        <p id={messageId} className="mt-2 text-sm text-gris">{message}</p>
        <label htmlFor={inputId} className="mt-4 block text-sm text-gris">
          Pour confirmer, tapez <b className="font-mono text-noir">{word}</b>
        </label>
        <input
          id={inputId}
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gris/30 text-sm font-mono"
        />
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => {
              setTyped("");
              onCancel();
            }}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              setTyped("");
              onConfirm();
            }}
            disabled={typed !== word}
            className="px-4 py-2 text-sm rounded-lg bg-terre-cuite text-blanc hover:bg-terre-cuite/90 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
