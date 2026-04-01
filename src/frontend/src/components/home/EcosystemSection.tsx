import { useTranslations } from "next-intl";

export default function EcosystemSection() {
  const t = useTranslations("home.about");

  return (
    <section className="px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="text-2xl lg:text-4xl font-bold text-noir mb-8">
          {t("ecosystemTitle")}
        </h2>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <a
            href="https://www.toulousetechhub.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 rounded-[12px] bg-bleu text-blanc font-bold text-base hover:bg-bleu/90 transition-colors"
          >
            Toulouse Tech Hub
          </a>
          <a
            href="https://www.cloudtoulouse.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 rounded-[12px] border-2 border-bleu text-bleu font-bold text-base hover:bg-bleu/10 transition-colors"
          >
            Cloud Toulouse
          </a>
        </div>
      </div>
    </section>
  );
}
