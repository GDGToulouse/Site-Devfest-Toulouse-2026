"use client";

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
  if (!isOpen) return null;

  const confirmButtonClass =
    variant === "danger"
      ? "bg-terre-cuite text-blanc hover:bg-terre-cuite/90"
      : "bg-malachite text-blanc hover:bg-malachite/90";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-noir/50">
      <div className="bg-blanc rounded-xl shadow-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold text-noir">{title}</h3>
        <p className="mt-2 text-sm text-gris">{message}</p>
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
