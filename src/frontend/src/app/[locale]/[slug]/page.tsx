import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getContentPage } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import { htmlToText } from "@/lib/html";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";

// Serves any page created from the admin (#421). Slugs are unique and not
// localized, so the same URL answers under /fr and /en with the matching
// language columns. Statically-declared routes (mentions-legales,
// code-de-conduite) keep priority over this segment and are untouched.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const page = await getContentPage(slug);

  if (!page) return {};

  const title = localizedField(page, "title", locale);
  const description = htmlToText(localizedField(page, "content", locale)).slice(0, 160);

  return {
    title,
    description,
    ...(await pageMetadata(locale, `/${slug}`)),
  };
}

export default async function ContentPageBySlug({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("legalNotice");
  const page = await getContentPage(slug);

  if (!page) notFound();

  const title = localizedField(page, "title", locale);
  const content = localizedField(page, "content", locale);

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: title, href: `/${locale}/${slug}` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {title}
        </h1>

        {/* Admin-authored HTML, sanitized on write (sanitizeRichHtml in the
            pages routes). Styled by `.article-content`, the editor's own
            typography, so the page reads as it was written (#490). */}
        <div
          className="article-content mt-8 text-noir"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
}
