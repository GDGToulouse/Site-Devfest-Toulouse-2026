import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays, faUsers, faMicrophone, faHandshake } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface StatIconProps {
  name: string;
  className?: string;
}

const icons: Record<string, IconDefinition> = {
  calendar: faCalendarDays,
  users: faUsers,
  microphone: faMicrophone,
  handshake: faHandshake,
};

export default function StatIcon({ name, className = "" }: StatIconProps) {
  const icon = icons[name];
  if (!icon) return null;

  return (
    <span className={`text-malachite ${className}`}>
      <FontAwesomeIcon icon={icon} aria-hidden="true" />
    </span>
  );
}
