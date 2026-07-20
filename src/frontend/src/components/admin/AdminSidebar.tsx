"use client";

import { useEffect, useState } from "react";
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
  faUser,
  faMicrophone,
  faHandshake,
  faTag,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import { adminNavGroups, type AdminNavItem, type AdminRole } from "./nav-items";

interface AdminUser {
  email: string;
  name: string | null;
  role: AdminRole;
}

interface CurrentEdition {
  id: number;
  year: number;
}

interface AdminSidebarProps {
  user: AdminUser;
  currentEdition?: CurrentEdition | null;
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
  user: faUser,
  microphone: faMicrophone,
  handshake: faHandshake,
  tag: faTag,
  star: faStar,
};

interface HealthInfo {
  version: string;
  environment: string;
  // Absent on builds made outside CI/Coolify (local dev).
  commit?: string;
}

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="px-6 pt-5 pb-2 text-[11px] font-bold uppercase tracking-wider text-blanc/40">
      {title}
    </p>
  );
}

export default function AdminSidebar({ user, currentEdition, onLogout, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();

  function renderItem(item: AdminNavItem) {
    const icon = iconMap[item.icon];

    if (item.disabled) {
      return (
        <span
          key={item.path}
          aria-disabled="true"
          className="flex items-center gap-3 px-6 py-3 text-sm border-l-4 border-transparent text-blanc/30 cursor-not-allowed"
        >
          {icon && <FontAwesomeIcon icon={icon} className="w-4 h-4" aria-hidden="true" />}
          {item.label}
          {item.badge && (
            <span className="ml-auto rounded-full bg-blanc/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blanc/40">
              {item.badge}
            </span>
          )}
        </span>
      );
    }

    const isActive = pathname === item.path || (item.path !== "/admin" && pathname.startsWith(item.path));
    return (
      <Link
        key={item.path}
        href={item.path}
        onClick={onNavigate}
        className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors border-l-4 ${
          isActive
            ? "bg-blanc/10 text-blanc font-bold border-malachite"
            : "text-blanc/70 hover:bg-blanc/5 hover:text-blanc border-transparent"
        }`}
      >
        {icon && <FontAwesomeIcon icon={icon} className="w-4 h-4" aria-hidden="true" />}
        {item.label}
      </Link>
    );
  }

  const editionHref = currentEdition ? `/admin/editions/${currentEdition.id}` : null;
  const isEditionActive = editionHref ? pathname.startsWith(editionHref) : false;

  // Surface the running backend's version + environment so admins know which
  // deployment they're on (#171). Best-effort: a failed fetch just hides the
  // badge, it never blocks the sidebar.
  const [health, setHealth] = useState<HealthInfo | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.version && data?.environment) {
          setHealth({
            version: data.version,
            environment: data.environment,
            commit: data.commit,
          });
        }
      })
      .catch(() => {
        // Silently ignore — the version badge is non-essential.
      });
  }, []);

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

      <nav className="flex-1 py-2 overflow-y-auto">
        {adminNavGroups.map((group, index) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(user.role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title ?? `group-${index}`}>
              {group.title && <SectionTitle title={group.title} />}
              {visibleItems.map(renderItem)}

              {/* Dynamic "current edition" block, right after the top group */}
              {index === 0 && currentEdition && editionHref && (
                <>
                  <SectionTitle title={`Édition en cours · ${currentEdition.year}`} />
                  <Link
                    href={editionHref}
                    onClick={onNavigate}
                    className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors border-l-4 ${
                      isEditionActive
                        ? "bg-blanc/10 text-blanc font-bold border-malachite"
                        : "text-blanc/70 hover:bg-blanc/5 hover:text-blanc border-transparent"
                    }`}
                  >
                    <FontAwesomeIcon icon={faStar} className="w-4 h-4" aria-hidden="true" />
                    Voir l&apos;édition
                  </Link>
                </>
              )}
            </div>
          );
        })}
      </nav>

      {health && (
        <p className="px-4 pb-2 text-xs text-blanc/40">
          v{health.version} · {health.environment}
          {/* The commit tells two deploys of the same version apart (#290);
              linked to GitHub so "what exactly is live?" is one click away. */}
          {health.commit && (
            <>
              {" · "}
              <a
                href={`https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/commit/${health.commit}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-blanc/70 hover:underline"
              >
                {health.commit}
              </a>
            </>
          )}
        </p>
      )}

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
