"use client";

import { createContext, useContext } from "react";
import type { CfpSettings, ContentPageSummary, Edition, SocialLinks } from "@/lib/types";

interface EditionContextValue {
  edition: Edition | null;
  cfp: CfpSettings | null;
  identity: Record<string, string>;
  socialLinks: SocialLinks;
  // Published admin-authored pages, so the header — a client component — can
  // place the ones an editor put in the menu (#420).
  pages: ContentPageSummary[];
}

const EditionContext = createContext<EditionContextValue>({
  edition: null,
  cfp: null,
  identity: {},
  socialLinks: {},
  pages: [],
});

export function EditionProvider({
  edition,
  cfp,
  identity,
  socialLinks,
  pages = [],
  children,
}: {
  edition: Edition | null;
  cfp: CfpSettings | null;
  identity: Record<string, string>;
  socialLinks: SocialLinks;
  pages?: ContentPageSummary[];
  children: React.ReactNode;
}) {
  return (
    <EditionContext.Provider value={{ edition, cfp, identity, socialLinks, pages }}>
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

export function useNavPages() {
  return useContext(EditionContext).pages;
}
