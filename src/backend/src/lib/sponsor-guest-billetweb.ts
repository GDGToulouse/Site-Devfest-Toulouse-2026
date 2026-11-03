import type { SponsorGuest } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";
import { notDeleted } from "./admin-helpers.js";
import {
  addOrders,
  BilletwebError,
  listAttendees,
  listEventForms,
  listFields,
  type BilletwebAttendee,
  type BilletwebField,
  type NewOrder,
} from "./billetweb-client.js";
import { booleanOf, dietOf, DIET_LABELS, EXPERIENCE_LABELS, experienceOf, GENDER_LABELS, genderOf, squash } from "./sponsor-guest-csv.js";
import { quotaOf, rankGuests } from "./sponsor-guests.js";

// Sponsor guests → Billetweb tickets (#731, RG-INS-40 to RG-INS-48). Billetweb
// is the reference once a ticket exists: the site creates tickets, reads back
// what the guests corrected, and never writes to an existing ticket.

// The questions of the Billetweb ticket form, by the names its export uses
// (`custom`). Matched loosely: a renamed question keeps its key word.
const FIELD_KEYS = {
  gender: "genre",
  experience: "experience",
  attendsAfterParty: "after",
  diet: "regime",
  needsAssistance: "assistance",
} as const;
type GuestField = keyof typeof FIELD_KEYS;
const REQUIRED_FIELDS = Object.keys(FIELD_KEYS) as GuestField[];

export interface FieldMap {
  ticket: Record<GuestField, BilletwebField>;
  // Optional: the company on the ticket, which the arrivals read too, and the
  // order's « Origine » question when the team created one (RG-INS-43).
  company: BilletwebField | null;
  origin: BilletwebField | null;
}

function findField(fields: BilletwebField[], key: string) {
  return fields.find((f) => squash(f.name) === key) ?? fields.find((f) => squash(f.name).includes(key)) ?? null;
}

/**
 * The ids of the form questions for the sponsors' tariff. `add_order` takes ids,
 * the attendee export names: both are read here, once per sync. Refuses when a
 * question is missing, rather than creating tickets the arrivals cannot read.
 */
export async function resolveFieldMap(eventId: string, ticketId: string): Promise<FieldMap> {
  const [forms, catalogue] = await Promise.all([listEventForms(eventId), listFields()]);
  const form =
    forms.find((f) => (f.tickets ?? []).map(String).includes(ticketId)) ?? forms.find((f) => f.default === 1) ?? forms[0];
  if (!form) throw new BilletwebError("Aucun formulaire trouvé pour ce tarif dans Billetweb.");

  // Answers (the options of a list) live in the organiser's catalogue.
  const withAnswers = (f: { id: number; name: string }) => catalogue.find((c) => c.id === f.id) ?? f;
  const ticketFields = (form.ticket_fields ?? []).map(withAnswers);
  const buyerFields = (form.buyer_fields ?? []).map(withAnswers);

  const ticket = {} as Record<GuestField, BilletwebField>;
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const found = findField(ticketFields, FIELD_KEYS[field]);
    if (found) ticket[field] = found;
    else missing.push(FIELD_KEYS[field]);
  }
  if (missing.length > 0) {
    throw new BilletwebError(`Questions absentes du formulaire du tarif dans Billetweb : ${missing.join(", ")}.`);
  }
  return {
    ticket,
    company: findField(ticketFields, "entreprise") ?? findField(buyerFields, "entreprise"),
    origin: findField(buyerFields, "origine"),
  };
}

// The option Billetweb lists for a value, so the ticket shows its own wording
// (« Sup à 7 ans »); our label when the question is free text.
function answerFor(field: BilletwebField, matches: (answer: string) => boolean, fallback: string) {
  return field.answers?.find(matches) ?? fallback;
}

type GuestForTicket = Pick<
  SponsorGuest,
  "id" | "lastName" | "firstName" | "email" | "gender" | "experience" | "attendsAfterParty" | "diet" | "needsAssistance"
>;

export function guestReference(guestId: number) {
  return `site-sponsor-${guestId}`;
}

