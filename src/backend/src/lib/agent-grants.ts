import { prisma } from "./prisma.js";

// The AI agents a person let act for them (#514): one per OAuth client they
// consented to. Withdrawing one removes the consent — which agent-token.ts
// checks on every call — and the tokens, so a refresh cannot mint a new one.

export interface ConnectedAgent {
  clientId: string;
  name: string | null;
  uri: string | null;
  connectedAt: string | null;
  lastTokenAt: string | null;
}

export async function listConnectedAgents(userId: string): Promise<ConnectedAgent[]> {
  const consents = await prisma.oauthConsent.findMany({
    where: { userId },
    select: { clientId: true, createdAt: true, client: { select: { name: true, uri: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (consents.length === 0) return [];

  // When each agent last obtained a token: the closest thing to "last used"
  // the provider records, since API calls themselves leave nothing here.
  const latest = await prisma.oauthAccessToken.groupBy({
    by: ["clientId"],
    where: { userId, clientId: { in: consents.map((c) => c.clientId) } },
    _max: { createdAt: true },
  });
  const lastTokenAt = new Map(latest.map((row) => [row.clientId, row._max.createdAt]));

  return consents.map((consent) => ({
    clientId: consent.clientId,
    name: consent.client.name,
    uri: consent.client.uri,
    connectedAt: consent.createdAt?.toISOString() ?? null,
    lastTokenAt: lastTokenAt.get(consent.clientId)?.toISOString() ?? null,
  }));
}

/**
 * Cut off one agent (`clientId`) or every agent of a person. Returns how many
 * consents went, so a caller can tell "revoked" from "there was nothing".
 */
export async function revokeAgents(userId: string, clientId?: string): Promise<number> {
  const where = { userId, ...(clientId && { clientId }) };
  // Access tokens first: they may point at a refresh token.
  await prisma.oauthAccessToken.deleteMany({ where });
  await prisma.oauthRefreshToken.deleteMany({ where });
  const { count } = await prisma.oauthConsent.deleteMany({ where });
  return count;
}
