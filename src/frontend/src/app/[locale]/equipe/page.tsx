import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getTeam } from "@/lib/api";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";
import TeamMemberCard from "@/components/team/TeamMemberCard";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("team");
  return {
    title: t("metaTitle"),
    description: t("description"),
    ...(await pageMetadata(locale, "/equipe")),
  };
}

// The organisers of the featured edition (#110), alphabetical by last name
// (RG-412): four columns on desktop, two on a tablet, one on a phone (US-410).
export default async function TeamPage() {
  const locale = await getLocale();
  const t = await getTranslations("team");
  const { year, members } = await getTeam();

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("metaTitle"), href: `/${locale}/equipe` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl font-bold text-noir lg:text-5xl">{t("pageTitle")}</h1>
        <p className="mt-3 text-lg text-gris">{year ? t("introYear", { year }) : t("intro")}</p>

        {members.length === 0 ? (
          <p className="mt-10 text-gris">{t("empty")}</p>
        ) : (
          <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {members.map((member) => (
              <TeamMemberCard key={member.id} member={member} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
