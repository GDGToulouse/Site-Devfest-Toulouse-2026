import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getFaq } from "@/lib/api";
import { pageMetadata } from "@/lib/page-metadata";
import { jsonLdScript } from "@/lib/seo";
import type { FaqItem, FaqTheme } from "@/lib/types";
import Breadcrumb from "@/components/Breadcrumb";
import { Link } from "@/i18n/navigation";

const THEMES: FaqTheme[] = ["VENUE", "TICKETS", "PROGRAMME", "PRACTICAL", "OTHER"];

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("faq");
  return {
    title: t("pageTitle"),
    description: t("description"),
    ...(await pageMetadata(locale, "/faq")),
  };
}

// An English question not written yet reads in French rather than vanishing:
// the answer exists, and the visitor came for it.
function inLocale(item: FaqItem, locale: string) {
  const isEn = locale === "en";
  return {
    question: (isEn && item.questionEn.trim()) || item.questionFr,
    answer: (isEn && item.answerEn.replace(/<[^>]*>/g, "").trim() && item.answerEn) || item.answerFr,
  };
}

// The FAQ (#111): questions grouped by theme, each a native disclosure —
// <details>/<summary> open with the keyboard and announce their state with no
// script — and a FAQPage block for search engines.
export default async function FaqPage() {
  const locale = await getLocale();
  const t = await getTranslations("faq");
  const items = await getFaq();

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("pageTitle"), href: `/${locale}/faq` },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => {
      const { question, answer } = inLocale(item, locale);
      return { "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } };
    }),
  };

  return (
    <div className="px-6 py-8 lg:py-12">
      {items.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      )}
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl font-bold text-noir lg:text-5xl">{t("pageTitle")}</h1>
        <p className="mt-3 text-lg text-gris">
          {t.rich("intro", {
            contact: (chunks) => (
              <Link href="/contact" className="font-bold text-bleu underline">
                {chunks}
              </Link>
            ),
          })}
        </p>

        {items.length === 0 ? (
          <p className="mt-10 text-gris">{t("empty")}</p>
        ) : (
          THEMES.map((theme) => {
            const questions = items.filter((item) => item.theme === theme);
            if (questions.length === 0) return null;
            return (
              <section key={theme} aria-labelledby={`faq-${theme}`} className="mt-10">
                <h2 id={`faq-${theme}`} className="text-2xl font-bold text-noir">
                  {t(`themes.${theme}`)}
                </h2>
                <div className="mt-4 space-y-3">
                  {questions.map((item) => {
                    const { question, answer } = inLocale(item, locale);
                    return (
                      <details key={item.id} className="group rounded-2xl bg-blanc shadow-card open:shadow-lg">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-lg font-bold text-noir focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bleu [&::-webkit-details-marker]:hidden">
                          {question}
                          <span aria-hidden className="shrink-0 text-2xl text-malachite transition-transform group-open:rotate-45">
                            +
                          </span>
                        </summary>
                        <div className="article-content px-5 pb-5 text-noir" dangerouslySetInnerHTML={{ __html: answer }} />
                      </details>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
