"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SocialIcons from "./SocialIcons";
import LanguageSwitcher from "./LanguageSwitcher";

const NAV_LINKS = [
  { key: "program", href: "/conferences" },
  { key: "speakers", href: "/speakers" },
  { key: "partners", href: "/partners" },
  { key: "blog", href: "/actualites" },
] as const;

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const t = useTranslations("nav");
  const tCta = useTranslations("cta");
  const tHeader = useTranslations("header");

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 h-[60px] bg-blanc shadow-header"
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-center px-4 lg:px-[100px]">
        {/* Logo + Nav grouped on left */}
        <div className="flex items-center gap-8">
          <Link href="/" className="shrink-0">
            <Image
              src="/images/logo-devfest-96.png"
              alt="DevFest Toulouse"
              width={40}
              height={40}
              className="rounded-full"
            />
          </Link>

          {/* Desktop nav — right of logo */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="text-gris text-base hover:text-noir transition-colors"
              >
                {t(link.key)}
              </Link>
            ))}
          </nav>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Desktop actions */}
        <div className="hidden lg:flex items-center gap-4">
          <SocialIcons size={20} className="text-gris" />
          <a
            href="https://forms.gle/devfest-partenaire"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[12px] border-2 border-bleu px-[18px] py-1.5 text-base font-bold text-bleu hover:bg-bleu hover:text-blanc transition-colors"
          >
            {tCta("becomePartner")}
          </a>
          <a
            href="https://sessionize.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[12px] bg-bleu px-[18px] py-1.5 text-base font-bold text-blanc hover:bg-bleu/90 transition-colors"
          >
            {tCta("submitTalk")}
          </a>
          <LanguageSwitcher />
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2 text-noir"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? tHeader("close") : tHeader("menu")}
        >
          {isMenuOpen ? (
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <nav
          className="lg:hidden border-t border-gray-100 bg-blanc px-4 py-4 shadow-card"
          aria-label="Mobile navigation"
        >
          <div className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="text-gris text-base hover:text-noir transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t(link.key)}
              </Link>
            ))}
            <hr className="border-gray-100" />
            <a
              href="https://forms.gle/devfest-partenaire"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[12px] border-2 border-bleu px-[18px] py-3 text-base font-bold text-bleu text-center"
            >
              {tCta("becomePartner")}
            </a>
            <a
              href="https://sessionize.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[12px] bg-bleu px-[18px] py-3 text-base font-bold text-blanc text-center"
            >
              {tCta("submitTalk")}
            </a>
            <div className="flex items-center justify-between">
              <SocialIcons size={24} className="text-gris" />
              <LanguageSwitcher />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
