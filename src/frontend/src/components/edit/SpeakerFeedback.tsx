"use client";

import { useEffect, useState } from "react";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";

// The audience's opinion of the speaker's sessions (#565), on their edit link,
// which stands in for a speaker back-office until speakers get accounts (#363).
// Read from its own route: the edit form freezes 48 hours before the event,
// and the feedback arrives on the day and after.

interface TalkResults {
  id: number;
  title: string;
  year: number;
  votes: number;
  testVotes: number;
  items: { code: string; count: number }[];
  messages: { text: string; at: string | null; isTest: boolean }[];
}

export interface SpeakerFeedbackLabels {
  heading: string;
  intro: string;
  votes: (n: number) => string;
  messages: string;
  noMessage: string;
  test: string;
}

// The appreciation labels are the public form's own, read from the site's
// translations rather than copied into this page's dictionary.
const ITEM_LABELS: Record<"fr" | "en", Record<string, string>> = { fr: fr.feedback.items, en: en.feedback.items };

export default function SpeakerFeedback({
  token,
  locale,
  labels,
}: {
  token: string;
  locale: "fr" | "en";
  labels: SpeakerFeedbackLabels;
}) {
  const [talks, setTalks] = useState<TalkResults[]>([]);

  useEffect(() => {
    fetch(`/api/edit/${token}/feedback`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { talks: [] }))
      .then((body: { talks: TalkResults[] }) => setTalks(body.talks))
      .catch(() => setTalks([]));
  }, [token]);

  // Nothing to say before the first vote: the section stays out of the way.
  if (talks.length === 0) return null;

  const dateFormat = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });

  return (
    <section aria-labelledby="speaker-feedback-title" className="rounded-2xl border border-gris/15 bg-blanc p-6 shadow-sm sm:p-10">
      <h2 id="speaker-feedback-title" className="text-xl font-bold text-noir lg:text-2xl">{labels.heading}</h2>
      <p className="mt-1 max-w-prose text-sm text-gris">{labels.intro}</p>

      <div className="mt-6 space-y-10">
        {talks.map((talk) => (
          <article key={talk.id}>
            <h3 className="text-lg font-bold text-noir">{talk.title}</h3>
            <p className="text-sm text-gris">
              {labels.votes(talk.votes)}
              {talk.testVotes > 0 && <> · {labels.test}</>}
            </p>

            <ul className="mt-4 space-y-2">
              {talk.items.map(({ code, count }) => {
                const percent = talk.votes ? Math.round((count / talk.votes) * 100) : 0;
                return (
                  <li key={code} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-sm">
                    <span className="text-noir">{ITEM_LABELS[locale][code] ?? code}</span>
                    <span aria-hidden className="h-2 overflow-hidden rounded-full bg-gris/10">
                      <span className="block h-full rounded-full bg-bleu" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="tabular-nums text-gris">
                      {count} ({percent} %)
                    </span>
                  </li>
                );
              })}
            </ul>

            <h4 className="mt-6 text-base font-bold text-noir">{labels.messages}</h4>
            {talk.messages.length === 0 ? (
              <p className="mt-1 text-sm text-gris">{labels.noMessage}</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {talk.messages.map((message, index) => (
                  <li key={index} className="rounded-[12px] bg-blanc-casse px-4 py-3 text-sm text-noir">
                    <p className="whitespace-pre-line">{message.text}</p>
                    {message.at && (
                      <p className="mt-1 text-xs text-gris">
                        {dateFormat.format(new Date(message.at))}
                        {message.isTest && <> · {labels.test}</>}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
