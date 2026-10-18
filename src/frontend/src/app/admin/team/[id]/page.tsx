"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { adminFetch, humanError } from "@/lib/admin-api";
import ImagePickerDialog from "@/components/admin/ImagePickerDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import TrashButton from "@/components/admin/TrashButton";
import AuditTrail from "@/components/admin/AuditTrail";

// An organiser of the DevFest (#110): first name, last name, photo, five links
// (decision on the issue: no role), and the editions they organised. Shared
// across years like a speaker; the public page shows the featured edition's.

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  blueskyUrl: string | null;
  editions: { id: number; year: number }[];
}

type LinkField = "websiteUrl" | "linkedinUrl" | "twitterUrl" | "githubUrl" | "blueskyUrl";

interface Form {
  firstName: string;
  lastName: string;
  photoUrl: string;
  links: Record<LinkField, string>;
  editionIds: number[];
}

const LINK_FIELDS: { field: LinkField; label: string; placeholder: string }[] = [
  { field: "websiteUrl", label: "Site web", placeholder: "https://…" },
  { field: "linkedinUrl", label: "LinkedIn", placeholder: "https://www.linkedin.com/in/…" },
  { field: "twitterUrl", label: "X (Twitter)", placeholder: "https://x.com/…" },
  { field: "githubUrl", label: "GitHub", placeholder: "https://github.com/…" },
  { field: "blueskyUrl", label: "Bluesky", placeholder: "https://bsky.app/profile/…" },
];

const FIELD_LABELS: Record<string, string> = {
  firstName: "Le prénom",
  lastName: "Le nom",
  photoUrl: "La photo",
  ...Object.fromEntries(LINK_FIELDS.map((l) => [l.field, `Le lien ${l.label}`])),
};

const EMPTY: Form = {
  firstName: "",
  lastName: "",
  photoUrl: "",
  links: { websiteUrl: "", linkedinUrl: "", twitterUrl: "", githubUrl: "", blueskyUrl: "" },
  editionIds: [],
};

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";

