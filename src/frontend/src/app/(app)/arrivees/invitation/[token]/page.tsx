"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import SponsorLogin from "@/components/sponsor-space/SponsorLogin";
import { ARRIVALS_SPACE } from "@/lib/account-spaces";
import { acceptArrivalsInvitation, getArrivalsInvitation, type ArrivalsInvitation } from "@/lib/arrivals-api";

// Accepting a volunteer invitation (#640), in the three steps of the sponsor
// one (sponsor/invitation/[token]/page.tsx, whose comments explain the silent
// retry on mount): describe it, get the invited address signed in, grant.

export default function ArrivalsInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [invitation, setInvitation] = useState<ArrivalsInvitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    getArrivalsInvitation(token).then(async ({ data }) => {
      setInvitation(data);
      if (data) await accept({ silent: true });
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function accept({ silent = false }: { silent?: boolean } = {}) {
    setIsAccepting(true);
    setError(null);
    const { data, status, error: apiError } = await acceptArrivalsInvitation(token);

    if (status === 401) {
      setNeedsSignIn(!silent);
      setIsAccepting(false);
      return;
    }
    if (status === 403 && apiError === "email_mismatch") {
      setError(
        "Cette invitation a été émise pour une autre adresse e-mail. Connectez-vous avec l'adresse qui l'a reçue, ou demandez à l'équipe DevFest de vous la renvoyer.",
      );
      setIsAccepting(false);
      return;
    }
    if (!data) {
      if (!silent) setError("Cette invitation n'est plus valable. Demandez-en une nouvelle à l'équipe DevFest.");
      setIsAccepting(false);
      return;
    }
    router.push("/arrivees");
  }

  if (isLoading) {
    return <Shell><p className="text-center text-gris">Chargement…</p></Shell>;
  }

  if (!invitation) {
    return (
      <Shell>
        <p className="text-center text-noir">
          Cette invitation n&apos;est plus valable : elle a peut-être expiré ou déjà servi.
        </p>
        <p className="mt-4 text-center text-sm text-gris">Demandez-en une nouvelle à l&apos;équipe DevFest Toulouse.</p>
      </Shell>
    );
  }

  if (needsSignIn) {
    return (
      <SponsorLogin
        callbackURL={`/arrivees/invitation/${token}`}
        invitationToken={token}
        emailHint={invitation.emailHint}
        space={ARRIVALS_SPACE}
      />
    );
  }

  return (
    <Shell>
      <p className="text-noir">
        Vous êtes invité·e à l&apos;accueil des participants du <strong>DevFest Toulouse {invitation.editionYear}</strong>,
        en tant que bénévole.
      </p>
      <p className="mt-3 text-sm text-gris">
        Connectez-vous avec l&apos;adresse <strong>{invitation.emailHint}</strong> : l&apos;invitation ne fonctionne
        qu&apos;avec celle-ci.
      </p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-terre-cuite/10 p-3 text-sm text-terre-cuite">{error}</p>}

      <button
        type="button"
        onClick={() => accept()}
        disabled={isAccepting}
        className="mt-6 w-full rounded-[12px] bg-malachite px-4 py-3 font-bold text-blanc transition-colors hover:bg-malachite/90 disabled:opacity-50"
      >
        {isAccepting ? "Validation…" : "Accepter l'invitation"}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-blanc-casse px-6 py-10">
      <div className="w-full max-w-md rounded-3xl bg-blanc p-8 shadow-card">
        <h1 className="mb-6 text-center text-2xl font-bold text-noir">{ARRIVALS_SPACE.name}</h1>
        {children}
      </div>
    </div>
  );
}
