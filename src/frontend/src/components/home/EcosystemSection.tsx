import { getTranslations } from "next-intl/server";

import { getEcosystemPartners } from "@/lib/api";

export default async function EcosystemSection() {
  const [t, partners] = await Promise.all([
    getTranslations("home.about"),
    getEcosystemPartners(),
  ]);

  if (partners.length === 0) return null;

  return (
    <section className="px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="text-2xl lg:text-4xl font-bold text-noir mb-8">
          {t("ecosystemTitle")}
        </h2>
        <div className="flex flex-wrap justify-center gap-4">
          {partners.map((partner) => {
            const baseClasses =
              "px-8 py-3 rounded-[12px] border-2 border-bleu font-bold text-base transition-colors";
            const variantClasses = partner.isFeatured
              ? "bg-bleu text-blanc hover:bg-bleu/90"
              : "text-bleu hover:bg-bleu/10";
            return (
              <a
                key={`${partner.name}-${partner.url}`}
                href={partner.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${baseClasses} ${variantClasses}`}
              >
                {partner.name}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
