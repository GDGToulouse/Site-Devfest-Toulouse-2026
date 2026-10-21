"use client";

import { Suspense, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";

import { parseFavourites, parseView } from "@/lib/favourites";
import { parseFilters } from "@/lib/talk-filters";
import { parsePrintGrouping } from "@/lib/print";
import ProgrammeBrowser from "./ProgrammeBrowser";

type BrowserProps = ComponentProps<typeof ProgrammeBrowser>;
type UrlStateProps = "initialFavourites" | "initialView" | "initialFilters" | "initialPrintGrouping";

// The programme page is rendered once and cached (#700), so it cannot read the
// querystring on the server: the selection, the view and the filters of a
// shared link are read here, in the browser. The cached HTML is the unfiltered
// programme, which is also what every visitor without a querystring gets. A
// visitor who opens a filtered link sees that programme for the time of the
// hydration, then their selection.
function ProgrammeWithUrlState(props: Omit<BrowserProps, UrlStateProps>) {
  const params = useSearchParams();
  return (
    <ProgrammeBrowser
      {...props}
      initialFavourites={parseFavourites(params.get("fav"))}
      initialView={parseView(params.get("view"))}
      initialFilters={parseFilters((key) => params.get(key) ?? undefined)}
      initialPrintGrouping={parsePrintGrouping(params.get("print"))}
    />
  );
}

export default function ProgrammeFromUrl(props: Omit<BrowserProps, UrlStateProps>) {
  return (
    <Suspense
      fallback={
        <ProgrammeBrowser
          {...props}
          initialFavourites={parseFavourites(null)}
          initialView={parseView(null)}
          initialFilters={parseFilters(() => undefined)}
          initialPrintGrouping={parsePrintGrouping(null)}
        />
      }
    >
      <ProgrammeWithUrlState {...props} />
    </Suspense>
  );
}
