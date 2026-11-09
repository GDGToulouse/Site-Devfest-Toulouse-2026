"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatEventDate, formatEventTime } from "@/lib/datetime";
import { getFeedbackVoterId } from "@/lib/feedback-voter";

// The audience's opinion of a session (#563, #564), on the model of OpenFeedback
// by Hugo Gresse. Fetched in the browser, not rendered on the server: the talk
// page is cached for an hour, and voting is a matter of minutes.

// OpenFeedback's default voting form, in its order (codes match the backend).
export const FEEDBACK_ITEMS = [
  "fun",
  "learned",
  "interesting",
  "speaker",
  "notClear",
  "tooTechnical",
  "lackOfDemo",
  "tooComplex",
] as const;

const MESSAGE_MAX_LENGTH = 2000;

interface FeedbackStatus {
  phase: "upcoming" | "open" | "closed";
  /** The edition's test mode is on (#566): what is cast now will be wiped. */
  isTest: boolean;
  /** When this session's vote opens: ten minutes before its end (#809). */
  opensAt: string | null;
  hasVoted: boolean;
  hasMessage: boolean;
  /** Every appreciation's count, shown to everyone from the first vote (#803). */
  results: { votes: number; items: { code: string; count: number }[] } | null;
}

const LINK = "font-bold text-bleu underline";

// A page left open past the opening reloads the form by itself, but not for a
// session days away: a timer that long would only drift (#809).
const MAX_OPENING_WAIT_MS = 12 * 60 * 60 * 1000;

