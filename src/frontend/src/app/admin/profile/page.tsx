"use client";

import { useState, useEffect } from "react";
import { adminFetch, getAdminSession } from "@/lib/admin-api";
import ApiKeysSection from "@/components/admin/ApiKeysSection";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "EDITOR";
}

export default function ProfilePage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Profile form
  const [name, setName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    async function load() {
      const session = await getAdminSession();
      if (session) {
        setUser(session);
        setName(session.name || "");
      }
      setIsLoading(false);
    }
    load();
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSaved(false);
    setProfileError("");

    const { status } = await adminFetch("/profile", {
      method: "PUT",
      body: JSON.stringify({ name }),
    });

    setIsSavingProfile(false);
    if (status === 200) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } else {
      setProfileError("Erreur lors de la sauvegarde");
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSaved(false);

    if (newPassword.length < 10) {
      setPasswordError("Le mot de passe doit contenir au moins 10 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas");
      return;
    }

    setIsSavingPassword(true);

    try {
      const res = await fetch(`/api/auth/change-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      setIsSavingPassword(false);

      if (res.ok) {
        setPasswordSaved(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSaved(false), 3000);
      } else {
        const data = await res.json().catch(() => null);
        setPasswordError(data?.message || "Mot de passe actuel incorrect");
      }
    } catch {
      setIsSavingPassword(false);
      setPasswordError("Erreur de connexion au serveur");
    }
  }

  if (isLoading) {
    return <div className="text-gris py-20 text-center">Chargement...</div>;
  }

  if (!user) {
    return <div className="text-terre-cuite py-20 text-center">Non connecté</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-noir mb-8">Mon profil</h1>

      {/* Profile info */}
      <form onSubmit={handleSaveProfile}>
        <div className="bg-blanc rounded-xl shadow-card p-6 mb-6">
          <h2 className="text-lg font-bold text-noir mb-4">Informations personnelles</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Nom</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Email</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-gris bg-blanc-casse cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gris">L&apos;email ne peut pas être modifié</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-noir mb-1">Rôle</label>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              user.role === "ADMIN" ? "bg-malachite/10 text-malachite" : "bg-bleu/10 text-bleu"
            }`}>
              {user.role === "ADMIN" ? "Administrateur" : "Éditeur"}
            </span>
          </div>

          {profileError && (
            <div className="mb-4 p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm">{profileError}</div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
            >
              {isSavingProfile ? "Enregistrement..." : "Enregistrer"}
            </button>
            {profileSaved && <span className="text-sm text-malachite">Enregistré !</span>}
          </div>
        </div>
      </form>

      {/* API keys */}
      <div className="mb-6">
        <ApiKeysSection />
      </div>

      {/* Password change */}
      <form onSubmit={handleChangePassword}>
        <div className="bg-blanc rounded-xl shadow-card p-6">
          <h2 className="text-lg font-bold text-noir mb-4">Changer le mot de passe</h2>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Mot de passe actuel</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={10}
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
              <p className="mt-1 text-xs text-gris">Minimum 10 caractères</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-noir mb-1">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-gris/30 px-3 py-2 text-sm text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50"
              />
            </div>
          </div>

          {passwordError && (
            <div className="mt-4 p-3 rounded-lg bg-terre-cuite/10 text-terre-cuite text-sm">{passwordError}</div>
          )}

          <div className="flex items-center gap-4 mt-4">
            <button
              type="submit"
              disabled={isSavingPassword}
              className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
            >
              {isSavingPassword ? "Modification..." : "Modifier le mot de passe"}
            </button>
            {passwordSaved && <span className="text-sm text-malachite">Mot de passe modifié !</span>}
          </div>
        </div>
      </form>
    </div>
  );
}
