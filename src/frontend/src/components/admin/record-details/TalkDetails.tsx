"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { adminFetch } from "@/lib/admin-api";
import { formatEventTime } from "@/lib/datetime";
import RecordDetailsDialog, { DetailList, DetailLoading, DetailSection, RichText, statusLabel } from "./RecordDetailsDialog";

interface TalkDetail {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  format: string;
  level: string | null;
  language: string | null;
  videoUrl: string | null;
  publicationStatus: "PUBLISHED" | "DRAFT";
  isSpeakerEditable: boolean;
  startsAt: string | null;
  endsAt: string | null;
  roomLabel: string | null;
  room: { id: number; name: string } | null;
  category: { id: number; nameFr: string } | null;
  edition: { id: number; year: number };
  speakers: { id: number; name: string }[];
  simulcasts: { roomId: number | null }[];
}

const FORMAT_LABELS: Record<string, string> = {
  CONFERENCE: "Conférence",
  QUICKIE: "Quickie",
  KEYNOTE: "Keynote",
  WORKSHOP: "Workshop",
};

const LEVEL_LABELS: Record<string, string> = {
  DEBUTANT: "Débutant",
  INTERMEDIAIRE: "Intermédiaire",
  CONFIRME: "Confirmé",
};

export default function TalkDetails({ talkId, onClose }: { talkId: number | null; onClose: () => void }) {
  const [talk, setTalk] = useState<TalkDetail | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setTalk(null);
    setHasError(false);
    if (talkId === null) return;
    adminFetch<TalkDetail>(`/talks/${talkId}`).then(({ data }) => {
      if (data) setTalk(data);
      else setHasError(true);
    });
  }, [talkId]);

  // The edition-scoped address works for every year, the current one included.
  const publicHref =
    talk?.publicationStatus === "PUBLISHED" ? `/fr/editions/${talk.edition.year}/conferences/${talk.slug}` : null;

  return (
    <RecordDetailsDialog
      title={talk?.title ?? "Conférence"}
      isOpen={talkId !== null}
      onClose={onClose}
      editHref={`/admin/talks/${talkId}`}
      publicHref={publicHref}
    >
      {!talk ? (
        <DetailLoading error={hasError} />
      ) : (
        <>
          <DetailSection title="Conférence">
            <DetailList
              rows={[
                ["Édition", talk.edition.year],
                ["Statut", statusLabel(talk.publicationStatus)],
                ["Format", FORMAT_LABELS[talk.format] ?? talk.format],
                ["Niveau", talk.level ? (LEVEL_LABELS[talk.level] ?? talk.level) : null],
                ["Langue", talk.language === "en" ? "Anglais" : talk.language === "fr" ? "Français" : talk.language],
                ["Catégorie", talk.category?.nameFr],
                ["Slug", <code key="slug" className="text-xs">{talk.slug}</code>],
              ]}
            />
          </DetailSection>

          <DetailSection title={`Speakers (${talk.speakers.length})`}>
            {talk.speakers.length === 0 ? (
              <p className="text-sm text-gris">Aucun speaker.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {talk.speakers.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/speakers/${s.id}`} className="text-bleu hover:underline">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title="Programme">
            <DetailList
              rows={[
                [
                  "Créneau",
                  talk.startsAt
                    ? `${new Date(talk.startsAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} · ${formatEventTime(talk.startsAt)}${talk.endsAt ? ` – ${formatEventTime(talk.endsAt)}` : ""}`
                    : "Non programmée",
                ],
                ["Salle", talk.room?.name ?? talk.roomLabel],
                ["Retransmission", talk.simulcasts.length > 0 ? `dans ${talk.simulcasts.length} autre(s) salle(s)` : null],
              ]}
            />
          </DetailSection>

          <DetailSection title="Interne">
            <DetailList
              rows={[
                ["Modifiable par le speaker", talk.isSpeakerEditable ? "Oui" : "Non"],
                [
                  "Vidéo",
                  talk.videoUrl && (
                    <a href={talk.videoUrl} target="_blank" rel="noopener noreferrer" className="text-bleu hover:underline break-all">
                      {talk.videoUrl}
                    </a>
                  ),
                ],
              ]}
            />
          </DetailSection>

          <DetailSection title="Description">
            <RichText html={talk.description} />
          </DetailSection>
        </>
      )}
    </RecordDetailsDialog>
  );
}
