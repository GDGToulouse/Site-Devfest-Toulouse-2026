"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";

import CodeScanner from "@/components/arrivals/CodeScanner";
import { ScanLine } from "@/components/sponsor-space/ScansTab";
import { NoteField, noteErrorMessage } from "@/components/sponsor-space/ScanNote";
import { getSponsorScans, recordSponsorScan, saveSponsorScanNote, type SponsorScan } from "@/lib/sponsor-api";

// The booth's scanner (#813), on the phone of whoever stands at the stand. The
// camera is the only way in: no field to type a code, no search by name. A
// code that names no valid ticket is shown as read.

type Result = { scan: SponsorScan; isDuplicate: boolean } | { error: string };

const RECENT = 5;

export default function SponsorScanPage({ params }: { params: Promise<{ sponsorId: string }> }) {
  const { sponsorId } = use(params);
  const id = Number(sponsorId);
  const router = useRouter();

  const [state, setState] = useState<"loading" | "ready" | "no_participation" | "denied" | "unreachable">("loading");
  const [scans, setScans] = useState<SponsorScan[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, status } = await getSponsorScans(id);
    if (status === 401) {
      router.replace(`/sponsor/login?next=/sponsor/${id}/scan`);
      return;
    }
    if (data) {
      setScans(data.scans);
      setState("ready");
      return;
    }
    if (status === 422) setState("no_participation");
    // 429 included: a page reloaded too often is not a page the account may not open.
    else setState(status === 0 || status === 429 || status >= 500 ? "unreachable" : "denied");
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!Number.isInteger(id) || id <= 0) notFound();

  async function send(code: string) {
    setIsCameraOpen(false);
    setIsSending(true);
    const { data, status, message } = await recordSponsorScan(id, code);
    setIsSending(false);
    if (data) {
      setResult(data);
      setNoteDraft(data.scan.note?.text ?? "");
      setNoteError(null);
      if (!data.isDuplicate) setScans((previous) => [data.scan, ...previous]);
      return;
    }
    setResult({
      error:
        status === 429
          ? "Trop de scans en une minute : attendez quelques secondes avant le suivant."
          : status === 0
            ? "Le badge n'a pas pu être enregistré : vérifiez la connexion, puis scannez-le à nouveau."
            : message || "Le badge n'a pas pu être enregistré. Scannez-le à nouveau.",
    });
  }

  const scanned = result && "scan" in result ? result.scan : null;
  const isNoteDirty = scanned !== null && noteDraft.trim() !== (scanned.note?.text ?? "");

  // Returns false when the note could not be saved: it stays on screen, unsent.
  async function saveNote(): Promise<boolean> {
    if (!scanned) return true;
    setIsSavingNote(true);
    const { data, status, message } = await saveSponsorScanNote(id, scanned.id, noteDraft);
    setIsSavingNote(false);
    if (!data) {
      setNoteError(noteErrorMessage(status, message));
      return false;
    }
    setNoteError(null);
    setResult((current) => (current && "scan" in current ? { ...current, scan: data.scan } : current));
    setScans((previous) => previous.map((s) => (s.id === data.scan.id ? data.scan : s)));
    return true;
  }

  // A note typed but not saved goes with the next badge (#815), never lost.
  async function openCamera() {
    if (isNoteDirty && !(await saveNote())) return;
    setResult(null);
    setIsCameraOpen(true);
  }

  const known = scans.filter((s) => s.attendee).length;

  return (
    <div className="min-h-dvh bg-blanc-casse">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-noir">Scanner un badge</h1>
          <Link
            href={`/sponsor/${id}`}
            className="inline-flex min-h-11 items-center rounded-full border border-gris/30 bg-blanc px-4 text-sm font-medium text-noir hover:border-bleu"
          >
            Mon espace
          </Link>
        </div>

        {state === "loading" && <p className="text-gris">Chargement…</p>}
        {state === "denied" && <p className="text-noir">Cette page n&apos;est pas accessible avec votre compte.</p>}
        {state === "unreachable" && (
          <p role="alert" className="rounded-2xl bg-terre-cuite/10 p-4 text-noir">
            La page n&apos;a pas pu être chargée. Vérifiez votre connexion, puis rechargez-la.
          </p>
        )}
        {state === "no_participation" && (
          <p className="text-noir">
            Votre entreprise ne participe pas à l&apos;édition en cours : le scan des badges n&apos;y est pas ouvert.
          </p>
        )}

        {state === "ready" && (
          <>
            {isCameraOpen ? (
              <CodeScanner onRead={(code) => void send(code)} onClose={() => setIsCameraOpen(false)} canTypeCode={false} />
            ) : (
              <>
                {isSending && <p className="rounded-2xl bg-blanc p-6 text-center text-gris">Enregistrement…</p>}
                {result && <ResultCard result={result} />}
                <button
                  type="button"
                  onClick={() => void openCamera()}
                  disabled={isSending || isSavingNote}
                  className="min-h-16 rounded-2xl bg-malachite px-5 text-lg font-bold text-blanc transition-colors hover:bg-malachite/90 disabled:opacity-60"
                >
                  {result ? "Scanner le badge suivant" : "Ouvrir la caméra"}
                </button>
                {scanned && (
                  <NoteField
                    value={noteDraft}
                    onChange={setNoteDraft}
                    onSave={() => void saveNote()}
                    isSaving={isSavingNote}
                    isDirty={isNoteDirty}
                    error={noteError}
                    savedNote={scanned.note}
                  />
                )}
              </>
            )}

            <p className="text-sm text-gris" aria-live="polite">
              {known} contact{known > 1 ? "s" : ""} scanné{known > 1 ? "s" : ""} par votre équipe
            </p>
            {scans.length > 0 && (
              <section aria-labelledby="recent-scans">
                <h2 id="recent-scans" className="text-sm font-bold text-noir">
                  Derniers scans
                </h2>
                <ul className="divide-y divide-gris/15 rounded-xl border border-gris/20 bg-blanc px-4">
                  {scans.slice(0, RECENT).map((scan) => (
                    <ScanLine key={scan.id} scan={scan}>
                      {scan.note && <p className="whitespace-pre-line text-sm text-noir">{scan.note.text}</p>}
                    </ScanLine>
                  ))}
                </ul>
                <Link href={`/sponsor/${id}`} className="mt-2 inline-block text-sm text-bleu underline">
                  Toute la liste et l&apos;export
                </Link>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ResultCard({ result }: { result: Result }) {
  if ("error" in result) {
    return (
      <p role="alert" className="rounded-2xl bg-terre-cuite/10 p-5 text-noir">
        {result.error}
      </p>
    );
  }
  const { scan, isDuplicate } = result;
  if (!scan.attendee) {
    return (
      <div role="status" className="rounded-2xl border-2 border-terre-cuite bg-blanc p-5">
        <p className="font-bold text-terre-cuite">Code non reconnu</p>
        <p className="mt-1 break-all font-mono text-sm text-noir">{scan.code}</p>
        <p className="mt-2 text-sm text-gris">Ce n&apos;est pas un badge valide de cette édition. Il reste dans votre liste tel quel.</p>
      </div>
    );
  }
  return (
    <div role="status" className="rounded-2xl border-2 border-malachite bg-blanc p-5">
      <p className="text-sm font-medium text-noir">{isDuplicate ? "Déjà scanné" : "✓ Contact ajouté"}</p>
      <p className="mt-1 text-2xl font-bold text-noir">
        {scan.attendee.firstName} {scan.attendee.lastName}
      </p>
      {scan.attendee.company && <p className="text-lg text-gris">{scan.attendee.company}</p>}
    </div>
  );
}
