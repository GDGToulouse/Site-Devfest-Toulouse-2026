import type { StreamStatus } from "@/lib/use-arrivals-stream";

// Always on screen (RG-ARR-60): a volunteer must never work on a stale state
// without knowing it. Colour and word both, colour alone fails the colour-blind.
const STATUS_DISPLAY: Record<StreamStatus, { label: string; dot: string }> = {
  connected: { label: "Connecté", dot: "bg-malachite" },
  reconnecting: { label: "Reconnexion…", dot: "bg-orange" },
  disconnected: { label: "Déconnecté", dot: "bg-rouge" },
};

export default function ConnectionIndicator({ status }: { status: StreamStatus }) {
  const { label, dot } = STATUS_DISPLAY[status];
  return (
    <p role="status" className="flex items-center gap-2 text-sm font-medium text-noir" data-status={status}>
      <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-full ${dot}`} />
      {label}
    </p>
  );
}
