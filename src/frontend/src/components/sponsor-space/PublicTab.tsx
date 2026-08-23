"use client";

import { useState } from "react";

import BilingualTabs from "@/components/admin/BilingualTabs";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { saveSponsorProfile, type SponsorSpaceProfile } from "@/lib/sponsor-api";
import SponsorFileField from "@/components/sponsor-space/SponsorFileField";
import SponsorFeedback, { type SponsorMessage } from "@/components/sponsor-space/SponsorFeedback";

// What the public site shows about the company (#362). Read-only for STAND:
// the booth team sees the page without being able to rewrite it.

const SOCIAL_FIELDS = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "twitter", label: "X / Twitter" },
  { key: "bluesky", label: "Bluesky" },
] as const;

export default function PublicTab({
  profile,
  canEdit,
  onSaved,
}: {
  profile: SponsorSpaceProfile;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [descriptionFr, setDescriptionFr] = useState(profile.descriptionFr ?? "");
  const [descriptionEn, setDescriptionEn] = useState(profile.descriptionEn ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl ?? "");
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl ?? "");
  const [social, setSocial] = useState<Record<string, string>>(profile.socialLinks ?? {});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<SponsorMessage | null>(null);

  async function save() {
    setIsSaving(true);
    setMessage(null);
    const { status, error } = await saveSponsorProfile(profile.id, {
      descriptionFr,
      descriptionEn,
      websiteUrl,
      logoUrl,
      socialLinks: social,
    });
    setIsSaving(false);

    if (status === 200) {
      setMessage({ isOk: true, text: "Modifications enregistrées." });
      onSaved();
      return;
    }
    setMessage({
      isOk: false,
      text:
        error === "unsafe_url"
          ? "Une des adresses saisies n'est pas valide. Utilisez une URL commençant par http:// ou https://."
          : // The logo is stored per edition (#375), so it has nowhere to go when
            // the company does not sponsor the current one. Saying "failed" here
            // sent the sponsor looking for a mistake in their own input.
            error === "no_current_participation"
            ? "Votre entreprise ne sponsorise pas l'édition en cours : le logo ne peut pas être enregistré. Contactez l'équipe DevFest Toulouse."
            : "L'enregistrement a échoué. Réessayez.",
    });
  }

  return (
    <div className="space-y-6">
      {!canEdit && (
        <p className="rounded-lg bg-blanc-casse p-3 text-sm text-gris">
          Votre accès est en lecture seule. Demandez au responsable de votre équipe de vous donner
          les droits d&apos;édition.
        </p>
      )}

      {/* Both panels stay mounted (BilingualTabs hides the inactive one), so
          the editor keeps its undo history across language switches. */}
      <BilingualTabs
        label="Description"
        isEmpty={(lang) => !(lang === "fr" ? descriptionFr : descriptionEn).trim()}
        renderPanel={(lang) =>
          canEdit ? (
            <RichTextEditor
              label={lang === "fr" ? "Description (français)" : "Description (English)"}
              name={`description-${lang}`}
              value={lang === "fr" ? descriptionFr : descriptionEn}
              onChange={lang === "fr" ? setDescriptionFr : setDescriptionEn}
            />
          ) : (
            // RichTextEditor has no read-only mode; STAND gets the rendered
            // text rather than a disabled editor. Safe to inject: the field is
            // sanitized on write by sanitizeRichHtml (#270), and the public
            // sponsor page renders the very same value the same way.
            <div
              className="rounded-lg border border-gris/20 bg-blanc-casse p-3 text-sm text-noir"
              dangerouslySetInnerHTML={{ __html: lang === "fr" ? descriptionFr : descriptionEn }}
            />
          )
        }
      />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-noir">Site web</span>
        <input
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          disabled={!canEdit}
          className={inputClass}
        />
      </label>

      <div>
        <SponsorFileField
          label="Logo"
          hint="Haute définition (largeur ≥ 1000 px), sans marge autour du logo, PNG ou WebP à fond transparent de préférence."
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          value={logoUrl}
          fileName={profile.fileNames?.[logoUrl]}
          sponsorId={profile.id}
          canEdit={canEdit}
          onChange={setLogoUrl}
        />
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Aperçu du logo" className="mt-2 h-16 object-contain" />
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-noir">Réseaux sociaux</legend>
        {SOCIAL_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs text-gris">{f.label}</span>
            <input
              value={social[f.key] ?? ""}
              onChange={(e) => setSocial({ ...social, [f.key]: e.target.value })}
              disabled={!canEdit}
              className={inputClass}
            />
          </label>
        ))}
      </fieldset>

      {profile.editions.length > 0 && (
        <div>
          <span className="mb-2 block text-sm font-medium text-noir">Participations</span>
          <ul className="space-y-1">
            {profile.editions.map((e) => (
              <li key={e.editionId} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-noir">{e.edition.year}</span>
                <span className="text-gris">{e.tier.nameFr}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.publicationStatus === "PUBLISHED"
                      ? "bg-malachite/10 text-malachite"
                      : "bg-gris/10 text-gris"
                  }`}
                >
                  {e.publicationStatus === "PUBLISHED" ? "Publié" : "Brouillon"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SponsorFeedback message={message} />

      {canEdit && (
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
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50 disabled:bg-blanc-casse disabled:text-gris";
