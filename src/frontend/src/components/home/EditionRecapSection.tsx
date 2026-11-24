import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { surfaceBgClass, type SectionSurface } from "./section-surface";

// The edition that just ended (#872), shown from the day after: what is
// already there — its talks and speakers — the replays once enough of them are
// online, and the archives. Built on what exists the next morning, so the page
// is never empty while the aftermovie and the photos are still to come.

/** The replays get their own card once at least half the talks have one. */
export function areReplaysReady(talks: { videoUrl: string | null }[]): boolean {
  const withReplay = talks.filter((talk) => talk.videoUrl).length;
  return talks.length > 0 && withReplay * 2 >= talks.length;
}

export default function EditionRecapSection({
  year,
  hasReplays,
  surface = "blanc-casse",
}: {
  year: number;
  hasReplays: boolean;
  surface?: SectionSurface;
}) {
  const t = useTranslations("home.recap");

  const cardClass =
    "block h-full rounded-2xl bg-blanc p-6 text-left shadow-card transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bleu";

  const cards = [
    { key: "talks", href: "/conferences" },
    { key: "speakers", href: "/speakers" },
    hasReplays ? { key: "replays", href: `/replays?year=${year}` } : { key: "replaysSoon", href: null },
    { key: "editions", href: "/editions" },
  ] as const;

  return (
    <section className={`section-y px-6 ${surfaceBgClass(surface)}`}>
      <div className="mx-auto max-w-6xl">
        <h2 className="section-title text-center text-3xl font-bold text-noir lg:text-5xl">{t("title", { year })}</h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-lg text-gris">{t("nextYear")}</p>
        <ul className="mx-auto grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ key, href }) => {
            const body = (
              <>
                <span className="block text-xl font-bold text-noir">{t(`${key}.title`)}</span>
                <span className="mt-2 block text-base text-gris">{t(`${key}.text`, { year })}</span>
              </>
            );
            return (
              <li key={key}>
                {/* Replays still to come: a card that says so, not a link to an
                    empty page. */}
                {href ? (
                  <Link href={href} className={cardClass}>
                    {body}
                  </Link>
                ) : (
                  <div className="h-full rounded-2xl border-2 border-dashed border-gris/30 p-6 text-left">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
