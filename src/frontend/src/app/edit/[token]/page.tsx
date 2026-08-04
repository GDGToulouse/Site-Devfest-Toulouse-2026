"use client";

import { use, useEffect, useRef, useState } from "react";

import BilingualTabs from "@/components/admin/BilingualTabs";
import RichTextEditor from "@/components/admin/RichTextEditor";
import SponsorPrivateSection, { type SponsorPrivate } from "./SponsorPrivateSection";
import SponsorJobOffers, { type JobOffersData } from "./SponsorJobOffers";

type Locale = "fr" | "en";

type TalkFormat = "CONFERENCE" | "QUICKIE" | "KEYNOTE" | "WORKSHOP";
type TalkLevel = "" | "DEBUTANT" | "INTERMEDIAIRE" | "CONFIRME";
type TalkLanguage = "fr" | "en";

interface EditTalk {
  id: number;
  slug: string;
  // Single-language (#293) — in the talk's own `language`, below.
  title: string;
  description: string;
  format: TalkFormat;
  level: TalkLevel | null;
  language: TalkLanguage;
  // Organizers open editing talk by talk (#289); false means read-only.
  isSpeakerEditable: boolean;
}

interface EditData {
  kind: "speaker" | "sponsor";
  locale?: Locale;
  name: string;
  fields: Record<string, unknown>;
  // Speaker only (#229, editable per talk since #289).
  talks?: EditTalk[];
  // Sponsor only, private section (#249).
  private?: SponsorPrivate;
  // Sponsor only, job offers (#251).
  jobOffers?: JobOffersData;
}

type SocialLinks = Record<string, string>;

