"use client";

// The chips both filter bars are built from — the session list (#107) and the
// schedule grid (#448). Shared so the two look like one control, and so a
// change of design lands on both at once.

export function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="shrink-0 text-sm font-semibold text-noir sm:w-24">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        active ? "bg-malachite text-blanc" : "bg-blanc-casse text-noir hover:bg-gris/15"
      }`}
    >
      {children}
    </button>
  );
}
