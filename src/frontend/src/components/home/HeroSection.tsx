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

        {/* Staircase text blocks — each line has its own white background creating a step effect */}
        <div className="relative z-10 flex min-h-[600px] lg:min-h-[700px] items-center">
          <div className="flex flex-col items-start p-8 lg:p-16">
            {/* Line 1: DevFest — widest block */}
            <div className="bg-blanc pr-12 lg:pr-24 pb-2 rounded-tr-hero">
              <h1>
                <span className="text-5xl sm:text-6xl lg:text-[96px] font-bold leading-[1.05] tracking-tight text-malachite">
                  DevFest
                </span>
              </h1>
            </div>

            {/* Line 2: Toulouse — slightly narrower, creates a step */}
            <div className="bg-blanc pr-16 lg:pr-32 pb-4 rounded-tr-hero">
              <span className="text-5xl sm:text-6xl lg:text-[96px] font-bold leading-[1.05] tracking-tight text-terre-cuite">
                Toulouse
              </span>
            </div>

            {/* Line 3: Subtitle — narrower still */}
            <div className="bg-blanc pr-8 lg:pr-16 py-4 rounded-tr-hero rounded-br-hero">
              <p className="text-lg sm:text-xl lg:text-2xl text-noir/80 font-normal leading-relaxed max-w-lg">
                {t("subtitle")}
              </p>

              <div className="mt-3 flex flex-col sm:flex-row items-start gap-1 text-noir/70 text-lg">
                <span className="font-bold text-noir">{t("date")}</span>
                <span className="hidden sm:inline">&middot;</span>
                <span>{t("venue")}</span>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
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
          </div>
        </div>
      </div>
    </section>
  );
}
