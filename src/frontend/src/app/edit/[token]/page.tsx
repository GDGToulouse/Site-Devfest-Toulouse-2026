"use client";

import { use, useEffect, useState } from "react";

interface EditData {
  kind: "speaker" | "sponsor";
  name: string;
  fields: Record<string, unknown>;
}

type SocialLinks = Record<string, string>;

export default function EditByTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorKind, setErrorKind] = useState<string>("");
  const [data, setData] = useState<EditData | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [social, setSocial] = useState<SocialLinks>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/edit/${token}`, { cache: "no-store" });
        if (!res.ok) {
          setErrorKind(res.status === 404 ? "invalid" : "blocked");
          setState("error");
          return;
        }
        const json: EditData = await res.json();
        setData(json);
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
    const body: Record<string, unknown> = { ...form, socialLinks: social };
    const res = await fetch(`/api/edit/${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
    else {
      setErrorKind(res.status === 404 ? "invalid" : "blocked");
      setState("error");
    }
  }

  if (state === "loading") {
    return <main className="mx-auto max-w-2xl px-6 py-16 text-center text-gris">Chargement…</main>;
  }

  if (state === "error") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-noir">Lien indisponible</h1>
        <p className="mt-4 text-gris">
          {errorKind === "invalid"
            ? "Ce lien de modification est invalide ou a été révoqué."
            : "Les modifications sont actuellement clôturées. Contactez l'organisation si nécessaire."}
        </p>
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
      <h1 className="text-2xl lg:text-3xl font-bold text-noir">Modifier ma fiche</h1>
      <p className="mt-1 text-gris">{data!.name}</p>

      <div className="mt-8 space-y-5">
        {isSpeaker ? (
          <>
            <Field label="Biographie (FR)" value={form.bioFr} onChange={(v) => setForm({ ...form, bioFr: v })} textarea className={inputClass} />
            <Field label="Biographie (EN)" value={form.bioEn} onChange={(v) => setForm({ ...form, bioEn: v })} textarea className={inputClass} />
            <Field label="Entreprise" value={form.company} onChange={(v) => setForm({ ...form, company: v })} className={inputClass} />
            <Field label="Ville" value={form.city} onChange={(v) => setForm({ ...form, city: v })} className={inputClass} />
            <Field label="Photo (URL)" value={form.photoUrl} onChange={(v) => setForm({ ...form, photoUrl: v })} className={inputClass} />
          </>
        ) : (
          <>
            <Field label="Description (FR)" value={form.descriptionFr} onChange={(v) => setForm({ ...form, descriptionFr: v })} textarea className={inputClass} />
            <Field label="Description (EN)" value={form.descriptionEn} onChange={(v) => setForm({ ...form, descriptionEn: v })} textarea className={inputClass} />
            <Field label="Site web" value={form.websiteUrl} onChange={(v) => setForm({ ...form, websiteUrl: v })} className={inputClass} />
            <Field label="Logo (URL)" value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} className={inputClass} />
          </>
        )}

        <div>
          <p className="block text-sm font-medium text-noir mb-2">Liens sociaux</p>
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
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {saved && <span className="text-malachite font-medium">Enregistré ! Les modifications seront visibles sous peu.</span>}
        </div>
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
