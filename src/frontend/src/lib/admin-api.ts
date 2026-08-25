// All requests go through Next.js rewrites (next.config.ts) so the
// backend URL stays internal — never exposed to the browser bundle.
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
): Promise<{ data: T | null; status: number; error?: string; errorBody?: Record<string, unknown> }> {
  try {
    const headers: Record<string, string> = {};
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`/api/admin${path}`, {
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

    // Surface the backend's own message (#262) — a generic "save failed" left
    // editors guessing which field was rejected. `data` stays null on error, so
    // callers that only check it keep working.
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const error = body?.error || body?.message;
      // Some errors carry more than a message: the 409 on a taken sponsor slug
      // returns the existing company's id, which the caller offers to attach
      // rather than leaving the editor stuck (#389).
      return {
        data: null,
        status: res.status,
        ...(error ? { error } : {}),
        ...(body && typeof body === "object" ? { errorBody: body as Record<string, unknown> } : {}),
      };
    }

    // 204 No Content (e.g. a DELETE) has an empty body: res.json() would throw
    // and wrongly surface as a network error. Return the success status as-is.
    if (res.status === 204) {
      return { data: null, status: 204 };
    }

    const data = await res.json();
    return { data, status: res.status };
  } catch {
    // Status 0 means the request never reached the backend — a network
    // failure, not an answer. Callers must not test `status >= 400` alone: 0
    // slips through it, and the screen then reports a save that never happened
    // (#428). Success is 200 on an update, 201 on a creation.
    return { data: null, status: 0 };
  }
}

/**
 * The sentence to show a human after a failed call.
 *
 * `adminFetch` resolves `error` as `body.error || body.message`, and several
 * screens compare that value against a code (`last_responsable`,
 * `quota_reached`…), so it has to keep winning. The cost is that a route
 * sending both — a code AND a written explanation — surfaces the code:
 * "room_in_use" where the backend wrote "3 conférences sont programmées dans
 * cette salle". This picks the written one when there is one.
 */
export function humanError(
  result: { error?: string; errorBody?: Record<string, unknown> },
  fallback: string,
): string {
  const message = result.errorBody?.message;
  if (typeof message === "string" && message.trim()) return message;
  return result.error ?? fallback;
}

export async function getAdminSession(): Promise<AdminUser | null> {
  const { data, status } = await adminFetch<{ user: AdminUser }>("/session");
  if (status === 403 || !data) return null;
  return data.user;
}

export interface PurgeReport {
  cutoff: string;
  retentionDays: number;
  entities: { entity: string; purged: number; filesDeleted: number; filesKept: number }[];
  totalPurged: number;
}

/**
 * Run the trash purge by hand (#335).
 *
 * Not `adminFetch`: maintenance routes live under `/api`, not `/api/admin`, so
 * that helper's prefix would 404. The endpoint accepts an ADMIN session as a
 * fallback for the cron secret, hence `credentials: "include"` and no header.
 */
export async function purgeExpiredTrash(): Promise<{
  data: PurgeReport | null;
  status: number;
  error?: string;
}> {
  try {
    const res = await fetch("/api/maintenance/purge-trash", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const error = body?.error || body?.message;
      return { data: null, status: res.status, ...(error ? { error } : {}) };
    }
    return { data: await res.json(), status: res.status };
  } catch {
    return { data: null, status: 0 };
  }
}

// Better Auth's sign-in/social endpoint is POST-only: it returns the provider
// authorization URL as JSON ({ url, redirect }) instead of issuing a 302. A
// plain <a href> performed a GET and got back `null` (404). We POST, then
// navigate to the returned URL.
// path defaults to the back-office, but a sponsor signing in from its own space
// must come back there: landing on /admin got them a 403 loop, and the page
// that binds their invitation never reloaded, so the account stayed orphaned
// (#409).
export async function signInWithSocial(
  provider: "google" | "github",
  path = "/admin",
): Promise<{ ok: boolean; error?: string }> {
  const callbackURL = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  try {
    const res = await fetch(`/api/auth/sign-in/social`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, callbackURL }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.url) {
      window.location.href = data.url;
      return { ok: true };
    }
    return { ok: false, error: data?.message || `Erreur ${res.status}` };
  } catch {
    return { ok: false, error: "Impossible de contacter le serveur" };
  }
}

export async function signOut(): Promise<void> {
  await fetch(`/api/auth/sign-out`, {
    method: "POST",
    credentials: "include",
  });
}

export async function signInWithEmail(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/auth/sign-in/email`, {
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
    const res = await fetch(`/api/auth/request-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/admin` }),
    });

    if (res.ok) return { success: true };
    return { success: false, error: "Erreur lors de l'envoi" };
  } catch {
    return { success: false, error: "Impossible de contacter le serveur" };
  }
}

// --- API Keys ---

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ApiKeyWithUser extends ApiKey {
  user: { id: string; email: string; name: string | null; role: "ADMIN" | "EDITOR" };
}

export interface CreatedApiKey extends ApiKey {
  key: string;
}

async function meFetch<T>(path: string, options: RequestInit = {}): Promise<{ data: T | null; status: number }> {
  try {
    const headers: Record<string, string> = {};
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(`/api/me${path}`, {
      credentials: "include",
      headers: { ...headers, ...options.headers },
      ...options,
    });
    if (!res.ok) return { data: null, status: res.status };
    const data = await res.json();
    return { data, status: res.status };
  } catch {
    return { data: null, status: 0 };
  }
}

export async function listMyApiKeys(): Promise<ApiKey[]> {
  const { data } = await meFetch<ApiKey[]>("/api-keys");
  return data ?? [];
}

export async function createApiKey(name: string, expiresAt?: string | null): Promise<{ data: CreatedApiKey | null; status: number }> {
  return meFetch<CreatedApiKey>("/api-keys", {
    method: "POST",
    body: JSON.stringify({ name, expiresAt: expiresAt ?? null }),
  });
}

// Replace a key's secret in place, keeping its name and expiry. The old value
// stops working immediately; the new one is returned once (#227).
export async function rotateMyApiKey(id: string): Promise<{ data: CreatedApiKey | null; status: number }> {
  return meFetch<CreatedApiKey>(`/api-keys/${id}/rotate`, { method: "POST" });
}

export async function revokeMyApiKey(id: string): Promise<boolean> {
  const { status } = await meFetch(`/api-keys/${id}`, { method: "DELETE" });
  return status === 200;
}

// Hard-delete a key that has already been revoked. Returns false if the
// key is still active (the backend refuses to purge unrevoked keys).
export async function purgeMyApiKey(id: string): Promise<boolean> {
  const { status } = await meFetch(`/api-keys/${id}?purge=true`, { method: "DELETE" });
  return status === 200;
}

export interface AdminApiKeysList {
  page: number;
  limit: number;
  total: number;
  items: ApiKeyWithUser[];
}

export async function adminListApiKeys(params: {
  userId?: string;
  status?: "active" | "revoked" | "all";
  page?: number;
  limit?: number;
} = {}): Promise<AdminApiKeysList | null> {
  const q = new URLSearchParams();
  if (params.userId) q.set("userId", params.userId);
  if (params.status) q.set("status", params.status);
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  const { data } = await adminFetch<AdminApiKeysList>(`/api-keys${q.toString() ? `?${q}` : ""}`);
  return data;
}

export async function adminRevokeApiKey(id: string): Promise<boolean> {
  const { status } = await adminFetch(`/api-keys/${id}`, { method: "DELETE" });
  return status === 200;
}
