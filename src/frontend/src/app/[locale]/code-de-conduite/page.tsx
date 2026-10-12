import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getContentPage } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("codeOfConduct");
  return {
    title: t("title"),
    description: t("description"),
    ...(await pageMetadata(locale, "/code-de-conduite")),
  };
}

export default async function CodeOfConductPage() {
  const locale = await getLocale();
  const t = await getTranslations("codeOfConduct");
  const page = await getContentPage("code-de-conduite");

  if (!page) notFound();

  const title = localizedField(page, "title", locale);
  const content = localizedField(page, "content", locale);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: title, href: `/${locale}/code-de-conduite` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {title}
        </h1>

        <div
          className="article-content mt-8 text-noir"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
}
