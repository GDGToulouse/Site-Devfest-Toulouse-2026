"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import { adminFetch, getAdminSession, signOut } from "@/lib/admin-api";
import AdminLogin from "./AdminLogin";
import AdminSidebar from "./AdminSidebar";
import { isAdminPathAllowed, type AdminRole } from "./nav-items";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: AdminRole;
}

interface CurrentEdition {
  id: number;
  year: number;
}

interface EditionSummary {
  id: number;
  year: number;
  status: string;
}

// The "current edition" is the one being actively worked on: an edition in the
// ANNOUNCEMENT phase, otherwise one in PREPARATION, otherwise the most recent.
function pickCurrentEdition(editions: EditionSummary[]): CurrentEdition | null {
  if (editions.length === 0) return null;
  const byPriority =
    editions.find((e) => e.status === "ANNOUNCEMENT") ??
    editions.find((e) => e.status === "PREPARATION") ??
    [...editions].sort((a, b) => b.year - a.year)[0];
  return { id: byPriority.id, year: byPriority.year };
}

// Public admin paths that render their own content without requiring a session.
// A user resetting their password precisely does NOT have a valid session.
const PUBLIC_ADMIN_PATHS = ["/admin/reset-password"];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPath = PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p));

  const [user, setUser] = useState<AdminUser | null>(null);
  const [currentEdition, setCurrentEdition] = useState<CurrentEdition | null>(null);
  const [isLoading, setIsLoading] = useState(!isPublicPath);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (isPublicPath) return;
    getAdminSession()
      .then(async (session) => {
        setUser(session);
        // Editions are ADMIN-only; skip the call for editors to avoid a 403.
        if (session?.role === "ADMIN") {
          const { data } = await adminFetch<EditionSummary[]>("/editions");
          if (data) setCurrentEdition(pickCurrentEdition(data));
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [isPublicPath]);

  if (isPublicPath) {
    return <>{children}</>;
  }

  async function handleLogout() {
    await signOut();
    setUser(null);
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-blanc">
        <p className="text-gris text-lg">Chargement...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-50">
        <AdminLogin />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-blanc-casse w-screen h-screen h-dvh overflow-hidden">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-noir/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible on desktop, toggleable on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 lg:relative lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AdminSidebar
          user={user}
          currentEdition={currentEdition}
          onLogout={handleLogout}
          onNavigate={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header with hamburger */}
        <div className="sticky top-0 z-30 flex items-center gap-4 bg-blanc-casse px-4 py-3 lg:hidden border-b border-gris/10">
          <button
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Ouvrir le menu"
            className="p-2 text-noir"
          >
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-bold">
            <span className="text-malachite">DevFest</span>{" "}
            <span className="text-terre-cuite">Admin</span>
          </span>
        </div>

        {/* pb-24 on mobile keeps the last element (often a Save button) clear
            of the browser's bottom chrome; h-dvh above already excludes it, but
            the extra padding is a belt-and-braces safeguard (#257). */}
        <div className="p-4 pb-24 lg:p-8 lg:pb-8">
          {isAdminPathAllowed(pathname, user.role) ? children : <ForbiddenSection />}
        </div>
      </main>
    </div>
  );
}

function ForbiddenSection() {
  return (
    <div className="mx-auto max-w-xl rounded-[12px] border border-gris/20 bg-blanc p-8 text-center">
      <h1 className="text-2xl font-bold text-noir">Accès réservé</h1>
      <p className="mt-3 text-gris">
        Cette section est réservée aux administrateurs. Contactez un administrateur si vous pensez
        avoir besoin d&apos;y accéder.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-block rounded-[8px] bg-malachite px-5 py-2 text-sm font-bold text-blanc hover:opacity-90"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
