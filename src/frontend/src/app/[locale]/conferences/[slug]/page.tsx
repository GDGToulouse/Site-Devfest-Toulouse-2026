import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentEdition, getTalkBySlug } from "@/lib/api";
import { localizedField } from "@/lib/i18n-helpers";
import { pageMetadata } from "@/lib/page-metadata";
import Breadcrumb from "@/components/Breadcrumb";
import AddToCalendar from "@/components/conferences/AddToCalendar";
import { Link } from "@/i18n/navigation";

// Absolute, because the event body ends up on someone else's calendar: a
// relative link would be dead there.
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const talk = await getTalkBySlug(slug);

  if (!talk) return { title: "Session not found" };

  // Title and abstract are not localized (#293) — the talk has one language.
  const title = talk.title;
  const description = talk.description || title;

  return {
    title,
    description,
    // OG image generated dynamically by ./opengraph-image (RG-215); og:title
    // and og:description come from the two fields above.
    ...(await pageMetadata(locale, `/conferences/${slug}`)),
  };
}

export default async function TalkDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("conferences");
  const tcal = await getTranslations("calendar");
  const talk = await getTalkBySlug(slug);

  if (!talk) notFound();

  // Only for the venue printed on the calendar event; the page itself does not
  // otherwise need the edition.
  const edition = talk.startsAt ? await getCurrentEdition() : null;

  const title = talk.title;
  const description = talk.description;
  const categoryName = talk.category ? localizedField(talk.category, "name", locale) : null;

  const breadcrumbItems = [
    { label: t("home"), href: `/${locale}` },
    { label: t("title"), href: `/${locale}/conferences` },
    { label: title, href: `/${locale}/conferences/${slug}` },
  ];

  return (
    <div className="px-6 py-8 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={breadcrumbItems} />

        {/* Meta badges */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-bleu/10 px-3 py-1 text-sm font-bold text-bleu">
            {t(`format.${talk.format}`)}
          </span>
          {talk.level && (
            <span className="rounded-full bg-gris/10 px-3 py-1 text-sm text-noir">
              {t(`level.${talk.level}`)}
            </span>
          )}
          {categoryName && (
            <span
              className="rounded-full px-3 py-1 text-sm font-bold"
              style={{ backgroundColor: `${talk.category!.color}20`, color: talk.category!.color }}
            >
              {categoryName}
            </span>
          )}
          <span className="text-sm uppercase text-gris">{talk.language}</span>
        </div>

        <h1 className="mt-4 text-3xl lg:text-5xl font-bold text-noir">{title}</h1>

        {description && (
          <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-noir">{description}</p>
        )}

        {/* Only once the session has an hour: before that there is nothing to
            put on a calendar (#443). */}
        {talk.startsAt && (
          <AddToCalendar
            session={{
              slug: talk.slug,
              title: talk.title,
              startsAt: talk.startsAt,
              endsAt: talk.endsAt,
              room: talk.room,
              speakers: talk.speakers.map((sp) => sp.name),
              year: talk.year,
              url: `${BASE_URL}/${locale}/conferences/${talk.slug}`,
              venue: [edition?.venueName, edition?.venueAddress].filter(Boolean).join(", ") || null,
            }}
            labels={{
              heading: tcal("heading"),
              google: tcal("google"),
              outlook: tcal("outlook"),
              download: tcal("download"),
            }}
          />
        )}

        {talk.speakers.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-6 text-2xl font-bold text-noir">{t("speakersLabel")}</h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {talk.speakers.map((sp) => (
                <Link
                  key={sp.slug}
                  href={`/speakers/${sp.slug}`}
                  className="group flex flex-col items-center gap-3 text-center"
                >
                  <div className="relative h-24 w-24 overflow-hidden rounded-full bg-blanc-casse">
                    {sp.photoUrl ? (
                      <Image src={sp.photoUrl} alt={sp.name} fill className="object-cover" sizes="96px" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-gris">
                        {sp.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-noir group-hover:text-bleu">{sp.name}</span>
                  {sp.company && <span className="text-sm text-gris">{sp.company}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
