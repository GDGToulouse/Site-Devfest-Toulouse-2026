import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import { getCurrentEdition, getEditions, getSocialLinks } from "@/lib/api";
import SocialIcons from "./SocialIcons";

const NAV_LINKS = [
  { key: "program", href: "/conferences" },
  { key: "speakers", href: "/speakers" },
  { key: "partners", href: "/partners" },
  { key: "blog", href: "/actualites" },
] as const;

const ECOSYSTEM_LINKS = [
  { label: "ToulouseTechHub", href: "https://www.toulousetechhub.com/" },
  { label: "CloudToulouse", href: "https://www.cloudtoulouse.com/" },
];

export default async function Footer() {
  const [tNav, tFooter, tCta, edition, editions, socialLinks] = await Promise.all([
    getTranslations("nav"),
    getTranslations("footer"),
    getTranslations("cta"),
    getCurrentEdition(),
    getEditions(),
    getSocialLinks(),
  ]);

  const isAnnouncement = edition?.status === "ANNOUNCEMENT";

  const previousEditions = edition
    ? editions
        .filter((e) => e.year < edition.year)
        .sort((a, b) => b.year - a.year)
    : [];

  return (
    <footer
      role="contentinfo"
      className="bg-[#0B7350] rounded-3xl shadow-section mx-4 mb-4 mt-8 overflow-hidden"
    >
      <div className="mx-auto max-w-[1440px] px-6 py-8 lg:px-[84px] lg:py-8">
        <div className="flex flex-col lg:flex-row lg:justify-between gap-8">
          {/* Left column — Logo + socials + CTA */}
          <div className="flex flex-col gap-6">
            <Image
              src="/images/logo-devfest-white.svg"
              alt="DevFest Toulouse"
              width={180}
              height={80}
              className="h-auto"
            />

            <div>
              <p className="text-blanc text-sm mb-2">{tFooter("followUs")}</p>
              <SocialIcons size={48} className="text-blanc" links={socialLinks} />
            </div>

            <Link
              href="/contact"
              className="inline-block rounded-[12px] bg-bleu px-[18px] py-3 text-base font-bold text-blanc hover:opacity-90 transition-opacity w-fit"
            >
              {tCta("contactUs")}
            </Link>
          </div>

          {/* Right columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Navigation — only when edition is in ANNOUNCEMENT */}
            {isAnnouncement && (() => {
              const footerLinks = NAV_LINKS.filter((link) => {
                if (link.key === "program" && !edition?.isProgramPublished) return false;
                if (link.key === "speakers" && !edition?.hasSpeakers) return false;
                if (link.key === "partners" && !edition?.hasSponsors) return false;
                return true;
              });
              if (footerLinks.length === 0) return null;
              return (
                <div>
                  <p className="text-blanc text-xl font-bold mb-2 leading-snug">
                    {tFooter("navigation")}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {footerLinks.map((link) => (
                      <li key={link.key}>
                        <Link
                          href={link.href}
                          className="text-blanc text-base hover:text-blanc-casse transition-colors"
                        >
                          {tNav(link.key)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* Ecosystems */}
            <div>
              <p className="text-blanc text-xl font-bold mb-2 leading-snug">
                {tFooter("ecosystems")}
              </p>
              <ul className="flex flex-col gap-1">
                {ECOSYSTEM_LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blanc text-base hover:text-blanc-casse transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Previous editions — from database */}
            {previousEditions.length > 0 && (
              <div>
                <p className="text-blanc text-xl font-bold mb-2 leading-snug">
                  {tFooter("previousEditions")}
                </p>
                <ul className="flex flex-col gap-1">
                  {previousEditions.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/editions/${e.year}`}
                        className="text-blanc text-base hover:text-blanc-casse transition-colors"
                      >
                        DevFest Toulouse {e.year}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-6 lg:mx-[84px] border-t border-blanc/20 px-0 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-blanc/85 text-sm italic">
          {tFooter("tagline")}
        </p>
        <div className="flex items-center gap-4">
          <Link href="/mentions-legales" className="text-blanc/85 text-sm hover:text-blanc transition-colors">
            {tFooter("legalNotice")}
          </Link>
          <Link href="/code-de-conduite" className="text-blanc/85 text-sm hover:text-blanc transition-colors">
            {tFooter("codeOfConduct")}
          </Link>
          <a href="/sitemap.xml" className="text-blanc/85 text-sm hover:text-blanc transition-colors">
            {tFooter("sitemap")}
          </a>
        </div>
      </div>
    </footer>
  );
}
