"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSponsorScans, sponsorScansExportUrl, type SponsorScan } from "@/lib/sponsor-api";
import ScanNoteEditor from "@/components/sponsor-space/ScanNote";

// The people the booth met (#813): every badge scanned by the sponsor's team
// this edition, and the export. Each line is read again from the attendees, so
// a ticket corrected or cancelled since shows as it is now.

export function formatScanTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** One scan: the person, or the code as read when it names no valid ticket. `children`: its note. */
export function ScanLine({ scan, children }: { scan: SponsorScan; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
      <div className="min-w-0">
        {scan.attendee ? (
          <>
            <p className="font-medium text-noir">
              {scan.attendee.firstName} {scan.attendee.lastName}
            </p>
            {scan.attendee.company && <p className="text-sm text-gris">{scan.attendee.company}</p>}
          </>
        ) : (
          <>
            <p className="font-medium text-terre-cuite">Code non reconnu</p>
            <p className="break-all font-mono text-sm text-gris">{scan.code}</p>
          </>
        )}
      </div>
      <p className="text-xs text-gris">
        {formatScanTime(scan.scannedAt)} · {scan.scannedBy}
      </p>
      {children && <div className="w-full">{children}</div>}
    </li>
  );
}

export default function ScansTab({ sponsorId }: { sponsorId: number }) {
  const [scans, setScans] = useState<SponsorScan[] | null>(null);
  const [outcome, setOutcome] = useState<"ok" | "no_participation" | "failed">("ok");

  useEffect(() => {
    void (async () => {
      const { data, status } = await getSponsorScans(sponsorId);
      if (data) {
        setScans(data.scans);
        setOutcome("ok");
        return;
      }
      setScans([]);
      setOutcome(status === 422 ? "no_participation" : "failed");
    })();
  }, [sponsorId]);

  if (outcome === "no_participation") {
    return (
      <p className="mt-6 text-sm text-gris">
        Votre entreprise ne participe pas à l&apos;édition en cours : le scan des badges n&apos;y est pas ouvert.
      </p>
    );
  }

  const known = scans?.filter((s) => s.attendee).length ?? 0;

  return (
    <section className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-gris">
        Scannez le badge des personnes qui passent sur votre stand : vous retrouvez ici leurs nom et entreprise, et
        leur e-mail dans l&apos;export. Toute votre équipe voit la même liste.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/sponsor/${sponsorId}/scan`}
          className="inline-flex min-h-11 items-center rounded-[12px] bg-malachite px-5 font-bold text-blanc transition-colors hover:bg-malachite/90"
        >
          Scanner un badge
        </Link>
        {(scans?.length ?? 0) > 0 && (
          <a
            href={sponsorScansExportUrl(sponsorId)}
            className="inline-flex min-h-11 items-center rounded-[12px] border border-gris/30 bg-blanc px-5 font-medium text-noir hover:border-bleu"
          >
            Exporter en CSV
          </a>
        )}
      </div>

      {outcome === "failed" && (
        <p role="alert" className="rounded-xl bg-terre-cuite/10 p-4 text-sm text-terre-cuite">
          La liste n&apos;a pas pu être chargée. Vérifiez votre connexion et rechargez la page dans un instant.
        </p>
      )}

      {!scans ? (
        <p className="text-sm text-gris">Chargement…</p>
      ) : scans.length === 0 ? (
        outcome === "ok" && <p className="text-sm text-gris">Aucun badge scanné pour l&apos;instant.</p>
      ) : (
        <>
          <p className="text-sm font-medium text-noir" aria-live="polite">
            {known} contact{known > 1 ? "s" : ""}
            {scans.length > known && ` · ${scans.length - known} code${scans.length - known > 1 ? "s" : ""} non reconnu${scans.length - known > 1 ? "s" : ""}`}
          </p>
          <ul className="divide-y divide-gris/15 rounded-xl border border-gris/20 bg-blanc px-4">
            {scans.map((scan) => (
              <ScanLine key={scan.id} scan={scan}>
                <ScanNoteEditor
                  sponsorId={sponsorId}
                  scan={scan}
                  onSaved={(saved) => setScans((all) => all?.map((s) => (s.id === saved.id ? saved : s)) ?? null)}
                />
              </ScanLine>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
