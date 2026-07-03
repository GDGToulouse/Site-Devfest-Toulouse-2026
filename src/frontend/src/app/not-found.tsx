import Link from "next/link";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";

const STRINGS = {
  fr: {
    title: "Page introuvable",
    description: "La page que vous cherchez n'existe pas ou a été déplacée.",
    cta: "Retour à l'accueil",
  },
  en: {
    title: "Page not found",
    description: "The page you are looking for does not exist or has been moved.",
    cta: "Back to home",
  },
} as const;

async function resolveLang(): Promise<"fr" | "en"> {
  const h = await headers();
  const accept = h.get("accept-language") || "";
  // Pick the first language tag in the header that matches one of our locales.
  const match = accept
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase().split("-")[0])
    .find((tag) => (routing.locales as readonly string[]).includes(tag));
  return (match as "fr" | "en") || (routing.defaultLocale as "fr" | "en");
}

export default async function NotFound() {
  const lang = await resolveLang();
  const t = STRINGS[lang];

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 text-center min-h-screen">
      <h1 className="text-8xl font-bold text-terre-cuite">404</h1>
      <h2 className="mt-4 text-2xl font-bold text-noir">{t.title}</h2>
      <p className="mt-2 text-gris max-w-md">{t.description}</p>
      <Link
        href={`/${lang}`}
        className="mt-8 rounded-[12px] bg-bleu px-6 py-3 text-base font-bold text-blanc hover:opacity-90 transition-opacity inline-block"
      >
        {t.cta}
      </Link>
    </div>
  );
}
