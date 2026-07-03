"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LanguageSuggestionBanner() {
  const locale = useLocale();
  const t = useTranslations("langBanner");
  const [isVisible, setIsVisible] = useState(false);
  const [suggestedLocale, setSuggestedLocale] = useState<"fr" | "en" | null>(null);

  useEffect(() => {
    if (localStorage.getItem("lang-banner-dismissed")) return;

    const browserLang = navigator.language?.split("-")[0];
    if (!browserLang) return;

    if (browserLang === "en" && locale === "fr") {
      setSuggestedLocale("en");
      setIsVisible(true);
    } else if (browserLang === "fr" && locale === "en") {
      setSuggestedLocale("fr");
      setIsVisible(true);
    }
  }, [locale]);

  function handleDismiss() {
    localStorage.setItem("lang-banner-dismissed", "1");
    setIsVisible(false);
  }

  if (!isVisible || !suggestedLocale) return null;

  return (
    <div className="bg-bleu text-blanc px-4 py-2 text-sm flex items-center justify-center gap-4">
      <span>{t("message")}</span>
      <Link
        href="/"
        locale={suggestedLocale}
        className="font-bold underline hover:no-underline"
        onClick={handleDismiss}
      >
        {t("switch", { lang: suggestedLocale === "fr" ? "Français" : "English" })}
      </Link>
      <button
        onClick={handleDismiss}
        className="ml-2 text-blanc/70 hover:text-blanc"
        aria-label={t("dismiss")}
      >
        &times;
      </button>
    </div>
  );
}
