"use client";

import { useRef, useCallback, type KeyboardEvent } from "react";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export default function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  const tablistRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = tabs.findIndex((tab) => tab.key === activeTab);
      let nextIndex: number | null = null;

      if (e.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        onTabChange(tabs[nextIndex].key);
        const nextButton = tablistRef.current?.querySelector<HTMLButtonElement>(
          `#tab-${tabs[nextIndex].key}`,
        );
        nextButton?.focus();
      }
    },
    [tabs, activeTab, onTabChange],
  );

  return (
    <div
      ref={tablistRef}
      role="tablist"
      className="flex border-b border-gris/20 mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            id={`tab-${tab.key}`}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.key)}
            onKeyDown={handleKeyDown}
            className={`px-5 py-3 text-sm font-medium transition-colors -mb-px whitespace-nowrap ${
              isActive
                ? "text-malachite border-b-2 border-malachite"
                : "text-gris hover:text-noir"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