export default function TalkFeedback({ slug }: { slug: string }) {
  const t = useTranslations("feedback");
  const locale = useLocale();
  const [voterId, setVoterId] = useState<string | null>(null);
  const [status, setStatus] = useState<FeedbackStatus | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMessageSent, setIsMessageSent] = useState(false);

  const base = `/api/talks/${encodeURIComponent(slug)}/feedback`;

  const load = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${base}?voterId=${id}`, { cache: "no-store" });
      setStatus(res.ok ? await res.json() : null);
    } catch {
      setStatus(null);
    }
  }, [base]);

  useEffect(() => {
    const id = getFeedbackVoterId();
    setVoterId(id);
    load(id);
  }, [load]);

  const opensAt = status?.phase === "upcoming" ? status.opensAt : null;
  useEffect(() => {
    if (!opensAt || !voterId) return;
    const wait = new Date(opensAt).getTime() - Date.now();
    if (wait <= 0 || wait > MAX_OPENING_WAIT_MS) return;
    // A second late, so the server agrees the vote is open.
    const timer = setTimeout(() => load(voterId), wait + 1000);
    return () => clearTimeout(timer);
  }, [opensAt, voterId, load]);

  if (!status || !voterId) return null;
  const votes = status.results?.votes ?? 0;
  // Over and nobody voted: the page stays as it was.
  if (status.phase === "closed" && votes === 0) return null;

  function toggle(code: string) {
    setPicked((current) => (current.includes(code) ? current.filter((c) => c !== code) : [...current, code]));
  }

  async function post(path: string, body: object): Promise<number> {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId, ...body }),
      });
      return res.status;
    } catch {
      return 0;
    }
  }

  async function sendVote() {
    setIsSending(true);
    setError(null);
    const code = await post(base, { items: picked });
    setIsSending(false);
    // 409: this browser had already voted, from another tab perhaps — it is
    // a vote all the same.
    if (code === 201 || code === 409) {
      await load(voterId!);
      return;
    }
    setError(code === 403 ? t("closedError") : t("voteError"));
  }

  async function sendMessage() {
    setIsSending(true);
    setError(null);
    const code = await post(`${base}/message`, { message: message.trim() });
    setIsSending(false);
    if (code === 201 || code === 409) {
      setIsMessageSent(true);
      return;
    }
    setError(code === 403 ? t("closedError") : t("messageError"));
  }

  const isUpcoming = status.phase === "upcoming";
  const canVote = status.phase === "open" && !status.hasVoted;
  const canWrite = status.phase === "open" && status.hasVoted && !status.hasMessage && !isMessageSent;

  return (
    <section aria-labelledby="talk-feedback-title" className="mt-8 rounded-2xl border border-gris/15 bg-blanc p-5 shadow-sm lg:p-6">
      {status.isTest && (
        <p className="mb-3 rounded-[12px] bg-jaune-clair px-3 py-2 text-sm font-bold text-noir">{t("testBanner")}</p>
      )}
      <h2 id="talk-feedback-title" className="text-xl font-bold text-noir">
        {canVote || isUpcoming ? t("title") : status.hasVoted ? t("thanks") : t("trendTitle")}
      </h2>

      {/* Shown greyed out before it opens (#809), so the audience knows it is
          coming. The buttons are disabled, not merely styled: nothing can be sent. */}
      {isUpcoming && (
        <>
          <p className="mt-1 text-sm text-gris">
            {status.opensAt
              ? t("opensAt", { day: formatEventDate(status.opensAt, locale), time: formatEventTime(status.opensAt) })
              : t("opensDuring")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {FEEDBACK_ITEMS.map((code) => (
              <button
                key={code}
                type="button"
                disabled
                className="cursor-not-allowed rounded-full border border-gris/20 bg-blanc-casse px-4 py-2 text-sm font-bold text-gris opacity-70"
              >
                {t(`items.${code}`)}
              </button>
            ))}
          </div>
        </>
      )}

      {canVote && (
        <>
          <p className="mt-1 text-sm text-gris">{t("intro")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {FEEDBACK_ITEMS.map((code) => {
              const isOn = picked.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => toggle(code)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                    isOn ? "border-bleu bg-bleu text-blanc" : "border-gris/30 bg-blanc text-noir hover:border-bleu"
                  }`}
                >
                  {t(`items.${code}`)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={sendVote}
            disabled={picked.length === 0 || isSending}
            className="mt-4 rounded-[12px] bg-bleu px-[18px] py-3 font-bold text-blanc disabled:opacity-50"
          >
            {isSending ? t("sending") : t("send")}
          </button>
        </>
      )}

      {canWrite && (
        <div className="mt-4">
          <label htmlFor="talk-feedback-message" className="block text-sm font-bold text-noir">
            {t("messageLabel")}
          </label>
          <p className="text-sm text-gris">{t("messageHint")}</p>
          <textarea
            id="talk-feedback-message"
            value={message}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-[12px] border border-gris-clair px-3 py-2 text-base"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!message.trim() || isSending}
            className="mt-2 rounded-[12px] bg-bleu px-[18px] py-3 font-bold text-blanc disabled:opacity-50"
          >
            {isSending ? t("sending") : t("sendMessage")}
          </button>
        </div>
      )}

      {(isMessageSent || (status.hasVoted && status.hasMessage)) && (
        <p role="status" className="mt-4 text-sm text-gris">{t("messageSent")}</p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm font-bold text-rouge">{error}</p>
      )}

      {votes > 0 && (
        <div className="mt-6">
          {/* The heading already says it once voting is over and this browser did not vote. */}
          {(canVote || status.hasVoted) && <h3 className="text-base font-bold text-noir">{t("trendTitle")}</h3>}
          <p className="text-sm text-gris">{t("votes", { count: votes })}</p>
          <ul className="mt-2 space-y-1">
            {status.results!.items
              .filter(({ count }) => count > 0)
              .map(({ code, count }) => (
                <li key={code} className="text-sm text-noir">
                  <span className="font-bold">{count}</span> — {t(`items.${code}`)}
                </li>
              ))}
          </ul>
        </div>
      )}

      <p className="mt-6 border-t border-gris/15 pt-3 text-xs text-gris">
        {t.rich("credit", {
          openfeedback: (chunks) => (
            <a href="https://github.com/HugoGresse/open-feedback" target="_blank" rel="noopener noreferrer" className={LINK}>
              {chunks}
            </a>
          ),
          openplanner: (chunks) => (
            <a href="https://openplanner.fr/features" target="_blank" rel="noopener noreferrer" className={LINK}>
              {chunks}
            </a>
          ),
        })}
      </p>
    </section>
  );
}
