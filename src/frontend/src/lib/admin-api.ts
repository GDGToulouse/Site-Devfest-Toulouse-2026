const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "ADMIN" | "EDITOR";
}

export async function adminFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; status: number }> {
  try {
    const headers: Record<string, string> = {};
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${BACKEND_URL}/api/admin${path}`, {
      credentials: "include",
      headers: {
        ...headers,
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

export async function signOut(): Promise<void> {
  await fetch(`${BACKEND_URL}/api/auth/sign-out`, {
    method: "POST",
    credentials: "include",
  });
}

export async function signInWithEmail(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/sign-in/email`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) return { success: true };

    const body = await res.json().catch(() => null);
    if (res.status === 401 || res.status === 403) {
      return { success: false, error: "Email ou mot de passe incorrect" };
    }
    if (body?.message?.includes("verify")) {
      return { success: false, error: "Veuillez vérifier votre email avant de vous connecter" };
    }
    return { success: false, error: body?.message || "Erreur de connexion" };
  } catch {
    return { success: false, error: "Impossible de contacter le serveur" };
  }
}

export async function forgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/forget-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/fr/admin` }),
    });

    if (res.ok) return { success: true };
    return { success: false, error: "Erreur lors de l'envoi" };
  } catch {
    return { success: false, error: "Impossible de contacter le serveur" };
  }
}
