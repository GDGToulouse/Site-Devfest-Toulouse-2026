const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export async function adminFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; status: number }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (res.status === 403) {
      return { data: null, status: 403 };
    }

    if (!res.ok) {
      return { data: null, status: res.status };
    }

    const data = await res.json();
    return { data, status: res.status };
  } catch {
    return { data: null, status: 0 };
  }
}

export async function getAdminSession(): Promise<AdminUser | null> {
  const { data, status } = await adminFetch<{ user: AdminUser }>("/session");
  if (status === 403 || !data) return null;
  return data.user;
}

export function getAuthUrl(provider: "google" | "github"): string {
  const callbackURL = typeof window !== "undefined" ? `${window.location.origin}/fr/admin` : "/fr/admin";
  return `${BACKEND_URL}/api/auth/sign-in/social?provider=${provider}&callbackURL=${encodeURIComponent(callbackURL)}`;
}

export function getLogoutUrl(): string {
  return `${BACKEND_URL}/api/auth/sign-out`;
}
