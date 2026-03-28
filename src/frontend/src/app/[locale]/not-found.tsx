import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
      <h1 className="text-8xl font-bold text-terre-cuite">404</h1>
      <h2 className="mt-4 text-2xl font-bold text-noir">{t("title")}</h2>
      <p className="mt-2 text-gris max-w-md">{t("description")}</p>
      <Link
        href="/"
        className="mt-8 rounded-l bg-bleu px-6 py-3 text-base font-bold text-blanc hover:opacity-90 transition-opacity"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
