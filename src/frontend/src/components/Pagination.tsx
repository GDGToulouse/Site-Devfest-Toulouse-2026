import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  queryParams?: Record<string, string>;
}

export default function Pagination({
  currentPage,
  totalPages,
  basePath,
  queryParams = {},
}: PaginationProps) {
  const t = useTranslations("pagination");

  if (totalPages <= 1) return null;

  function buildHref(page: number) {
    const params = new URLSearchParams(queryParams);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <nav aria-label={t("label")} className="flex items-center justify-center gap-2 mt-12">
      {currentPage > 1 && (
        <Link
          href={buildHref(currentPage - 1)}
          className="px-4 py-2 rounded-[12px] border border-gris-clair text-gris hover:bg-blanc-casse transition-colors"
        >
          {t("previous")}
        </Link>
      )}

      {pages.map((page) => (
        <Link
          key={page}
          href={buildHref(page)}
          className={`px-4 py-2 rounded-[12px] transition-colors ${
            page === currentPage
              ? "bg-bleu text-blanc font-bold"
              : "border border-gris-clair text-gris hover:bg-blanc-casse"
          }`}
          aria-current={page === currentPage ? "page" : undefined}
        >
          {page}
        </Link>
      ))}

      {currentPage < totalPages && (
        <Link
          href={buildHref(currentPage + 1)}
          className="px-4 py-2 rounded-[12px] border border-gris-clair text-gris hover:bg-blanc-casse transition-colors"
        >
          {t("next")}
        </Link>
      )}
    </nav>
  );
}
