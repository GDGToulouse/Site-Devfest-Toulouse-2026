"use client";

import { useId, useState } from "react";
import Tabs from "./Tabs";

type Lang = "fr" | "en";

interface BilingualTabsProps {
  // Optional section label shown above the tabs (e.g. "Bio", "Description").
  label?: string;
  required?: boolean;
  // The two panels. Both are always mounted; the inactive one is hidden via
  // CSS (never unmounted) so a RichTextEditor inside keeps its undo history and
  // focus across language switches — the whole reason this component exists.
  renderPanel: (lang: Lang) => React.ReactNode;
  // Marks a language whose fields are still empty, surfacing a dot on its tab
  // so a missing translation is visible without clicking through.
  isEmpty?: (lang: Lang) => boolean;
  // Tab captions. Defaults suit the admin (mono-language French UI); the public
  // edit page passes localized captions since it lives outside next-intl.
  labels?: { fr: string; en: string };
}

export default function BilingualTabs({
  label,
  required,
  renderPanel,
  isEmpty,
  labels = { fr: "Français", en: "English" },
}: BilingualTabsProps) {
  const [active, setActive] = useState<Lang>("fr");
  // Unique per instance so several BilingualTabs on one page don't collide on
  // their tab/panel ids (aria-controls / aria-labelledby wiring).
  const base = useId();
  const tabKey = (lang: Lang) => `${base}-${lang}`;
  const panelKey = (lang: Lang) => `panel-${base}-${lang}`;

  const tabs = (["fr", "en"] as const).map((lang) => ({
    key: tabKey(lang),
    label: labels[lang],
    badge: isEmpty?.(lang) ?? false,
  }));

  return (
    <div>
      {label && (
        <p className="mb-1 block text-sm font-medium text-noir">
          {label}
          {required && <span className="text-terre-cuite"> *</span>}
        </p>
      )}
      <Tabs
        tabs={tabs}
        activeTab={tabKey(active)}
        onTabChange={(key) => setActive(key.endsWith("-en") ? "en" : "fr")}
        panelId={(key) => `panel-${key}`}
      />
      {(["fr", "en"] as const).map((lang) => (
        <div
          key={lang}
          id={panelKey(lang)}
          role="tabpanel"
          aria-labelledby={tabKey(lang)}
          className={active === lang ? "" : "hidden"}
        >
          {renderPanel(lang)}
        </div>
      ))}
    </div>
  );
}
