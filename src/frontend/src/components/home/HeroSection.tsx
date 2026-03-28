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

        {/* 5 staircase blocks — pyramid effect */}
        <div className="relative z-10 flex min-h-[600px] lg:min-h-[700px] items-center">
          <div className="flex flex-col items-start">
            {/* Block 1: DevFest — most indented, rounded top-right only */}
            <div
              className="bg-blanc pl-8 lg:pl-[100px] pr-8 lg:pr-[45px] pb-2"
              style={{ borderTopRightRadius: "40px" }}
            >
              <h1>
                <span className="text-5xl sm:text-6xl lg:text-[96px] font-bold leading-[1.05] tracking-tight text-malachite">
                  DevFest
                </span>
              </h1>
            </div>

            {/* Block 2: Toulouse + "La conférence Toulousaine par" — wider, rounded top-right + bottom-right */}
            <div
              className="bg-blanc pl-8 lg:pl-[175px] pr-8 lg:pr-[45px] pb-3"
              style={{ borderTopRightRadius: "40px", borderBottomRightRadius: "40px" }}
            >
              <span className="text-5xl sm:text-6xl lg:text-[96px] font-bold leading-[1.05] tracking-tight text-terre-cuite">
                Toulouse
              </span>
              <p className="mt-2 text-lg sm:text-xl lg:text-2xl text-noir/80 leading-relaxed">
                {t("subtitleLine1")}
              </p>
            </div>

            {/* Block 3: "les devs et pour les devs." — no top-right, has bottom-right */}
            <div
              className="bg-blanc pl-8 lg:pl-[175px] pr-8 lg:pr-[45px] py-1"
              style={{ borderBottomRightRadius: "40px" }}
            >
              <p className="text-lg sm:text-xl lg:text-2xl text-noir/80 leading-relaxed">
                <strong>{t("subtitleLine2devs")}</strong>
                {t("subtitleLine2end")}
                <strong>{t("subtitleLine2devs2")}</strong>
              </p>
            </div>

            {/* Block 4: Date — narrower, no top-right, has bottom-right */}
            <div
              className="bg-blanc pl-8 lg:pl-[175px] pr-8 lg:pr-[45px] py-1"
              style={{ borderBottomRightRadius: "40px" }}
            >
              <p className="text-lg text-noir">
                <strong>{t("date")}</strong>
              </p>
            </div>

            {/* Block 5: Venue — narrowest, no top-right, has bottom-right */}
            <div
              className="bg-blanc pl-8 lg:pl-[175px] pr-8 lg:pr-[45px] pt-1 pb-4"
              style={{ borderBottomRightRadius: "40px" }}
            >
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
            className="px-8 py-5 rounded-[12px] border-3 border-bleu text-bleu font-bold text-base hover:bg-bleu hover:text-blanc transition-colors text-center"
          >
            {t("ctaPartner")}
          </Link>
          <a
            href="https://sessionize.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-5 rounded-[12px] bg-bleu text-blanc font-bold text-base hover:bg-bleu/90 transition-colors text-center"
          >
            {t("ctaTalk")}
          </a>
        </div>
      </div>
    </section>
  );
}