export function orderFor(guest: GuestForTicket, sponsorName: string, ticketId: string, fields: FieldMap): NewOrder {
  const { ticket } = fields;
  const custom: Record<string, string> = {
    [ticket.gender.id]: answerFor(ticket.gender, (a) => genderOf(a) === guest.gender, GENDER_LABELS[guest.gender]),
    [ticket.experience.id]: answerFor(ticket.experience, (a) => experienceOf(a) === guest.experience, EXPERIENCE_LABELS[guest.experience]),
    // The export shows a ticked box as "1" and an empty one as "".
    [ticket.attendsAfterParty.id]: guest.attendsAfterParty ? "1" : "",
    // No special diet is an empty answer, as in the export.
    [ticket.diet.id]: guest.diet === "NONE" ? "" : answerFor(ticket.diet, (a) => dietOf(a) === guest.diet, DIET_LABELS[guest.diet]),
    [ticket.needsAssistance.id]: guest.needsAssistance ? "1" : "",
  };
  if (fields.company) custom[fields.company.id] = sponsorName;
  const reference = guestReference(guest.id);
  return {
    // One order per guest, so one can be cancelled alone (RG-INS-42).
    request_id: reference,
    name: guest.lastName,
    firstname: guest.firstName,
    email: guest.email,
    payment_type: "invitation",
    ship: 1,
    language: "fr",
    ...(fields.origin ? { custom: { [fields.origin.id]: `Site — ${sponsorName}` } } : {}),
    products: [
      {
        ticket: ticketId,
        name: guest.lastName,
        firstname: guest.firstName,
        email: guest.email,
        reference,
        request_id: reference,
        custom,
      },
    ],
  };
}

/** What a Billetweb attendee says about a guest, for the sponsor's screen (RG-INS-48). */
export function guestFromAttendee(attendee: BilletwebAttendee, fields: FieldMap | null) {
  const answer = (field: BilletwebField | undefined) => (field ? (attendee.custom?.[field.name] ?? "") : undefined);
  const gender = genderOf(answer(fields?.ticket.gender) ?? "");
  const experience = experienceOf(answer(fields?.ticket.experience) ?? "");
  const diet = fields ? dietOf(answer(fields.ticket.diet) ?? "") : undefined;
  const attendsAfterParty = fields ? booleanOf(answer(fields.ticket.attendsAfterParty) ?? "") : undefined;
  const needsAssistance = fields ? booleanOf(answer(fields.ticket.needsAssistance) ?? "") : undefined;
  return {
    ...(attendee.name ? { lastName: attendee.name } : {}),
    ...(attendee.firstname ? { firstName: attendee.firstname } : {}),
    ...(attendee.email ? { email: attendee.email } : {}),
    ...(gender ? { gender } : {}),
    ...(experience ? { experience } : {}),
    ...(diet ? { diet } : {}),
    ...(attendsAfterParty !== undefined ? { attendsAfterParty } : {}),
    ...(needsAssistance !== undefined ? { needsAssistance } : {}),
    isBilletwebCancelled: attendee.disabled === "1",
  };
}

export interface SyncSettings {
  eventId: string;
  ticketId: string;
}

/** The edition's Billetweb target, or why the sync cannot run (RG-INS-47). */
export async function loadSyncSettings(editionId: number): Promise<SyncSettings | { error: string }> {
  const edition = await prisma.edition.findFirst({
    where: { id: editionId, ...notDeleted },
    select: { sponsorGuestBilletwebEventId: true, sponsorGuestBilletwebTicketId: true },
  });
  if (!edition) return { error: "Édition introuvable." };
  if (!edition.sponsorGuestBilletwebEventId || !edition.sponsorGuestBilletwebTicketId) {
    return { error: "Choisissez d'abord l'événement et le tarif Billetweb des invités sponsors." };
  }
  return { eventId: edition.sponsorGuestBilletwebEventId, ticketId: edition.sponsorGuestBilletwebTicketId };
}

/** The guests of the edition, ranked per sponsor, with their sponsor's name. */
async function editionGuests(editionId: number, sponsorId: number | null) {
  const [participations, offers] = await Promise.all([
    prisma.editionSponsor.findMany({
      where: { editionId, sponsor: notDeleted, ...(sponsorId !== null ? { sponsorId } : {}) },
      select: {
        tierId: true,
        sponsor: { select: { id: true, name: true } },
        guests: true,
        guestAdjustments: { select: { quantity: true } },
      },
    }),
    prisma.editionSponsorTier.findMany({ where: { editionId }, select: { tierId: true, guestPlaces: true } }),
  ]);
  const placesByTier = new Map(offers.map((o) => [o.tierId, o.guestPlaces]));
  return participations.flatMap((p) =>
    rankGuests(p.guests, quotaOf(placesByTier.get(p.tierId) ?? 0, p.guestAdjustments).quota).map((g) => ({
      ...g,
      sponsorName: p.sponsor.name,
    })),
  );
}

/** What a sync would do, without calling Billetweb (RG-INS-41). */
export async function previewSync(editionId: number, sponsorId: number | null) {
  const guests = await editionGuests(editionId, sponsorId);
  const summary = (g: (typeof guests)[number]) => ({
    id: g.id,
    lastName: g.lastName,
    firstName: g.firstName,
    email: g.email,
    sponsorName: g.sponsorName,
    billetwebError: g.billetwebError,
  });
  return {
    toCreate: guests.filter((g) => g.isWithinQuota && !g.billetwebTicketId).map(summary),
    blockedOutOfQuota: guests.filter((g) => !g.isWithinQuota && !g.billetwebTicketId).map(summary),
    ticketedOutOfQuota: guests.filter((g) => !g.isWithinQuota && g.billetwebTicketId).map(summary),
    withErrors: guests.filter((g) => g.billetwebError !== null).map(summary),
  };
}

