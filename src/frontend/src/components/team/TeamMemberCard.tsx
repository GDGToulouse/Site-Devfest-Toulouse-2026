import { useTranslations } from "next-intl";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBluesky, faGithub, faLinkedin, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import SpeakerPhoto from "@/components/speakers/SpeakerPhoto";
import type { TeamMember } from "@/lib/types";

// One organiser on the team page (#110). The links are icons, their network
// named in a tooltip on hover and keyboard focus (decision on the issue): the
// name also goes to assistive tech, which a hover-only label never reaches.
const LINKS: { field: keyof TeamMember; labelKey: "website" | "linkedin" | "twitter" | "github" | "bluesky"; icon: IconDefinition }[] = [
  { field: "websiteUrl", labelKey: "website", icon: faGlobe },
  { field: "linkedinUrl", labelKey: "linkedin", icon: faLinkedin },
  { field: "twitterUrl", labelKey: "twitter", icon: faXTwitter },
  { field: "githubUrl", labelKey: "github", icon: faGithub },
  { field: "blueskyUrl", labelKey: "bluesky", icon: faBluesky },
];

export default function TeamMemberCard({ member }: { member: TeamMember }) {
  const t = useTranslations("team");
  const name = `${member.firstName} ${member.lastName}`;
  const links = LINKS.filter((l) => member[l.field]);

  return (
    <li className="flex flex-col items-center rounded-2xl bg-blanc p-6 text-center shadow-card">
      <div className="relative h-32 w-32 overflow-hidden rounded-full bg-blanc-casse">
        <SpeakerPhoto photoUrl={member.photoUrl} name={name} size={128} />
      </div>
      <h2 className="mt-4 text-lg font-bold text-noir">{name}</h2>
      {links.length > 0 && (
        <ul className="mt-3 flex flex-wrap justify-center gap-3">
          {links.map((link) => {
            const network = t(link.labelKey);
            return (
              <li key={link.field}>
                <a
                  href={member[link.field] as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("linkOf", { network, name })}
                  className="group relative flex h-10 w-10 items-center justify-center rounded-full text-gris transition-colors hover:bg-blanc-casse hover:text-noir focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-malachite"
                >
                  <FontAwesomeIcon icon={link.icon} className="h-5 w-5" aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-noir px-2 py-1 text-xs text-blanc opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    {network}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
