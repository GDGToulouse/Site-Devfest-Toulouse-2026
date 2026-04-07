"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminUser {
  email: string;
  name: string | null;
  role: "ADMIN" | "EDITOR";
}

interface AdminSidebarProps {
  user: AdminUser;
  onLogout: () => void;
  onNavigate?: () => void;
}

const navItems = [
  { label: "Dashboard", path: "/admin", icon: "grid", roles: ["ADMIN", "EDITOR"] },
  { label: "Editions", path: "/admin/editions", icon: "calendar", roles: ["ADMIN"] },
  { label: "Articles", path: "/admin/articles", icon: "file-text", roles: ["ADMIN", "EDITOR"] },
  { label: "Pages", path: "/admin/pages", icon: "book", roles: ["ADMIN", "EDITOR"] },
  { label: "Fichiers", path: "/admin/images", icon: "image", roles: ["ADMIN", "EDITOR"] },
  { label: "Messages", path: "/admin/contact/messages", icon: "mail", roles: ["ADMIN", "EDITOR"] },
  { label: "Utilisateurs", path: "/admin/users", icon: "users", roles: ["ADMIN"] },
  { label: "Parametres", path: "/admin/settings", icon: "settings", roles: ["ADMIN"] },
];

export default function AdminSidebar({ user, onLogout, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const locale = pathname.startsWith("/en") ? "en" : "fr";
  const visibleItems = navItems
    .filter((item) => item.roles.includes(user.role))
    .map((item) => ({ ...item, href: `/${locale}${item.path}` }));

  return (
    <aside className="w-64 bg-noir text-blanc flex flex-col h-full">
      <div className="p-6 border-b border-blanc/10 flex items-center justify-between">
        <Link href={`/${locale}/admin`} className="text-xl font-bold">
          <span className="text-malachite">DevFest</span>{" "}
          <span className="text-terre-cuite">Admin</span>
        </Link>
        <Link
          href={`/${locale}`}
          className="text-blanc/50 hover:text-blanc transition-colors"
          title="Voir le site"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
        </Link>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleItems.map((item) => {
          const adminRoot = `/${locale}/admin`;
          const isActive = pathname === item.href || (item.href !== adminRoot && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
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
        <Link href={`/${locale}/admin/profile`} onClick={onNavigate} className="block hover:bg-blanc/5 -mx-2 px-2 py-1 rounded transition-colors">
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
