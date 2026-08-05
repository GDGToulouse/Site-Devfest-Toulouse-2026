"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { getMySponsorSpaces, type SponsorSpaceSummary } from "@/lib/sponsor-api";

// Entry point of a sponsor's space (#362). A person invited by two companies
// has to pick one, and the frontend cannot guess the ids on its own.
//
// A single company is the common case, so it redirects straight through rather
// than showing a list of one.

export default function SponsorHomePage() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<SponsorSpaceSummary[] | null>(null);
  const [isDenied, setIsDenied] = useState(false);

  useEffect(() => {
    getMySponsorSpaces().then(({ data, status }) => {
      if (status === 401) {
        router.replace("/sponsor/login?next=/sponsor");
        return;
      }
      if (!data) {
        setIsDenied(true);
        return;
      }
      if (data.length === 1) {
        router.replace(`/sponsor/${data[0].id}`);
        return;
      }
      setSpaces(data);
    });
  }, [router]);

  if (isDenied) {
    return (
      <Shell>
        <p className="text-center text-noir">
          Votre compte n&apos;est rattaché à aucune fiche partenaire.
        </p>
        <p className="mt-3 text-center text-sm text-gris">
          Si vous venez de recevoir une invitation, ouvrez le lien qu&apos;elle contient.
        </p>
      </Shell>
    );
  }

  if (!spaces) {
    return <Shell><p className="text-center text-gris">Chargement…</p></Shell>;
  }

  if (spaces.length === 0) {
    return (
      <Shell>
        <p className="text-center text-noir">Aucune fiche partenaire rattachée à votre compte.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="mb-4 text-sm text-gris">Choisissez la fiche à gérer :</p>
      <ul className="space-y-2">
        {spaces.map((s) => (
          <li key={s.id}>
            <Link
              href={`/sponsor/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-gris/20 bg-blanc px-4 py-3 transition-colors hover:border-malachite"
            >
              <span className="font-medium text-noir">{s.name}</span>
              <span className="text-xs text-gris">{ROLE_SHORT[s.accessRole]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

const ROLE_SHORT: Record<string, string> = {
  RESPONSABLE: "Responsable",
  EDITEUR: "Éditeur",
  STAND: "Stand",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-blanc-casse px-6 py-10">
      <div className="w-full max-w-md rounded-3xl bg-blanc p-8 shadow-card">
        <h1 className="mb-6 text-center text-2xl font-bold text-noir">Espace partenaire</h1>
        {children}
      </div>
    </div>
  );
}
