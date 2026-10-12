"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch, humanError } from "@/lib/admin-api";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";
import fr from "../../../../messages/fr.json";

// The audience feedback of every session of an edition (#565): vote counts,
// the full spread of appreciations — negatives included, unlike the public
// trend — and the private messages, which the team can hide when out of place.

const ITEM_LABELS: Record<string, string> = fr.feedback.items;

interface ItemCount {
  code: string;
  count: number;
}

interface SessionRow {
  id: number;
  title: string;
  slug: string;
  speakers: string[];
  votes: number;
  testVotes: number;
  items: ItemCount[];
  messages: number;
}

interface SessionDetail {
  id: number;
  title: string;
  votes: number;
  items: ItemCount[];
  messages: { id: number; text: string; at: string | null; hidden: boolean; isTest: boolean }[];
}

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

function topItems(items: ItemCount[], votes: number): string {
  return [...items]
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((item) => `${ITEM_LABELS[item.code] ?? item.code} ${Math.round((item.count / votes) * 100)} %`)
    .join(" · ");
}

export default function FeedbackResults({ editionId }: { editionId: number }) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [feedback, setFeedback] = useState<SaveState>(null);

  const loadSessions = useCallback(async () => {
    const { data } = await adminFetch<{ talks: SessionRow[] }>(`/editions/${editionId}/feedback`);
    setSessions(data?.talks ?? []);
  }, [editionId]);

  const loadDetail = useCallback(async (talkId: number) => {
    const { data } = await adminFetch<SessionDetail>(`/talks/${talkId}/feedback`);
    setDetail(data ?? null);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function toggle(talkId: number) {
    setFeedback(null);
    if (openId === talkId) {
      setOpenId(null);
      return;
    }
    setOpenId(talkId);
    setDetail(null);
    await loadDetail(talkId);
  }

  async function setHidden(messageId: number, hidden: boolean) {
    const result = await adminFetch(`/feedback/${messageId}/message`, { method: "PUT", body: JSON.stringify({ hidden }) });
    if (result.status !== 200) {
      setFeedback({ kind: "error", text: humanError(result, "Le message n'a pas pu être modifié.") });
      return;
    }
    setFeedback({ kind: "ok", text: hidden ? "Message masqué : le speaker ne le verra pas." : "Message réaffiché." });
    if (openId) await loadDetail(openId);
  }

  if (!sessions) return null;
  const voted = sessions.filter((s) => s.votes > 0);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-noir">Résultats</h2>
      {voted.length === 0 ? (
        <p className="text-sm text-gris">Aucun avis pour l’instant.</p>
      ) : (
        <ul className="space-y-2">
          {voted.map((session) => (
            <li key={session.id} className="rounded-[12px] bg-blanc shadow-card">
              <button
                type="button"
                onClick={() => toggle(session.id)}
                aria-expanded={openId === session.id}
                className="flex w-full flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-left"
              >
                <span>
                  <span className="font-bold text-noir">{session.title}</span>
                  {session.speakers.length > 0 && <span className="text-sm text-gris"> — {session.speakers.join(", ")}</span>}
                  <span className="block text-sm text-gris">{topItems(session.items, session.votes)}</span>
                </span>
                <span className="text-sm text-noir">
                  <strong>{session.votes}</strong> avis
                  {session.testVotes > 0 && <span className="text-gris"> (dont {session.testVotes} de test)</span>}
                  {session.messages > 0 && <span className="text-gris"> · {session.messages} message{session.messages > 1 ? "s" : ""}</span>}
                </span>
              </button>

              {openId === session.id && detail && (
                <div className="space-y-4 border-t border-gris/10 px-4 py-4">
                  <ul className="space-y-1 text-sm">
                    {detail.items.map(({ code, count }) => (
                      <li key={code} className="flex justify-between gap-4">
                        <span>{ITEM_LABELS[code] ?? code}</span>
                        <span className="tabular-nums text-gris">
                          {count} ({detail.votes ? Math.round((count / detail.votes) * 100) : 0} %)
                        </span>
                      </li>
                    ))}
                  </ul>

                  <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />

                  {detail.messages.length === 0 ? (
                    <p className="text-sm text-gris">Aucun message.</p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.messages.map((message) => (
                        <li
                          key={message.id}
                          className={`flex flex-wrap items-start justify-between gap-3 rounded-[12px] px-4 py-3 text-sm ${
                            message.hidden ? "bg-gris/10 text-gris" : "bg-blanc-casse text-noir"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-line">{message.text}</p>
                            <p className="mt-1 text-xs text-gris">
                              {message.at && DATE_TIME.format(new Date(message.at))}
                              {message.isTest && " · test"}
                              {message.hidden && " · masqué, le speaker ne le voit pas"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setHidden(message.id, !message.hidden)}
                            className="text-sm text-bleu underline"
                          >
                            {message.hidden ? "Réafficher" : "Masquer"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
