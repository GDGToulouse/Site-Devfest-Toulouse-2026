// The Billetweb calls of the sponsor guest sync (#731, #732), against the API
// described in https://www.billetweb.fr/api/openapi.json. Kept apart from
// routes/admin/tickets.ts, which the arrivals work (#637) rewrites on its own
// branch: two hands on one file would conflict for no gain.
//
// Every function throws BilletwebError on a refusal or an outage, with a
// message the back-office can show as is. The credentials travel in the query
// string as everywhere else in this codebase: never log a URL built here.

const BILLETWEB_API = "https://www.billetweb.fr/api";

export class BilletwebError extends Error {}

export function hasBilletwebCredentials() {
  return Boolean(process.env.BILLETWEB_USER && process.env.BILLETWEB_KEY);
}

function credentials() {
  const user = process.env.BILLETWEB_USER;
  const key = process.env.BILLETWEB_KEY;
  if (!user || !key) throw new BilletwebError("Les identifiants Billetweb ne sont pas configurés (BILLETWEB_USER, BILLETWEB_KEY).");
  return new URLSearchParams({ user, key, version: "1" });
}

async function call<T>(path: string, init?: { query?: Record<string, string>; body?: unknown }): Promise<T> {
  const params = credentials();
  for (const [k, v] of Object.entries(init?.query ?? {})) params.set(k, v);
  let res: Response;
  try {
    res = await fetch(`${BILLETWEB_API}${path}?${params}`, {
      method: init?.body === undefined ? "GET" : "POST",
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      // Billetweb answers in a second or two; a hung call must not hold the
      // admin's request forever.
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new BilletwebError("Billetweb ne répond pas. Réessayez dans quelques minutes.");
  }
  const text = await res.text();
  if (!res.ok) {
    // Billetweb's own words (« Tarif inconnu », « Quota atteint ») say what to
    // fix; cut to keep a page of HTML out of the screen.
    throw new BilletwebError(`Billetweb a refusé la demande (${res.status}) : ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BilletwebError("Réponse illisible de Billetweb.");
  }
}

export interface BilletwebEventTicket {
  id: string;
  name: string;
  full_name?: string;
  is_category?: string;
}

export async function listEventTickets(eventId: string) {
  const tickets = await call<BilletwebEventTicket[]>(`/event/${encodeURIComponent(eventId)}/tickets`);
  return tickets.filter((t) => t.is_category !== "1");
}

export interface BilletwebFormField {
  id: number;
  name: string;
}

export interface BilletwebForm {
  default?: number;
  tickets?: number[];
  ticket_fields?: BilletwebFormField[];
  buyer_fields?: BilletwebFormField[];
}

export function listEventForms(eventId: string) {
  return call<BilletwebForm[]>(`/event/${encodeURIComponent(eventId)}/forms`);
}

export interface BilletwebField {
  id: number;
  name: string;
  type?: string;
  answers?: string[];
}

export function listFields() {
  return call<BilletwebField[]>("/fields");
}

export interface BilletwebAttendee {
  id: string;
  ext_id?: string;
  firstname?: string;
  name?: string;
  email?: string;
  ticket_id?: string;
  ticket?: string;
  disabled?: string;
  order_id?: string;
  order_payment_type?: string;
  custom?: Record<string, string>;
}

// Limited to 10 calls a minute by Billetweb: one per sync, one per attachment.
export function listAttendees(eventId: string, filters: Record<string, string>) {
  return call<BilletwebAttendee[]>(`/event/${encodeURIComponent(eventId)}/attendees`, { query: filters });
}

export interface NewOrder {
  request_id: string;
  name: string;
  firstname: string;
  email: string;
  payment_type: string;
  ship?: 1;
  language?: string;
  custom?: Record<string, string>;
  products: Array<{
    ticket: string;
    name: string;
    firstname: string;
    email: string;
    reference?: string;
    request_id: string;
    custom?: Record<string, string>;
  }>;
}

export interface CreatedOrder {
  id: string;
  request_id?: string;
  products_details?: Array<{ id: string; ext_id?: string; request_id?: string }>;
}

/** Up to 100 orders per call, as Billetweb allows. */
export function addOrders(eventId: string, orders: NewOrder[]) {
  return call<CreatedOrder[]>(`/event/${encodeURIComponent(eventId)}/add_order`, { body: { data: orders } });
}

export function deleteOrders(eventId: string, orderIds: number[]) {
  return call<unknown>(`/event/${encodeURIComponent(eventId)}/delete_order`, { body: { data: orderIds } });
}
