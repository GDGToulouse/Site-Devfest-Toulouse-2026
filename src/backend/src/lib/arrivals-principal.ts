import type { FastifyRequest } from "fastify";

import { getAuthContext, type AuthenticatedUser } from "./auth-context.js";
import { canAccessArrivals } from "./arrivals-access.js";
import { setActor } from "./request-context.js";
import {
  canStationDo,
  checkStationToken,
  readStationCookie,
  stationLabel,
  type ArrivalsCapability,
  type Station,
} from "./arrivals-station.js";

// Who is calling an event-day route, in one place: a person (an account with
// the arrivals permission, or an admin) or a station opened by its QR code
// (#775). Each route names what it is, and the answer says whether the caller
// may. Returns a result for the handler to send, never sends itself: Fastify's
// reply is thenable, and a helper that returns `reply.send(...)` lets the
// handler carry on behind its own refusal (api.md).

/** Who acts, as the history keeps it: a station has no account to point to. */
export interface ArrivalsActor {
  id: string | null;
  label: string;
}

export type ArrivalsPrincipal =
  | { kind: "user"; user: AuthenticatedUser; actor: ArrivalsActor }
  | { kind: "station"; station: Station; editionId: number; until: Date; token: string; actor: ArrivalsActor };

export type ArrivalsAccess =
  | { ok: true; principal: ArrivalsPrincipal }
  | { ok: false; status: 401 | 403; body: { error: string; message?: string } };

const unauthenticated: ArrivalsAccess = { ok: false, status: 401, body: { error: "Unauthenticated" } };

/**
 * The caller of an event-day route, whatever its door. `editionId` is the one
 * in the URL: a station only ever works on the edition its link was made for.
 */
export async function resolveArrivalsPrincipal(request: FastifyRequest): Promise<ArrivalsAccess> {
  const ctx = await getAuthContext(request);
  if (ctx) {
    return {
      ok: true,
      principal: { kind: "user", user: ctx.user, actor: { id: ctx.user.id, label: ctx.user.name || ctx.user.email } },
    };
  }

  const token = readStationCookie(request);
  if (!token) return unauthenticated;
  const check = await checkStationToken(token);
  if (!check.ok) {
    return { ok: false, status: 403, body: { error: `station_${check.reason}`, message: check.message } };
  }
  const actor = { id: null, label: stationLabel(check.station) };
  // Writes made through a station are attributed to it in the history (#513).
  setActor({ userId: null, label: actor.label });
  return {
    ok: true,
    principal: { kind: "station", station: check.station, editionId: check.editionId, until: check.until, token, actor },
  };
}

/** The caller, if it may use `capability` on that edition. */
export async function authorizeArrivals(
  request: FastifyRequest,
  editionId: number,
  capability: ArrivalsCapability,
): Promise<ArrivalsAccess> {
  const access = await resolveArrivalsPrincipal(request);
  if (!access.ok) return access;
  const { principal } = access;
  const forbidden: ArrivalsAccess = { ok: false, status: 403, body: { error: "Forbidden" } };

  if (principal.kind === "station") {
    return principal.editionId === editionId && canStationDo(principal.station, capability) ? access : forbidden;
  }
  // The tracking screen is the team's (RG-ARR-26): the arrivals permission does not open it.
  if (capability === "tracking") {
    return principal.user.role === "ADMIN" || principal.user.role === "EDITOR" ? access : forbidden;
  }
  return (await canAccessArrivals(principal.user, editionId)) ? access : forbidden;
}
