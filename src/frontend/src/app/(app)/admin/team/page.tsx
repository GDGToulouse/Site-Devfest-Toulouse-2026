"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import DataTable from "@/components/admin/DataTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

// The organisers (#110), alphabetical by last name as on the public page.
// A short list by nature: no pagination.
interface MemberRow {
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

const LINK_FIELDS = ["websiteUrl", "linkedinUrl", "twitterUrl", "githubUrl", "blueskyUrl"] as const;

export default function TeamAdminPage() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await adminFetch<MemberRow[]>("/team");
    setMembers(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    const { status } = await adminFetch(`/team/${target.id}`, { method: "DELETE" });
    if (status !== 204) {
      setError("La suppression a échoué. Réessayez.");
      return;
    }
    setError(null);
    await load();
  }

  const columns = [
    {
      key: "name",
      label: "Organisateur",
      render: (m: MemberRow) => (
        <span className="flex items-center gap-3">
          {m.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blanc-casse text-sm font-bold text-gris">
              {m.firstName.charAt(0)}
            </span>
          )}
          <span className="font-medium text-noir">
            {m.firstName} {m.lastName}
          </span>
        </span>
      ),
    },
    { key: "editions", label: "Éditions", render: (m: MemberRow) => m.editions.map((e) => e.year).join(", ") || "—" },
    { key: "links", label: "Liens", render: (m: MemberRow) => LINK_FIELDS.filter((f) => m[f]).length || "—" },
  ];

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-noir">Équipe</h1>
          <p className="mt-1 text-sm text-gris">
            Les organisateurs, présentés sur la page Équipe pour l&apos;édition en cours.
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/team/new")}
          className="shrink-0 rounded-lg bg-malachite px-4 py-2 text-sm font-medium text-blanc hover:bg-malachite/90"
        >
          + Ajouter
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-terre-cuite/10 px-4 py-3 text-sm text-terre-cuite">
          {error}
        </div>
      )}

      {members === null ? (
        <p className="text-gris">Chargement…</p>
      ) : (
        <DataTable<MemberRow>
          columns={columns}
          data={members}
          emptyMessage="Aucun organisateur. Ajoutez le premier."
          rowLabel={(m) => `${m.firstName} ${m.lastName}`}
          onEdit={(m) => router.push(`/admin/team/${m.id}`)}
          onDelete={(m) => setDeleteTarget(m)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer l'organisateur"
        message={`Supprimer « ${deleteTarget?.firstName} ${deleteTarget?.lastName} » ? Il disparaîtra de la page Équipe. Vous pourrez le restaurer depuis la corbeille.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
