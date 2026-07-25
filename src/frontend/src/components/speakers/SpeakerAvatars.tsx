import { Link } from "@/i18n/navigation";
import SpeakerPhoto from "@/components/speakers/SpeakerPhoto";

interface SpeakerAvatarsProps {
  speakers: { slug: string; name: string; photoUrl: string | null }[];
  // Past editions link to their year-scoped speaker page; the current edition
  // uses the plain /speakers route. Omit for the featured edition.
  year?: number;
  // Stacked avatars stay readable up to a point; beyond it the rest is folded
  // into a +N bubble while the names line still lists everyone.
  max?: number;
  // Set when the caller already wraps the whole card in a link: <a> inside <a>
  // is invalid HTML, so the names render as plain text there.
  asPlainText?: boolean;
}

// Shared between the conference list (#207) and the Hall of replays (#344),
// which had drifted into two separate implementations of the same design.
export default function SpeakerAvatars({
  speakers,
  year,
  max = 4,
  asPlainText = false,
}: SpeakerAvatarsProps) {
  const shown = speakers.slice(0, max);
  const extra = speakers.length - shown.length;

  // `/speakers/[slug]` only serves the featured edition, so a past speaker needs
  // its year-scoped page (#103) — linking there instead would 404.
  const speakerHref = (slug: string) =>
    year === undefined ? `/speakers/${slug}` : `/editions/${year}/speakers/${slug}`;

  const avatarClass =
    "relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-blanc-casse ring-2 ring-blanc";

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {shown.map((speaker) => {
          // Historical speakers often have no photo at all (dead paths dropped
          // at import) or one hosted on a third-party domain — SpeakerPhoto
          // handles both without taking the page down.
          const face = <SpeakerPhoto photoUrl={speaker.photoUrl} name={speaker.name} size={32} />;

          return asPlainText ? (
            <span key={speaker.slug} className={avatarClass} title={speaker.name}>
              {face}
            </span>
          ) : (
            <Link
              key={speaker.slug}
              href={speakerHref(speaker.slug)}
              className={`${avatarClass} transition-transform hover:z-10 hover:scale-110`}
              title={speaker.name}
            >
              {face}
            </Link>
          );
        })}
        {extra > 0 && (
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blanc-casse text-xs font-bold text-gris ring-2 ring-blanc">
            +{extra}
          </span>
        )}
      </div>

      <p className="text-sm text-gris">
        {asPlainText
          ? speakers.map((s) => s.name).join(", ")
          : speakers.map((speaker, i) => (
              <span key={speaker.slug}>
                {i > 0 && ", "}
                <Link href={speakerHref(speaker.slug)} className="hover:text-bleu hover:underline">
                  {speaker.name}
                </Link>
              </span>
            ))}
      </p>
    </div>
  );
}
