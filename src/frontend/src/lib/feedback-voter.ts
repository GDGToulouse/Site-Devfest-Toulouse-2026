// The anonymous id a browser votes under (#564). The backend keeps one vote per
// (session, voter id): this id is the whole of "one vote per browser".

export const FEEDBACK_VOTER_KEY = "devfest-feedback-voter";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Older browsers: a v4-shaped id from Math.random, good enough for an
  // anonymous vote key, which protects nothing beyond "once per browser".
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const VOTER_ID = /^[0-9a-f-]{36}$/i;

/**
 * This browser's voter id, created on first use. Storage can be missing or
 * throw (private window, blocked site data): the id then lives for the page
 * only, and the vote still counts once.
 */
export function getFeedbackVoterId(): string {
  try {
    const stored = localStorage.getItem(FEEDBACK_VOTER_KEY);
    if (stored && VOTER_ID.test(stored)) return stored;
    const id = newId();
    localStorage.setItem(FEEDBACK_VOTER_KEY, id);
    return id;
  } catch {
    return newId();
  }
}