// This page lives outside the [locale] segment, so next-intl does not reach it.
// The recipient's language comes from the API instead (#224) — which also means
// the links already sitting in speakers' mailboxes keep working untouched.
const T = {
  fr: {
    loading: "Chargement…",
    unavailable: "Lien indisponible",
    title: "Modifier ma fiche",
    intro:
      "Complétez ou mettez à jour les informations de votre fiche. Elles seront visibles publiquement sur le site du DevFest Toulouse.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Enregistré ! Les modifications seront visibles sous peu.",
    socialLinks: "Liens sociaux",
    langFr: "Français",
    langEn: "English",
    bio: "Biographie",
    description: "Description",
    company: "Entreprise",
    city: "Ville",
    photo: "Photo",
    websiteUrl: "Site web",
    logo: "Logo",
    mySessions: "Mes sessions",
    mySessionsHint:
      "Vos conférences retenues. Lorsque la modification est ouverte, les changements sont publiés aussitôt sur le programme.",
    talkReadOnly:
      "Cette conférence n'est pas modifiable. Contactez l'organisation pour toute correction.",
    talkTitle: "Titre",
    talkDescription: "Résumé",
    talkFormat: "Format",
    talkLevel: "Niveau",
    talkLanguage: "Langue de présentation",
    levelAll: "Tous niveaux",
    format: { CONFERENCE: "Conférence", QUICKIE: "Quickie", KEYNOTE: "Keynote", WORKSHOP: "Workshop" },
    level: { DEBUTANT: "Débutant", INTERMEDIAIRE: "Intermédiaire", CONFIRME: "Confirmé" },
    language: { fr: "Français", en: "Anglais" },
    talkSaved: "Conférence enregistrée !",
    talkRejected: "Le titre est obligatoire et le résumé doit rester sous 5 000 caractères.",
    social: { linkedin: "LinkedIn", twitter: "X (Twitter)", bluesky: "Bluesky", github: "GitHub", website: "Autre site" },
    privateSection: "Informations privées",
    privateHint: "Réservé à l'organisation — ces informations ne sont jamais affichées publiquement.",
    standContacts: "Personnes présentes sur le stand",
    standContactsHint: "Leurs réseaux sociaux, pour un relais le jour J.",
    standName: "Nom",
    addStandContact: "Ajouter une personne",
    removeContact: "Retirer",
    comKit: "Kit de communication",
    comKitReceived: "Kit de com reçu",
    comKitLogoWeb: "Logo (version Web)",
    comKitLogoPrint: "Logo (version Print)",
    comKitCharter: "Charte graphique",
    comKitNotes: "Notes / autres supports",
    comKitEmailIntro:
      "Des fichiers ou informations complémentaires à transmettre qui ne tiennent pas dans un lien ? Envoyez-les par email à l'organisation.",
    comKitEmailButton: "Envoyer par email",
    comKitEmailSubject: "Compléments kit de communication — {name}",
    comKitEmailBody:
      "Bonjour,\n\nVeuillez trouver ci-joint des informations complémentaires pour {name}.\n\n[joindre les fichiers]\n",
    platinumSection: "Réservé aux partenaires Platinum",
    platinumPromoIdea: "Contenu promotionnel à mettre en avant",
    platinumPromoIdeaHint: "Vidéo, produit, campagne… que nous pourrions relayer.",
    platinumCoBuildIdea: "Idées de contenu à co-construire",
    jobOffers: "Offres d'emploi à relayer",
    jobOffersHint: "Publiées sur votre fiche et la page « Offres d'emploi des partenaires ».",
    jobOfferTitle: "Intitulé du poste",
    jobOfferDescription: "Description",
    jobOfferUrl: "Lien vers l'offre complète",
    addJobOffer: "Ajouter une offre",
    removeJobOffer: "Supprimer",
    jobOfferQuotaReached: "Vous avez atteint le nombre maximum d'offres pour votre niveau de partenariat.",
    jobOfferSaved: "Offre enregistrée !",
    jobOfferRejected: "Une valeur est invalide : le titre est obligatoire et le lien doit commencer par http:// ou https://.",
    upload: "Choisir une image…",
    uploading: "Envoi…",
    uploadHint: "JPEG, PNG, WebP ou GIF — 5 Mo max.",
    // Sponsors only: a low-resolution or margin-padded logo renders badly once
    // the higher tiers scale it up (#315). Informative, never blocking (#340).
    logoHint:
      "Logo en haute définition (largeur ≥ 1000 px), sans marge autour du logo. PNG ou WebP à fond transparent de préférence.",
    uploadError: "Envoi impossible : vérifiez que le fichier est une image de moins de 5 Mo.",
    currentImage: "Aperçu",
    orUrl: "ou collez l'adresse d'une image en ligne",
    // Com-kit assets (#374): a file to send, not a URL to type. The charter is
    // usually a PDF, hence its own wording.
    comKitUpload: "Choisir un fichier…",
    comKitUploadHintImage: "PNG, JPEG, WebP ou SVG — 5 Mo max.",
    comKitUploadHintDoc: "PDF, PNG ou JPEG — 5 Mo max.",
    comKitUploadError: "Envoi impossible : vérifiez le format et que le fichier fait moins de 5 Mo.",
    comKitRemove: "Retirer",
    comKitOpenFile: "Voir le fichier",
    rejected:
      "Une valeur est invalide : les liens doivent commencer par http:// ou https://, et les textes rester sous 5 000 caractères.",
    // Sent instead of "rejected" when a per-year field (kit com, idées
    // Platinum) has no participation to attach to (#129) — the form must not
    // be wiped, only this section's save is refused.
    noCurrentParticipation:
      "Votre entreprise ne sponsorise pas l'édition en cours : ces informations propres à l'édition ne peuvent pas être enregistrées.",
    errors: {
      invalid: "Ce lien de modification est invalide ou a été révoqué.",
      expired:
        "Ce lien a expiré. Demandez-nous un nouveau lien de modification, nous vous en enverrons un aussitôt.",
      frozen:
        "Les modifications sont clôturées à l'approche de l'événement. Contactez l'organisation si un changement est indispensable.",
      locked: "Les modifications de votre fiche ont été suspendues. Contactez l'organisation.",
      blocked: "Les modifications sont actuellement clôturées. Contactez l'organisation si nécessaire.",
    },
  },
  en: {
    loading: "Loading…",
    unavailable: "Link unavailable",
    title: "Edit my profile",
    intro:
      "Complete or update your profile information. It will be shown publicly on the DevFest Toulouse website.",
    save: "Save",
    saving: "Saving…",
    saved: "Saved! Your changes will appear shortly.",
    socialLinks: "Social links",
    langFr: "Français",
    langEn: "English",
    bio: "Biography",
    description: "Description",
    company: "Company",
    city: "City",
    photo: "Photo",
    websiteUrl: "Website",
    logo: "Logo",
    mySessions: "My sessions",
    mySessionsHint:
      "Your accepted talks. When editing is open, changes are published to the programme right away.",
    talkReadOnly:
      "This talk cannot be edited. Please contact the organizers for any correction.",
    talkTitle: "Title",
    talkDescription: "Abstract",
    talkFormat: "Format",
    talkLevel: "Level",
    talkLanguage: "Talk language",
    levelAll: "All levels",
    format: { CONFERENCE: "Conference", QUICKIE: "Quickie", KEYNOTE: "Keynote", WORKSHOP: "Workshop" },
    level: { DEBUTANT: "Beginner", INTERMEDIAIRE: "Intermediate", CONFIRME: "Advanced" },
    language: { fr: "French", en: "English" },
    talkSaved: "Talk saved!",
    talkRejected: "A title is required and the abstract must stay under 5,000 characters.",
    social: { linkedin: "LinkedIn", twitter: "X (Twitter)", bluesky: "Bluesky", github: "GitHub", website: "Other website" },
    privateSection: "Private information",
    privateHint: "Organizers only — this information is never shown publicly.",
    standContacts: "People staffing the booth",
    standContactsHint: "Their social handles, for relaying on the day.",
    standName: "Name",
    addStandContact: "Add a person",
    removeContact: "Remove",
    comKit: "Communication kit",
    comKitReceived: "Com kit received",
    comKitLogoWeb: "Logo (web version)",
    comKitLogoPrint: "Logo (print version)",
    comKitCharter: "Brand guidelines",
    comKitNotes: "Notes / other assets",
    comKitEmailIntro:
      "Extra files or information to share that don't fit in a link? Email them to the organisers.",
    comKitEmailButton: "Send by email",
    comKitEmailSubject: "Communication kit complements — {name}",
    comKitEmailBody:
      "Hello,\n\nPlease find attached some additional information for {name}.\n\n[attach the files]\n",
    platinumSection: "Platinum partners only",
    platinumPromoIdea: "Promotional content to highlight",
    platinumPromoIdeaHint: "Video, product, campaign… we could relay.",
    platinumCoBuildIdea: "Ideas for content to co-build",
    jobOffers: "Job offers to relay",
    jobOffersHint: "Published on your page and the “Partner job offers” page.",
    jobOfferTitle: "Job title",
    jobOfferDescription: "Description",
    jobOfferUrl: "Link to the full offer",
    addJobOffer: "Add an offer",
    removeJobOffer: "Delete",
    jobOfferQuotaReached: "You have reached the maximum number of offers for your sponsorship level.",
    jobOfferSaved: "Offer saved!",
    jobOfferRejected: "A value is invalid: the title is required and the link must start with http:// or https://.",
    upload: "Choose an image…",
    uploading: "Uploading…",
    uploadHint: "JPEG, PNG, WebP or GIF — 5 MB max.",
    logoHint:
      "High-resolution logo (width ≥ 1000 px), with no built-in margin. PNG or WebP with a transparent background preferred.",
    uploadError: "Upload failed: make sure the file is an image under 5 MB.",
    currentImage: "Preview",
    orUrl: "or paste the address of an online image",
    comKitUpload: "Choose a file…",
    comKitUploadHintImage: "PNG, JPEG, WebP or SVG — 5 MB max.",
    comKitUploadHintDoc: "PDF, PNG or JPEG — 5 MB max.",
    comKitUploadError: "Upload failed: check the format and that the file is under 5 MB.",
    comKitRemove: "Remove",
    comKitOpenFile: "View file",
    rejected:
      "A value is invalid: links must start with http:// or https://, and text must stay under 5,000 characters.",
    noCurrentParticipation:
      "Your company does not sponsor the current edition: this edition-specific information cannot be saved.",
    errors: {
      invalid: "This modification link is invalid or has been revoked.",
      expired:
        "This link has expired. Ask us for a new modification link and we will send one right away.",
      frozen:
        "Editing is closed as the event approaches. Contact the organisers if a change is essential.",
      locked: "Editing of your profile has been suspended. Please contact the organisers.",
      blocked: "Editing is currently closed. Please contact the organisers if needed.",
    },
  },
} as const;

