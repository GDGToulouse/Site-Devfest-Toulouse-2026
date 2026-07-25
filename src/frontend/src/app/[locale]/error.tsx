"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * Error boundary for the public site (#345).
 *
 * Reached when a page throws — in practice when the backend is unreachable.
 * That case used to surface as `notFound()`, and `s-maxage=3600` kept serving
 * that 404 for an hour after the backend came back. An error page is not
 * cached, so recovery is immediate.
 *
 * Must be a client component: that is how Next wires an error boundary.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    // The server already logged the cause; this records that a visitor
    // actually hit the boundary, with the digest to correlate the two.
    console.error("Page failed to render", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <h1 className="text-8xl font-bold text-terre-cuite">500</h1>
      <h2 className="mt-4 text-2xl font-bold text-noir">{t("title")}</h2>
      <p className="mt-2 max-w-md text-gris">{t("description")}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-[12px] bg-bleu px-6 py-3 text-base font-bold text-blanc transition-opacity hover:opacity-90"
        >
          {t("retry")}
        </button>
        <Link href="/" className="text-base font-medium text-bleu hover:underline">
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
