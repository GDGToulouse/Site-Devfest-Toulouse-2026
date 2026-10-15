"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Shown on every public page while the draft preview is on (#618), so an
// unpublished record is never taken for the live site. A plain link, not a
// next/link: a prefetch of the exit route would end the preview by itself.
export default function PreviewBanner() {
  const t = useTranslations("preview");
  const pathname = usePathname();

  return (
    <div role="status" className="relative z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-noir px-4 py-2 text-sm text-blanc">
      <span className="font-bold">{t("label")}</span>
      <a
        href={`/api/preview/exit?path=${encodeURIComponent(pathname)}`}
        className="underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blanc"
      >
        {t("exit")}
      </a>
    </div>
  );
}
