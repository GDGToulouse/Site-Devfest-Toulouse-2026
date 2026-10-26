import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

// A path nothing else claims, two segments or more under a locale
// (/fr/a/b/c). Without it Next answers with its own English 404, outside the
// site's layout: [locale]/not-found.tsx is only reached through a route of the
// [locale] tree. A single segment is [slug]/page.tsx (#421).
//
// Never cached: every URL that lands here is a 404, and a cache entry per
// invented URL would only fill the disk.
export const dynamic = "force-dynamic";

export default async function UnknownPath({
  params,
}: {
  params: Promise<{ locale: string; rest: string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  notFound();
}
