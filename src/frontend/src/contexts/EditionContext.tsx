"use client";

import { createContext, useContext } from "react";
import type { Edition } from "@/lib/types";

const EditionContext = createContext<Edition | null>(null);

export function EditionProvider({
  edition,
  children,
}: {
  edition: Edition | null;
  children: React.ReactNode;
}) {
  return (
    <EditionContext.Provider value={edition}>
      {children}
    </EditionContext.Provider>
  );
}

export function useEdition() {
  return useContext(EditionContext);
}
