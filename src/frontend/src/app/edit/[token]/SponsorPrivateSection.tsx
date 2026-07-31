"use client";

import { useRef, useState } from "react";

interface StandContact {
  name?: string;
  linkedin?: string;
  twitter?: string;
  bluesky?: string;
}

export interface SponsorPrivate {
  // The sponsoring tier: `allowsPromoIdeas` gates the promo fields (#321).
  tier: { allowsPromoIdeas: boolean };
  standContacts: StandContact[];
  comKitReceived: boolean;
  comKitLogoWebUrl: string | null;
  comKitLogoPrintUrl: string | null;
  comKitCharterUrl: string | null;
  comKitNotes: string | null;
  // Platinum-only ideas (#252).
  platinumPromoIdea: string | null;
  platinumCoBuildIdea: string | null;
  // Where to email complements that don't fit as links (#271).
  sponsorContactEmail: string;
}

// Only the string labels this section needs. The parent passes its whole dict
// (which also holds nested objects like `format`); this interface picks the
// flat keys we use, so the wider dict is assignable to it.
interface Labels {
  save: string;
  saving: string;
  saved: string;
  rejected: string;
  privateSection: string;
  privateHint: string;
  standContacts: string;
  standContactsHint: string;
  standName: string;
  addStandContact: string;
  removeContact: string;
  comKit: string;
  comKitReceived: string;
  comKitLogoWeb: string;
  comKitLogoPrint: string;
  comKitCharter: string;
  comKitNotes: string;
  comKitUpload: string;
  comKitUploadHintImage: string;
  comKitUploadHintDoc: string;
  comKitUploadError: string;
  comKitRemove: string;
  comKitOpenFile: string;
  uploading: string;
  comKitEmailIntro: string;
  comKitEmailButton: string;
  comKitEmailSubject: string;
  comKitEmailBody: string;
  platinumSection: string;
  platinumPromoIdea: string;
  platinumPromoIdeaHint: string;
  platinumCoBuildIdea: string;
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

// Sponsor private information (#249): booth contacts + com kit. Organizers
// only — never rendered on public pages. Self-contained: own draft state and
// own save (PUT sends only the private fields; the profile save is separate).
export default function SponsorPrivateSection({
  token,
  sponsorName,
  initial,
  t,
}: {
  token: string;
  sponsorName: string;
  initial: SponsorPrivate;
  t: Labels;
}) {
  const [standContacts, setStandContacts] = useState<StandContact[]>(
    initial.standContacts.length ? initial.standContacts : [],
  );
  const [comKitReceived, setComKitReceived] = useState(initial.comKitReceived);
  const [comKitLogoWebUrl, setComKitLogoWebUrl] = useState(initial.comKitLogoWebUrl ?? "");
  const [comKitLogoPrintUrl, setComKitLogoPrintUrl] = useState(initial.comKitLogoPrintUrl ?? "");
  const [comKitCharterUrl, setComKitCharterUrl] = useState(initial.comKitCharterUrl ?? "");
  const [comKitNotes, setComKitNotes] = useState(initial.comKitNotes ?? "");
  const [platinumPromoIdea, setPlatinumPromoIdea] = useState(initial.platinumPromoIdea ?? "");
  const [platinumCoBuildIdea, setPlatinumCoBuildIdea] = useState(initial.platinumCoBuildIdea ?? "");
  const isPlatinum = initial.tier.allowsPromoIdeas;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function updateContact(index: number, patch: Partial<StandContact>) {
    setStandContacts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }
  function addContact() {
    setStandContacts((prev) => [...prev, {}]);
  }
  function removeContact(index: number) {
    setStandContacts((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const res = await fetch(`/api/edit/${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        standContacts,
        comKitReceived,
        comKitLogoWebUrl,
        comKitLogoPrintUrl,
        comKitCharterUrl,
        comKitNotes,
        // Only sent for Platinum; the backend ignores them otherwise anyway.
        ...(isPlatinum && { platinumPromoIdea, platinumCoBuildIdea }),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      return;
    }
    setError(t.rejected);
  }

  return (
    <section className="rounded-2xl border-2 border-dashed border-gris/25 bg-blanc-casse/60 p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <span aria-hidden className="text-lg">🔒</span>
        <h2 className="text-lg font-bold text-noir">{t.privateSection}</h2>
      </div>
      <p className="mb-6 text-sm text-gris">{t.privateHint}</p>

      {/* Booth staff social handles */}
      <div className="mb-8">
        <p className="text-sm font-semibold text-noir">{t.standContacts}</p>
        <p className="mb-3 text-sm text-gris">{t.standContactsHint}</p>
        <div className="space-y-4">
          {standContacts.map((contact, i) => (
            <div key={i} className="rounded-lg border border-gris/15 bg-blanc p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-gris">#{i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeContact(i)}
                  className="text-xs font-medium text-terre-cuite hover:underline"
                >
                  {t.removeContact}
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t.standName} value={contact.name ?? ""} onChange={(v) => updateContact(i, { name: v })} />
                <Field label="LinkedIn" value={contact.linkedin ?? ""} onChange={(v) => updateContact(i, { linkedin: v })} />
                <Field label="X (Twitter)" value={contact.twitter ?? ""} onChange={(v) => updateContact(i, { twitter: v })} />
                <Field label="Bluesky" value={contact.bluesky ?? ""} onChange={(v) => updateContact(i, { bluesky: v })} />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addContact}
          className="mt-3 rounded-lg border border-gris/30 bg-blanc px-4 py-2 text-sm font-medium text-noir hover:bg-blanc-casse"
        >
          + {t.addStandContact}
        </button>
      </div>

      {/* Communication kit */}
      <div className="mb-6">
        <p className="mb-3 text-sm font-semibold text-noir">{t.comKit}</p>
        <label className="mb-4 flex items-center gap-3">
          <input
            type="checkbox"
            checked={comKitReceived}
            onChange={(e) => setComKitReceived(e.target.checked)}
            className="h-4 w-4 rounded border-gris/40 text-malachite focus:ring-malachite/50"
          />
          <span className="text-sm text-noir">{t.comKitReceived}</span>
        </label>
        {/* Files the sponsor hands over, not URLs to type (#374). Uploads go
            through the magic-link endpoint, never the admin media library:
            this page is reachable without authentication. */}
        <div className="grid gap-4 md:grid-cols-2">
          <ComKitFileField
            label={t.comKitLogoWeb}
            token={token}
            value={comKitLogoWebUrl}
            onChange={setComKitLogoWebUrl}
            kind="image"
            t={t}
          />
          <ComKitFileField
            label={t.comKitLogoPrint}
            token={token}
            value={comKitLogoPrintUrl}
            onChange={setComKitLogoPrintUrl}
            kind="image"
            t={t}
          />
          <ComKitFileField
            label={t.comKitCharter}
            token={token}
            value={comKitCharterUrl}
            onChange={setComKitCharterUrl}
            kind="doc"
            t={t}
          />
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-noir">{t.comKitNotes}</span>
          <textarea value={comKitNotes} onChange={(e) => setComKitNotes(e.target.value)} rows={3} className={inputClass} />
        </label>
      </div>

      {/* Platinum-only promotional content (#252). Shown only to Platinum
          sponsors; the backend also refuses to write these for other levels. */}
      {isPlatinum && (
        <div className="mb-6 rounded-lg border border-jaune/40 bg-jaune/5 p-4">
          <p className="mb-3 text-sm font-semibold text-noir">💎 {t.platinumSection}</p>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-noir">{t.platinumPromoIdea}</span>
            <span className="mb-1 block text-xs text-gris">{t.platinumPromoIdeaHint}</span>
            <textarea value={platinumPromoIdea} onChange={(e) => setPlatinumPromoIdea(e.target.value)} rows={3} className={inputClass} />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-noir">{t.platinumCoBuildIdea}</span>
            <textarea value={platinumCoBuildIdea} onChange={(e) => setPlatinumCoBuildIdea(e.target.value)} rows={3} className={inputClass} />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-gris/15 pt-5">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-[12px] bg-malachite px-5 py-2.5 text-sm font-bold text-blanc hover:bg-malachite/90 disabled:opacity-50"
        >
          {saving ? t.saving : t.save}
        </button>
        {saved && <span className="text-sm font-medium text-malachite">{t.saved}</span>}
        {error && (
          <span role="alert" className="text-sm font-medium text-terre-cuite">
            {error}
          </span>
        )}
      </div>

      {/* Complements go by email — a mailto: to the sponsoring team (#271). */}
      <ComKitEmailLink email={initial.sponsorContactEmail} sponsorName={sponsorName} t={t} />
    </section>
  );
}

// Complements that don't fit as links are sent by email, not through the site
// (#271): a mailto: link opens the sponsor's own mail client, pre-filled with
// the sponsoring address, a subject and a body naming the company. No server
// send — the sponsor attaches the files and hits send themselves.
function ComKitEmailLink({ email, sponsorName, t }: { email: string; sponsorName: string; t: Labels }) {
  const subject = t.comKitEmailSubject.replace("{name}", sponsorName);
  const body = t.comKitEmailBody.replace(/\{name\}/g, sponsorName);
  const href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="mt-6 rounded-lg bg-blanc p-4">
      <p className="mb-3 text-sm text-noir">{t.comKitEmailIntro}</p>
      <a
        href={href}
        className="inline-block rounded-lg border border-gris/30 bg-blanc px-4 py-2 text-sm font-medium text-noir hover:bg-blanc-casse"
      >
        ✉ {t.comKitEmailButton}
      </a>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-noir">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
}

// A com-kit asset (#374): upload with preview and remove. Deliberately
// does NOT reuse the admin ImagePicker/FilePicker — those read the whole media
// library through adminFetch, and this page is open to anyone holding the link.
// Uploads go to /api/edit/:token/upload, which is scoped to that one sponsor.
function ComKitFileField({
  label,
  token,
  value,
  onChange,
  kind,
  t,
}: {
  label: string;
  token: string;
  value: string;
  onChange: (v: string) => void;
  kind: "image" | "doc";
  t: Labels;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);

  const accept =
    kind === "image"
      ? "image/jpeg,image/png,image/webp,image/svg+xml"
      : "application/pdf,image/jpeg,image/png";

  async function handleFile(file: File) {
    setUploading(true);
    setFailed(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/edit/${token}/upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("upload failed");
      const { url } = (await res.json()) as { url: string };
      onChange(url);
    } catch {
      setFailed(true);
    } finally {
      setUploading(false);
    }
  }

  const isImagePreview = kind === "image" && value && !value.toLowerCase().endsWith(".pdf");

  return (
    <div className="block">
      <span className="mb-1 block text-sm font-medium text-noir">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-sm font-medium text-noir hover:bg-blanc-casse disabled:opacity-50"
        >
          {uploading ? t.uploading : t.comKitUpload}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        {value && (
          <>
            {isImagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt={label} className="h-10 rounded object-contain" />
            ) : (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm text-bleu hover:underline"
              >
                {t.comKitOpenFile}
              </a>
            )}
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-sm text-terre-cuite hover:underline"
            >
              {t.comKitRemove}
            </button>
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-gris">
        {kind === "image" ? t.comKitUploadHintImage : t.comKitUploadHintDoc}
      </p>
      {failed && (
        <p role="alert" className="mt-1 text-sm font-medium text-terre-cuite">
          {t.comKitUploadError}
        </p>
      )}
    </div>
  );
}