// add_order takes 100 orders per call.
const ORDER_BATCH = 100;

/**
 * Reads back the tariff's tickets, then creates one for each valid guest who
 * has none (RG-INS-40). A guest whose ticket is already in Billetweb — the
 * answer of an earlier sync lost on the way back — is linked to it rather than
 * given a second one: same tariff, same address and name, not yet linked.
 */
export async function runSync(editionId: number, sponsorId: number | null, settings: SyncSettings) {
  const fields = await resolveFieldMap(settings.eventId, settings.ticketId);
  const attendees = await listAttendees(settings.eventId, { ticket: settings.ticketId });
  const guests = await editionGuests(editionId, sponsorId);

  // Read back: what the guests corrected through their ticket (RG-INS-48).
  const attendeeById = new Map(attendees.map((a) => [String(a.id), a]));
  let refreshed = 0;
  for (const guest of guests.filter((g) => g.billetwebTicketId)) {
    const attendee = attendeeById.get(guest.billetwebTicketId!);
    if (!attendee) continue;
    const data = guestFromAttendee(attendee, fields);
    const changed = (Object.keys(data) as Array<keyof typeof data>).some((k) => guest[k] !== data[k]);
    if (changed) {
      await prisma.sponsorGuest.update({ where: { id: guest.id }, data });
      refreshed++;
    }
  }

  const linkedIds = new Set(guests.map((g) => g.billetwebTicketId).filter(Boolean));
  // Tickets of this tariff already held by a guest outside the scope of this
  // sync (another sponsor, or attached by hand, #732).
  const linkedElsewhere = new Set(
    (
      await prisma.sponsorGuest.findMany({
        where: { billetwebTicketId: { in: attendees.map((a) => String(a.id)) } },
        select: { billetwebTicketId: true },
      })
    ).map((g) => g.billetwebTicketId),
  );
  const candidates = guests.filter((g) => g.isWithinQuota && !g.billetwebTicketId);

  let adopted = 0;
  const toCreate: typeof candidates = [];
  for (const guest of candidates) {
    const match = attendees.find(
      (a) =>
        a.disabled !== "1" &&
        !linkedIds.has(String(a.id)) &&
        !linkedElsewhere.has(String(a.id)) &&
        (a.email ?? "").toLowerCase() === guest.email.toLowerCase() &&
        squash(a.name ?? "") === squash(guest.lastName) &&
        squash(a.firstname ?? "") === squash(guest.firstName),
    );
    if (!match) {
      toCreate.push(guest);
      continue;
    }
    linkedIds.add(String(match.id));
    await prisma.sponsorGuest.update({
      where: { id: guest.id },
      data: {
        billetwebTicketId: String(match.id),
        billetwebTicketRef: match.ext_id ?? null,
        billetwebOrderId: match.order_id ?? null,
        billetwebSyncedAt: new Date(),
        billetwebError: null,
      },
    });
    adopted++;
  }

  let created = 0;
  const failed: Array<{ id: number; error: string }> = [];
  for (let i = 0; i < toCreate.length; i += ORDER_BATCH) {
    const batch = toCreate.slice(i, i + ORDER_BATCH);
    let orders;
    try {
      orders = await addOrders(settings.eventId, batch.map((g) => orderFor(g, g.sponsorName, settings.ticketId, fields)));
    } catch (err) {
      if (!(err instanceof BilletwebError)) throw err;
      for (const g of batch) failed.push({ id: g.id, error: err.message });
      continue;
    }
    const byReference = new Map(orders.map((o) => [o.request_id, o]));
    for (const guest of batch) {
      const order = byReference.get(guestReference(guest.id));
      const product = order?.products_details?.[0];
      if (!order || !product) {
        failed.push({ id: guest.id, error: "Billetweb n'a pas créé ce billet." });
        continue;
      }
      await prisma.sponsorGuest.update({
        where: { id: guest.id },
        data: {
          billetwebOrderId: String(order.id),
          billetwebTicketId: String(product.id),
          billetwebTicketRef: product.ext_id ?? null,
          billetwebSyncedAt: new Date(),
          billetwebError: null,
        },
      });
      created++;
    }
  }
  for (const { id, error } of failed) {
    await prisma.sponsorGuest.update({ where: { id }, data: { billetwebError: error } });
  }

  return {
    created,
    adopted,
    refreshed,
    failed: failed.length,
    blockedOutOfQuota: guests.filter((g) => !g.isWithinQuota && !g.billetwebTicketId).length,
    // Fields the team may want to add in Billetweb (RG-INS-43).
    missingOptionalFields: [...(fields.company ? [] : ["Entreprise"]), ...(fields.origin ? [] : ["Origine"])],
  };
}
