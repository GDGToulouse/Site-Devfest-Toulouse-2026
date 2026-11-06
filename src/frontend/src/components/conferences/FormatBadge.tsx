/**
 * A talk's format, as a pill. The keynote stands out everywhere a talk is listed
 * (#808): it is the session the whole audience gathers for, and a pill the same
 * pale blue as a quickie's said nothing of that.
 */
export default function FormatBadge({
  format,
  label,
  size = "md",
}: {
  format: string;
  label: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  if (format !== "KEYNOTE") {
    return <span className={`whitespace-nowrap rounded-full bg-bleu/10 font-bold text-bleu ${box}`}>{label}</span>;
  }
  return (
    <span className={`whitespace-nowrap rounded-full bg-noir font-bold text-jaune ${box}`}>
      <span aria-hidden="true">★ </span>
      {label}
    </span>
  );
}
