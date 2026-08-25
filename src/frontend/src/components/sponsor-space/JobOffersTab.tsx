"use client";

import { useEffect, useState } from "react";

import BilingualTabs from "@/components/admin/BilingualTabs";
import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  getSponsorJobOffers,
  createSponsorJobOffer,
  updateSponsorJobOffer,
  deleteSponsorJobOffer,
  type SponsorJobOffer,
} from "@/lib/sponsor-api";
import SponsorFeedback, { type SponsorMessage } from "@/components/sponsor-space/SponsorFeedback";

// The company's job offers for the current edition (#251), moved to the
// account-based space (#362). How many may be published depends on the tier
// bought this year, so the cap is read from the server rather than assumed.

interface Draft {
  title: string;
  descriptionFr: string;
  descriptionEn: string;
  url: string;
}

const EMPTY: Draft = { title: "", descriptionFr: "", descriptionEn: "", url: "" };

export default function JobOffersTab({ sponsorId, canEdit }: { sponsorId: number; canEdit: boolean }) {
  const [offers, setOffers] = useState<SponsorJobOffer[] | null>(null);
  const [quota, setQuota] = useState(0);
  const [noParticipation, setNoParticipation] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<SponsorMessage | null>(null);

  async function load() {
    const { data, status } = await getSponsorJobOffers(sponsorId);
    if (status === 422) {
      setNoParticipation(true);
      setOffers([]);
      return;
    }
    if (!data) return;
    setOffers(data.offers);
    setQuota(data.quota);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId]);

  function startEdit(offer: SponsorJobOffer) {
    setEditingId(offer.id);
    setDraft({
      title: offer.title,
      descriptionFr: offer.descriptionFr ?? "",
      descriptionEn: offer.descriptionEn ?? "",
      url: offer.url,
    });
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(EMPTY);
    setMessage(null);
  }

  async function submit() {
    if (!draft.title.trim()) {
      setMessage({ isOk: false, text: "Renseignez un intitulé de poste." });
      return;
    }
    if (!draft.url.trim()) {
      setMessage({ isOk: false, text: "Renseignez le lien vers l'offre." });
      return;
    }

    setIsBusy(true);
    setMessage(null);
    const { status, error } =
      editingId === null
        ? await createSponsorJobOffer(sponsorId, draft)
        : await updateSponsorJobOffer(sponsorId, editingId, draft);
    setIsBusy(false);

    if (status === 201 || status === 200) {
      setMessage({ isOk: true, text: editingId === null ? "Offre publiée." : "Offre mise à jour." });
      cancelEdit();
      void load();
      return;
    }
    setMessage({ isOk: false, text: submitError(error) });
  }

  async function remove(offer: SponsorJobOffer) {
    if (!window.confirm(`Retirer l'offre « ${offer.title} » ?`)) return;
    setIsBusy(true);
    setMessage(null);
    const { status } = await deleteSponsorJobOffer(sponsorId, offer.id);
    setIsBusy(false);
    if (status === 204) {
      setMessage({ isOk: true, text: "Offre retirée." });
      if (editingId === offer.id) cancelEdit();
      void load();
      return;
    }
    setMessage({ isOk: false, text: "Le retrait a échoué." });
  }

  if (!offers) return <p className="text-sm text-gris">Chargement…</p>;

  if (noParticipation) {
    return (
      <p className="text-sm text-gris">
        Aucune participation en cours. Vos offres d&apos;emploi seront disponibles dès que votre
        participation à l&apos;édition en préparation sera enregistrée.
      </p>
    );
  }

  const isAtCap = offers.length >= quota;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gris">
        Votre niveau de sponsoring vous permet de publier {quota} offre{quota > 1 ? "s" : ""}{" "}
        d&apos;emploi. {offers.length} publiée{offers.length > 1 ? "s" : ""}.
      </p>

      {offers.length > 0 && (
        <ul className="space-y-2">
          {offers.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-gris/15 bg-blanc px-3 py-2"
            >
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-medium text-noir">{o.title}</p>
                <a
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-xs text-bleu hover:underline"
                >
                  {o.url}
                </a>
              </div>
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => startEdit(o)}
                    disabled={isBusy}
                    className={`${rowActionClass} text-noir focus:ring-noir/30`}
                  >
                    Modifier<span className="sr-only"> l&apos;offre {o.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(o)}
                    disabled={isBusy}
                    className={`${rowActionClass} text-terre-cuite focus:ring-terre-cuite/50`}
                  >
                    Retirer<span className="sr-only"> l&apos;offre {o.title}</span>
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="rounded-lg border border-gris/20 bg-blanc-casse/50 p-4">
          <p className="mb-3 text-sm font-medium text-noir">
            {editingId === null ? "Publier une offre" : "Modifier l'offre"}
          </p>

          {editingId === null && isAtCap ? (
            <p className="text-sm text-gris">
              Vous avez atteint le nombre d&apos;offres de votre niveau de sponsoring. Retirez une
              offre pour en publier une autre.
            </p>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs text-gris">Intitulé du poste</span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-gris">Lien vers l&apos;offre</span>
                <input
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  placeholder="https://…"
                  className={inputClass}
                />
              </label>

              <BilingualTabs
                label="Description"
                isEmpty={(lang) => !(lang === "fr" ? draft.descriptionFr : draft.descriptionEn).trim()}
                renderPanel={(lang) => (
                  <RichTextEditor
                    label={lang === "fr" ? "Description (français)" : "Description (English)"}
                    name={`job-offer-description-${lang}`}
                    value={lang === "fr" ? draft.descriptionFr : draft.descriptionEn}
                    onChange={(v) =>
                      setDraft({ ...draft, [lang === "fr" ? "descriptionFr" : "descriptionEn"]: v })
                    }
                  />
                )}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={submit}
                  disabled={isBusy}
                  className="rounded-[12px] bg-malachite px-5 py-2.5 font-bold text-blanc transition-colors hover:bg-malachite/90 disabled:opacity-50"
                >
                  {editingId === null ? "Publier" : "Enregistrer"}
                </button>
                {editingId !== null && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isBusy}
                    className="rounded-[12px] border border-gris/30 px-5 py-2.5 font-medium text-noir hover:bg-blanc-casse disabled:opacity-50"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <SponsorFeedback message={message} />
    </div>
  );
}

function submitError(error?: string): string {
  if (error === "quota_reached") {
    return "Vous avez atteint le nombre d'offres de votre niveau de sponsoring.";
  }
  if (error === "invalid_url") {
    return "Le lien n'est pas valide. Utilisez une adresse commençant par http:// ou https://.";
  }
  if (error === "empty_title") return "Renseignez un intitulé de poste.";
  return "L'enregistrement a échoué. Réessayez.";
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

const rowActionClass =
  "inline-flex min-h-[24px] items-center rounded px-2 py-1 text-xs font-medium hover:underline disabled:opacity-50 focus:outline-none focus:ring-2";
