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
  return (
    <div className="flex border-b border-gris/20 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-5 py-3 text-sm font-medium transition-colors -mb-px ${
            activeTab === tab.key
              ? "text-malachite border-b-2 border-malachite"
              : "text-gris hover:text-noir"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
