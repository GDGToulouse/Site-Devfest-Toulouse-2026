export type AdminRole = "ADMIN" | "EDITOR";

export interface AdminNavItem {
  label: string;
  path: string;
  icon: string;
  roles: AdminRole[];
}

export const adminNavItems: AdminNavItem[] = [
  { label: "Dashboard", path: "/admin", icon: "grid", roles: ["ADMIN", "EDITOR"] },
  { label: "Éditions", path: "/admin/editions", icon: "calendar", roles: ["ADMIN"] },
  { label: "Articles", path: "/admin/articles", icon: "file-text", roles: ["ADMIN", "EDITOR"] },
  { label: "Pages", path: "/admin/pages", icon: "book", roles: ["ADMIN", "EDITOR"] },
  { label: "Fichiers", path: "/admin/images", icon: "image", roles: ["ADMIN", "EDITOR"] },
  { label: "Messages", path: "/admin/contact/messages", icon: "mail", roles: ["ADMIN", "EDITOR"] },
  { label: "Utilisateurs", path: "/admin/users", icon: "users", roles: ["ADMIN"] },
  { label: "Clés API", path: "/admin/api-keys", icon: "key", roles: ["ADMIN"] },
  { label: "Paramètres", path: "/admin/settings", icon: "settings", roles: ["ADMIN"] },
];

export function isAdminPathAllowed(pathname: string, role: AdminRole): boolean {
  const match = adminNavItems
    .filter((item) => item.path !== "/admin" && pathname.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!match) return true;
  return match.roles.includes(role);
}
