"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-api";

const PREDEFINED_PATHS = [
  { label: "Accueil", path: "/" },
  { label: "Articles", path: "/fr/actualites" },
  { label: "Billetterie", path: "/fr/billetterie" },
  { label: "Code de conduite", path: "/fr/code-de-conduite" },
  { label: "Mentions legales", path: "/fr/mentions-legales" },
  { label: "Contact", path: "/fr/contact" },
  { label: "CFP", path: "/fr/proposer-un-talk" },
];

export default function CachePage() {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [customPath, setCustomPath] = useState("");
  const [isPurging, setIsPurging] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  function togglePath(path: string) {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  }

  async function handlePurge() {
    const paths = [...selectedPaths];
    if (customPath.trim()) {
      paths.push(customPath.trim());
    }
    if (paths.length === 0) {
      setResult({ success: false, message: "Selectionnez au moins un chemin" });
      return;
    }

    setIsPurging(true);
    setResult(null);

    const { data, status } = await adminFetch<{ revalidated: boolean }>("/cache/purge", {
      method: "POST",
      body: JSON.stringify({ paths }),
    });

    setIsPurging(false);

    if (status === 200 && data?.revalidated) {
      setResult({ success: true, message: `Cache purge pour ${paths.length} chemin(s)` });
      setSelectedPaths([]);
      setCustomPath("");
    } else {
      setResult({ success: false, message: "Erreur lors du purge du cache" });
    }
  }

  async function handlePurgeAll() {
    setIsPurging(true);
    setResult(null);

    const allPaths = PREDEFINED_PATHS.map((p) => p.path);
    const { data, status } = await adminFetch<{ revalidated: boolean }>("/cache/purge", {
      method: "POST",
      body: JSON.stringify({ paths: allPaths }),
    });

    setIsPurging(false);

    if (status === 200 && data?.revalidated) {
      setResult({ success: true, message: "Cache complet purge" });
    } else {
      setResult({ success: false, message: "Erreur lors du purge" });
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-noir mb-8">Gestion du cache</h1>

      <div className="bg-blanc rounded-xl shadow-card p-6 mb-6">
        <h2 className="text-lg font-bold text-noir mb-4">Purger des pages specifiques</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {PREDEFINED_PATHS.map((item) => (
            <label key={item.path} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPaths.includes(item.path)}
                onChange={() => togglePath(item.path)}
                className="rounded border-gris/30 text-malachite focus:ring-malachite"
              />
              <span className="text-sm text-noir">{item.label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="Chemin personnalise (ex: /fr/actualites/mon-article)"
            className="flex-1 rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handlePurge}
            disabled={isPurging}
            className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
          >
            {isPurging ? "Purge en cours..." : "Purger la selection"}
          </button>
          <button
            onClick={handlePurgeAll}
            disabled={isPurging}
            className="px-4 py-2 bg-terre-cuite text-blanc rounded-lg text-sm font-medium hover:bg-terre-cuite/90 disabled:opacity-50"
          >
            Purger tout le cache
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`p-4 rounded-xl ${
            result.success ? "bg-malachite/10 text-malachite" : "bg-terre-cuite/10 text-terre-cuite"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
