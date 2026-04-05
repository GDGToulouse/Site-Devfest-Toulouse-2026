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

export default function StatIcon({ name, className = "w-12 h-12" }: StatIconProps) {
  const icon = icons[name];
  if (!icon) return null;

  return (
    <span className={`inline-block text-malachite ${className}`}>
      <FontAwesomeIcon icon={icon} className="w-full h-full" aria-hidden="true" />
    </span>
  );
}
