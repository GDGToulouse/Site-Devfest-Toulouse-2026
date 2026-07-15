"use client";

import { use, useEffect, useState } from "react";

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
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Enregistré ! Les modifications seront visibles sous peu.",
    socialLinks: "Liens sociaux",
    bioFr: "Biographie (FR)",
    bioEn: "Biographie (EN)",
    company: "Entreprise",
    city: "Ville",
    photoUrl: "Photo (URL)",
    descriptionFr: "Description (FR)",
    descriptionEn: "Description (EN)",
    websiteUrl: "Site web",
    logoUrl: "Logo (URL)",
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
    save: "Save",
    saving: "Saving…",
    saved: "Saved! Your changes will appear shortly.",
    socialLinks: "Social links",
    bioFr: "Biography (FR)",
    bioEn: "Biography (EN)",
    company: "Company",
    city: "City",
    photoUrl: "Photo (URL)",
    descriptionFr: "Description (FR)",
    descriptionEn: "Description (EN)",
    websiteUrl: "Website",
    logoUrl: "Logo (URL)",
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
    return <main className="mx-auto max-w-2xl px-6 py-16 text-center text-gris">{t.loading}</main>;
  }

  if (state === "error") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-noir">{t.unavailable}</h1>
        <p className="mt-4 text-gris">{t.errors[errorKind]}</p>
        <a href="mailto:contact@devfesttoulouse.fr" className="mt-6 inline-block font-bold text-bleu hover:underline">
          contact@devfesttoulouse.fr
        </a>
      </main>
    );
  }

  const isSpeaker = data!.kind === "speaker";
  const inputClass =
    "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl lg:text-3xl font-bold text-noir">{t.title}</h1>
      <p className="mt-1 text-gris">{data!.name}</p>

      <div className="mt-8 space-y-5">
        {isSpeaker ? (
          <>
            <Field label={t.bioFr} value={form.bioFr} onChange={(v) => setForm({ ...form, bioFr: v })} textarea className={inputClass} />
            <Field label={t.bioEn} value={form.bioEn} onChange={(v) => setForm({ ...form, bioEn: v })} textarea className={inputClass} />
            <Field label={t.company} value={form.company} onChange={(v) => setForm({ ...form, company: v })} className={inputClass} />
            <Field label={t.city} value={form.city} onChange={(v) => setForm({ ...form, city: v })} className={inputClass} />
            <Field label={t.photoUrl} value={form.photoUrl} onChange={(v) => setForm({ ...form, photoUrl: v })} className={inputClass} />
          </>
        ) : (
          <>
            <Field label={t.descriptionFr} value={form.descriptionFr} onChange={(v) => setForm({ ...form, descriptionFr: v })} textarea className={inputClass} />
            <Field label={t.descriptionEn} value={form.descriptionEn} onChange={(v) => setForm({ ...form, descriptionEn: v })} textarea className={inputClass} />
            <Field label={t.websiteUrl} value={form.websiteUrl} onChange={(v) => setForm({ ...form, websiteUrl: v })} className={inputClass} />
            <Field label={t.logoUrl} value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} className={inputClass} />
          </>
        )}

        <div>
          <p className="block text-sm font-medium text-noir mb-2">{t.socialLinks}</p>
          {(["linkedin", "twitter", "github", "website"] as const).map((key) => (
            <div key={key} className="mb-2">
              <Field
                label={key}
                value={social[key] ?? ""}
                onChange={(v) => setSocial({ ...social, [key]: v })}
                className={inputClass}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-3 rounded-[12px] bg-malachite text-blanc font-bold hover:bg-malachite/90 disabled:opacity-50"
          >
            {saving ? t.saving : t.save}
          </button>
          {saved && <span className="text-malachite font-medium">{t.saved}</span>}
        </div>
        {saveError && (
          <p role="alert" className="text-terre-cuite font-medium">
            {saveError}
          </p>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  className: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-noir mb-1 capitalize">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className={className} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </label>
  );
}
