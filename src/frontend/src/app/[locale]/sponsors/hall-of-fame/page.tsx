import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getSponsorsHallOfFame } from "@/lib/api";
import { pageMetadata } from "@/lib/page-metadata";
import { absoluteUrl, jsonLdScript } from "@/lib/seo";
import Breadcrumb from "@/components/Breadcrumb";
import SponsorHallOfFameCard from "@/components/sponsors/SponsorHallOfFameCard";
import { Link } from "@/i18n/navigation";

const PATH = "/sponsors/hall-of-fame";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("sponsorsHallOfFame");
  const companies = await getSponsorsHallOfFame();

  return {
    title: t("title"),
    description: t("description", { count: companies.length }),
    ...(await pageMetadata(locale, PATH)),
  };
}

type Sort = "name" | "participations";

// Every company that ever sponsored a DevFest Toulouse (#611): the proof of
// loyalty a prospect sponsor looks for. `/sponsors` answers "who supports this
// year"; this page answers "who has ever". Alphabetical by default, by number of
// editions on demand (decision on the issue).
//
// Year and order go through the URL rather than client state, like the speakers'
// hall of fame (#352): a filtered view stays shareable and server-rendered.
export default async function SponsorsHallOfFamePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("sponsorsHallOfFame");

  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const rawYear = first(sp.year);
  const year = rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
  const sort: Sort = first(sp.sort) === "participations" ? "participations" : "name";

  const companies = await getSponsorsHallOfFame();

  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const filtered = year ? companies.filter((c) => c.participations.some((p) => p.year === year)) : companies;
  const shown = [...filtered].sort((a, b) =>
    sort === "participations"
      ? b.participations.length - a.participations.length || collator.compare(a.name, b.name)
      : collator.compare(a.name, b.name),
  );
  const years = [...new Set(companies.flatMap((c) => c.participations.map((p) => p.year)))].sort((a, b) => b - a);

  const href = (params: { year?: number | null; sort?: Sort }) => {
    const query = new URLSearchParams();
    const y = params.year === undefined ? year : params.year;
    const s = params.sort ?? sort;
    if (y) query.set("year", String(y));
    if (s !== "name") query.set("sort", s);
    const qs = query.toString();
    return qs ? `${PATH}?${qs}` : PATH;
  };

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("sponsors"), href: `/${locale}/sponsors` },
    { label: t("title"), href: `/${locale}${PATH}` },
  ];

  // The companies as an ItemList of Organization (#382), in the order shown.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("title"),
    numberOfItems: shown.length,
    itemListElement: shown.map((company, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Organization",
        name: company.name,
        url: absoluteUrl(`/${locale}/sponsors/${company.slug}`),
        ...(company.logoUrl ? { logo: absoluteUrl(company.logoUrl) } : {}),
      },
    })),
  };

  const pill = (isActive: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium transition-colors ${
      isActive ? "bg-bismarck text-blanc" : "bg-blanc-casse text-gris hover:brightness-95"
    }`;

  return (
    <div className="px-6 py-8 lg:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(itemListJsonLd) }} />
      <div className="mx-auto max-w-[1440px]">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-8 text-3xl font-bold text-noir lg:text-5xl">{t("heading")}</h1>
        <p className="mt-2 text-lg text-gris">{t("intro", { count: companies.length })}</p>

        {years.length > 0 && (
          <nav aria-label={t("filterLabel")} className="mt-6 flex flex-wrap gap-2">
            <Link href={href({ year: null })} aria-current={year ? undefined : "true"} className={pill(!year)}>
              {t("allYears")}
            </Link>
            {years.map((y) => (
              <Link key={y} href={href({ year: y })} aria-current={year === y ? "true" : undefined} className={pill(year === y)}>
                {y}
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gris">{t("countLabel", { count: shown.length })}</p>
          <nav aria-label={t("sortLabel")} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gris">{t("sortLabel")} :</span>
            <Link href={href({ sort: "name" })} aria-current={sort === "name" ? "true" : undefined} className={pill(sort === "name")}>
              {t("sortByName")}
            </Link>
            <Link
              href={href({ sort: "participations" })}
              aria-current={sort === "participations" ? "true" : undefined}
              className={pill(sort === "participations")}
            >
              {t("sortByParticipations")}
            </Link>
          </nav>
        </div>

        {shown.length === 0 ? (
          <p className="mt-8 text-gris">{t("empty")}</p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {shown.map((company) => (
              <li key={company.slug}>
                <SponsorHallOfFameCard
                  company={company}
                  year={year}
                  locale={locale}
                  editionsLabel={t("editions", { count: company.participations.length })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
