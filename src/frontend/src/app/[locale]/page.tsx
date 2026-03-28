import { getTranslations } from "next-intl/server";

const eventJsonLd = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "DevFest Toulouse 2026",
  startDate: "2026-11-19",
  endDate: "2026-11-19",
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: {
    "@type": "Place",
    name: "Diagora",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Labège",
      addressRegion: "Occitanie",
      addressCountry: "FR",
    },
  },
  organizer: {
    "@type": "Organization",
    name: "GDG Toulouse",
    url: "https://gdg.community.dev/gdg-toulouse/",
  },
  superEvent: {
    "@type": "Event",
    name: "DevFest",
    url: "https://developers.google.com/community/devfest",
  },
  previousStartDate: [
    "2025-11-20",
    "2024-11-07",
    "2023-11-16",
    "2019-10-03",
    "2018-11-08",
    "2017-09-28",
    "2016-11-03",
  ],
};

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <div className="flex flex-col items-center justify-center flex-1 p-8">
        <h1 className="text-4xl font-bold text-noir">
          <span className="text-malachite">DevFest</span>{" "}
          <span className="text-terre-cuite">Toulouse</span>
        </h1>
        <p className="mt-4 text-gris">{t("subtitle")}</p>
        <p className="mt-2 text-gris-clair text-sm">{t("date")}</p>
        <p className="text-gris-clair text-sm">{t("venue")}</p>
      </div>
    </>
  );
}
