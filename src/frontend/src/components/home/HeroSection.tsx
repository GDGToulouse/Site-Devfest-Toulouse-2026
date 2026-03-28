import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function HeroSection() {
  const t = useTranslations("home.hero");

  return (
    <section className="relative w-full overflow-hidden rounded-b-hero bg-noir min-h-[600px] lg:min-h-[850px] flex items-center justify-center">
      {/* Gradient placeholder — replace with actual hero image */}
      <div className="absolute inset-0 bg-gradient-to-br from-noir via-noir/90 to-malachite/30" />
      <div className="absolute inset-0 bg-noir/50" />

      <div className="relative z-10 flex flex-col items-center text-center px-6 py-16 lg:py-24 max-w-4xl mx-auto">
        <h1 className="text-5xl sm:text-7xl lg:text-[112px] font-bold leading-none tracking-tight">
          <span className="text-malachite">DevFest</span>{" "}
          <span className="text-terre-cuite">Toulouse</span>
        </h1>

        <p className="mt-6 text-xl sm:text-2xl lg:text-[32px] lg:leading-[140%] text-blanc/90 font-normal">
          {t("subtitle")}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-2 text-blanc/80 text-lg">
          <span>{t("date")}</span>
          <span className="hidden sm:inline">&middot;</span>
          <span>{t("venue")}</span>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link
            href="/contact"
            className="px-8 py-3 rounded-l border-2 border-bleu text-blanc font-bold text-base hover:bg-bleu/20 transition-colors"
          >
            {t("ctaPartner")}
          </Link>
          <a
            href="https://sessionize.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 rounded-l bg-bleu text-blanc font-bold text-base hover:bg-bleu/90 transition-colors"
          >
            {t("ctaTalk")}
          </a>
        </div>
      </div>
    </section>
  );
}
