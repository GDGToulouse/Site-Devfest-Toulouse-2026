import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance } from "fastify";

import type { AuditChannel } from "../generated/prisma/client.js";

// Who is writing, and through which door (#513). The audit extension reads this
// on every write; carrying it in AsyncLocalStorage spares threading an actor
// through every handler and library function — the one that forgot would be an
// unattributed change.

export interface RequestActor {
  // Null for actors without an account: a speaker through their edit link, a
  // scheduled task.
  userId: string | null;
  // Frozen into the log line, so the history still reads after a rename or a
  // deletion.
  label: string;
}

export interface RequestContext {
  channel: AuditChannel;
  actor?: RequestActor;
  apiKeyId?: string;
  ip?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

// Anything not listed is a public route.
const CHANNEL_BY_PREFIX: Array<[string, AuditChannel]> = [
  ["/api/admin/", "ADMIN"],
  ["/api/me/", "ADMIN"],
  ["/api/sponsor-space/", "SPONSOR"],
  ["/api/edit/", "EDIT_LINK"],
  ["/api/auth/", "AUTH"],
  ["/api/maintenance/", "SYSTEM"],
];

export function channelForUrl(url: string): AuditChannel {
  const path = url.split("?")[0];
  const match = CHANNEL_BY_PREFIX.find(([prefix]) => path.startsWith(prefix));
  return match ? match[1] : "PUBLIC";
}

export function runInContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Context for work no request started: scheduled tasks, CLI scripts. */
export function systemContext(task: string): RequestContext {
  return { channel: "SYSTEM", actor: { userId: null, label: task } };
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Record who is acting. A no-op outside a context (scripts, seeds). */
export function setActor(actor: RequestActor, details: { apiKeyId?: string } = {}): void {
  const context = storage.getStore();
  if (!context) return;
  context.actor = actor;
  if (details.apiKeyId) {
    context.apiKeyId = details.apiKeyId;
    // A key is a script, not a person at the screen: the channel says so even
    // when it calls the back-office routes.
    context.channel = "API_KEY";
  }
}

/**
 * Narrow the channel the route prefix guessed (an import, a manual purge).
 * API_KEY is kept: a script driving the import is still a script, and that is
 * the fact worth reading in the history.
 */
export function setChannel(channel: AuditChannel): void {
  const context = storage.getStore();
  if (context && context.channel !== "API_KEY") context.channel = channel;
}

/**
 * Open a context for every request, from onRequest to the reply. The rest of
 * the lifecycle runs inside `done`, so the guard and the handler share this
 * object — what the guard sets, the handler's writes see. A streamed body does
 * not lose it on Fastify 5; request-context.test.ts checks that over a real
 * socket, since inject() cannot.
 */
export function registerRequestContext(app: FastifyInstance): void {
  app.addHook("onRequest", (request, _reply, done) => {
    storage.run({ channel: channelForUrl(request.url), ip: request.ip }, done);
  });
}
