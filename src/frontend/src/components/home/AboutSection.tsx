import { useTranslations } from "next-intl";

export default function AboutSection() {
  const t = useTranslations("home.about");

  return (
    <section className="px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl">
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
      </div>
    </section>
  );
}
