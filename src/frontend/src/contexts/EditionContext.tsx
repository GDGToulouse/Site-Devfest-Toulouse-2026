"use client";

import { createContext, useContext } from "react";
import type { CfpSettings, Edition, SocialLinks } from "@/lib/types";

interface EditionContextValue {
  edition: Edition | null;
  cfp: CfpSettings | null;
  identity: Record<string, string>;
  socialLinks: SocialLinks;
}

const EditionContext = createContext<EditionContextValue>({
  edition: null,
  cfp: null,
  identity: {},
  socialLinks: {},
});

export function EditionProvider({
  edition,
  cfp,
  identity,
  socialLinks,
  children,
}: {
  edition: Edition | null;
  cfp: CfpSettings | null;
  identity: Record<string, string>;
  socialLinks: SocialLinks;
  children: React.ReactNode;
}) {
  return (
    <EditionContext.Provider value={{ edition, cfp, identity, socialLinks }}>
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

export function useSocialLinks() {
  return useContext(EditionContext).socialLinks;
}
