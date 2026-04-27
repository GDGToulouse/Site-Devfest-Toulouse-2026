import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLinkedin, faYoutube, faXTwitter, faBluesky } from "@fortawesome/free-brands-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { SocialLinks } from "@/lib/types";

const SOCIAL_ITEMS: { key: keyof SocialLinks; name: string; icon: IconDefinition }[] = [
  { key: "social_linkedin", name: "LinkedIn", icon: faLinkedin },
  { key: "social_youtube", name: "YouTube", icon: faYoutube },
  { key: "social_x", name: "X (Twitter)", icon: faXTwitter },
  { key: "social_bluesky", name: "Bluesky", icon: faBluesky },
];

// Admin-saved values are the only source of truth. Empty/missing values
// hide the corresponding icon — no hardcoded fallback to GDG accounts,
// which would silently override an empty admin setting.
export default function SocialIcons({
  size = 24,
  className = "",
  links,
}: {
  size?: number;
  className?: string;
  links?: SocialLinks;
}) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {SOCIAL_ITEMS.map((social) => {
        const href = links?.[social.key]?.trim();
        if (!href) return null;
        return (
          <a
            key={social.key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.name}
            className="text-current hover:opacity-70 transition-opacity"
            style={{ width: size, height: size }}
          >
            <FontAwesomeIcon icon={social.icon} className="w-full h-full" aria-hidden="true" />
          </a>
        );
      })}
    </div>
  );
}
