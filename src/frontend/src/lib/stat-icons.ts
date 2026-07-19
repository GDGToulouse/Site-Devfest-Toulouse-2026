import {
  faCalendarDays,
  faUsers,
  faMicrophone,
  faHandshake,
  faLocationDot,
  faClock,
  faTicket,
  faMugHot,
  faCode,
  faLightbulb,
  faTrophy,
  faHeart,
  faRocket,
  faStar,
  faBuilding,
  faGift,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

// Single source of truth for key-figure icons (#164).
//
// This catalogue drives BOTH the admin picker and the public rendering. Before,
// the admin took free text while the renderer only knew four keys, so a typo
// silently rendered no icon at all. Adding an entry here makes it available and
// renderable at once — the two can no longer drift apart.
//
// `key` is what gets stored in KeyFigure.icon; keep existing keys stable, they
// are already in the database.
export interface StatIconOption {
  key: string;
  labelFr: string;
  labelEn: string;
  icon: IconDefinition;
}

export const STAT_ICONS: StatIconOption[] = [
  { key: "calendar", labelFr: "Calendrier", labelEn: "Calendar", icon: faCalendarDays },
  { key: "users", labelFr: "Participants", labelEn: "Attendees", icon: faUsers },
  { key: "microphone", labelFr: "Micro", labelEn: "Microphone", icon: faMicrophone },
  { key: "handshake", labelFr: "Partenariat", labelEn: "Partnership", icon: faHandshake },
  { key: "location", labelFr: "Lieu", labelEn: "Venue", icon: faLocationDot },
  { key: "clock", labelFr: "Horloge", labelEn: "Clock", icon: faClock },
  { key: "ticket", labelFr: "Billet", labelEn: "Ticket", icon: faTicket },
  { key: "coffee", labelFr: "Café", labelEn: "Coffee", icon: faMugHot },
  { key: "code", labelFr: "Code", labelEn: "Code", icon: faCode },
  { key: "lightbulb", labelFr: "Idée", labelEn: "Idea", icon: faLightbulb },
  { key: "trophy", labelFr: "Trophée", labelEn: "Trophy", icon: faTrophy },
  { key: "heart", labelFr: "Cœur", labelEn: "Heart", icon: faHeart },
  { key: "rocket", labelFr: "Fusée", labelEn: "Rocket", icon: faRocket },
  { key: "star", labelFr: "Étoile", labelEn: "Star", icon: faStar },
  { key: "building", labelFr: "Bâtiment", labelEn: "Building", icon: faBuilding },
  { key: "gift", labelFr: "Cadeau", labelEn: "Gift", icon: faGift },
];

const BY_KEY = new Map(STAT_ICONS.map((entry) => [entry.key, entry]));

export function findStatIcon(key: string): StatIconOption | undefined {
  return BY_KEY.get(key);
}
