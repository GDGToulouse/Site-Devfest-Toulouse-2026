export type AdminRole = "ADMIN" | "EDITOR";

export interface AdminNavItem {
  label: string;
  path: string;
  icon: string;
  roles: AdminRole[];
  disabled?: boolean;
  badge?: string;
}

export interface AdminNavGroup {
  title: string | null;
  items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    title: null,
    items: [
      { label: "Tableau de bord", path: "/admin", icon: "grid", roles: ["ADMIN", "EDITOR"] },
    ],
  },
  {
    title: "Données",
    items: [
      { label: "Speakers", path: "/admin/speakers", icon: "user", roles: ["ADMIN", "EDITOR"] },
      { label: "Conférences", path: "/admin/talks", icon: "microphone", roles: ["ADMIN", "EDITOR"] },
      { label: "Sponsors", path: "/admin/sponsors", icon: "handshake", roles: ["ADMIN", "EDITOR"] },
      { label: "Catégories", path: "/admin/categories", icon: "tag", roles: ["ADMIN", "EDITOR"] },
    ],
  },
  {
    title: "Contenu éditorial",
    items: [
      { label: "Articles", path: "/admin/articles", icon: "file-text", roles: ["ADMIN", "EDITOR"] },
      { label: "Pages", path: "/admin/pages", icon: "book", roles: ["ADMIN", "EDITOR"] },
      { label: "Fichiers", path: "/admin/files", icon: "image", roles: ["ADMIN", "EDITOR"] },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Messages", path: "/admin/contact/messages", icon: "mail", roles: ["ADMIN", "EDITOR"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Éditions", path: "/admin/editions", icon: "calendar", roles: ["ADMIN"] },
      { label: "Utilisateurs", path: "/admin/users", icon: "users", roles: ["ADMIN"] },
      { label: "Clés API", path: "/admin/api-keys", icon: "key", roles: ["ADMIN"] },
      // Both roles reach the page; ADMIN-only entities (users, editions…) are
      // filtered out inside it, mirroring the API's 403 (#150).
      { label: "Corbeille", path: "/admin/trash", icon: "trash", roles: ["ADMIN", "EDITOR"] },
      { label: "Paramètres", path: "/admin/settings", icon: "settings", roles: ["ADMIN"] },
    ],
  },
];

export function isAdminPathAllowed(pathname: string, role: AdminRole): boolean {
  const match = adminNavGroups
    .flatMap((group) => group.items)
    .filter((item) => item.path !== "/admin" && pathname.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!match) return true;
  return match.roles.includes(role);
}
