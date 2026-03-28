import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <main className="flex flex-col items-center justify-center flex-1 p-8">
      <h1 className="text-4xl font-bold text-noir">
        <span className="text-malachite">DevFest</span>{" "}
        <span className="text-terre-cuite">Toulouse</span>
      </h1>
      <p className="mt-4 text-gris">{t("subtitle")}</p>
      <p className="mt-2 text-gris-clair text-sm">{t("date")}</p>
      <p className="text-gris-clair text-sm">{t("venue")}</p>
    </main>
  );
}
