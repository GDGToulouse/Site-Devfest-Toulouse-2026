"use client";

import { useId } from "react";
import { useDialog } from "@/lib/use-dialog";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "default";
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm,
  onCancel,
  variant = "default",
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  // Attach focus trap + Escape handling + focus restore even when isOpen
  // transitions; hook handles the no-op case internally.
  const containerRef = useDialog({ open: isOpen, onClose: onCancel });

  if (!isOpen) return null;

  const confirmButtonClass =
    variant === "danger"
      ? "bg-terre-cuite text-blanc hover:bg-terre-cuite/90"
      : "bg-malachite text-blanc hover:bg-malachite/90";

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
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
