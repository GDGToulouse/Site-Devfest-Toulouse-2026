"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * The filters, sort and page of an admin list, kept in the URL (#572): coming
 * back from a detail page lands where the list was left, and a filtered view
 * can be shared as a link. The URL is the only state — nothing to keep in sync.
 *
 * Any change other than the page itself goes back to page 1: page 4 of the
 * previous filter means nothing for the new one.
 */
export function useListParams<K extends string>(keys: readonly K[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = Object.fromEntries(keys.map((key) => [key, searchParams.get(key) ?? ""])) as Record<K, string>;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const update = useCallback(
    (patch: Partial<Record<K | "page", string>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch) as [string, string | undefined][]) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (!("page" in patch)) next.delete("page");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { params, page, update };
}
