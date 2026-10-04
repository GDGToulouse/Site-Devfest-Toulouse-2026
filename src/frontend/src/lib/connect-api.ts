// Connecting an AI agent (MCP client) to a person's account (#514).
//
// The OAuth provider sends a person without a session to /connect, and then to
// /connect/consent, with a signed copy of the agent's request in the query
// string. Both pages hand that signed request back to the provider, which
// checks the signature and resumes. All calls go through the /api/auth rewrite.

/**
 * The part of a page's query string the provider signed, ready to send back as
 * `oauth_query`. Undefined when the page was not reached through the provider
 * (no signature): there is nothing to resume.
 *
 * Mirrors `buildSignedOAuthQuery` from @better-auth/oauth-provider 1.7 (its
 * client plugin), which this frontend does not install: `ba_param` lists the
 * signed parameter names, and only those, plus `sig`, are kept.
 */
export function signedOAuthQuery(search: string): string | undefined {
  const params = new URLSearchParams(search);
  if (!params.has("sig")) return undefined;
  const signedNames = new Set(params.getAll("ba_param"));
  if (signedNames.size === 0) return undefined;
  const signed = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (key === "sig" || key === "ba_param" || signedNames.has(key)) signed.append(key, value);
  }
  return signed.toString();
}

export interface SessionUser {
  name: string | null;
  email: string;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const res = await fetch("/api/auth/get-session", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.user ? { name: data.user.name ?? null, email: data.user.email } : null;
  } catch {
    return null;
  }
}

type Redirect = { ok: true; url: string } | { ok: false; status: number };

async function postForRedirect(path: string, body: Record<string, unknown>): Promise<Redirect> {
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    const url = data?.url ?? data?.redirect_uri;
    return res.ok && typeof url === "string" ? { ok: true, url } : { ok: false, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Resume the agent's authorization now that this browser holds a session. */
export function continueAuthorization(oauthQuery: string) {
  return postForRedirect("/api/auth/oauth2/continue", { postLogin: true, oauth_query: oauthQuery });
}

/** Grant or refuse; either way the provider answers where to send the browser. */
export function answerConsent(accept: boolean, oauthQuery: string) {
  return postForRedirect("/api/auth/oauth2/consent", { accept, oauth_query: oauthQuery });
}

export interface AgentClient {
  name: string | null;
  uri: string | null;
}

/** The name the agent gave itself in its metadata document, for the consent screen. */
export async function getAgentClient(clientId: string): Promise<AgentClient | null> {
  try {
    const res = await fetch(`/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data ? { name: data.client_name ?? null, uri: data.client_uri ?? null } : null;
  } catch {
    return null;
  }
}
