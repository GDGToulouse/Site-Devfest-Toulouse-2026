"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { adminFetch } from "@/lib/admin-api";
import { SPONSOR_ROLE_LABELS } from "@/lib/sponsor-roles";
import type { SponsorAccessRole } from "@/lib/sponsor-api";
import RecordDetailsDialog, { DetailList, DetailLoading, DetailSection, RichText, statusLabel } from "./RecordDetailsDialog";

interface Participation {
  editionId: number;
  edition: { id: number; year: number };
  tier: { nameFr: string };
  publicationStatus: "PUBLISHED" | "DRAFT";
  logoUrl: string | null;
  comKitReceived: boolean;
  comKitLogoWebUrl: string | null;
  comKitLogoPrintUrl: string | null;
  comKitCharterUrl: string | null;
  comKitNotes: string | null;
  platinumPromoIdea: string | null;
  platinumCoBuildIdea: string | null;
}

interface SponsorDetail {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  socialLinks: Record<string, string>;
  contactEmail: string | null;
  locale: string | null;
  standContacts: { name?: string; linkedin?: string }[];
  editions: Participation[];
  speakers: { id: number; name: string; year: number }[];
}

interface Contact {
  id: number;
  email: string;
  name: string | null;
  role: string | null;
  accessRole: SponsorAccessRole;
  hasAccount: boolean;
  invitationPending: boolean;
}

interface JobOffer {
  id: number;
  title: string;
  url: string;
  year: number;
  editionId: number;
}

function fileLink(url: string | null) {
  return (
    url && (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-bleu hover:underline break-all">
        {url.split("/").pop()}
      </a>
    )
  );
}

export default function SponsorDetails({ sponsorId, onClose }: { sponsorId: number | null; onClose: () => void }) {
  const [sponsor, setSponsor] = useState<SponsorDetail | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setSponsor(null);
    setHasError(false);
    if (sponsorId === null) return;
    // The sheet, its people and its offers: three routes the edit form already uses.
    Promise.all([
      adminFetch<SponsorDetail>(`/sponsors/${sponsorId}`),
      adminFetch<Contact[]>(`/sponsors/${sponsorId}/contacts`),
      adminFetch<JobOffer[]>(`/job-offers?sponsorId=${sponsorId}`),
    ]).then(([detail, people, jobOffers]) => {
      if (!detail.data) {
        setHasError(true);
        return;
      }
      setSponsor(detail.data);
      setContacts(people.data ?? []);
      setOffers(jobOffers.data ?? []);
    });
  }, [sponsorId]);

  const isPublic = sponsor?.editions.some((e) => e.publicationStatus === "PUBLISHED");

  return (
    <RecordDetailsDialog
      title={sponsor?.name ?? "Sponsor"}
      isOpen={sponsorId !== null}
      onClose={onClose}
      editHref={`/admin/sponsors/${sponsorId}`}
      publicHref={sponsor && isPublic ? `/fr/sponsors/${sponsor.slug}` : null}
      previewHref={sponsor ? `/api/preview?type=sponsor&slug=${encodeURIComponent(sponsor.slug)}` : null}
    >
      {!sponsor ? (
        <DetailLoading error={hasError} />
      ) : (
        <>
          <DetailSection title="Identité">
            <div className="space-y-3">
              {sponsor.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sponsor.logoUrl} alt="" className="h-16 w-24 object-contain" />
              )}
              <DetailList
                rows={[
                  [
                    "Site web",
                    sponsor.websiteUrl && (
                      <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-bleu hover:underline break-all">
                        {sponsor.websiteUrl}
                      </a>
                    ),
                  ],
                  [
                    "Réseaux",
                    Object.entries(sponsor.socialLinks).map(([network, url]) => (
                      <a key={network} href={url} target="_blank" rel="noopener noreferrer" className="mr-3 text-bleu hover:underline">
                        {network}
                      </a>
                    )),
                  ],
                  ["Slug", <code key="slug" className="text-xs">{sponsor.slug}</code>],
                ]}
              />
            </div>
          </DetailSection>

          <DetailSection title="Interne">
            <DetailList
              rows={[
                ["Email de contact", sponsor.contactEmail],
                ["Langue des emails", sponsor.locale === "en" ? "Anglais" : "Français"],
                ["Contacts du stand", sponsor.standContacts.map((c) => c.name).filter(Boolean).join(", ")],
              ]}
            />
          </DetailSection>

          {sponsor.editions.map((e) => (
            <DetailSection key={e.editionId} title={`Participation ${e.edition.year}`}>
              <DetailList
                rows={[
                  ["Niveau", e.tier.nameFr],
                  ["Statut", statusLabel(e.publicationStatus)],
                  ["Logo de l'année", fileLink(e.logoUrl)],
                  ["Kit de com", e.comKitReceived ? "Reçu" : "Non reçu"],
                  ["Logo web", fileLink(e.comKitLogoWebUrl)],
                  ["Logo print", fileLink(e.comKitLogoPrintUrl)],
                  ["Charte", fileLink(e.comKitCharterUrl)],
                  ["Notes", e.comKitNotes],
                  ["Idée de promotion", e.platinumPromoIdea],
                  ["Idée de co-construction", e.platinumCoBuildIdea],
                ]}
              />
            </DetailSection>
          ))}

          <DetailSection title={`Contacts & accès (${contacts.length})`}>
            {contacts.length === 0 ? (
              <p className="text-sm text-gris">Aucun contact.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <span className="text-noir">{c.name || c.email}</span>
                    <span className="text-gris">
                      {c.name && ` · ${c.email}`}
                      {c.role && ` · ${c.role}`} · {SPONSOR_ROLE_LABELS[c.accessRole]} ·{" "}
                      {c.hasAccount ? "compte actif" : c.invitationPending ? "invitation en attente" : "sans compte"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title={`Speakers (${sponsor.speakers.length})`}>
            {sponsor.speakers.length === 0 ? (
              <p className="text-sm text-gris">Aucun speaker rattaché.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sponsor.speakers.map((s) => (
                  <li key={`${s.id}-${s.year}`}>
                    <Link href={`/admin/speakers/${s.id}`} className="text-bleu hover:underline">
                      {s.name}
                    </Link>{" "}
                    <span className="text-gris">· {s.year}</span>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title={`Offres d'emploi (${offers.length})`}>
            {offers.length === 0 ? (
              <p className="text-sm text-gris">Aucune offre.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {offers.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/sponsors/${sponsor.id}?tab=offres&editionId=${o.editionId}&offer=${o.id}`}
                      className="text-bleu hover:underline"
                    >
                      {o.title}
                    </Link>{" "}
                    <span className="text-gris">· {o.year}</span>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title="Description (français)">
            <RichText html={sponsor.descriptionFr} />
          </DetailSection>
          <DetailSection title="Description (anglais)">
            <RichText html={sponsor.descriptionEn} />
          </DetailSection>
        </>
      )}
    </RecordDetailsDialog>
  );
}
