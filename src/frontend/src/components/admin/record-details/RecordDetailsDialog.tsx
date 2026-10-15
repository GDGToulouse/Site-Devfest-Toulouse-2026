"use client";

import { useId } from "react";
import Link from "next/link";

import { useDialog } from "@/lib/use-dialog";

// A read-only look at a whole record from its list (#484): the fields the public
// page never shows (contact email, com kit, notes) and what the record is linked
// to, without entering the edit form. Same shell as FileDetailsDialog.
export default function RecordDetailsDialog({
  title,
  isOpen,
  onClose,
  editHref,
  publicHref,
  previewHref,
  children,
}: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  editHref: string;
  // The public page, when there is one: a draft has none (#484)…
  publicHref?: string | null;
  // …but the team can preview it on the site (#618), through /api/preview.
  previewHref?: string | null;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const containerRef = useDialog({ open: isOpen, onClose });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-noir/50" onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-blanc rounded-xl shadow-card w-full max-w-3xl max-h-[85vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 p-4 border-b border-gris/20">
          <h2 id={titleId} className="text-lg font-bold text-noir truncate">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Fermer la boîte de dialogue" className="text-gris hover:text-noir text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">{children}</div>

        <div className="flex flex-wrap items-center justify-end gap-3 p-4 border-t border-gris/20">
          {publicHref ? (
            <a href={publicHref} target="_blank" rel="noopener noreferrer" className="text-sm text-bleu hover:underline">
              Voir sur le site
            </a>
          ) : previewHref ? (
            <a href={previewHref} target="_blank" rel="noopener noreferrer" className="text-sm text-bleu hover:underline">
              Prévisualiser sur le site
            </a>
          ) : (
            <span className="text-sm text-gris">Pas de page publique : non publié</span>
          )}
          <Link href={editHref} className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90">
            Modifier
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gris">{title}</h3>
      {children}
    </section>
  );
}

// Label / value rows. An empty value reads "—" rather than disappearing: what is
// missing is precisely what the organiser opened the panel to check.
export function DetailList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-gris">{label}</dt>
          <dd className="text-noir break-words">{isEmpty(value) ? "—" : value}</dd>
        </div>
      ))}
    </dl>
  );
}

function isEmpty(value: React.ReactNode): boolean {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

// Rich text as the site renders it (.article-content, #559). Sanitized on write.
export function RichText({ html }: { html: string | null | undefined }) {
  if (!html) return <p className="text-sm text-gris">—</p>;
  return <div className="article-content text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function DetailLoading({ error }: { error: boolean }) {
  return error ? (
    <p role="alert" className="text-sm text-terre-cuite">
      La fiche n&apos;a pas pu être chargée. Fermez et réessayez.
    </p>
  ) : (
    <p className="text-sm text-gris">Chargement…</p>
  );
}

export function statusLabel(status: "PUBLISHED" | "DRAFT"): string {
  return status === "PUBLISHED" ? "Publié" : "Brouillon";
}
