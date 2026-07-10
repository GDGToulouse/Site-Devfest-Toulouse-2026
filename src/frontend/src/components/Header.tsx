"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SocialIcons from "./SocialIcons";
import LanguageSwitcher from "./LanguageSwitcher";
import { useCfpSettings, useEdition, useIdentitySettings, useSocialLinks } from "@/contexts/EditionContext";
import { getCfpCtaUrl } from "@/lib/cfp";
import { getLogoUrl } from "@/lib/identity";
import { getPublicNavEntries } from "@/lib/nav";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const t = useTranslations("nav");
  const tCta = useTranslations("cta");
  const tHeader = useTranslations("header");
  const edition = useEdition();
  const cfp = useCfpSettings();
  const identity = useIdentitySettings();
  const socialLinks = useSocialLinks();
  // Header sits on a white bar — use the square / main logo (color on white).
  const logoUrl = getLogoUrl(identity, "square");

  // Show "Become a sponsor" CTA whenever the page is meant to receive
  // visitors (i.e. anything but the sold-out state).
  const showSponsorCta = edition && edition.sponsorPageStatus !== "SOLD_OUT";
  const cfpUrl = getCfpCtaUrl(cfp);

  const navEntries = getPublicNavEntries(edition);

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
              src={logoUrl}
              alt="DevFest Toulouse"
              width={40}
              height={40}
              className="rounded-full"
            />
          </Link>

          {/* Desktop nav — right of logo */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="Main navigation">
            {navEntries.map((entry) =>
              entry.children ? (
                <div key={entry.key} className="group relative">
                  <Link
                    href={entry.href}
                    className="flex items-center gap-1 text-gris text-base hover:text-noir transition-colors"
                    aria-haspopup="true"
                  >
                    {t(entry.labelKey)}
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Link>
                  <div className="absolute left-0 top-full hidden min-w-[180px] flex-col rounded-[12px] bg-blanc py-2 shadow-card group-hover:flex group-focus-within:flex">
                    {entry.children.map((child) => (
                      <Link
                        key={child.key}
                        href={child.href}
                        className="px-4 py-2 text-gris text-base hover:text-noir hover:bg-blanc-casse transition-colors"
                      >
                        {t(child.labelKey)}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  key={entry.key}
                  href={entry.href}
                  className="text-gris text-base hover:text-noir transition-colors"
                >
                  {t(entry.labelKey)}
                </Link>
              ),
            )}
          </nav>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Desktop actions */}
        <div className="hidden lg:flex items-center gap-4">
          <SocialIcons size={20} className="text-gris" links={socialLinks} />
          {showSponsorCta && (
            <Link
              href="/devenir-sponsor"
              className="rounded-[12px] border-2 border-bleu px-[18px] py-1.5 text-base font-bold text-bleu hover:bg-bleu hover:text-blanc transition-colors"
            >
              {tCta("becomeSponsor")}
            </Link>
          )}
          {cfpUrl && (
            <a
              href={cfpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[12px] border-2 border-bleu bg-bleu px-[18px] py-1.5 text-base font-bold text-blanc hover:bg-bleu/90 transition-colors"
            >
              {tCta("submitTalk")}
            </a>
          )}
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
            {navEntries.map((entry) => (
              <div key={entry.key} className="flex flex-col gap-4">
                <Link
                  href={entry.href}
                  className="text-gris text-base hover:text-noir transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t(entry.labelKey)}
                </Link>
                {entry.children?.map((child) => (
                  <Link
                    key={child.key}
                    href={child.href}
                    className="pl-4 text-gris text-base hover:text-noir transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t(child.labelKey)}
                  </Link>
                ))}
              </div>
            ))}
            {(showSponsorCta || cfpUrl) && <hr className="border-gray-100" />}
            {showSponsorCta && (
              <Link
                href="/devenir-sponsor"
                className="rounded-[12px] border-2 border-bleu px-[18px] py-3 text-base font-bold text-bleu text-center"
                onClick={() => setIsMenuOpen(false)}
              >
                {tCta("becomeSponsor")}
              </Link>
            )}
            {cfpUrl && (
              <a
                href={cfpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[12px] bg-bleu px-[18px] py-3 text-base font-bold text-blanc text-center"
              >
                {tCta("submitTalk")}
              </a>
            )}
            <div className="flex items-center justify-between">
              <SocialIcons size={24} className="text-gris" links={socialLinks} />
              <LanguageSwitcher />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