export default function TeamMemberEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";
  const memberId = isNew ? null : Number(params.id);

  const [form, setForm] = useState<Form>(EMPTY);
  const [editions, setEditions] = useState<{ id: number; year: number }[]>([]);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(null);

  useEffect(() => {
    adminFetch<{ id: number; year: number }[]>("/editions").then(({ data }) => {
      const sorted = [...(data ?? [])].sort((a, b) => b.year - a.year);
      setEditions(sorted);
      // A new organiser most likely joins the edition being prepared.
      if (isNew && sorted[0]) setForm((f) => ({ ...f, editionIds: [sorted[0].id] }));
    });
    if (memberId === null) return;
    adminFetch<Member>(`/team/${memberId}`).then(({ data, status }) => {
      if (status === 404 || !data) {
        router.push("/admin/team");
        return;
      }
      setForm({
        firstName: data.firstName,
        lastName: data.lastName,
        photoUrl: data.photoUrl ?? "",
        links: Object.fromEntries(LINK_FIELDS.map((l) => [l.field, data[l.field] ?? ""])) as Record<LinkField, string>,
        editionIds: data.editions.map((e) => e.id),
      });
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  function toggleEdition(id: number) {
    setForm((f) => ({
      ...f,
      editionIds: f.editionIds.includes(id) ? f.editionIds.filter((e) => e !== id) : [...f.editionIds, id],
    }));
  }

  async function save() {
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    setIsSaving(true);
    setSaveState(null);
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      photoUrl: form.photoUrl || null,
      ...form.links,
      editionIds: form.editionIds,
    };
    const result = isNew
      ? await adminFetch<Member>("/team", { method: "POST", body: JSON.stringify(payload) })
      : await adminFetch<Member>(`/team/${memberId}`, { method: "PUT", body: JSON.stringify(payload) });
    setIsSaving(false);

    if (isNew && result.status === 201 && result.data) {
      router.push(`/admin/team/${result.data.id}`);
      return;
    }
    if (result.status === 200) {
      setSaveState({ kind: "ok", text: "Modifications enregistrées." });
      return;
    }
    const field = result.errorBody?.field;
    setSaveState({
      kind: "error",
      text:
        typeof field === "string" && FIELD_LABELS[field]
          ? `${FIELD_LABELS[field]} n'est pas valide : utilisez une adresse commençant par https://.`
          : humanError(result, "L'enregistrement a échoué. Réessayez."),
    });
  }

  if (isLoading) return <p className="text-gris">Chargement…</p>;

  const canSave = form.firstName.trim() && form.lastName.trim();

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.push("/admin/team")} className="text-gris hover:text-noir" title="Retour" aria-label="Retour à l'équipe">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-3xl font-bold text-noir">{isNew ? "Nouvel organisateur" : `${form.firstName} ${form.lastName}`}</h1>
        {memberId !== null && (
          <TrashButton
            path={`/team/${memberId}`}
            listHref="/admin/team"
            title="Supprimer l'organisateur"
            message="Il disparaîtra de la page Équipe. Vous pourrez le restaurer depuis la corbeille."
          />
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-6 rounded-xl bg-blanc p-6 shadow-card"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-noir">Prénom *</span>
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-noir">Nom *</span>
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required className={inputClass} />
          </label>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-noir">Photo</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className="rounded-lg border border-gris/30 px-4 py-2 text-sm text-noir hover:bg-blanc-casse"
            >
              {form.photoUrl ? "Changer la photo" : "Choisir une photo"}
            </button>
            {form.photoUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                <button type="button" onClick={() => setForm({ ...form, photoUrl: "" })} className="text-sm text-terre-cuite hover:underline">
                  Retirer
                </button>
              </>
            )}
          </div>
        </div>

        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-2 text-sm font-medium text-noir">Liens</legend>
          {LINK_FIELDS.map((link) => (
            <label key={link.field} className="block">
              <span className="mb-1 block text-xs text-gris">{link.label}</span>
              <input
                type="url"
                value={form.links[link.field]}
                onChange={(e) => setForm({ ...form, links: { ...form.links, [link.field]: e.target.value } })}
                placeholder={link.placeholder}
                className={inputClass}
              />
            </label>
          ))}
        </fieldset>

        <div>
          <span className="mb-1 block text-sm font-medium text-noir">Éditions organisées</span>
          <p className="mb-2 text-sm text-gris">La page Équipe montre les organisateurs de l&apos;édition en cours.</p>
          <div className="flex flex-wrap gap-2">
            {editions.map((edition) => {
              const isSelected = form.editionIds.includes(edition.id);
              return (
                <button
                  key={edition.id}
                  type="button"
                  onClick={() => toggleEdition(edition.id)}
                  aria-pressed={isSelected}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isSelected ? "bg-bismarck text-blanc" : "bg-blanc text-noir shadow-card hover:bg-blanc-casse"
                  }`}
                >
                  {edition.year}
                </button>
              );
            })}
          </div>
        </div>

        <SaveFeedback state={saveState} onDismiss={() => setSaveState(null)} />

        <div className="flex items-center gap-3 border-t border-gris/20 pt-4">
          <button
            type="submit"
            disabled={isSaving || !canSave}
            className="rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90 disabled:opacity-50"
          >
            {isSaving ? "Enregistrement…" : isNew ? "Créer" : "Enregistrer"}
          </button>
          <button type="button" onClick={() => router.push("/admin/team")} className="rounded-lg border border-gris/30 px-4 py-2 text-sm text-gris hover:bg-blanc-casse">
            Annuler
          </button>
          {!canSave && <span className="text-sm text-gris">Renseignez le prénom et le nom.</span>}
        </div>
      </form>

      <ImagePickerDialog
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(url) => {
          setForm((f) => ({ ...f, photoUrl: url }));
          setIsPickerOpen(false);
        }}
      />

      {memberId !== null && <AuditTrail entity="TeamMember" entityId={memberId} refreshKey={saveState} />}
    </div>
  );
}
