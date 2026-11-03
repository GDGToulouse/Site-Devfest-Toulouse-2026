import { useLocale, useTranslations } from "next-intl";

import { formatEventDay, formatEventTime } from "@/lib/datetime";
import type { TalkDetail } from "@/lib/types";

type Props = Pick<TalkDetail, "startsAt" | "endsAt" | "room" | "simulcasts">;

/**
 * When and where a talk is given (#717): the day, the hours, the room, and the
 * rooms a keynote is relayed to (#456). A participant opens this page from the
 * programme, a favourite or the speaker's QR code (#564) to know where to go.
 *
 * Toulouse time through `formatEventTime`, whatever zone the server runs on.
 * A talk not placed yet renders nothing, not an empty line.
 */
export default function TalkSlot({ startsAt, endsAt, room, simulcasts }: Props) {
  const t = useTranslations("conferences.slot");
  const locale = useLocale();

  // A relay whose room was never labelled has nothing to say (as on the grid).
  const relays = (simulcasts ?? []).flatMap((relay) => (relay.room ? [relay.room] : []));
  const parts: string[] = [];
  if (startsAt) {
    parts.push(formatEventDay(startsAt, locale));
    const start = formatEventTime(startsAt);
    parts.push(endsAt ? `${start} – ${formatEventTime(endsAt)}` : start);
  }
  if (room) parts.push(room);
  if (relays.length > 0) {
    const rooms = new Intl.ListFormat(locale === "en" ? "en-GB" : "fr-FR", { type: "conjunction" }).format(relays);
    parts.push(t("relayedIn", { rooms }));
  }

  if (parts.length === 0) return null;
  return <p className="mt-4 text-lg font-bold text-bleu">{parts.join(" · ")}</p>;
}
