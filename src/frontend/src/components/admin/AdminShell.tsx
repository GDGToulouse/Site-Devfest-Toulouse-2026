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
      <AdminSidebar user={user} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
