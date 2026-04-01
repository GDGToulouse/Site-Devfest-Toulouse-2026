"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("lang");

  const otherLocale = locale === "fr" ? "en" : "fr";

  function handleSwitch() {
    router.replace(pathname, { locale: otherLocale });
  }

  return (
    <button
      onClick={handleSwitch}
      className="text-base text-gris hover:text-noir transition-colors px-3 py-1.5 rounded-[12px] border-2 border-gris-clair hover:border-noir"
      aria-label={t("switchTo")}
    >
      {otherLocale.toUpperCase()}
    </button>
  );
}
