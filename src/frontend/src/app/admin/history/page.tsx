"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { adminFetch, adminListAudit, type AuditChannel, type AuditFilters, type AuditPage } from "@/lib/admin-api";
import { AuditEntryList, CHANNEL_LABELS, ENTITY_LABELS } from "@/components/admin/AuditTrail";

// "Who changed this?" (#513), answered from every write the site recorded.

const PAGE_SIZE = 50;

interface UserOption {
  id: string;
  email: string;
  name: string | null;
}

const selectClass = "rounded-lg border border-gris/30 px-3 py-1.5 text-sm bg-blanc";

// A date input gives a day; the API wants an instant. "Du" opens the day and
// "au" closes it, so picking the same date twice covers that whole day.
function dayStart(day: string) {
  return day ? new Date(`${day}T00:00:00`).toISOString() : undefined;
}
function dayEnd(day: string) {
  return day ? new Date(`${day}T23:59:59.999`).toISOString() : undefined;
}

export default function AdminHistoryPage() {
  const searchParams = useSearchParams();
  // Arriving from a record's "Voir tout l'historique" link pins that record.
  const entityId = searchParams.get("entityId") ?? undefined;

  const [entity, setEntity] = useState(searchParams.get("entity") ?? "");
  const [actorUserId, setActorUserId] = useState("");
  const [channel, setChannel] = useState<AuditChannel | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);

  // Cursors of the pages already seen, so "Précédent" can step back: a keyset
  // cursor only knows how to go forward.
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  // Tagged with the query it answers: loading is "the answer on screen is not
  // for the current filters", which also drops a late reply to an old query.
  const [result, setResult] = useState<{ key: string; page: AuditPage | null } | null>(null);

  useEffect(() => {
    adminFetch<UserOption[]>("/users").then(({ data }) => setUsers(data ?? []));
  }, []);

  const query: AuditFilters = {
    entity: entity || undefined,
    entityId,
    actorUserId: actorUserId || undefined,
    channel: channel || undefined,
    from: dayStart(from),
    to: dayEnd(to),
    before: cursors[cursors.length - 1],
    limit: PAGE_SIZE,
  };
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let isCancelled = false;
    adminListAudit(JSON.parse(queryKey) as AuditFilters).then(({ data }) => {
      if (!isCancelled) setResult({ key: queryKey, page: data });
    });
    return () => {
      isCancelled = true;
    };
  }, [queryKey]);

  const isLoading = result?.key !== queryKey;
  const page = isLoading ? null : result.page;
  const error = !isLoading && !page ? "Impossible de charger l'historique. Rechargez la page pour réessayer." : "";

  // Any filter change starts over from the newest line.
  function onFilter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setCursors([undefined]);
    };
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-noir mb-2">Historique</h1>
      <p className="text-gris mb-6">
        Toutes les modifications du site : qui, quand, depuis où, et ce qui a changé. Conservé 13 mois.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1 text-sm text-noir">
          Fiche
          <select value={entity} onChange={(e) => onFilter(setEntity)(e.target.value)} className={selectClass}>
            <option value="">Toutes</option>
            {Object.entries(ENTITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-noir">
          Personne
          <select value={actorUserId} onChange={(e) => onFilter(setActorUserId)(e.target.value)} className={selectClass}>
            <option value="">Tout le monde</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name ?? user.email}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-noir">
          Canal
          <select
            value={channel}
            onChange={(e) => onFilter(setChannel)(e.target.value as AuditChannel | "")}
            className={selectClass}
          >
            <option value="">Tous</option>
            {(Object.entries(CHANNEL_LABELS) as Array<[AuditChannel, string]>).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-noir">
          Du
          <input type="date" value={from} onChange={(e) => onFilter(setFrom)(e.target.value)} className={selectClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-noir">
          Au
          <input type="date" value={to} onChange={(e) => onFilter(setTo)(e.target.value)} className={selectClass} />
        </label>
      </div>

      {entityId && (
        <p className="text-sm text-gris mb-4">
          Historique d&apos;une seule fiche ({ENTITY_LABELS[entity] ?? entity} #{entityId}).{" "}
          <Link href="/admin/history" className="text-malachite hover:underline">
            Voir tout
          </Link>
        </p>
      )}

      {error && (
        <div role="alert" aria-live="assertive" className="mb-4 p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gris py-12 text-center">Chargement...</p>
      ) : !page || page.items.length === 0 ? (
        !error && (
          <div className="bg-blanc rounded-xl shadow-card p-12 text-center text-gris">
            Aucune modification correspondant aux critères.
          </div>
        )
      ) : (
        <div className="bg-blanc rounded-xl shadow-card px-4">
          <AuditEntryList items={page.items} />
        </div>
      )}

      {page && (cursors.length > 1 || page.nextCursor) && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gris">Page {cursors.length}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCursors((stack) => stack.slice(0, -1))}
              disabled={cursors.length <= 1}
              className="px-3 py-1.5 text-sm bg-blanc border border-gris/30 rounded-lg disabled:opacity-40"
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() => page.nextCursor && setCursors((stack) => [...stack, page.nextCursor ?? undefined])}
              disabled={!page.nextCursor}
              className="px-3 py-1.5 text-sm bg-blanc border border-gris/30 rounded-lg disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
