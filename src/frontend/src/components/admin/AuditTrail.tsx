"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { adminListAudit, getAdminSession, type AuditAction, type AuditChannel, type AuditEntry } from "@/lib/admin-api";

// History of the writes (#513): the shared row list, used by /admin/history and
// by the "Historique" section of a record's page.

export const ENTITY_LABELS: Record<string, string> = {
  Speaker: "Speaker",
  Talk: "Conférence",
  Sponsor: "Sponsor",
  Article: "Article",
  ContentPage: "Page",
  Category: "Catégorie",
  Edition: "Édition",
  User: "Utilisateur",
  SponsorContact: "Contact sponsor",
  SponsorJobOffer: "Offre d'emploi",
  SponsorTier: "Offre de sponsoring",
  EditionSponsor: "Participation sponsor",
  EditionSponsorTier: "Offre de l'édition",
  SpeakerEdition: "Participation speaker",
  TicketTier: "Tarif",
  ScheduleEntry: "Créneau",
  Venue: "Lieu",
  Room: "Salle",
  SiteSetting: "Paramètre",
  FileMetadata: "Fichier",
  ContactMessage: "Message",
  ContactCategory: "Catégorie de contact",
  KeyFigure: "Chiffre clé",
  Tag: "Tag",
  ApiKey: "Clé API",
};

export const CHANNEL_LABELS: Record<AuditChannel, string> = {
  ADMIN: "admin",
  SPONSOR: "espace sponsor",
  EDIT_LINK: "lien de modification",
  IMPORT: "import Sessionize",
  API_KEY: "clé API",
  MCP: "agent MCP",
  PUBLIC: "site public",
  SYSTEM: "système",
  AUTH: "connexion",
};

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Créé",
  UPDATE: "Modifié",
  DELETE: "Supprimé",
  TRASH: "Mis à la corbeille",
  RESTORE: "Restauré",
};

// Records that have an admin page to jump to.
const ENTITY_PATHS: Record<string, string> = {
  Speaker: "speakers",
  Talk: "talks",
  Sponsor: "sponsors",
  Article: "articles",
  Category: "categories",
  Edition: "editions",
  SponsorTier: "sponsor-tiers",
  Venue: "venues",
};

// A bio or an article body can run to pages; the row is for spotting what
// changed, not for reading it.
const MAX_VALUE_LENGTH = 200;

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function EntityName({ entry }: { entry: AuditEntry }) {
  const kind = ENTITY_LABELS[entry.entity] ?? entry.entity;
  const name = entry.entityLabel ? `« ${entry.entityLabel} »` : `#${entry.entityId}`;
  const path = ENTITY_PATHS[entry.entity];
  // No current label means the record is gone (deleted since, or this very line
  // deleted it): there is no page left to open.
  if (!path || !entry.entityLabel) {
    return (
      <span>
        {kind} {name}
      </span>
    );
  }
  return (
    <Link href={`/admin/${path}/${entry.entityId}`} className="text-malachite hover:underline">
      {kind} {name}
    </Link>
  );
}

export function AuditEntryList({ items, showEntity = true }: { items: AuditEntry[]; showEntity?: boolean }) {
  return (
    <ul className="divide-y divide-gris/10">
      {items.map((entry) => {
        const changes = Object.entries(entry.changes ?? {});
        return (
          <li key={entry.id} className="py-2">
            <details className="group">
              {/* flex drops the native disclosure triangle: the chevron puts
                  back the cue that the line opens. */}
              <summary className="cursor-pointer list-none text-sm text-noir flex flex-wrap items-baseline gap-x-2">
                <span aria-hidden="true" className="inline-block text-gris transition-transform group-open:rotate-90">
                  ▸
                </span>
                <span className="text-gris">{formatDate(entry.createdAt)}</span>
                <span>·</span>
                <span>
                  {entry.actorLabel} <span className="text-gris">({CHANNEL_LABELS[entry.channel]})</span>
                </span>
                <span>·</span>
                <span className="font-medium">{ACTION_LABELS[entry.action]}</span>
                {showEntity && (
                  <>
                    <span>·</span>
                    <EntityName entry={entry} />
                  </>
                )}
              </summary>
              {changes.length === 0 ? (
                <p className="mt-2 ml-6 text-xs text-gris">Aucun détail de champ enregistré.</p>
              ) : (
                <dl className="mt-2 ml-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                  {changes.map(([field, { before, after }]) => (
                    <div key={field} className="contents">
                      <dt className="font-mono text-gris">{field}</dt>
                      {/* JSON and URLs have no spaces to break on. */}
                      <dd className="text-noir [overflow-wrap:anywhere]">
                        <span className="line-through text-gris">{formatValue(before)}</span>
                        {" → "}
                        <span>{formatValue(after)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}

const TRAIL_LIMIT = 20;

/**
 * The "Historique" section of a record's page. Renders nothing for an editor:
 * the history is ADMIN only, and a section that can only say "forbidden" is
 * noise on a page they otherwise use.
 */
export default function AuditTrail({
  entity,
  entityId,
  refreshKey,
}: {
  entity: string;
  entityId: number | string;
  // Anything that changes after a save on the page, so the line it just wrote
  // shows up without a reload.
  refreshKey?: unknown;
}) {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "hidden" } | { kind: "error" } | { kind: "ready"; items: AuditEntry[]; hasMore: boolean }
  >({ kind: "loading" });

  useEffect(() => {
    let isCancelled = false;
    async function load() {
      // Same convention as AdminShell: ask for the role first rather than let an
      // editor's every page open with a 403 in the console.
      const session = await getAdminSession();
      if (session?.role !== "ADMIN") {
        if (!isCancelled) setState({ kind: "hidden" });
        return;
      }
      const { data, status } = await adminListAudit({ entity, entityId: String(entityId), limit: TRAIL_LIMIT });
      if (isCancelled) return;
      if (status === 403) setState({ kind: "hidden" });
      else if (!data) setState({ kind: "error" });
      else setState({ kind: "ready", items: data.items, hasMore: data.nextCursor !== null });
    }
    load();
    return () => {
      isCancelled = true;
    };
  }, [entity, entityId, refreshKey]);

  if (state.kind === "hidden") return null;

  return (
    <section className="bg-blanc rounded-xl shadow-card p-6 mt-6" aria-labelledby="audit-trail-title">
      <h2 id="audit-trail-title" className="text-lg font-semibold text-noir mb-3">
        Historique
      </h2>
      {state.kind === "loading" && <p className="text-sm text-gris">Chargement...</p>}
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-terre-cuite">
          Impossible de charger l&apos;historique. Rechargez la page pour réessayer.
        </p>
      )}
      {state.kind === "ready" && state.items.length === 0 && (
        <p className="text-sm text-gris">Aucune modification enregistrée depuis la mise en place de l&apos;historique.</p>
      )}
      {state.kind === "ready" && state.items.length > 0 && (
        <>
          <AuditEntryList items={state.items} showEntity={false} />
          {state.hasMore && (
            <Link
              href={`/admin/history?entity=${entity}&entityId=${entityId}`}
              className="inline-block mt-3 text-sm text-malachite hover:underline"
            >
              Voir tout l&apos;historique de cette fiche
            </Link>
          )}
        </>
      )}
    </section>
  );
}
