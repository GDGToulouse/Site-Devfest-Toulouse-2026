import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function HeroSection() {
  const t = useTranslations("home.hero");

  return (
    <section className="relative w-full overflow-hidden bg-blanc">
      <div className="relative mx-auto max-w-[1440px] min-h-[600px] lg:min-h-[700px]">
        {/* Background photo — starts at ~33% from left, flush right, rounded left corners */}
        <div
          className="absolute top-0 bottom-0 right-0 left-0 lg:left-1/3 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(0deg, rgba(29, 29, 27, 0.3), rgba(29, 29, 27, 0.3)), url('https://picsum.photos/1200/800?random=devfest')",
            borderRadius: "64px 0px 0px 64px",
          }}
        />

        {/* Staircase text blocks */}
        <div className="relative z-10 flex min-h-[600px] lg:min-h-[700px] items-center">
          <div className="flex flex-col items-start p-8 lg:p-16">
            {/* Line 1: DevFest — offset left */}
            <div className="bg-blanc pr-12 lg:pr-24 pb-2 rounded-tr-hero -ml-8 lg:-ml-16 pl-8 lg:pl-16">
              <h1>
                <span className="text-5xl sm:text-6xl lg:text-[96px] font-bold leading-[1.05] tracking-tight text-malachite">
                  DevFest
                </span>
              </h1>
            </div>

            {/* Line 2: Toulouse — indented right relative to DevFest */}
            <div className="bg-blanc pr-16 lg:pr-32 pb-4 rounded-tr-hero">
              <span className="text-5xl sm:text-6xl lg:text-[96px] font-bold leading-[1.05] tracking-tight text-terre-cuite">
                Toulouse
              </span>
            </div>

            {/* Line 3: Subtitle + date/venue */}
            <div className="bg-blanc pr-8 lg:pr-16 py-4 pb-8 rounded-tr-hero rounded-br-hero">
              <p className="text-lg sm:text-xl lg:text-2xl text-noir/80 leading-relaxed max-w-lg">
                {t("subtitleLine1")}
                <br />
                <strong>{t("subtitleLine2devs")}</strong>
                {t("subtitleLine2end")}
                <strong>{t("subtitleLine2devs2")}</strong>
              </p>

              <p className="mt-3 text-lg text-noir/70">
                <strong className="text-noir">{t("date")}</strong>
              </p>
              <p className="text-lg text-noir/70">
                {t("venue")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Buttons — completely outside the photo area, on plain white background */}
      <div className="mx-auto max-w-[1440px] px-8 lg:px-16 pt-[50px] pb-12">
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/contact"
            className="px-8 py-5 rounded-l border-3 border-bleu text-bleu font-bold text-base hover:bg-bleu hover:text-blanc transition-colors text-center"
          >
            {t("ctaPartner")}
          </Link>
          <a
            href="https://sessionize.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-5 rounded-l bg-bleu text-blanc font-bold text-base hover:bg-bleu/90 transition-colors text-center"
          >
            {t("ctaTalk")}
          </a>
        </div>
      </div>
    </section>
  );
}
