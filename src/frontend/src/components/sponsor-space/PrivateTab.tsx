"use client";

import { useEffect, useState } from "react";

import { getSponsorPrivate, saveSponsorProfile, type SponsorSpacePrivate } from "@/lib/sponsor-api";
import SponsorFileField from "@/components/sponsor-space/SponsorFileField";

// The com kit and booth staff (#362) — what the company and the organisers
// exchange privately. Never rendered on the public site.
//
// Only reachable by EDITEUR and above: STAND does not get this tab at all, and
// the API refuses it too.

export default function PrivateTab({ sponsorId }: { sponsorId: number }) {
  const [data, setData] = useState<SponsorSpacePrivate | null>(null);
  const [comKitNotes, setComKitNotes] = useState("");
  const [promoIdea, setPromoIdea] = useState("");
  const [coBuildIdea, setCoBuildIdea] = useState("");
  const [logoWebUrl, setLogoWebUrl] = useState("");
  const [logoPrintUrl, setLogoPrintUrl] = useState("");
  const [charterUrl, setCharterUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ isOk: boolean; text: string } | null>(null);

  useEffect(() => {
    getSponsorPrivate(sponsorId).then(({ data }) => {
      if (!data) return;
      setData(data);
      // The current edition is the one being prepared — the only year a sponsor
      // may still edit. Ordered year-descending by the API.
      const current = data.editions[0];
      setComKitNotes(current?.comKitNotes ?? "");
      setPromoIdea(current?.platinumPromoIdea ?? "");
      setCoBuildIdea(current?.platinumCoBuildIdea ?? "");
      setLogoWebUrl(current?.comKitLogoWebUrl ?? "");
      setLogoPrintUrl(current?.comKitLogoPrintUrl ?? "");
      setCharterUrl(current?.comKitCharterUrl ?? "");
    });
  }, [sponsorId]);

  if (!data) return <p className="text-sm text-gris">Chargement…</p>;

  const current = data.editions[0];
  const allowsPromoIdeas = current?.tier.allowsPromoIdeas ?? false;

  async function save() {
    setIsSaving(true);
    setMessage(null);
    const { status } = await saveSponsorProfile(sponsorId, {
      comKitNotes,
      comKitLogoWebUrl: logoWebUrl,
      comKitLogoPrintUrl: logoPrintUrl,
      comKitCharterUrl: charterUrl,
      ...(allowsPromoIdeas ? { platinumPromoIdea: promoIdea, platinumCoBuildIdea: coBuildIdea } : {}),
    });
    setIsSaving(false);
    setMessage(
      status === 200
        ? { isOk: true, text: "Modifications enregistrées." }
        : { isOk: false, text: "L'enregistrement a échoué. Réessayez." },
    );
  }

  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-blanc-casse p-3 text-sm text-gris">
        Ces informations ne sont visibles que par vous et l&apos;équipe DevFest. Elles n&apos;apparaissent
        jamais sur le site public.
      </p>

      {current ? (
        <>
          <div className="rounded-lg border border-gris/20 p-4">
            <p className="mb-3 text-sm font-medium text-noir">
              Kit de communication — édition {current.edition.year}
            </p>
            <p className="text-sm text-gris">
              {current.comKitReceived
                ? "Reçu par l'équipe DevFest."
                : "Pas encore reçu. Déposez vos fichiers ci-dessous, puis enregistrez."}
            </p>
            <div className="mt-4 space-y-4">
              <SponsorFileField
                label="Logo web"
                hint="PNG, WebP ou SVG, fond transparent de préférence."
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                value={logoWebUrl}
                sponsorId={sponsorId}
                canEdit
                onChange={setLogoWebUrl}
              />
              <SponsorFileField
                label="Logo print"
                hint="Version haute définition ou vectorielle, pour l'impression."
                accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
                value={logoPrintUrl}
                sponsorId={sponsorId}
                canEdit
                onChange={setLogoPrintUrl}
              />
              <SponsorFileField
                label="Charte graphique"
                hint="PDF."
                accept="application/pdf"
                value={charterUrl}
                sponsorId={sponsorId}
                canEdit
                onChange={setCharterUrl}
              />
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-noir">Notes / autres supports</span>
            <textarea
              value={comKitNotes}
              onChange={(e) => setComKitNotes(e.target.value)}
              rows={4}
              className={inputClass}
            />
          </label>

          {allowsPromoIdeas && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-noir">
                  Contenu promotionnel à mettre en avant
                </span>
                <textarea
                  value={promoIdea}
                  onChange={(e) => setPromoIdea(e.target.value)}
                  rows={4}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-noir">
                  Idées de contenu à co-construire
                </span>
                <textarea
                  value={coBuildIdea}
                  onChange={(e) => setCoBuildIdea(e.target.value)}
                  rows={4}
                  className={inputClass}
                />
              </label>
            </>
          )}
        </>
      ) : (
        <p className="text-sm text-gris">
          Aucune participation en cours. Ces informations seront disponibles dès que votre
          participation à l&apos;édition en préparation sera enregistrée.
        </p>
      )}

      {data.standContacts.length > 0 && (
        <div>
          <span className="mb-2 block text-sm font-medium text-noir">Équipe sur le stand</span>
          <ul className="space-y-1 text-sm text-gris">
            {data.standContacts.map((c, i) => (
              <li key={i}>{c.name || "—"}</li>
            ))}
          </ul>
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.isOk ? "text-malachite" : "text-terre-cuite"}`}>
          {message.text}
        </p>
      )}

      {current && (
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="rounded-[12px] bg-malachite px-5 py-2.5 font-bold text-blanc transition-colors hover:bg-malachite/90 disabled:opacity-50"
        >
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </button>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";
