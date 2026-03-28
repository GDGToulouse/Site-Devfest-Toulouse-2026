import type { Edition, Article, TicketTier, KeyFigure } from "./types";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

async function fetchAPI<T>(path: string, revalidate = 3600): Promise<T | null> {
  const url = `${BACKEND_URL}${path}`;
  try {
    const res = await fetch(url, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getCurrentEdition(): Promise<Edition | null> {
  return fetchAPI<Edition>("/api/editions/current");
}

export async function getLatestArticles(limit = 4): Promise<Article[]> {
  return (await fetchAPI<Article[]>(`/api/articles/latest?limit=${limit}`)) || [];
}

export async function getCurrentTicketTiers(): Promise<TicketTier[]> {
  return (await fetchAPI<TicketTier[]>("/api/editions/current/ticket-tiers")) || [];
}

export async function getKeyFigures(): Promise<KeyFigure[]> {
  return (await fetchAPI<KeyFigure[]>("/api/settings/key-figures")) || [];
}
