"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { adminFetch } from "@/lib/admin-api";
import type { Speaker, Talk } from "@/lib/types";

interface SynthesisOverviewProps {
  editionId: number;
  year: number;
  counts: {
    speakers: number;
    talks: number;
    sponsors: number;
    categories: number;
  };
}

const TOP_N = 5;

export default function SynthesisOverview({ editionId, year, counts }: SynthesisOverviewProps) {
  const router = useRouter();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [talks, setTalks] = useState<Talk[]>([]);

  useEffect(() => {
    void Promise.all([
      adminFetch<Speaker[]>(`/speakers?editionId=${editionId}`),
      adminFetch<Talk[]>(`/talks?editionId=${editionId}`),
    ]).then(([{ data: s }, { data: t }]) => {
      if (s) setSpeakers(s);
      if (t) setTalks(t);
    });
  }, [editionId]);

  const publishedSpeakers = speakers.filter((s) => s.publicationStatus === "PUBLISHED");

  function openAllSocialCards() {
    for (const s of publishedSpeakers) {
      window.open(`/speakers/${s.slug}/social-card`, "_blank", "noopener");
    }
  }

  const cards = [
    { label: "Speakers", count: counts.speakers, href: `/admin/speakers?year=${year}` },
    { label: "Conférences", count: counts.talks, href: `/admin/talks?year=${year}` },
    { label: "Sponsors", count: counts.sponsors, href: `/admin/sponsors?year=${year}` },
    { label: "Catégories", count: counts.categories, href: `/admin/categories?year=${year}` },
  ];

  return (
    <div className="mb-6 space-y-6">
      {/* Clickable counters */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl bg-blanc shadow-card p-4 transition-colors hover:bg-blanc-casse/60"
          >
            <p className="text-3xl font-bold text-noir">{c.count}</p>
            <p className="mt-1 text-sm text-gris">{c.label}</p>
          </Link>
        ))}
      </div>

      {/* Action shortcuts */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => router.push(`/admin/speakers/new?editionId=${editionId}`)}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
        >
          + Speaker
        </button>
        <button
          onClick={() => router.push(`/admin/talks/new?editionId=${editionId}`)}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
        >
          + Conférence
        </button>
        <button
          onClick={() => router.push(`/admin/sponsors/new?editionId=${editionId}`)}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
        >
          + Sponsor
        </button>
        <button
          onClick={() => router.push(`/admin/import?editionId=${editionId}`)}
          className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
        >
          Importer (Sessionize)
        </button>
        {publishedSpeakers.length > 0 && (
          <button
            onClick={openAllSocialCards}
            title="Ouvre le visuel de chaque speaker publié dans un nouvel onglet"
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-noir hover:bg-blanc-casse"
          >
            Générer les visuels ({publishedSpeakers.length})
          </button>
        )}
      </div>

      {/* Short lists */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ShortList
          title="Speakers"
          allHref={`/admin/speakers?year=${year}`}
          items={speakers.slice(0, TOP_N).map((s) => ({
            id: s.id,
            label: s.name,
            href: `/admin/speakers/${s.id}`,
          }))}
          emptyLabel="Aucun speaker pour cette édition."
        />
        <ShortList
          title="Conférences"
          allHref={`/admin/talks?year=${year}`}
          items={talks.slice(0, TOP_N).map((t) => ({
            id: t.id,
            label: t.titleFr,
            href: `/admin/talks/${t.id}`,
          }))}
          emptyLabel="Aucune conférence pour cette édition."
        />
      </div>
    </div>
  );
}

interface ShortListProps {
  title: string;
  allHref: string;
  items: { id: number; label: string; href: string }[];
  emptyLabel: string;
}

function ShortList({ title, allHref, items, emptyLabel }: ShortListProps) {
  return (
    <div className="rounded-xl bg-blanc shadow-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-noir">{title}</h3>
        <Link href={allHref} className="text-xs text-bleu hover:underline">Voir tout</Link>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-gris">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-gris/10">
          {items.map((it) => (
            <li key={it.id}>
              <Link href={it.href} className="block py-2 text-sm text-noir hover:text-malachite truncate">
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
