"use client";

interface FavouriteButtonProps {
  isFavourite: boolean;
  onToggle: () => void;
  labels: { add: string; remove: string };
  /** Positioning is the caller's business — the card decides where it sits. */
  className?: string;
}

// The star on a session (#442). Shared by the grid, the mobile agenda and the
// session list, so the three stay one gesture.
//
// It sits *beside* the card's link, never inside it: a button nested in an
// anchor is invalid, and swallows the click on one of the two.
export default function FavouriteButton({
  isFavourite,
  onToggle,
  labels,
  className = "",
}: FavouriteButtonProps) {
  const label = isFavourite ? labels.remove : labels.add;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isFavourite}
      // The visible star is decorative; the accessible name carries the action,
      // and aria-pressed carries the state.
      aria-label={label}
      title={label}
      // no-print (#108): a star is a control, and a control on paper is noise.
      className={`no-print inline-flex size-8 items-center justify-center rounded-full text-lg transition-colors hover:bg-blanc-casse focus:outline-none focus:ring-2 focus:ring-malachite/50 ${
        isFavourite ? "text-orange" : "text-gris"
      } ${className}`}
    >
      <span aria-hidden>{isFavourite ? "★" : "☆"}</span>
    </button>
  );
}
