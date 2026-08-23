import { Link } from "@/i18n/navigation";
import SpeakerPhoto from "@/components/speakers/SpeakerPhoto";

interface SpeakerAvatarsProps {
  speakers: { slug: string; name: string; photoUrl: string | null }[];
  // Stacked avatars stay readable up to a point; beyond it the rest is folded
  // into a +N bubble while the names line still lists everyone.
  max?: number;
  // Set when the caller already wraps the whole card in a link: <a> inside <a>
  // is invalid HTML, so the names render as plain text there.
  asPlainText?: boolean;
  /** Rendered bubble size in px — 24 in the schedule grid, 32 elsewhere (#463). */
  size?: number;
  // False in the schedule grid (#463), where a 180 px column has no room for a
  // names line and the bubble alone is what identifies the speaker.
  withNames?: boolean;
}

// Shared between the conference list (#207) and the Hall of replays (#344),
// which had drifted into two separate implementations of the same design.
export default function SpeakerAvatars({
  speakers,
  max = 4,
  asPlainText = false,
  size = 32,
  withNames = true,
}: SpeakerAvatarsProps) {
  const shown = speakers.slice(0, max);
  const extra = speakers.length - shown.length;

  // One person, one URL (#352). This used to branch on a `year` prop because
  // `/speakers/[slug]` was scoped to the featured edition and 404ed on anyone
  // else; the slug is global now, so the edition has no place in the path.
  const speakerHref = (slug: string) => `/speakers/${slug}`;

  // The size drives the box, `next/image`'s `sizes` hint and the initial's
  // scale at once, so it travels as a value rather than a class — Tailwind
  // cannot generate `h-6 w-6` from a prop.
  const bubble = { width: size, height: size };
  const avatarClass =
    "relative shrink-0 overflow-hidden rounded-full bg-blanc-casse ring-2 ring-blanc";

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {shown.map((speaker) => {
          // Historical speakers often have no photo at all (dead paths dropped
          // at import) or one hosted on a third-party domain — SpeakerPhoto
          // handles both without taking the page down.
          const face = <SpeakerPhoto photoUrl={speaker.photoUrl} name={speaker.name} size={size} />;

          return asPlainText ? (
            <span key={speaker.slug} className={avatarClass} style={bubble} title={speaker.name}>
              {face}
            </span>
          ) : (
            <Link
              key={speaker.slug}
              href={speakerHref(speaker.slug)}
              className={`${avatarClass} transition-transform hover:z-10 hover:scale-110`}
              style={bubble}
              // Without a photo the bubble is a single initial, and the alt text
              // of an image is what names the link — so the link announced
              // itself as "J". Only worth fixing where the bubble stands alone
              // (#463): beside a visible name, naming both would put two links
              // of the same name and the same target next to each other.
              aria-label={withNames ? undefined : speaker.name}
              title={speaker.name}
            >
              {face}
            </Link>
          );
        })}
        {extra > 0 && (
          <span
            className="relative flex shrink-0 items-center justify-center rounded-full bg-blanc-casse font-bold text-gris ring-2 ring-blanc"
            style={{ ...bubble, fontSize: Math.round(size / 2.6) }}
            // With no names line under it, +N is the only trace the folded
            // speakers leave on the card.
            title={withNames ? undefined : speakers.slice(max).map((s) => s.name).join(", ")}
          >
            +{extra}
          </span>
        )}
      </div>

      {withNames && (
        <p className="text-sm text-gris">
          {asPlainText
            ? speakers.map((s) => s.name).join(", ")
            : speakers.map((speaker, i) => (
                <span key={speaker.slug}>
                  {i > 0 && ", "}
                  {/* `relative` keeps the name clickable when a caller stretches
                      a link over the whole card (#350). */}
                  <Link
                    href={speakerHref(speaker.slug)}
                    className="relative hover:text-bleu hover:underline"
                  >
                    {speaker.name}
                  </Link>
                </span>
              ))}
        </p>
      )}
    </div>
  );
}
