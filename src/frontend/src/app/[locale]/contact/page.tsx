import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getContactCategories } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import ContactForm from "@/components/ContactForm";
import SocialIcons from "@/components/SocialIcons";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("contact");
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/contact`,
      languages: { fr: "/fr/contact", en: "/en/contact", "x-default": "/fr/contact" },
    },
  };
}

export default async function ContactPage() {
  const locale = await getLocale();
  const t = await getTranslations("contact");
  const categories = await getContactCategories();

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/contact` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl lg:text-[64px] lg:leading-[120%] font-bold text-noir">
          {t("title")}
        </h1>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 lg:gap-16">
          {/* Form */}
          <ContactForm categories={categories} locale={locale} />

          {/* Sidebar */}
          <aside className="space-y-8">
            <div className="p-6 rounded-3xl bg-blanc-casse">
              <p className="text-gris text-base leading-relaxed">
                {t("sidebar.responseTime")}
              </p>
            </div>

            <div className="p-6">
              <p className="text-sm font-bold text-noir mb-4">{t("sidebar.followUs")}</p>
              <SocialIcons size={40} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
