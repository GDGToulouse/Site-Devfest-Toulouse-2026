import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getContentPage } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("legalNotice");
  return {
    title: t("title"),
    description: t("description"),
    ...(await pageMetadata(locale, "/mentions-legales")),
  };
}

export default async function LegalNoticePage() {
  const locale = await getLocale();
  const t = await getTranslations("legalNotice");
  const page = await getContentPage("mentions-legales");

  if (!page) notFound();

  const title = localizedField(page, "title", locale);
  const content = localizedField(page, "content", locale);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: title, href: `/${locale}/mentions-legales` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {title}
        </h1>

        <div
          className="mt-8 prose prose-lg max-w-none text-noir
            [&_h4]:text-2xl [&_h4]:font-bold [&_h4]:mt-8 [&_h4]:mb-4
            [&_h5]:text-xl [&_h5]:font-bold [&_h5]:mt-6 [&_h5]:mb-3
            [&_p]:leading-relaxed [&_p]:mb-4
            [&_a]:text-bismarck [&_a]:underline
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
            [&_li]:mb-1"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
}
