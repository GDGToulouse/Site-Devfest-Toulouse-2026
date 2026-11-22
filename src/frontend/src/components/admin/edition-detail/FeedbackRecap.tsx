"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch, humanError } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

// The recap of the audience feedback sent to the speakers (#567): only when an
// admin presses a button. Since #865, where it stands is kept per speaker: the
// main button only writes to those not served yet, and each line can send
// its own again.

export interface RecapSpeaker {
  id: number;
  name: string;
  email: string | null;
  sentAt: string | null;
  failedAt: string | null;
}

interface Overview {
  phase: "upcoming" | "open" | "closed";
  speakers: RecapSpeaker[];
}

interface Report {
  sent: string[];
  withoutEmail: string[];
  failed: string[];
}

type Status = "noEmail" | "failed" | "toSend" | "sent";

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export function recapStatus(speaker: RecapSpeaker): Status {
  if (!speaker.email) return "noEmail";
  if (speaker.sentAt) return "sent";
  return speaker.failedAt ? "failed" : "toSend";
}

// What needs a hand first: no address, then failures, then the rest.
const ORDER: Record<Status, number> = { noEmail: 0, failed: 1, toSend: 2, sent: 3 };

export function sortRecapSpeakers(speakers: RecapSpeaker[]): RecapSpeaker[] {
  return [...speakers].sort((a, b) => ORDER[recapStatus(a)] - ORDER[recapStatus(b)] || a.name.localeCompare(b.name, "fr"));
}

function StatusLabel({ speaker }: { speaker: RecapSpeaker }) {
  switch (recapStatus(speaker)) {
    case "noEmail":
      return <span className="text-terre-cuite">Sans adresse</span>;
    case "failed":
      return <span className="text-terre-cuite">Échec le {DATE_TIME.format(new Date(speaker.failedAt!))}</span>;
    case "toSend":
      return <span className="text-noir">À envoyer</span>;
    case "sent":
      return <span className="text-malachite">Envoyé le {DATE_TIME.format(new Date(speaker.sentAt!))}</span>;
  }
}

export default function FeedbackRecap({ editionId }: { editionId: number }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [sendingTo, setSendingTo] = useState<"all" | number | null>(null);
  const [feedback, setFeedback] = useState<SaveState>(null);

  const load = useCallback(async () => {
    const { data } = await adminFetch<Overview>(`/editions/${editionId}/feedback-recap`);
    setOverview(data ?? null);
  }, [editionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(target: "all" | RecapSpeaker) {
    setIsConfirming(false);
    setSendingTo(target === "all" ? "all" : target.id);
    setFeedback(null);
    const url = `/editions/${editionId}/feedback-recap${target === "all" ? "" : `/${target.id}`}`;
    const result = await adminFetch<Report>(url, { method: "POST" });
    setSendingTo(null);
    if (result.status !== 200 || !result.data) {
      setFeedback({ kind: "error", text: humanError(result, "Le récapitulatif n'a pas pu être envoyé.") });
    } else if (result.data.failed.length > 0) {
      // A failure never fades on its own (#394): it stays here and on its line.
      setFeedback({ kind: "error", text: `En échec : ${result.data.failed.join(", ")}. Réessayez.` });
    } else {
      setFeedback({ kind: "ok", text: `Récapitulatif envoyé à ${result.data.sent.join(", ") || "personne"}.` });
    }
    load();
  }

  if (!overview) return null;

  const speakers = sortRecapSpeakers(overview.speakers);
  const pending = speakers.filter((s) => ["toSend", "failed"].includes(recapStatus(s)));
  const isBusy = sendingTo !== null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-noir">Récapitulatif aux speakers</h2>
      <p className="text-sm text-gris">
        Un e-mail par speaker avec les résultats de ses sessions et les messages non masqués, dans sa langue, avec un
        lien neuf vers le détail. Les avis de test ne sont jamais envoyés. Rien ne part sans votre action.
      </p>

      {speakers.length === 0 ? (
        <p className="text-sm text-noir">Aucun speaker n&apos;a encore reçu d&apos;avis.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Envoi du récapitulatif, speaker par speaker</caption>
            <thead>
              <tr className="text-left text-gris">
                <th scope="col" className="py-2 pr-4 font-medium">Speaker</th>
                <th scope="col" className="py-2 pr-4 font-medium">Adresse</th>
                <th scope="col" className="py-2 pr-4 font-medium">État</th>
                <th scope="col" className="py-2 font-medium"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {speakers.map((speaker) => (
                <tr key={speaker.id} className="border-t border-gris/20">
                  <td className="py-2 pr-4">
                    <Link href={`/admin/speakers/${speaker.id}`} className="text-bleu hover:underline">
                      {speaker.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-noir break-all">{speaker.email ?? "—"}</td>
                  <td className="py-2 pr-4"><StatusLabel speaker={speaker} /></td>
                  <td className="py-2 text-right">
                    {speaker.email && (
                      <button
                        type="button"
                        onClick={() => send(speaker)}
                        disabled={isBusy}
                        className="text-bleu hover:underline disabled:opacity-50"
                        aria-label={`${speaker.sentAt ? "Renvoyer" : "Envoyer"} le récapitulatif à ${speaker.name}`}
                      >
                        {sendingTo === speaker.id ? "Envoi…" : speaker.sentAt ? "Renvoyer" : "Envoyer"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />

      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        disabled={pending.length === 0 || isBusy}
        className="rounded-[12px] bg-bleu px-[18px] py-3 text-base font-bold text-blanc disabled:opacity-50"
      >
        {sendingTo === "all"
          ? "Envoi…"
          : pending.length === 0
            ? speakers.some((s) => s.sentAt)
              ? "Tous les speakers joignables l'ont reçu"
              : "Aucun speaker joignable par e-mail"
            : pending.length === 1
              ? "Envoyer au speaker pas encore servi"
              : `Envoyer aux ${pending.length} speakers pas encore servis`}
      </button>

      <ConfirmDialog
        isOpen={isConfirming}
        title="Envoyer le récapitulatif ?"
        message={`${plural(pending.length, "speaker")} ${pending.length > 1 ? "vont" : "va"} recevoir un e-mail : ${pending.map((s) => s.name).join(", ")}.${
          overview.phase === "open" ? " Les avis sont encore ouverts : les suivants ne figureront pas dans cet envoi." : ""
        } Ceux qui l'ont déjà reçu ne le recevront pas une seconde fois.`}
        confirmLabel="Envoyer"
        onConfirm={() => send("all")}
        onCancel={() => setIsConfirming(false)}
      />
    </section>
  );
}