type ErrorKind = keyof (typeof T)["fr"]["errors"];
type SocialKey = keyof (typeof T)["fr"]["social"];

// The API tells us *why* a link is unusable (locked / frozen / expired); an
// expired link is worth its own message since the fix is "ask for a new one",
// not "editing is over". It also returns the locale so a refusal speaks the
// recipient's language. Falls back on the status code if the body is unusable.
async function readError(res: Response): Promise<{ kind: ErrorKind; locale?: Locale }> {
  if (res.status === 404) return { kind: "invalid" };
  try {
    const body = (await res.json()) as { error?: string; locale?: Locale };
    const kind = body.error && body.error in T.fr.errors ? (body.error as ErrorKind) : "blocked";
    return { kind, locale: body.locale };
  } catch {
    // Non-JSON error body — fall through to the generic message.
    return { kind: "blocked" };
  }
}

export default function EditByTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorKind, setErrorKind] = useState<ErrorKind>("blocked");
  const [locale, setLocale] = useState<Locale>("fr");
  const [data, setData] = useState<EditData | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [social, setSocial] = useState<SocialLinks>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const t = T[locale];

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/edit/${token}`, { cache: "no-store" });
        if (!res.ok) {
          const { kind, locale: errLocale } = await readError(res);
          if (errLocale) setLocale(errLocale);
          setErrorKind(kind);
          setState("error");
          return;
        }
        const json: EditData = await res.json();
        setData(json);
        if (json.locale) setLocale(json.locale);
        const f = json.fields;
        const strFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(f)) {
          if (k === "socialLinks") continue;
          strFields[k] = (v as string) ?? "";
        }
        setForm(strFields);
        setSocial((f.socialLinks as SocialLinks) ?? {});
        setState("ready");
      } catch {
        setErrorKind("blocked");
        setState("error");
      }
    }
    void load();
  }, [token]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setSaveError("");
    const body: Record<string, unknown> = { ...form, socialLinks: social };
    const res = await fetch(`/api/edit/${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (res.ok) {
      setSaved(true);
      return;
    }

    // A rejected value (bad URL, too long) must not wipe the form the user just
    // filled in — report it in place and let them fix it. Only a link that has
    // become unusable sends them to the error page.
    if (res.status === 400) {
      setSaveError(t.rejected);
      return;
    }

    const { kind } = await readError(res);
    setErrorKind(kind);
    setState("error");
  }

  if (state === "loading") {
    return (
      <PageShell>
        <p className="py-16 text-center text-gris">{t.loading}</p>
      </PageShell>
    );
  }

  if (state === "error") {
    return (
      <PageShell>
        <div className="py-16 text-center">
          <h1 className="text-2xl font-bold text-noir">{t.unavailable}</h1>
          <p className="mt-4 text-gris">{t.errors[errorKind]}</p>
          <a
            href="mailto:contact@devfesttoulouse.fr"
            className="mt-6 inline-block font-bold text-bleu hover:underline"
          >
            contact@devfesttoulouse.fr
          </a>
        </div>
      </PageShell>
    );
  }

  const isSpeaker = data!.kind === "speaker";
  const imageField = isSpeaker ? "photoUrl" : "logoUrl";

  return (
    <PageShell>
      <div className="rounded-2xl border border-gris/15 bg-blanc p-6 shadow-sm sm:p-10">
        <h1 className="text-2xl font-bold text-noir lg:text-3xl">{t.title}</h1>
        <p className="mt-1 text-lg text-gris">{data!.name}</p>
        <p className="mt-4 max-w-prose text-sm text-gris">{t.intro}</p>

        <div className="mt-8 space-y-8">
          {/* Description / biography — language tabs (#222). Captions come from
              the recipient's locale dict, not next-intl (page is outside [locale]). */}
          <BilingualTabs
            label={isSpeaker ? t.bio : t.description}
            labels={{ fr: t.langFr, en: t.langEn }}
            isEmpty={(lang) =>
              isSpeaker
                ? !(lang === "fr" ? form.bioFr : form.bioEn)?.trim()
                : // Sponsor description is HTML — strip tags before the empty check.
                  !(lang === "fr" ? form.descriptionFr : form.descriptionEn)?.replace(/<[^>]*>/g, "").trim()
            }
            renderPanel={(lang) => {
              const field = isSpeaker
                ? lang === "fr" ? "bioFr" : "bioEn"
                : lang === "fr" ? "descriptionFr" : "descriptionEn";
              // Sponsor description is rich text (#270); speaker bio stays plain.
              if (isSpeaker) {
                return (
                  <textarea
                    value={form[field] ?? ""}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    rows={5}
                    className={inputClass}
                  />
                );
              }
              return (
                <RichTextEditor
                  label=""
                  name={`sponsor-${field}`}
                  value={form[field] ?? ""}
                  onChange={(html) => setForm({ ...form, [field]: html })}
                  showImageButton={false}
                  minHeight="180px"
                />
              );
            }}
          />

          {/* Identity fields */}
          <div className="grid gap-5 md:grid-cols-2">
            {isSpeaker ? (
              <>
                <Field label={t.company} value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
                <Field label={t.city} value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              </>
            ) : (
              <Field label={t.websiteUrl} value={form.websiteUrl} onChange={(v) => setForm({ ...form, websiteUrl: v })} />
            )}
          </div>

          {/* Logo / photo — upload with live preview, URL fallback. */}
          <ImageField
            label={isSpeaker ? t.photo : t.logo}
            token={token}
            value={form[imageField] ?? ""}
            onChange={(v) => setForm({ ...form, [imageField]: v })}
            t={t}
            hint={isSpeaker ? undefined : t.logoHint}
          />

          {/* Social links — a responsive grid, no more raw lowercase labels. */}
          <div>
            <p className="mb-3 text-sm font-semibold text-noir">{t.socialLinks}</p>
            <div className="grid gap-5 md:grid-cols-2">
              {(["linkedin", "twitter", "bluesky", "github", "website"] as const).map((key) => (
                <Field
                  key={key}
                  label={t.social[key as SocialKey]}
                  value={social[key] ?? ""}
                  onChange={(v) => setSocial({ ...social, [key]: v })}
                />
              ))}
            </div>
          </div>

          {/* Editable list of the speaker's accepted sessions (#260). Each talk
              is its own form with its own save button — the API updates one talk
              at a time and publishes it immediately. */}
          {isSpeaker && data!.talks && data!.talks.length > 0 && (
            <div className="border-t border-gris/15 pt-6">
              <p className="mb-1 text-sm font-semibold text-noir">{t.mySessions}</p>
              <p className="mb-4 text-sm text-gris">{t.mySessionsHint}</p>
              <div className="space-y-6">
                {data!.talks.map((talk) => (
                  <TalkEditor key={talk.id} talk={talk} token={token} t={t} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-gris/15 pt-6">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-[12px] bg-malachite px-6 py-3 font-bold text-blanc hover:bg-malachite/90 disabled:opacity-50"
            >
              {saving ? t.saving : t.save}
            </button>
            {saved && <span className="font-medium text-malachite">{t.saved}</span>}
          </div>

          {/* Sponsor private section (#249) — organizers only, own save button.
              Rendered after the public save so the public/private boundary is
              visually explicit. */}
          {!isSpeaker && data!.private && (
            <SponsorPrivateSection token={token} sponsorName={data!.name} initial={data!.private} t={t} />
          )}

          {/* Job offers (#251) — sponsor only, published directly. */}
          {!isSpeaker && data!.jobOffers && (
            <div className="border-t border-gris/15 pt-6">
              <SponsorJobOffers token={token} initial={data!.jobOffers} t={t} />
            </div>
          )}
          {saveError && (
            <p role="alert" className="font-medium text-terre-cuite">
              {saveError}
            </p>
          )}
        </div>
      </div>
    </PageShell>
  );
}

// A minimal branded shell: the page lives outside [locale] so it has no public
// header/footer — a logo + centred column give it just enough identity without
// pulling in the whole site navigation.
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-blanc-casse">
      <header className="border-b border-gris/10 bg-blanc">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo-devfest-96.png" alt="DevFest Toulouse" width={40} height={40} className="h-10 w-10" />
          <span className="font-bold text-noir">DevFest Toulouse</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-noir">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={5} className={inputClass} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
    </label>
  );
}

// Image field: a live preview + an upload button that pushes the file to
// /api/edit/:token/upload and writes the returned URL back into the form. The
// URL input stays as a fallback for people who prefer to link an online image.
function ImageField({
  label,
  token,
  value,
  onChange,
  t,
  hint,
}: {
  label: string;
  token: string;
  value: string;
  onChange: (v: string) => void;
  t: (typeof T)[Locale];
  // Extra guidance under the format line. Sponsors get logo requirements; a
  // speaker photo has different ones, so it stays absent there (#340).
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    setError(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/edit/${token}/upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("upload failed");
      const { url } = (await res.json()) as { url: string };
      onChange(url);
    } catch {
      setError(true);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-noir">{label}</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gris/20 bg-blanc-casse">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={t.currentImage} className="h-full w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-[11px] text-gris">{t.currentImage}</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-gris/30 bg-blanc px-4 py-2 text-sm font-medium text-noir hover:bg-blanc-casse disabled:opacity-50"
            >
              {uploading ? t.uploading : t.upload}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                if (inputRef.current) inputRef.current.value = "";
              }}
            />
            <p className="mt-1 text-xs text-gris">{t.uploadHint}</p>
            {hint && <p className="mt-1 text-xs text-gris">{hint}</p>}
          </div>
          <div>
            <label className="block">
              <span className="mb-1 block text-xs text-gris">{t.orUrl}</span>
              <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-terre-cuite">
              {t.uploadError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// A read-only value, shown when editing is closed (#289). The speaker still
// needs to see what was submitted.
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-noir">{label}</span>
      <p className="whitespace-pre-line text-sm text-noir">{value || "—"}</p>
    </div>
  );
}

// One session (#260). Read-only unless the organizers opened this talk to
// editing (#289) — format, level and language are never editable here, they
// drive the schedule. Self-contained: holds its own draft state and saves
// itself, since the API updates one talk at a time and publishes it immediately.
function TalkEditor({
  talk,
  token,
  t,
}: {
  talk: EditTalk;
  token: string;
  t: (typeof T)[Locale];
}) {
  const [title, setTitle] = useState(talk.title);
  const [description, setDescription] = useState(talk.description);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const res = await fetch(`/api/edit/${token}/talks/${talk.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      return;
    }
    setError(t.talkRejected);
  }

  // Programming metadata: shown as badges, never editable from the link (#289).
  const badges = [
    t.format[talk.format],
    talk.level ? t.level[talk.level] : t.levelAll,
    t.language[talk.language],
  ];

  return (
    <div className="rounded-lg border border-gris/15 bg-blanc-casse p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {badges.map((badge) => (
          <span key={badge} className="rounded-full bg-bleu/10 px-3 py-1 text-xs font-bold text-bleu">
            {badge}
          </span>
        ))}
      </div>

      <div className="space-y-5">
        {!talk.isSpeakerEditable ? (
          <>
            <ReadOnlyField label={t.talkTitle} value={talk.title} />
            <ReadOnlyField label={t.talkDescription} value={talk.description} />
            <p className="text-sm text-gris">{t.talkReadOnly}</p>
          </>
        ) : (
          <>
            {/* Single-language (#293): the talk is given in the language shown
                in the badges above, so there is nothing to switch between. */}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-noir">{t.talkTitle}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-noir">{t.talkDescription}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className={inputClass}
              />
            </label>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-[12px] bg-malachite px-5 py-2.5 text-sm font-bold text-blanc hover:bg-malachite/90 disabled:opacity-50"
              >
                {saving ? t.saving : t.save}
              </button>
              {saved && <span className="text-sm font-medium text-malachite">{t.talkSaved}</span>}
              {error && (
                <span role="alert" className="text-sm font-medium text-terre-cuite">
                  {error}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
