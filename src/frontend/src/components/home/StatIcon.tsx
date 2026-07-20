import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { findStatIcon } from "@/lib/stat-icons";

interface StatIconProps {
  name: string;
  className?: string;
}

// Renders a key-figure icon from the shared catalogue (#164). An unknown key
// renders nothing — the admin picker and the API validation both constrain the
// value, so this only guards against legacy rows.
export default function StatIcon({ name, className = "" }: StatIconProps) {
  const entry = findStatIcon(name);
  if (!entry) return null;

  return (
    <span className={`text-malachite ${className}`}>
      <FontAwesomeIcon icon={entry.icon} aria-hidden="true" />
    </span>
  );
}
