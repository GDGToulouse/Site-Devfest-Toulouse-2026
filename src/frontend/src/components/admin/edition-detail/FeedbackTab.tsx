"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch, humanError } from "@/lib/admin-api";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import FeedbackResults from "./FeedbackResults";

// The audience feedback of an edition (#563): its results (#565) and its test
// mode (#566), which opens voting before the event day so the team can try it,
// production included.

interface TestModeState {
  enabled: boolean;
  canEnable: boolean;
  opensAt: string | null;
  testVotes: number;
}

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" });

export default function FeedbackTab({ editionId }: { editionId: number }) {
  const [state, setState] = useState<TestModeState | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingOff, setIsConfirmingOff] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);

  const load = useCallback(async () => {
    const result = await adminFetch<TestModeState>(`/editions/${editionId}/feedback-test-mode`);
    // The test mode is ADMIN only; the team reads the edition but not this.
    if (result.status === 403) setIsForbidden(true);
    if (result.data) setState(result.data);
  }, [editionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function setMode(enabled: boolean) {
    setIsSaving(true);
    setFeedback(null);
    const result = await adminFetch<{ enabled: boolean; deleted: number }>(`/editions/${editionId}/feedback-test-mode`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
    setIsSaving(false);
    if (result.status !== 200 || !result.data) {
      setFeedback({ kind: "error", text: humanError(result, "Le mode test n'a pas pu être modifié.") });
      return;
    }
    setFeedback({
      kind: "ok",
      text: enabled
        ? "Mode test activé : les avis sont ouverts sur les pages des conférences."
        : `Mode test désactivé : ${result.data.deleted} avis de test supprimé${result.data.deleted > 1 ? "s" : ""}.`,
    });
    load();
  }

  if (isForbidden) {
    return <p className="text-sm text-gris">Les avis du public sont réservés aux administrateurs.</p>;
  }
  if (!state) return null;

  const opensAt = state.opensAt ? DATE_TIME.format(new Date(state.opensAt)) : null;

  return (
    <div className="space-y-8">
      <FeedbackResults editionId={editionId} />

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-noir">Mode test des avis</h2>
        <p className="text-sm text-gris">
          Ouvre les avis du public avant le jour de l’événement, pour vérifier que tout fonctionne, en prod comme en bêta.
          Les avis donnés pendant le test sont marqués comme tels et supprimés quand on le désactive.
          {opensAt && <> Les vrais avis s’ouvrent le <strong>{opensAt}</strong> : le mode test se coupe alors tout seul.</>}
        </p>

        <p className="text-base text-noir">
          {state.enabled ? (
            <>
              <strong className="text-malachite">Activé</strong> — {state.testVotes} avis de test enregistré
              {state.testVotes > 1 ? "s" : ""}.
            </>
          ) : (
            <strong>Désactivé</strong>
          )}
        </p>

        <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />

        {state.enabled ? (
          <button
            type="button"
            onClick={() => setIsConfirmingOff(true)}
            disabled={isSaving}
            className="rounded-[12px] bg-rouge px-[18px] py-3 text-base font-bold text-blanc disabled:opacity-50"
          >
            Désactiver et supprimer les avis de test
          </button>
        ) : state.canEnable ? (
          <button
            type="button"
            onClick={() => setMode(true)}
            disabled={isSaving}
            className="rounded-[12px] bg-malachite px-[18px] py-3 text-base font-bold text-blanc disabled:opacity-50"
          >
            Activer le mode test
          </button>
        ) : (
          <p className="text-sm text-gris">
            {state.opensAt
              ? "Le mode test n’est plus disponible : les vrais avis sont ouverts ou terminés."
              : "Renseignez la date de l’édition pour pouvoir activer le mode test."}
          </p>
        )}
      </section>

      <ConfirmDialog
        isOpen={isConfirmingOff}
        title="Désactiver le mode test ?"
        message={`${
          state.testVotes === 0
            ? "Aucun avis de test à supprimer."
            : state.testVotes === 1
              ? "L’avis de test et son éventuel message seront supprimés définitivement."
              : `Les ${state.testVotes} avis de test et leurs messages seront supprimés définitivement.`
        } Les vrais avis ne sont pas concernés.`}
        confirmLabel="Désactiver et supprimer"
        variant="danger"
        onConfirm={() => {
          setIsConfirmingOff(false);
          setMode(false);
        }}
        onCancel={() => setIsConfirmingOff(false)}
      />
    </div>
  );
}
