import { useTranslations } from "next-intl";

export default function AboutSection() {
  const t = useTranslations("home.about");

  return (
    <section className="px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl space-y-16 lg:space-y-24">
        {/* Behind the DevFest */}
        <div className="relative overflow-hidden rounded-3xl bg-noir min-h-[400px] flex items-center">
          {/* Gradient placeholder — replace with actual background image */}
          <div className="absolute inset-0 bg-gradient-to-r from-malachite/30 to-terre-cuite/20" />
          <div className="absolute inset-0 bg-noir/60" />

          <div className="relative z-10 p-8 lg:p-16 max-w-2xl">
            <h2 className="text-3xl lg:text-5xl font-bold text-blanc mb-6">
              {t("behindTitle")}
            </h2>
            <div className="bg-blanc/90 rounded-m p-6 lg:p-8">
              <p className="text-base lg:text-lg text-noir leading-relaxed">
                {t("gdgDescription")}
              </p>
            </div>
          </div>
        </div>

        {/* Ecosystem */}
        <div className="text-center">
          <h3 className="text-2xl lg:text-4xl font-bold text-noir mb-8">
            {t("ecosystemTitle")}
          </h3>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="https://www.toulousetechhub.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 rounded-s bg-bleu text-blanc font-bold text-base hover:bg-bleu/90 transition-colors"
            >
              Toulouse Tech Hub
            </a>
            <a
              href="https://www.cloudtoulouse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 rounded-s border-2 border-bleu text-bleu font-bold text-base hover:bg-bleu/10 transition-colors"
            >
              Cloud Toulouse
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
