"use client";

import { useState, useEffect } from "react";

import { getAdminSession, signOut } from "@/lib/admin-api";
import AdminLogin from "./AdminLogin";
import AdminSidebar from "./AdminSidebar";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "ADMIN" | "EDITOR";
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    getAdminSession()
      .then((session) => {
        setUser(session);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

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
    <div className="fixed inset-0 z-50 flex bg-blanc-casse w-screen h-screen overflow-hidden">
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

        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
