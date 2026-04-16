"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTableCellsLarge,
  faCalendarDays,
  faFileLines,
  faBook,
  faImage,
  faEnvelope,
  faUsers,
  faGear,
  faKey,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import { adminNavItems, type AdminRole } from "./nav-items";

interface AdminUser {
  email: string;
  name: string | null;
  role: AdminRole;
}

interface AdminSidebarProps {
  user: AdminUser;
  onLogout: () => void;
  onNavigate?: () => void;
}

const iconMap: Record<string, IconDefinition> = {
  grid: faTableCellsLarge,
  calendar: faCalendarDays,
  "file-text": faFileLines,
  book: faBook,
  image: faImage,
  mail: faEnvelope,
  users: faUsers,
  settings: faGear,
  key: faKey,
};

export default function AdminSidebar({ user, onLogout, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const visibleItems = adminNavItems
    .filter((item) => item.roles.includes(user.role))
    .map((item) => ({ ...item, href: item.path }));

  return (
    <aside className="w-64 bg-noir text-blanc flex flex-col h-full">
      <div className="p-6 border-b border-blanc/10 flex items-center justify-between">
        <Link href="/admin" className="text-xl font-bold">
          <span className="text-malachite">DevFest</span>{" "}
          <span className="text-terre-cuite">Admin</span>
        </Link>
        <Link
          href="/"
          className="text-blanc/50 hover:text-blanc transition-colors"
          title="Voir le site"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
        </Link>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors border-l-4 ${
                isActive
                  ? "bg-blanc/10 text-blanc font-bold border-malachite"
                  : "text-blanc/70 hover:bg-blanc/5 hover:text-blanc border-transparent"
              }`}
            >
              {iconMap[item.icon] && (
                <FontAwesomeIcon icon={iconMap[item.icon]} className="w-4 h-4" aria-hidden="true" />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-blanc/10">
        <Link href="/admin/profile" onClick={onNavigate} className="block hover:bg-blanc/5 -mx-2 px-2 py-1 rounded transition-colors">
          {user.name && <p className="text-sm text-blanc truncate">{user.name}</p>}
          <p className="text-xs text-blanc/50 truncate">{user.email}</p>
          <p className="text-xs text-blanc/30">{user.role === "ADMIN" ? "Administrateur" : "Éditeur"}</p>
        </Link>
        <button
          onClick={onLogout}
          className="mt-2 text-sm text-blanc/70 hover:text-blanc transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
