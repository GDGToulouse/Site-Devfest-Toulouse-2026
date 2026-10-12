import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { Edition } from "@/lib/types";
import { surfaceBgClass, type SectionSurface } from "./section-surface";

// The last week and the day itself (#577): what a participant needs to get
// through the day — the programme and its favourites, the sessions in their
// own calendar, how to get to the venue. A card only shows when what it leads
// to exists: no programme card before a session is scheduled, no venue card
// without practical information.
export default function DayPlanSection({
  edition,
  isToday,
  surface = "blanc-casse",
}: {
  edition: Pick<Edition, "year" | "isScheduleReady" | "hasVenueInfo">;
  isToday: boolean;
  surface?: SectionSurface;
}) {
  const t = useTranslations("home.dayPlan");

  const cards = [
    edition.isScheduleReady && { key: "programme", href: "/programme", isDownload: false },
    edition.isScheduleReady && { key: "agenda", href: `/api/editions/${edition.year}/schedule.ics`, isDownload: true },
    edition.hasVenueInfo && { key: "venue", href: "/lieu", isDownload: false },
  ].filter((card): card is { key: "programme" | "agenda" | "venue"; href: string; isDownload: boolean } => Boolean(card));

  if (cards.length === 0) return null;

  // Fewer cards than columns: narrow the row so it stays centred instead of
  // clinging to the left edge of a three-column grid.
  const rowClass = ["md:grid-cols-1 max-w-sm", "md:grid-cols-2 max-w-3xl", "md:grid-cols-3"][cards.length - 1];

  const cardClass =
    "block h-full rounded-2xl bg-blanc p-6 text-left shadow-card transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bleu";

  return (
    <section className={`section-y px-6 ${surfaceBgClass(surface)}`}>
      <div className="mx-auto max-w-6xl">
        <h2 className="section-title text-center text-3xl font-bold text-noir lg:text-5xl">
          {isToday ? t("titleToday") : t("title")}
        </h2>
        <ul className={`mx-auto grid grid-cols-1 gap-6 ${rowClass}`}>
          {cards.map(({ key, href, isDownload }) => {
            const title = t(`${key}.${isToday && key === "programme" ? "titleToday" : "title"}`);
            const body = (
              <>
                <span className="block text-xl font-bold text-noir">{title}</span>
                <span className="mt-2 block text-base text-gris">{t(`${key}.text`)}</span>
              </>
            );
            return (
              <li key={key}>
                {/* The calendar file is an API route, not a page: a plain link,
                    so the router does not try to render it. */}
                {isDownload ? (
                  <a href={href} className={cardClass}>
                    {body}
                  </a>
                ) : (
                  <Link href={href} className={cardClass}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
