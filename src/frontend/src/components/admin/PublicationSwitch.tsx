"use client";

import { useId, useRef, useState } from "react";

import ConfirmDialog from "@/components/admin/ConfirmDialog";

export type PublicationStatus = "DRAFT" | "PUBLISHED";
// A talk can be cancelled and a speaker's participation withdrawn (#726): off
// the site like a draft, but not work in progress.
export type TalkStatus = PublicationStatus | "CANCELLED";
export type ParticipationStatus = PublicationStatus | "WITHDRAWN";
type ClosedStatus = "CANCELLED" | "WITHDRAWN";

// The third choice of a talk or a participation (#726), and what to say about it.
export interface ClosedOption {
  status: ClosedStatus;
  // "Annulé", "Retirée".
  label: string;
  // The consequence, written under the switch while it is the current choice.
  hint: string;
  // The question asked before choosing it, and the button that confirms.
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel: string;
}

// The draft / published control of every editing screen (#632). A checkbox or a
// badge did not read as "this changes what the site shows": both options are
// now spelled out side by side, the consequence is written under them, and
// taking a live record off the site asks first.
//
// A radio group for assistive tech: one tab stop, arrows move the choice.
interface PublicationSwitchProps<S extends string> {
  value: S;
  onChange: (next: S) => void;
  // Accessible name, with its context: "Statut de la participation 2026".
  label: string;
  // The status as stored. Unpublishing asks for confirmation only when the
  // record is live on the site, not when the editor undoes an unsaved choice.
  savedValue?: S;
  // The question asked before taking the record off the site.
  unpublishMessage?: string;
  // "Publiée" for a question or a page.
  isFeminine?: boolean;
  // A link to preview the draft on the site (#618), shown under a draft.
  previewHref?: string | null;
  // Replaces the default consequence when the screen can say more (a page's
  // own address, for instance).
  hint?: string;
  // A third choice, cancelled or withdrawn (#726). Always asked for: it is a
  // decision about the event, not about the record being ready.
  closed?: ClosedOption;
  disabled?: boolean;
}

export default function PublicationSwitch<S extends string = PublicationStatus>({
  value,
  onChange,
  label,
  savedValue,
  unpublishMessage,
  isFeminine = false,
  previewHref,
  hint,
  closed,
  disabled = false,
}: PublicationSwitchProps<S>) {
  const hintId = useId();
  const [confirming, setConfirming] = useState<"unpublish" | "close" | null>(null);
  const buttons = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});
  const options = ["DRAFT", "PUBLISHED", ...(closed ? [closed.status] : [])] as S[];
  const isClosed = closed !== undefined && value === closed.status;

  const optionLabel = (status: S) =>
    status === "DRAFT"
      ? "Brouillon"
      : status === "PUBLISHED"
        ? isFeminine ? "Publiée" : "Publié"
        : closed?.label ?? status;

  function choose(next: S) {
    if (next === value || disabled) return;
    if (closed && next === closed.status && savedValue !== closed.status) {
      setConfirming("close");
      return;
    }
    if (next === "DRAFT" && savedValue === "PUBLISHED") {
      setConfirming("unpublish");
      return;
    }
    onChange(next);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = options[(options.indexOf(value) + step + options.length) % options.length];
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
        {options.map((status) => {
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
                    : status === "DRAFT"
                      ? "bg-gris text-blanc"
                      : "bg-rouge text-blanc"
                  : "text-gris hover:bg-blanc-casse hover:text-noir"
              }`}
            >
              {optionLabel(status)}
            </button>
          );
        })}
      </div>
      <p id={hintId} className="mt-1 text-xs text-gris">
        {isClosed ? closed.hint : hint ?? (value === "PUBLISHED" ? (
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
        isOpen={confirming === "unpublish"}
        title="Retirer du site ?"
        message={unpublishMessage ?? "Cette fiche ne sera plus visible sur le site."}
        confirmLabel="Retirer du site"
        variant="danger"
        onConfirm={() => {
          setConfirming(null);
          onChange("DRAFT" as S);
        }}
        onCancel={() => setConfirming(null)}
      />
      {closed && (
        <ConfirmDialog
          isOpen={confirming === "close"}
          title={closed.confirmTitle}
          message={closed.confirmMessage}
          confirmLabel={closed.confirmLabel}
          variant="danger"
          onConfirm={() => {
            setConfirming(null);
            onChange(closed.status as S);
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
