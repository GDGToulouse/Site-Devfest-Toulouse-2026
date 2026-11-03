"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { adminFetch } from "@/lib/admin-api";
import RecordDetailsDialog, { DetailList, DetailLoading, DetailSection, RichText, statusLabel } from "./RecordDetailsDialog";

interface SpeakerDetail {
  id: number;
  slug: string;
  name: string;
  photoUrl: string | null;
  company: string | null;
  city: string | null;
  bioFr: string | null;
  bioEn: string | null;
  socialLinks: Record<string, string>;
  contactEmail: string | null;
  locale: string | null;
  editLinkLocked: boolean;
  editTokenSentAt: string | null;
  editions: {
    id: number;
    year: number;
    isFeatured: boolean;
    publicationStatus: "PUBLISHED" | "DRAFT" | "WITHDRAWN";
    sponsor?: { id: number; name: string } | null;
  }[];
  talks: { id: number; slug: string; title: string; publicationStatus: "PUBLISHED" | "DRAFT" | "CANCELLED"; edition: { year: number } }[];
}

export default function SpeakerDetails({ speakerId, onClose }: { speakerId: number | null; onClose: () => void }) {
  const [speaker, setSpeaker] = useState<SpeakerDetail | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setSpeaker(null);
    setHasError(false);
    if (speakerId === null) return;
    adminFetch<SpeakerDetail>(`/speakers/${speakerId}`).then(({ data }) => {
      if (data) setSpeaker(data);
      else setHasError(true);
    });
  }, [speakerId]);

  // Public once any year is published: the page lists every edition (#351).
  const isPublic = speaker?.editions.some((e) => e.publicationStatus === "PUBLISHED");

  return (
    <RecordDetailsDialog
      title={speaker?.name ?? "Speaker"}
      isOpen={speakerId !== null}
      onClose={onClose}
      editHref={`/admin/speakers/${speakerId}`}
      publicHref={speaker && isPublic ? `/fr/speakers/${speaker.slug}` : null}
      previewHref={speaker ? `/api/preview?type=speaker&slug=${encodeURIComponent(speaker.slug)}` : null}
    >
      {!speaker ? (
        <DetailLoading error={hasError} />
      ) : (
        <>
          <DetailSection title="Identité">
            <div className="space-y-3">
              {speaker.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={speaker.photoUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
              )}
              <DetailList
                rows={[
                  ["Entreprise", speaker.company],
                  ["Ville", speaker.city],
                  ["Slug", <code key="slug" className="text-xs">{speaker.slug}</code>],
                  [
                    "Réseaux",
                    Object.entries(speaker.socialLinks).map(([network, url]) => (
                      <a key={network} href={url} target="_blank" rel="noopener noreferrer" className="mr-3 text-bleu hover:underline">
                        {network}
                      </a>
                    )),
                  ],
                ]}
              />
            </div>
          </DetailSection>

          <DetailSection title="Interne">
            <DetailList
              rows={[
                ["Email de contact", speaker.contactEmail],
                ["Langue des emails", speaker.locale === "en" ? "Anglais" : "Français"],
                [
                  "Lien de modification",
                  speaker.editLinkLocked
                    ? "Verrouillé"
                    : speaker.editTokenSentAt
                      ? `Envoyé le ${new Date(speaker.editTokenSentAt).toLocaleDateString("fr-FR")}`
                      : "Jamais envoyé",
                ],
              ]}
            />
          </DetailSection>

          <DetailSection title="Éditions">
            <DetailList
              rows={speaker.editions.map((e) => [
                String(e.year),
                <>
                  {statusLabel(e.publicationStatus)}
                  {e.isFeatured && " · mis en avant"}
                  {e.sponsor && (
                    <>
                      {" · "}
                      <Link href={`/admin/sponsors/${e.sponsor.id}`} className="text-bleu hover:underline">
                        {e.sponsor.name}
                      </Link>
                    </>
                  )}
                </>,
              ])}
            />
          </DetailSection>

          <DetailSection title={`Conférences (${speaker.talks.length})`}>
            {speaker.talks.length === 0 ? (
              <p className="text-sm text-gris">Aucune conférence.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {speaker.talks.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/talks/${t.id}`} className="text-bleu hover:underline">
                      {t.title}
                    </Link>{" "}
                    <span className="text-gris">
                      · {t.edition.year} · {statusLabel(t.publicationStatus)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title="Bio (français)">
            <RichText html={speaker.bioFr} />
          </DetailSection>
          <DetailSection title="Bio (anglais)">
            <RichText html={speaker.bioEn} />
          </DetailSection>
        </>
      )}
    </RecordDetailsDialog>
  );
}
