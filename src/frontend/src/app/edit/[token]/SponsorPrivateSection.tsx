"use client";

import { useState } from "react";

type SponsorLevel = "PLATINUM" | "GOLD" | "SILVER" | "SOUTIEN" | "COMMUNAUTE";

interface StandContact {
  name?: string;
  linkedin?: string;
  twitter?: string;
  bluesky?: string;
}

export interface SponsorPrivate {
  level: SponsorLevel;
  standContacts: StandContact[];
  comKitReceived: boolean;
  comKitLogoWebUrl: string | null;
  comKitLogoPrintUrl: string | null;
  comKitCharterUrl: string | null;
  comKitNotes: string | null;
  // Platinum-only ideas (#252).
  platinumPromoIdea: string | null;
  platinumCoBuildIdea: string | null;
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
  comKitEmailIntro: string;
  comKitEmailButton: string;
  comKitEmailMessage: string;
  comKitEmailSending: string;
  comKitEmailSent: string;
  comKitEmailError: string;
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
  initial,
  t,
}: {
  token: string;
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
  const isPlatinum = initial.level === "PLATINUM";
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
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t.comKitLogoWeb} value={comKitLogoWebUrl} onChange={setComKitLogoWebUrl} />
          <Field label={t.comKitLogoPrint} value={comKitLogoPrintUrl} onChange={setComKitLogoPrintUrl} />
          <Field label={t.comKitCharter} value={comKitCharterUrl} onChange={setComKitCharterUrl} />
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

      {/* Send com-kit complements by email */}
      <ComKitEmail token={token} t={t} />
    </section>
  );
}

// Lets the sponsor ask the organizers to collect files that don't fit as links
// (#249). Posts to a dedicated endpoint that emails the sponsoring team with
// Reply-To set to the sponsor.
function ComKitEmail({ token, t }: { token: string; t: Labels }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function send() {
    setSending(true);
    setSent(false);
    setError(false);
    const res = await fetch(`/api/edit/${token}/com-kit-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setSending(false);
    if (res.ok) {
      setSent(true);
      setMessage("");
      return;
    }
    setError(true);
  }

  return (
    <div className="mt-6 rounded-lg bg-blanc p-4">
      <p className="mb-2 text-sm text-noir">{t.comKitEmailIntro}</p>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-gris">{t.comKitEmailMessage}</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className={inputClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="rounded-lg border border-gris/30 bg-blanc px-4 py-2 text-sm font-medium text-noir hover:bg-blanc-casse disabled:opacity-50"
        >
          {sending ? t.comKitEmailSending : t.comKitEmailButton}
        </button>
        {sent && <span className="text-sm font-medium text-malachite">{t.comKitEmailSent}</span>}
        {error && (
          <span role="alert" className="text-sm font-medium text-terre-cuite">
            {t.comKitEmailError}
          </span>
        )}
      </div>
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
