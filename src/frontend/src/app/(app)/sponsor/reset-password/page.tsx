"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import SponsorFeedback, { type SponsorMessage } from "@/components/sponsor-space/SponsorFeedback";
import { resetSponsorPassword } from "@/lib/sponsor-api";

// Where a sponsor's "forgotten password" link lands (#411). The admin page of
// the same name is titled "DevFest Admin" and sends to /admin, which refuses a
// sponsor account: this one stays inside the partner space.
const MIN_PASSWORD_LENGTH = 10;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  // better-auth sends back ?error=INVALID_TOKEN when the link is expired or used.
  const isLinkInvalid = !token || searchParams.get("error") === "INVALID_TOKEN";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [message, setMessage] = useState<SponsorMessage | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage({ isOk: false, text: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.` });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ isOk: false, text: "Les deux mots de passe ne correspondent pas." });
      return;
    }

    setIsSaving(true);
    const { status } = await resetSponsorPassword(token!, password);
    setIsSaving(false);

    if (status === 200) {
      setIsDone(true);
    } else if (status === 0) {
      setMessage({ isOk: false, text: "Le serveur n'a pas pu être joint. Vérifiez votre connexion et réessayez." });
    } else {
      setMessage({
        isOk: false,
        text: "Ce lien n'est plus valide : il a expiré ou a déjà servi. Demandez-en un nouveau depuis l'écran de connexion.",
      });
    }
  }

  if (isDone) {
    return (
      <>
        <p role="status" aria-live="polite" className="text-center text-noir">
          Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter avec lui.
        </p>
        <LoginLink label="Me connecter" />
      </>
    );
  }

  if (isLinkInvalid) {
    return (
      <>
        <p className="text-center text-noir">
          Ce lien n&apos;est plus valide : il a expiré ou a déjà servi.
        </p>
        <p className="mt-2 text-center text-sm text-gris">
          Demandez-en un nouveau avec « Mot de passe oublié ? » sur l&apos;écran de connexion.
        </p>
        <LoginLink label="Aller à l'écran de connexion" />
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gris">Choisissez un nouveau mot de passe pour votre espace partenaire.</p>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-noir">Nouveau mot de passe</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-gris">Au moins {MIN_PASSWORD_LENGTH} caractères.</span>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-noir">Confirmer le mot de passe</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
      </label>

      <SponsorFeedback message={message} />

      <button
        type="submit"
        disabled={isSaving || !password || !confirmPassword}
        className="w-full rounded-[12px] bg-malachite px-4 py-3 font-bold text-blanc transition-colors hover:bg-malachite/90 disabled:opacity-50"
      >
        {isSaving ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>
    </form>
  );
}

function LoginLink({ label }: { label: string }) {
  return (
    <Link
      href="/sponsor/login"
      className="mt-6 block w-full rounded-[12px] bg-malachite px-4 py-3 text-center font-bold text-blanc transition-colors hover:bg-malachite/90"
    >
      {label}
    </Link>
  );
}

export default function SponsorResetPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-blanc-casse px-6 py-10">
      <div className="w-full max-w-md rounded-3xl bg-blanc p-8 shadow-card">
        <h1 className="mb-2 text-center text-2xl font-bold text-noir">Espace partenaire</h1>
        <p className="mb-6 text-center text-sm text-gris">DevFest Toulouse</p>
        <Suspense fallback={<p className="text-center text-gris">Chargement…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gris/30 px-3 py-2 text-noir bg-blanc focus:outline-none focus:ring-2 focus:ring-malachite/50";
