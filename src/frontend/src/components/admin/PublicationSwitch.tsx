"use client";

import { useId, useRef, useState } from "react";

import ConfirmDialog from "@/components/admin/ConfirmDialog";

export type PublicationStatus = "DRAFT" | "PUBLISHED";

// The draft / published control of every editing screen (#632). A checkbox or a
// badge did not read as "this changes what the site shows": both options are
// now spelled out side by side, the consequence is written under them, and
// taking a live record off the site asks first.
//
// A radio group for assistive tech: one tab stop, arrows move the choice.
interface PublicationSwitchProps {
  value: PublicationStatus;
  onChange: (next: PublicationStatus) => void;
  // Accessible name, with its context: "Statut de la participation 2026".
  label: string;
  // The status as stored. Unpublishing asks for confirmation only when the
  // record is live on the site, not when the editor undoes an unsaved choice.
  savedValue?: PublicationStatus;
  // The question asked before taking the record off the site.
  unpublishMessage?: string;
  // "Publiée" for a question or a page.
  isFeminine?: boolean;
  // A link to preview the draft on the site (#618), shown under a draft.
  previewHref?: string | null;
  // Replaces the default consequence when the screen can say more (a page's
  // own address, for instance).
  hint?: string;
  disabled?: boolean;
}

const OPTIONS: PublicationStatus[] = ["DRAFT", "PUBLISHED"];

export default function PublicationSwitch({
  value,
  onChange,
  label,
  savedValue,
  unpublishMessage,
  isFeminine = false,
  previewHref,
  hint,
  disabled = false,
}: PublicationSwitchProps) {
  const hintId = useId();
  const [isConfirming, setIsConfirming] = useState(false);
  const buttons = useRef<Record<PublicationStatus, HTMLButtonElement | null>>({ DRAFT: null, PUBLISHED: null });

  const optionLabel = (status: PublicationStatus) =>
    status === "DRAFT" ? "Brouillon" : isFeminine ? "Publiée" : "Publié";

  function choose(next: PublicationStatus) {
    if (next === value || disabled) return;
    if (next === "DRAFT" && savedValue === "PUBLISHED") {
      setIsConfirming(true);
      return;
    }
    onChange(next);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next = value === "DRAFT" ? "PUBLISHED" : "DRAFT";
    buttons.current[next]?.focus();
    choose(next);
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={label}
        aria-describedby={hintId}
        className="inline-flex rounded-lg border border-gris/30 bg-blanc p-0.5"
      >
        {OPTIONS.map((status) => {
          const isChecked = value === status;
          return (
            <button
              key={status}
              ref={(el) => {
                buttons.current[status] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isChecked}
              tabIndex={isChecked ? 0 : -1}
              disabled={disabled}
              onClick={() => choose(status)}
              onKeyDown={onKeyDown}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-malachite/50 disabled:opacity-50 ${
                isChecked
                  ? status === "PUBLISHED"
                    ? "bg-malachite text-blanc"
                    : "bg-gris text-blanc"
                  : "text-gris hover:bg-blanc-casse hover:text-noir"
              }`}
            >
              {optionLabel(status)}
            </button>
          );
        })}
      </div>
      <p id={hintId} className="mt-1 text-xs text-gris">
        {hint ?? (value === "PUBLISHED" ? (
          "Visible sur le site."
        ) : (
          <>
            Invisible sur le site : seule l&apos;équipe le voit.
            {previewHref && (
              <>
                {" "}
                <a href={previewHref} target="_blank" rel="noopener noreferrer" className="text-bleu hover:underline">
                  Prévisualiser
                </a>
              </>
            )}
          </>
        ))}
      </p>

      <ConfirmDialog
        isOpen={isConfirming}
        title="Retirer du site ?"
        message={unpublishMessage ?? "Cette fiche ne sera plus visible sur le site."}
        confirmLabel="Retirer du site"
        variant="danger"
        onConfirm={() => {
          setIsConfirming(false);
          onChange("DRAFT");
        }}
        onCancel={() => setIsConfirming(false)}
      />
    </div>
  );
}
