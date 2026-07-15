"use client";

import { useState } from "react";

import ConfirmDialog from "@/components/admin/ConfirmDialog";

type PendingAction =
  | { kind: "status"; value: "DRAFT" | "PUBLISHED" }
  | { kind: "featured"; value: boolean };

interface BulkActionBarProps {
  count: number;
  // Singular/plural entity name used in labels, e.g. "speaker" / "speakers".
  entitySingular: string;
  entityPlural: string;
  onSetStatus: (value: "DRAFT" | "PUBLISHED") => Promise<void>;
  // Provided only for entities that support "featured" (speakers).
  onSetFeatured?: (value: boolean) => Promise<void>;
  onClear: () => void;
}

export default function BulkActionBar({
  count,
  entitySingular,
  entityPlural,
  onSetStatus,
  onSetFeatured,
  onClear,
}: BulkActionBarProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const noun = count > 1 ? entityPlural : entitySingular;

  const confirmMessage = (() => {
    if (!pending) return "";
    if (pending.kind === "status") {
      const verb = pending.value === "PUBLISHED" ? "Publier" : "Repasser en brouillon";
      return `${verb} ${count} ${noun} ?`;
    }
    const verb = pending.value ? "Mettre à la une" : "Retirer de la une";
    return `${verb} ${count} ${noun} ?`;
  })();

  const apply = async () => {
    if (!pending) return;
    setIsApplying(true);
    try {
      if (pending.kind === "status") await onSetStatus(pending.value);
      else if (onSetFeatured) await onSetFeatured(pending.value);
    } finally {
      setIsApplying(false);
      setPending(null);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-malachite/30 bg-malachite/5 px-4 py-3">
      <span className="text-sm font-medium text-noir">
        {count} {noun} sélectionné{count > 1 ? "s" : ""}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPending({ kind: "status", value: "PUBLISHED" })}
          className="rounded-lg bg-malachite px-3 py-1.5 text-sm font-medium text-blanc hover:bg-malachite/90"
        >
          Publier
        </button>
        <button
          onClick={() => setPending({ kind: "status", value: "DRAFT" })}
          className="rounded-lg border border-gris/30 px-3 py-1.5 text-sm text-gris hover:bg-blanc-casse"
        >
          Repasser en brouillon
        </button>
        {onSetFeatured && (
          <>
            <button
              onClick={() => setPending({ kind: "featured", value: true })}
              className="rounded-lg border border-gris/30 px-3 py-1.5 text-sm text-gris hover:bg-blanc-casse"
            >
              Mettre à la une
            </button>
            <button
              onClick={() => setPending({ kind: "featured", value: false })}
              className="rounded-lg border border-gris/30 px-3 py-1.5 text-sm text-gris hover:bg-blanc-casse"
            >
              Retirer de la une
            </button>
          </>
        )}
      </div>

      <button
        onClick={onClear}
        className="ml-auto text-sm text-gris hover:underline"
      >
        Désélectionner
      </button>

      <ConfirmDialog
        isOpen={pending !== null}
        title="Confirmer l'action groupée"
        message={confirmMessage}
        confirmLabel={isApplying ? "Application…" : "Confirmer"}
        onConfirm={apply}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
