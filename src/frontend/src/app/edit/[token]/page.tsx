"use client";

import { use, useEffect, useRef, useState } from "react";

type Locale = "fr" | "en";

interface EditData {
  kind: "speaker" | "sponsor";
  locale?: Locale;
  name: string;
  fields: Record<string, unknown>;
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
    bioFr: "Biographie (FR)",
    bioEn: "Biographie (EN)",
    company: "Entreprise",
    city: "Ville",
    photo: "Photo",
    descriptionFr: "Description (FR)",
    descriptionEn: "Description (EN)",
    websiteUrl: "Site web",
    logo: "Logo",
    social: { linkedin: "LinkedIn", twitter: "X (Twitter)", github: "GitHub", website: "Autre site" },
    upload: "Choisir une image…",
    uploading: "Envoi…",
    uploadHint: "JPEG, PNG, WebP ou GIF — 5 Mo max.",
    uploadError: "Envoi impossible : vérifiez que le fichier est une image de moins de 5 Mo.",
    currentImage: "Aperçu",
    orUrl: "ou collez l'adresse d'une image en ligne",
    rejected:
      "Une valeur est invalide : les liens doivent commencer par http:// ou https://, et les textes rester sous 5 000 caractères.",
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
    bioFr: "Biography (FR)",
    bioEn: "Biography (EN)",
    company: "Company",
    city: "City",
    photo: "Photo",
    descriptionFr: "Description (FR)",
    descriptionEn: "Description (EN)",
    websiteUrl: "Website",
    logo: "Logo",
    social: { linkedin: "LinkedIn", twitter: "X (Twitter)", github: "GitHub", website: "Other website" },
    upload: "Choose an image…",
    uploading: "Uploading…",
    uploadHint: "JPEG, PNG, WebP or GIF — 5 MB max.",
    uploadError: "Upload failed: make sure the file is an image under 5 MB.",
    currentImage: "Preview",
    orUrl: "or paste the address of an online image",
    rejected:
      "A value is invalid: links must start with http:// or https://, and text must stay under 5,000 characters.",
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
          {/* Descriptions / biography — two columns on desktop, stacked on mobile. */}
          <div className="grid gap-5 md:grid-cols-2">
            {isSpeaker ? (
              <>
                <Field label={t.bioFr} value={form.bioFr} onChange={(v) => setForm({ ...form, bioFr: v })} textarea />
                <Field label={t.bioEn} value={form.bioEn} onChange={(v) => setForm({ ...form, bioEn: v })} textarea />
              </>
            ) : (
              <>
                <Field label={t.descriptionFr} value={form.descriptionFr} onChange={(v) => setForm({ ...form, descriptionFr: v })} textarea />
                <Field label={t.descriptionEn} value={form.descriptionEn} onChange={(v) => setForm({ ...form, descriptionEn: v })} textarea />
              </>
            )}
          </div>

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
          />

          {/* Social links — a responsive grid, no more raw lowercase labels. */}
          <div>
            <p className="mb-3 text-sm font-semibold text-noir">{t.socialLinks}</p>
            <div className="grid gap-5 md:grid-cols-2">
              {(["linkedin", "twitter", "github", "website"] as const).map((key) => (
                <Field
                  key={key}
                  label={t.social[key as SocialKey]}
                  value={social[key] ?? ""}
                  onChange={(v) => setSocial({ ...social, [key]: v })}
                />
              ))}
            </div>
          </div>

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
}: {
  label: string;
  token: string;
  value: string;
  onChange: (v: string) => void;
  t: (typeof T)["fr"];
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
