import type { ScanOutcome } from "@/lib/arrivals-api";
import type { OfflineAnswer } from "@/lib/arrivals-offline";
import { binColor, binOf, counterOf, type BadgeState } from "@/lib/arrivals-live";

// What the Scan volunteer reads out (RG-ARR-32, RG-ARR-33): the number and the
// counter first, big enough to say aloud from arm's length; then who it is, to
// check. Each way out of the normal path has its own colour and words.

export type ScanResult = { source: "online"; outcome: ScanOutcome } | { source: "offline"; answer: OfflineAnswer };

const STATE_WORDS: Record<BadgeState, string> = {
  PRINTED: "encore dans son bac",
  TO_FETCH: "à chercher",
  READY: "prêt",
  DELIVERED: "déjà distribué",
};

function formatTime(iso: string): string {
  const [hours, minutes] = new Date(iso)
    .toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", minute: "2-digit" })
    .split(":");
  return `${hours} h ${minutes}`;
}

function BadgeAnswer({ number }: { number: number }) {
  const bin = binOf(number);
  return (
    <>
      <p className="font-mono text-7xl font-bold leading-none tabular-nums text-noir">{number}</p>
      <p className="text-3xl font-bold text-terre-cuite">Guichet {counterOf(number)}</p>
      <p className="inline-flex items-center gap-2 self-center rounded-full border border-gris/30 px-3 py-0.5 text-sm text-noir">
        <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-full ${binColor(bin)}`} />
        bac {bin}
      </p>
    </>
  );
}

function Person({ attendee }: { attendee: { firstName: string; lastName: string; company: string | null } }) {
  return (
    <>
      <p className="text-lg text-noir">
        {attendee.firstName} {attendee.lastName}
      </p>
      {attendee.company && <p className="text-sm text-gris">{attendee.company}</p>}
    </>
  );
}

function Detour({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border-4 bg-blanc p-5 text-center ${tone}`}>
      <p className="text-3xl font-bold">{title}</p>
      {children}
    </div>
  );
}

export default function ScanResultCard({ result }: { result: ScanResult }) {
  if (result.source === "offline") {
    const { answer } = result;
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="rounded-2xl bg-orange/15 p-3 text-center text-sm font-bold text-noir">
          Mode dégradé : rien n&apos;est enregistré
        </p>
        {answer.kind === "badge" ? (
          <div className="flex flex-col gap-2 rounded-2xl border-4 border-bleu bg-blanc p-5 text-center">
            <BadgeAnswer number={answer.number} />
            <p className="text-sm text-gris">Le guichet cherche le badge dans le bac, d&apos;après le numéro.</p>
          </div>
        ) : answer.kind === "dedicated" ? (
          <Detour title="Accueil dédié" tone="border-malachite text-malachite">
            <p className="text-sm text-gris">Speaker, staff, bénévole ou prestataire.</p>
          </Detour>
        ) : (
          <Detour title="Guichet d'aide" tone="border-terre-cuite text-terre-cuite">
            <p className="text-sm text-gris">
              {answer.kind === "ambiguous"
                ? "Ce code ne suffit pas sans le serveur."
                : "Code introuvable sans le serveur : billet sans numéro, annulé ou mal lu."}
            </p>
          </Detour>
        )}
      </div>
    );
  }

  const { outcome } = result;
  if (outcome.result === "unknown") {
    return (
      <Detour title="Code inconnu" tone="border-rouge text-rouge">
        <p className="text-sm text-noir">Cherchez la personne par son nom, sinon envoyez-la au guichet d&apos;aide.</p>
      </Detour>
    );
  }
  if (outcome.result === "cancelled") {
    return (
      <Detour title="Billet annulé" tone="border-rouge text-rouge">
        <Person attendee={outcome.attendee} />
        <p className="text-sm text-noir">Cherchez un autre billet par son nom, sinon envoyez la personne au guichet d&apos;aide.</p>
      </Detour>
    );
  }

  const already = outcome.alreadyScanned && (
    <p role="alert" className="rounded-2xl border-2 border-orange bg-orange/10 p-3 text-sm text-noir">
      <strong>Déjà scanné</strong> à {formatTime(outcome.alreadyScanned.at)}
      {outcome.alreadyScanned.by ? ` par ${outcome.alreadyScanned.by}` : ""}
      {outcome.result === "badge" &&
        ` : badge ${STATE_WORDS[outcome.badge.state]}, guichet ${counterOf(outcome.badge.number)}`}
      .
    </p>
  );

  if (outcome.result === "dedicated") {
    return (
      <div className="flex flex-col gap-3">
        {already}
        <Detour title="Accueil dédié" tone="border-malachite text-malachite">
          <Person attendee={outcome.attendee} />
          {outcome.attendee.tierName && <p className="text-sm text-gris">{outcome.attendee.tierName}</p>}
        </Detour>
      </div>
    );
  }
  if (outcome.result === "help") {
    return (
      <div className="flex flex-col gap-3">
        {already}
        <Detour title="Guichet d'aide" tone="border-terre-cuite text-terre-cuite">
          <Person attendee={outcome.attendee} />
          <p className="text-sm text-gris">Pas de badge imprimé pour ce billet.</p>
        </Detour>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {already}
      <div className="flex flex-col gap-2 rounded-2xl border-4 border-bleu bg-blanc p-5 text-center">
        <BadgeAnswer number={outcome.badge.number} />
        <Person attendee={outcome.attendee} />
      </div>
    </div>
  );
}
