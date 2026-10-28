// The volunteers' side of the arrivals (#640): their invitation, and whether
// the signed-in account may open the event-day screens. Same-origin calls,
// relayed to the backend by next.config.ts.

export interface ArrivalsResult<T> {
  data: T | null;
  // 0: the request never reached the backend.
  status: number;
  error?: string;
}

export interface ArrivalsInvitation {
  editionYear: number;
  emailHint: string;
}

export interface ArrivalsCurrent {
  edition: { id: number; year: number } | null;
  hasAccess: boolean;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<ArrivalsResult<T>> {
  try {
    const res = await fetch(path, { credentials: "include", ...init });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { data: null, status: res.status, ...(body?.error ? { error: body.error } : {}) };
    }
    return { data: (await res.json()) as T, status: res.status };
  } catch {
    return { data: null, status: 0 };
  }
}

export function getArrivalsInvitation(token: string) {
  return call<ArrivalsInvitation>(`/api/arrivals-invitation/${encodeURIComponent(token)}`);
}

export function acceptArrivalsInvitation(token: string) {
  return call<{ editionYear: number }>(`/api/arrivals-invitation/${encodeURIComponent(token)}/accept`, {
    method: "POST",
  });
}

export function getArrivalsCurrent() {
  return call<ArrivalsCurrent>("/api/arrivals/current");
}
