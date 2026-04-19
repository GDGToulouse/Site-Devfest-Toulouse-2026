"use client";

import { createContext, useContext } from "react";
import type { CfpSettings, Edition } from "@/lib/types";

interface EditionContextValue {
  edition: Edition | null;
  cfp: CfpSettings | null;
  identity: Record<string, string>;
}

const EditionContext = createContext<EditionContextValue>({
  edition: null,
  cfp: null,
  identity: {},
});

export function EditionProvider({
  edition,
  cfp,
  identity,
  children,
}: {
  edition: Edition | null;
  cfp: CfpSettings | null;
  identity: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <EditionContext.Provider value={{ edition, cfp, identity }}>
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

export function useIdentitySettings() {
  return useContext(EditionContext).identity;
}
