"use client";

import { createContext, useContext } from "react";
import type { CfpSettings, Edition } from "@/lib/types";

interface EditionContextValue {
  edition: Edition | null;
  cfp: CfpSettings | null;
}

const EditionContext = createContext<EditionContextValue>({ edition: null, cfp: null });

export function EditionProvider({
  edition,
  cfp,
  children,
}: {
  edition: Edition | null;
  cfp: CfpSettings | null;
  children: React.ReactNode;
}) {
  return (
    <EditionContext.Provider value={{ edition, cfp }}>
      {children}
    </EditionContext.Provider>
  );
}

export function useEdition() {
  return useContext(EditionContext).edition;
}

export function useCfpSettings() {
  return useContext(EditionContext).cfp;
}
