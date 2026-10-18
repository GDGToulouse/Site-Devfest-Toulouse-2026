import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

import { routing } from "@/i18n/routing";
import { getCurrentEdition } from "@/lib/api";
import { fetchPreview, previewPaths } from "@/lib/preview";

// Opens the draft preview of a speaker, talk or sponsor (#618), from the
// back-office's consult panel. Under `/api/` so the i18n routing leaves it be.
//
// Draft mode is switched on only once the backend has served the draft to this
// caller: a visitor, a sponsor account or a stale link gets an answer, not a
// cookie. The redirect target is rebuilt from the validated record, never taken
// from the query string, so this cannot be turned into an open redirect.
export const dynamic = "force-dynamic";

const MAX_SLUG_LENGTH = 200;

async function target(params: URLSearchParams): Promise<{ backend: string; page: string } | null> {
  const type = params.get("type");
  const slug = params.get("slug") ?? "";
  const locale = params.get("locale") ?? routing.defaultLocale;
  if (!slug || slug.length > MAX_SLUG_LENGTH || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    return null;
  }
  const encoded = encodeURIComponent(slug);
  if (type === "speaker") return { backend: previewPaths.speaker(slug), page: `/${locale}/speakers/${encoded}` };
  if (type === "sponsor") return { backend: previewPaths.sponsor(slug), page: `/${locale}/sponsors/${encoded}` };
  if (type === "talk") {
    const year = Number(params.get("year"));
    if (!Number.isInteger(year) || year < 1900 || year > 3000) return null;
    // The featured edition's talks have one page, /conferences/<slug>; the
    // dated one redirects there (#633).
    if (year === (await getCurrentEdition())?.year) {
      return { backend: previewPaths.featuredTalk(slug), page: `/${locale}/conferences/${encoded}` };
    }
    return { backend: previewPaths.talk(year, slug), page: `/${locale}/editions/${year}/conferences/${encoded}` };
  }
  return null;
}

function message(status: number, text: string) {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const record = await target(new URL(request.url).searchParams);
  if (!record) return message(400, "Lien d'aperçu invalide.");

  const draft = await fetchPreview(record.backend);
  if (draft === "denied") {
    return message(403, "L'aperçu est réservé à l'équipe : connectez-vous au back-office dans ce navigateur, puis relancez l'aperçu.");
  }
  if (draft === null) return message(404, "Cette fiche n'existe pas ou est dans la corbeille.");

  (await draftMode()).enable();
  redirect(record.page);
}
