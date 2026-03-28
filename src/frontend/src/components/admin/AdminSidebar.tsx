"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminUser {
  email: string;
  name: string | null;
}

interface AdminSidebarProps {
  user: AdminUser;
  onLogout: () => void;
}

const navItems = [
  { label: "Dashboard", href: "/fr/admin", icon: "grid" },
  { label: "Articles", href: "/fr/admin/articles", icon: "file-text" },
  { label: "Edition", href: "/fr/admin/editions", icon: "calendar" },
  { label: "Billetterie", href: "/fr/admin/ticketing", icon: "ticket" },
  { label: "CFP", href: "/fr/admin/cfp", icon: "mic" },
  { label: "Pages", href: "/fr/admin/pages", icon: "book" },
  { label: "Categories contact", href: "/fr/admin/contact/categories", icon: "tag" },
  { label: "Messages", href: "/fr/admin/contact/messages", icon: "mail" },
  { label: "Chiffres cles", href: "/fr/admin/key-figures", icon: "bar-chart" },
  { label: "Cache", href: "/fr/admin/cache", icon: "refresh" },
];

export default function AdminSidebar({ user, onLogout }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-noir text-blanc flex flex-col h-full">
      <div className="p-6 border-b border-blanc/10">
        <Link href="/fr/admin" className="text-xl font-bold">
          <span className="text-malachite">DevFest</span>{" "}
          <span className="text-terre-cuite">Admin</span>
        </Link>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/fr/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-6 py-3 text-sm transition-colors ${
                isActive
                  ? "bg-blanc/10 text-blanc font-bold border-l-4 border-malachite"
                  : "text-blanc/70 hover:bg-blanc/5 hover:text-blanc"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-blanc/10">
        <p className="text-xs text-blanc/50 truncate">{user.email}</p>
        <button
          onClick={onLogout}
          className="mt-2 text-sm text-blanc/70 hover:text-blanc transition-colors"
        >
          Deconnexion
        </button>
      </div>
    </aside>
  );
}
