"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

interface FavouritesRestoreNoticeProps {
  onRestore: () => void;
  onDismiss: () => void;
}

/**
 * Offered when a shared link's selection has replaced the one this browser
 * remembered (#461).
 *
 * `role="status"`: it appears after the page has loaded, outside the reading
 * order, and a visitor who is not looking at that corner of the screen would
 * otherwise never learn their own selection is still recoverable.
 */
export default function FavouritesRestoreNotice({
  onRestore,
  onDismiss,
}: FavouritesRestoreNoticeProps) {
  const t = useTranslations("favourites");
  const box = useRef<HTMLDivElement>(null);

  // The first click anywhere else answers it: leaving it up would put a
  // permanent strip above a grid that is already short of vertical room.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) onDismiss();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [onDismiss]);

  return (
    <div
      ref={box}
      role="status"
      className="no-print mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-blanc-casse px-4 py-3 text-sm text-noir"
    >
      <span>{t("restoreNotice")}</span>
      <button
        type="button"
        onClick={onRestore}
        className="font-bold text-bleu underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-malachite/50"
      >
        {t("restoreAction")}
      </button>
    </div>
  );
}
