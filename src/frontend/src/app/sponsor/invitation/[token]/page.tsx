"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getInvitationPreview, acceptInvitation, type InvitationPreview } from "@/lib/sponsor-api";
import SponsorLogin from "@/components/sponsor-space/SponsorLogin";
import { describeSponsorRole } from "@/lib/sponsor-roles";

// Accepting an invitation to a sponsor space (#362).
//
// Three states, in order: describe the invitation, get the visitor signed in
// with the invited address, bind the account. The binding is a separate step
// rather than a side effect of signing in, because the email may not match —
// and that has to be said out loud instead of failing silently.
//
// Signing in leaves through window.location, so this component remounts with
// its state gone. It therefore retries the binding on mount: without that, an
// account created here lands back on "Accept the invitation" with no hint the
// sign-up worked, and the contact stays unlinked until someone clicks again.

export default function SponsorInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    getInvitationPreview(token).then(async ({ data }) => {
      setPreview(data);
      // Coming back from sign-up, the session is already there and the visitor
      // has nothing left to confirm — bind straight away. A 401 just means they
      // arrived from their mailbox, so fall through to the normal screen.
      if (data) await accept({ silent: true });
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function accept({ silent = false }: { silent?: boolean } = {}) {
    setIsAccepting(true);
    setError(null);
    const { data, status, error: apiError } = await acceptInvitation(token);

    if (status === 401) {
      // Not signed in yet — show the sign-in form rather than an error. On the
      // silent attempt this is the expected answer, so say nothing.
      setNeedsSignIn(!silent);
      setIsAccepting(false);
      return;
    }
    if (status === 403 && apiError === "email_mismatch") {
      // Deliberately does not name the invited address: whoever holds a
      // forwarded link must not learn it (#362).
      setError(
        "Cette invitation a été émise pour une autre adresse email. Connectez-vous avec l'adresse qui l'a reçue, ou demandez à l'équipe DevFest de vous la renvoyer.",
      );
      setIsAccepting(false);
      return;
    }
    if (!data) {
      // Silent attempt: the visitor asked for nothing, so an error here would
      // come out of nowhere. Let them press the button and get it in context.
      if (!silent) {
        setError("Cette invitation n'est plus valable. Demandez-en une nouvelle à l'équipe DevFest.");
      }
      setIsAccepting(false);
      return;
    }

    router.push(`/sponsor/${data.sponsorId}`);
  }

  if (isLoading) {
    return <Shell><p className="text-center text-gris">Chargement…</p></Shell>;
  }

  if (!preview) {
    return (
      <Shell>
        <p className="text-center text-noir">
          Cette invitation n&apos;est plus valable — elle a peut-être expiré ou déjà été utilisée.
        </p>
        <p className="mt-4 text-center text-sm text-gris">
          Demandez-en une nouvelle à l&apos;équipe DevFest Toulouse.
        </p>
      </Shell>
    );
  }

  if (needsSignIn) {
    return <SponsorLogin callbackURL={`/sponsor/invitation/${token}`} mode="signup" />;
  }

  return (
    <Shell>
      <p className="text-noir">
        Vous avez été invité à gérer la fiche de <strong>{preview.sponsorName}</strong> sur le site du
        DevFest Toulouse.
      </p>
      <p className="mt-3 text-sm text-gris">
        Rôle proposé : {describeSponsorRole(preview.accessRole)}
      </p>
      <p className="mt-3 text-sm text-gris">
        Connectez-vous avec l&apos;adresse <strong>{preview.emailHint}</strong>{" "}
        — l&apos;invitation ne fonctionne qu&apos;avec celle-ci.
      </p>

      {error && <p className="mt-4 rounded-lg bg-terre-cuite/10 p-3 text-sm text-terre-cuite">{error}</p>}

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
        <h1 className="mb-6 text-center text-2xl font-bold text-noir">Espace partenaire</h1>
        {children}
      </div>
    </div>
  );
}
