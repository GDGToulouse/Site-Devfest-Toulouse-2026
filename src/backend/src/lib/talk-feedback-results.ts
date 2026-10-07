import { prisma } from "./prisma.js";
import { TALK_FEEDBACK_ITEMS } from "./talk-feedback.js";

// The detailed results of the audience feedback (#565): every appreciation,
// negatives included, and the private messages. For the speaker (their own
// sessions, from their link) and the team (every session, in the admin) —
// never on a public route.

export interface FeedbackMessage {
  id: number;
  text: string;
  at: Date | null;
  hidden: boolean;
  isTest: boolean;
}

export interface TalkResults {
  votes: number;
  testVotes: number;
  /** Every appreciation of the fixed list, in its order, with its count. */
  items: { code: string; count: number }[];
  messages: FeedbackMessage[];
}

function emptyResults(): TalkResults {
  return { votes: 0, testVotes: 0, items: TALK_FEEDBACK_ITEMS.map(({ code }) => ({ code, count: 0 })), messages: [] };
}

/**
 * Results per session. One query for all of them: a DevFest is ~50 sessions
 * and at most a few thousand votes over two days, read whole and summed here.
 */
export async function resultsForTalks(talkIds: number[]): Promise<Map<number, TalkResults>> {
  const results = new Map(talkIds.map((id) => [id, emptyResults()]));
  if (talkIds.length === 0) return results;

  const rows = await prisma.talkFeedback.findMany({
    where: { talkId: { in: talkIds } },
    select: { id: true, talkId: true, items: true, message: true, messageAt: true, messageHidden: true, isTest: true },
    orderBy: { messageAt: "desc" },
  });

  for (const row of rows) {
    const talk = results.get(row.talkId)!;
    talk.votes += 1;
    if (row.isTest) talk.testVotes += 1;
    for (const item of talk.items) if (row.items.includes(item.code)) item.count += 1;
    if (row.message) {
      talk.messages.push({ id: row.id, text: row.message, at: row.messageAt, hidden: row.messageHidden, isTest: row.isTest });
    }
  }
  return results;
}
