"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import SponsorFeedback, { type SponsorMessage } from "@/components/sponsor-space/SponsorFeedback";
import { changeSponsorPassword, getSponsorAccount, type SponsorAccount } from "@/lib/sponsor-api";

// A sponsor's own account (#411): who is signed in, and a password they can
// change without asking the team. Same rules as the admin profile page.
const MIN_PASSWORD_LENGTH = 10;

export default function SponsorAccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<SponsorAccount | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<SponsorMessage | null>(null);

  useEffect(() => {
    getSponsorAccount().then(({ data, status }) => {
      if (status === 401) {
        router.replace("/sponsor/login?next=/sponsor/account");
        return;
      }
      setAccount(data);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage({ isOk: false, text: `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.` });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ isOk: false, text: "Les deux nouveaux mots de passe ne correspondent pas." });
      return;
    }

    setIsSaving(true);
    const { status } = await changeSponsorPassword(currentPassword, newPassword);
    setIsSaving(false);

    // Success is 200 only: status 0 means the request never left (#428), and a
    // refusal stays on screen until the next attempt (#394).
    if (status === 200) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ isOk: true, text: "Votre mot de passe a été modifié." });
    } else if (status === 0) {
      setMessage({ isOk: false, text: "Le serveur n'a pas pu être joint. Vérifiez votre connexion et réessayez." });
    } else {
      setMessage({ isOk: false, text: "Le mot de passe actuel est incorrect. Vérifiez-le et réessayez." });
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-blanc-casse px-6 py-10">
      <div className="w-full max-w-md rounded-3xl bg-blanc p-8 shadow-card">
        <h1 className="mb-6 text-center text-2xl font-bold text-noir">Mon compte</h1>

        {!account ? (
          <p className="text-center text-gris">Chargement…</p>
        ) : (
          <>
            <dl className="mb-8 space-y-2 text-sm">
              {account.name && (
                <div>
                  <dt className="text-gris">Nom</dt>
                  <dd className="font-medium text-noir">{account.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-gris">Adresse e-mail de connexion</dt>
                <dd className="break-all font-medium text-noir">{account.email}</dd>
              </div>
            </dl>

            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-bold text-noir">Changer le mot de passe</h2>
              <PasswordField
                label="Mot de passe actuel"
                autoComplete="current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
              />
              <PasswordField
                label="Nouveau mot de passe"
                hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères.`}
                autoComplete="new-password"
                value={newPassword}
                onChange={setNewPassword}
              />
              <PasswordField
                label="Confirmer le nouveau mot de passe"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
              />

              <SponsorFeedback message={message} />

              <button
                type="submit"
                disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
                className="w-full rounded-[12px] bg-malachite px-4 py-3 font-bold text-blanc transition-colors hover:bg-malachite/90 disabled:opacity-50"
              >
                {isSaving ? "Enregistrement…" : "Changer le mot de passe"}
              </button>
            </form>
          </>
        )}

        <Link href="/sponsor" className="mt-6 block text-center text-sm font-medium text-bleu hover:underline">
          ← Retour à mes fiches
        </Link>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  hint,
  autoComplete,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-noir">{label}</span>
      <input
        type="password"
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
      />
      {hint && <span className="mt-1 block text-xs text-gris">{hint}</span>}
    </label>
  );
}
