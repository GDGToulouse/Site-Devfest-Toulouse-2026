"use client";

import { useState, useEffect } from "react";

import {
  listMyApiKeys,
  createApiKey,
  rotateMyApiKey,
  revokeMyApiKey,
  purgeMyApiKey,
  type ApiKey,
  type CreatedApiKey,
} from "@/lib/admin-api";

function formatDate(iso: string | null, placeholder = "—") {
  if (!iso) return placeholder;
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusLabel(key: ApiKey): { label: string; className: string } {
  if (key.revokedAt) return { label: "Révoquée", className: "bg-gris/10 text-gris" };
  if (key.expiresAt && new Date(key.expiresAt) <= new Date()) {
    return { label: "Expirée", className: "bg-gris/10 text-gris" };
  }
  return { label: "Active", className: "bg-malachite/10 text-malachite" };
}

export default function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Creation form
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  // The one-shot panel is shared by creation and rotation; this only changes
  // its wording, so a rotated key is not announced as a brand-new one.
  const [isRotation, setIsRotation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      setKeys(await listMyApiKeys());
    } catch {
      setError("Impossible de charger les clés");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!newName.trim()) {
      setError("Le nom est obligatoire");
      return;
    }

    // `datetime-local` yields "2026-12-31T23:59" — no seconds, no timezone —
    // which the API rejects, since it requires a full ISO 8601 date-time (#228).
    // The value is local time, and toISOString() converts it to UTC.
    let expiresAt: string | null = null;
    if (newExpiresAt) {
      const parsed = new Date(newExpiresAt);
      if (Number.isNaN(parsed.getTime())) {
        setError("La date d'expiration est invalide.");
        return;
      }
      if (parsed.getTime() <= Date.now()) {
        setError("La date d'expiration doit être dans le futur.");
        return;
      }
      expiresAt = parsed.toISOString();
    }

    setIsSaving(true);
    const { data, status } = await createApiKey(newName.trim(), expiresAt);
    setIsSaving(false);
    if (!data) {
      if (status === 400) setError("Requête invalide (nom, date d'expiration ou quota de jetons dépassé).");
      else if (status === 401 || status === 403) setError("Session expirée, reconnectez-vous");
      else setError("Erreur serveur");
      return;
    }
    setCreated(data);
    setIsRotation(false);
    setNewName("");
    setNewExpiresAt("");
    setIsCreating(false);
    await load();
  }

  async function handleRotate(id: string, name: string) {
    if (
      !confirm(
        `Faire tourner le jeton « ${name} » ?\n\nUne nouvelle valeur sera générée et affichée une seule fois. ` +
          `L'ancienne cessera de fonctionner immédiatement : toute intégration qui l'utilise devra être mise à jour.`,
      )
    ) {
      return;
    }
    setError("");
    const { data, status } = await rotateMyApiKey(id);
    if (!data) {
      if (status === 400) setError("Ce jeton est révoqué ou expiré : créez-en un nouveau.");
      else if (status === 404) setError("Jeton introuvable");
      else if (status === 401 || status === 403) setError("Session expirée, reconnectez-vous");
      else setError("Rotation impossible");
      return;
    }
    setCreated(data);
    setIsRotation(true);
    await load();
  }

  async function handleRevoke(id: string) {
    if (!confirm("Révoquer cette clé ? Les requêtes utilisant cette clé échoueront immédiatement.")) return;
    const ok = await revokeMyApiKey(id);
    if (!ok) setError("Révocation impossible");
    await load();
  }

  async function handlePurge(id: string, name: string) {
    if (!confirm(`Supprimer définitivement la clé « ${name} » ? Cette action est irréversible.`)) return;
    const ok = await purgeMyApiKey(id);
    if (!ok) setError("Suppression impossible");
    await load();
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopyFeedback("Copiée !");
      setTimeout(() => setCopyFeedback(""), 2000);
    } catch {
      setCopyFeedback("Copie manuelle requise");
    }
  }

  return (
    <div className="bg-blanc rounded-xl shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-noir">Mes jetons d&apos;API</h2>
        {!isCreating && !created && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="px-3 py-1.5 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90"
          >
            Nouveau jeton
          </button>
        )}
      </div>

      <p className="text-sm text-gris mb-4">
        Un jeton d&apos;API vous permet d&apos;accéder à l&apos;API depuis un client externe (script,
        application mobile, etc.). Les jetons héritent de vos droits courants. La valeur complète
        n&apos;est affichée qu&apos;une seule fois, à la création.
      </p>

      {/* Creation form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-blanc-casse rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Nom du jeton</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Mon app mobile"
                required
                maxLength={80}
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-noir mb-1">
                Date d&apos;expiration <span className="text-gris text-xs">(optionnelle)</span>
              </label>
              <input
                type="datetime-local"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
            >
              {isSaving ? "Création..." : "Créer le jeton"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewName("");
                setNewExpiresAt("");
                setError("");
              }}
              className="px-4 py-2 text-sm font-medium text-gris hover:text-noir"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* One-shot display, shared by creation and rotation */}
      {created && (
        <div className="mb-6 p-4 border-2 border-malachite rounded-lg bg-malachite/5">
          <h3 className="text-sm font-bold text-malachite mb-2">
            {isRotation ? "Jeton renouvelé" : "Nouveau jeton créé"} : {created.name}
          </h3>
          <p className="text-sm text-noir mb-3">
            <strong>Copiez cette clé maintenant.</strong> Elle ne sera plus jamais affichée.
            {isRotation && " L'ancienne valeur ne fonctionne plus."}
          </p>
          <div className="flex items-stretch gap-2 mb-3">
            <code className="flex-1 px-3 py-2 bg-blanc border border-gris/30 rounded text-xs font-mono break-all">
              {created.key}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 whitespace-nowrap"
            >
              Copier
            </button>
          </div>
          {copyFeedback && <p className="text-xs text-malachite mb-3">{copyFeedback}</p>}
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="text-sm font-medium text-gris hover:text-noir"
          >
            J&apos;ai copié la clé, fermer
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm">{error}</div>
      )}

      {/* Keys list */}
      {isLoading ? (
        <p className="text-sm text-gris py-6">Chargement...</p>
      ) : !keys || keys.length === 0 ? (
        <p className="text-sm text-gris py-6">Aucun jeton pour le moment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gris/20">
                <th className="py-2 pr-4 text-noir font-medium">Nom</th>
                <th className="py-2 pr-4 text-noir font-medium">Préfixe</th>
                <th className="py-2 pr-4 text-noir font-medium">Statut</th>
                <th className="py-2 pr-4 text-noir font-medium">Dernière utilisation</th>
                <th className="py-2 pr-4 text-noir font-medium">Expiration</th>
                <th className="py-2 pr-4 text-noir font-medium">Créée le</th>
                <th className="py-2 text-right text-noir font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const status = statusLabel(k);
                return (
                  <tr key={k.id} className="border-b border-gris/10">
                    <td className="py-3 pr-4 text-noir">{k.name}</td>
                    <td className="py-3 pr-4">
                      <code className="text-xs font-mono text-gris">{k.prefix}…</code>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gris">{formatDate(k.lastUsedAt, "Jamais")}</td>
                    <td className="py-3 pr-4 text-gris">{formatDate(k.expiresAt)}</td>
                    <td className="py-3 pr-4 text-gris">{formatDate(k.createdAt)}</td>
                    <td className="py-3 text-right">
                      {k.revokedAt ? (
                        <button
                          type="button"
                          onClick={() => handlePurge(k.id, k.name)}
                          className="text-terre-cuite hover:underline text-sm"
                          title="La clé est déjà révoquée ; cette action la supprime définitivement."
                        >
                          Supprimer définitivement
                        </button>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          {/* An expired key cannot be rotated (the API refuses it):
                              offer the action only where it can succeed. */}
                          {status.label === "Active" && (
                            <button
                              type="button"
                              onClick={() => handleRotate(k.id, k.name)}
                              className="text-bleu hover:underline text-sm"
                              title="Génère une nouvelle valeur pour ce jeton. L'ancienne cessera de fonctionner immédiatement."
                            >
                              Faire tourner
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRevoke(k.id)}
                            className="text-terre-cuite hover:underline text-sm"
                          >
                            Révoquer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
