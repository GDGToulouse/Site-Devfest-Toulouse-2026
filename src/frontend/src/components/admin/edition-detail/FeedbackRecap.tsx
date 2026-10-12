"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch, humanError } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

// The recap of the audience feedback sent to the speakers (#567): only when an
// admin presses the button, after a confirmation that says who it reaches.

interface Preview {
  phase: "upcoming" | "open" | "closed";
  speakers: number;
  withoutEmail: string[];
  lastSentAt: string | null;
}

interface Report {
  sent: string[];
  withoutEmail: string[];
  failed: string[];
}

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" });
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export default function FeedbackRecap({ editionId }: { editionId: number }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);
  const [report, setReport] = useState<Report | null>(null);

  const load = useCallback(async () => {
    const { data } = await adminFetch<Preview>(`/editions/${editionId}/feedback-recap`);
    setPreview(data ?? null);
  }, [editionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    setIsConfirming(false);
    setIsSending(true);
    setFeedback(null);
    const result = await adminFetch<Report>(`/editions/${editionId}/feedback-recap`, { method: "POST" });
    setIsSending(false);
    if (result.status !== 200 || !result.data) {
      setFeedback({ kind: "error", text: humanError(result, "Le récapitulatif n'a pas pu être envoyé.") });
      return;
    }
    setReport(result.data);
    setFeedback(
      result.data.failed.length > 0
        ? { kind: "error", text: `${plural(result.data.sent.length, "e-mail")} envoyé${result.data.sent.length > 1 ? "s" : ""}, ${result.data.failed.length} en échec : relancez l'envoi.` }
        : { kind: "ok", text: `Récapitulatif envoyé à ${plural(result.data.sent.length, "speaker")}.` },
    );
    load();
  }

  if (!preview) return null;

  const reachable = preview.speakers - preview.withoutEmail.length;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-noir">Récapitulatif aux speakers</h2>
      <p className="text-sm text-gris">
        Un e-mail par speaker avec les résultats de ses sessions et les messages non masqués, dans sa langue, avec un
        lien neuf vers le détail. Les avis de test ne sont jamais envoyés. Rien ne part sans votre action.
      </p>
      <p className="text-sm text-noir">
        {preview.speakers === 0
          ? "Aucun speaker n'a encore reçu d'avis."
          : `${plural(preview.speakers, "speaker")} avec des avis, dont ${reachable} joignable${reachable > 1 ? "s" : ""} par e-mail.`}
        {preview.lastSentAt && <> Dernier envoi : {DATE_TIME.format(new Date(preview.lastSentAt))}.</>}
      </p>
      {preview.withoutEmail.length > 0 && (
        <p className="text-sm text-gris">Sans adresse de contact : {preview.withoutEmail.join(", ")}.</p>
      )}

      <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />
      {report && report.failed.length > 0 && <p className="text-sm text-rouge">En échec : {report.failed.join(", ")}.</p>}

      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        disabled={reachable === 0 || isSending}
        className="rounded-[12px] bg-bleu px-[18px] py-3 text-base font-bold text-blanc disabled:opacity-50"
      >
        {isSending ? "Envoi…" : preview.lastSentAt ? "Renvoyer le récapitulatif" : "Envoyer le récapitulatif aux speakers"}
      </button>

      <ConfirmDialog
        isOpen={isConfirming}
        title="Envoyer le récapitulatif ?"
        message={`${plural(reachable, "speaker")} ${reachable > 1 ? "vont" : "va"} recevoir un e-mail.${
          preview.phase === "open" ? " Les avis sont encore ouverts : les suivants ne figureront pas dans cet envoi." : ""
        }${preview.lastSentAt ? " Un récapitulatif a déjà été envoyé : ils le recevront une seconde fois." : ""}`}
        confirmLabel="Envoyer"
        onConfirm={send}
        onCancel={() => setIsConfirming(false)}
      />
    </section>
  );
}
