import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
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

const PREVIOUS_EDITIONS = [
  { label: "DevFest Toulouse 2025", href: "https://2025.devfesttoulouse.fr" },
  { label: "DevFest Toulouse 2024", href: "https://2024.devfesttoulouse.fr" },
  { label: "DevFest Toulouse 2023", href: "https://2023.devfesttoulouse.fr" },
];

export default async function Footer() {
  const tNav = await getTranslations("nav");
  const tFooter = await getTranslations("footer");
  const tCta = await getTranslations("cta");

  return (
    <footer
      role="contentinfo"
      className="bg-malachite rounded-3xl shadow-section mx-4 mb-4 mt-8 overflow-hidden"
    >
      <div className="mx-auto max-w-[1440px] px-6 py-8 lg:px-[84px] lg:py-8">
        <div className="flex flex-col lg:flex-row lg:justify-between gap-8">
          {/* Left column — Logo + socials + CTA */}
          <div className="flex flex-col gap-6">
            {/* Logo placeholder */}
            <div className="text-blanc">
              <span className="text-2xl font-bold">
                &lt;&gt; DevFest
              </span>
              <div className="text-lg tracking-[0.3em]">TOULOUSE</div>
            </div>

            <div>
              <p className="text-blanc text-sm mb-2">{tFooter("followUs")}</p>
              <SocialIcons size={48} className="text-blanc" />
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
            {/* Navigation */}
            <div>
              <h3 className="text-blanc text-xl font-bold mb-2 leading-snug">
                {tFooter("navigation")}
              </h3>
              <ul className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <li key={link.key}>
                    <Link
                      href={link.href}
                      className="text-blanc/80 text-base hover:text-blanc transition-colors"
                    >
                      {tNav(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ecosystems */}
            <div>
              <h3 className="text-blanc text-xl font-bold mb-2 leading-snug">
                {tFooter("ecosystems")}
              </h3>
              <ul className="flex flex-col gap-1">
                {ECOSYSTEM_LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blanc/80 text-base hover:text-blanc transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Previous editions */}
            <div>
              <h3 className="text-blanc text-xl font-bold mb-2 leading-snug">
                {tFooter("previousEditions")}
              </h3>
              <ul className="flex flex-col gap-1">
                {PREVIOUS_EDITIONS.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blanc/80 text-base hover:text-blanc transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-4 mb-4 rounded-l bg-blanc/75 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-gris-clair text-base italic">
          {tFooter("tagline")}
        </p>
        <div className="flex items-center gap-4">
          <Link href="/mentions-legales" className="text-link text-base hover:underline">
            {tFooter("legalNotice")}
          </Link>
          <Link href="/code-de-conduite" className="text-link text-base hover:underline">
            {tFooter("codeOfConduct")}
          </Link>
          <a href="/sitemap.xml" className="text-link text-base hover:underline">
            {tFooter("sitemap")}
          </a>
        </div>
      </div>
    </footer>
  );
}
