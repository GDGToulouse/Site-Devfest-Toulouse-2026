import type { FastifyBaseLogger, FastifyInstance, FastifyReply } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { notDeleted, notFound } from "../../lib/admin-helpers.js";
import { BILLETWEB_API, getBilletwebParams } from "../../lib/billetweb.js";
import {
  BADGES_PER_BIN,
  MAX_BINS_PER_COUNTER,
  MAX_COUNTERS,
  assignBadgeNumbers,
  badgeCapacity,
  capacityShortfall,
  type BadgeLayout,
} from "../../lib/badge-numbering.js";
import { renderBadgePdf, type PrintedBadge } from "../../lib/badge-pdf.js";

const editionIdParams = {
  type: "object",
  required: ["editionId"],
  properties: { editionId: { type: "string", pattern: "^[0-9]+$" } },
} as const;

// Billetweb takes several tickets per update_product call; 100 keeps one call
// small enough to fail alone (RG-ARR-20).
const WRITE_BATCH_SIZE = 100;
const BADGE_FIELD_NAME = /num[ée]ro\s+de\s+badge/i;

// The tickets that get a number (RG-ARR-14): live, and in a tier that goes
// through the counters. A ticket whose tier is not imported yet blocks the
// numbering, since nobody knows whether it belongs to the dedicated flow.
const inFlow = (editionId: number) => ({
  editionId,
  isCancelled: false,
  ticketTier: { isOutsideFlow: false },
});

async function findEdition(editionId: number) {
  return prisma.edition.findFirst({
    where: { id: editionId, ...notDeleted },
    select: {
      id: true,
      year: true,
      billetwebEventId: true,
      badgeCounters: true,
      badgeBinsPerCounter: true,
      badgesFrozenAt: true,
      billetwebBadgeFieldId: true,
    },
  });
}

type BadgeEdition = NonNullable<Awaited<ReturnType<typeof findEdition>>>;

const layoutOf = (e: BadgeEdition): BadgeLayout => ({ counters: e.badgeCounters, binsPerCounter: e.badgeBinsPerCounter });

async function ticketsToNumber(editionId: number) {
  return prisma.attendee.findMany({
    where: inFlow(editionId),
    select: { id: true, orderDate: true, orderId: true, billetwebId: true },
  });
}

/** Why the numbering cannot run yet, as a reply; null when it can. */
async function refuseNumbering(reply: FastifyReply, edition: BadgeEdition, count: number) {
  const withoutTier = await prisma.attendee.count({
    where: { editionId: edition.id, isCancelled: false, ticketTierId: null },
  });
  if (withoutTier > 0) {
    return reply.status(409).send({
      error: "tickets_without_tier",
      message: `${withoutTier} billets n'ont pas de tarif connu : importez les tarifs de l'édition, puis les participants.`,
    });
  }
  if (count === 0) {
    return reply.status(409).send({
      error: "nothing_to_number",
      message: "Aucun participant à numéroter : importez d'abord les participants.",
    });
  }
  const shortfall = capacityShortfall(count, layoutOf(edition));
  if (shortfall) {
    return reply.status(409).send({
      error: "capacity_exceeded",
      message:
        `${count} badges à numéroter pour ${shortfall.capacity} places : il manque ${shortfall.missingBins} bacs. ` +
        `Passez à ${shortfall.binsPerCounterNeeded} bacs par guichet.`,
    });
  }
  return null;
}

// One Billetweb write per edition at a time: a second click would send the
// same numbers twice and race on the report.
const runningWrites = new Set<number>();

export default async function adminBadgeRoutes(app: FastifyInstance) {
  // GET /api/admin/badges/:editionId — the numbering's state: layout, how many
  // badges, per bin, and after the freeze how many reached Billetweb. Counts only.
  app.get<{ Params: { editionId: string } }>(
    "/badges/:editionId",
    { schema: { params: editionIdParams } },
    async (request, reply) => {
      const edition = await findEdition(Number(request.params.editionId));
      if (!edition) return notFound(reply, "Edition");
      const layout = layoutOf(edition);

      const [withoutTier, numbered] = await Promise.all([
        prisma.attendee.count({ where: { editionId: edition.id, isCancelled: false, ticketTierId: null } }),
        edition.badgesFrozenAt
          ? prisma.attendee.findMany({
              where: { editionId: edition.id, badgeNumber: { not: null } },
              select: { badgeNumber: true, isCancelled: true, badgeWrittenAt: true, badgeWriteError: true },
            })
          : ticketsToNumber(edition.id).then((tickets) =>
              assignBadgeNumbers(tickets, layout).map((t) => ({
                badgeNumber: t.number,
                isCancelled: false,
                badgeWrittenAt: null,
                badgeWriteError: null,
              })),
            ),
      ]);

      const binCounts = new Map<number, number>();
      for (const a of numbered) {
        const bin = Math.floor((a.badgeNumber as number) / BADGES_PER_BIN);
        binCounts.set(bin, (binCounts.get(bin) ?? 0) + 1);
      }
      const frozen = edition.badgesFrozenAt !== null;
      const shortfall = frozen ? null : capacityShortfall(numbered.length, layout);
      return {
        counters: layout.counters,
        binsPerCounter: layout.binsPerCounter,
        capacity: badgeCapacity(layout),
        frozenAt: edition.badgesFrozenAt,
        billetwebBadgeFieldId: edition.billetwebBadgeFieldId,
        numbered: numbered.length,
        shortfall,
        withoutTier,
        // Bought after the freeze, or reinstated: no printed badge, sent to the help desk.
        withoutNumber: frozen
          ? await prisma.attendee.count({ where: { ...inFlow(edition.id), badgeNumber: null } })
          : 0,
        cancelledAfterFreeze: numbered.filter((a) => frozen && a.isCancelled).length,
        isWriting: runningWrites.has(edition.id),
        written: numbered.filter((a) => a.badgeWrittenAt).length,
        writeErrors: numbered.filter((a) => !a.badgeWrittenAt && a.badgeWriteError).length,
        // Over capacity the ranks run past 99 and the bins mean nothing.
        bins: shortfall ? [] : [...binCounts]
          .sort(([a], [b]) => a - b)
          .map(([bin, count]) => ({ counter: Math.floor(bin / 10), bin: bin % 10, count })),
      };
    },
  );

  // PUT /api/admin/badges/:editionId/settings — counters, bins (RG-ARR-17) and
  // the Billetweb field. The layout is locked by the freeze; the field is not.
  app.put<{
    Params: { editionId: string };
    Body: { counters: number; binsPerCounter: number; billetwebBadgeFieldId: string | null };
  }>(
    "/badges/:editionId/settings",
    {
      schema: {
        params: editionIdParams,
        body: {
          type: "object",
          required: ["counters", "binsPerCounter", "billetwebBadgeFieldId"],
          additionalProperties: false,
          properties: {
            counters: { type: "integer", minimum: 1, maximum: MAX_COUNTERS },
            binsPerCounter: { type: "integer", minimum: 1, maximum: MAX_BINS_PER_COUNTER },
            billetwebBadgeFieldId: { type: ["string", "null"], pattern: "^[0-9]+$" },
          },
        },
      },
    },
    async (request, reply) => {
      const edition = await findEdition(Number(request.params.editionId));
      if (!edition) return notFound(reply, "Edition");
      const { counters, binsPerCounter, billetwebBadgeFieldId } = request.body;
      const isLayoutChanged = counters !== edition.badgeCounters || binsPerCounter !== edition.badgeBinsPerCounter;
      if (edition.badgesFrozenAt && isLayoutChanged) {
        return reply.status(409).send({
          error: "badges_frozen",
          message: "Les badges sont partis à l'impression : guichets et bacs ne changent plus.",
        });
      }
      await prisma.edition.update({
        where: { id: edition.id },
        data: { badgeCounters: counters, badgeBinsPerCounter: binsPerCounter, billetwebBadgeFieldId },
      });
      return { counters, binsPerCounter, billetwebBadgeFieldId };
    },
  );

  // GET /api/admin/badges/:editionId/pdf — the print file (RG-ARR-19): the
  // numbering it would freeze before the freeze, the frozen one after.
  app.get<{ Params: { editionId: string } }>(
    "/badges/:editionId/pdf",
    { schema: { params: editionIdParams } },
    async (request, reply) => {
      const edition = await findEdition(Number(request.params.editionId));
      if (!edition) return notFound(reply, "Edition");

      const select = {
        firstName: true,
        lastName: true,
        company: true,
        ticketTier: { select: { nameFr: true } },
      } as const;
      let badges: PrintedBadge[];
      if (edition.badgesFrozenAt) {
        const rows = await prisma.attendee.findMany({
          where: { editionId: edition.id, badgeNumber: { not: null } },
          select: { ...select, badgeNumber: true },
        });
        badges = rows.map((r) => ({ ...r, badgeNumber: r.badgeNumber as number, tierName: r.ticketTier?.nameFr ?? null }));
      } else {
        const rows = await prisma.attendee.findMany({
          where: inFlow(edition.id),
          select: { ...select, orderDate: true, orderId: true, billetwebId: true },
        });
        const refusal = await refuseNumbering(reply, edition, rows.length);
        if (refusal) return refusal;
        badges = assignBadgeNumbers(rows, layoutOf(edition)).map((r) => ({
          ...r,
          badgeNumber: r.number,
          tierName: r.ticketTier?.nameFr ?? null,
        }));
      }

      const pdf = await renderBadgePdf(edition.year, badges);
      const suffix = edition.badgesFrozenAt ? "" : "-apercu";
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="badges-${edition.year}${suffix}.pdf"`)
        .header("Cache-Control", "no-store")
        .send(Buffer.from(pdf));
    },
  );

  // POST /api/admin/badges/:editionId/freeze — "send to print" (RG-ARR-18):
  // stores the numbers for good. Asked with an explicit confirmation.
  app.post<{ Params: { editionId: string }; Body: { confirm: true } }>(
    "/badges/:editionId/freeze",
    {
      schema: {
        params: editionIdParams,
        body: {
          type: "object",
          required: ["confirm"],
          additionalProperties: false,
          properties: { confirm: { const: true } },
        },
      },
    },
    async (request, reply) => {
      const edition = await findEdition(Number(request.params.editionId));
      if (!edition) return notFound(reply, "Edition");
      if (edition.badgesFrozenAt) {
        return reply.status(409).send({ error: "badges_frozen", message: "Les badges sont déjà partis à l'impression." });
      }
      const tickets = await ticketsToNumber(edition.id);
      const refusal = await refuseNumbering(reply, edition, tickets.length);
      if (refusal) return refusal;

      const numbered = assignBadgeNumbers(tickets, layoutOf(edition));
      const frozenAt = new Date();
      const isFrozen = await prisma.$transaction(
        async (tx) => {
          // Claims the freeze first: a second click finds it taken and writes nothing.
          const claimed = await tx.edition.updateMany({
            where: { id: edition.id, badgesFrozenAt: null },
            data: { badgesFrozenAt: frozenAt },
          });
          if (claimed.count === 0) return false;
          const ids = numbered.map((t) => t.id);
          const numbers = numbered.map((t) => t.number);
          // One statement for ~1 200 rows instead of one update each.
          await tx.$executeRaw`
            UPDATE "Attendee" AS a SET "badgeNumber" = v.n, "updatedAt" = NOW()
            FROM unnest(${ids}::int[], ${numbers}::int[]) AS v(id, n)
            WHERE a.id = v.id AND a."editionId" = ${edition.id}`;
          return true;
        },
        { timeout: 30_000 },
      );
      if (!isFrozen) {
        return reply.status(409).send({ error: "badges_frozen", message: "Les badges sont déjà partis à l'impression." });
      }
      request.log.info({ editionId: edition.id, numbered: numbered.length }, "Badge numbering frozen");
      return reply.status(201).send({ frozenAt, numbered: numbered.length });
    },
  );

  // POST /api/admin/badges/:editionId/billetweb — writes the frozen numbers to
  // the tickets' "Numéro de badge" field (RG-ARR-20). Only what is not written
  // yet: a retry picks up the failures and nothing else. Answers 202 at once.
  app.post<{ Params: { editionId: string } }>(
    "/badges/:editionId/billetweb",
    { schema: { params: editionIdParams } },
    async (request, reply) => {
      const edition = await findEdition(Number(request.params.editionId));
      if (!edition) return notFound(reply, "Edition");
      if (!edition.badgesFrozenAt) {
        return reply.status(409).send({
          error: "badges_not_frozen",
          message: "Les numéros ne s'écrivent dans Billetweb qu'une fois les badges envoyés à l'impression.",
        });
      }
      if (!edition.billetwebEventId) {
        return reply.status(409).send({
          error: "edition_not_linked",
          message: "L'édition n'est liée à aucun événement Billetweb.",
        });
      }
      const params = getBilletwebParams();
      if (!params) {
        return reply.status(400).send({ error: "Billetweb API credentials not configured" });
      }
      if (runningWrites.has(edition.id)) {
        return reply.status(409).send({ error: "write_running", message: "Une écriture est déjà en cours." });
      }

      runningWrites.add(edition.id);
      let isStarted = false;
      try {
        const eventPath = `${BILLETWEB_API}/event/${encodeURIComponent(edition.billetwebEventId)}`;
        let fieldId = edition.billetwebBadgeFieldId;
        if (!fieldId) {
          // Billetweb reads the field back by name but writes it by id: look the
          // id up once on the event's form, then keep it.
          const forms = (await fetch(`${eventPath}/forms?${params}`)
            .then((r) => r.json())
            .catch(() => null)) as unknown;
          const field = Array.isArray(forms)
            ? forms
                .flatMap((f: { ticket_fields?: Array<{ id: string; name: string }> }) => f.ticket_fields ?? [])
                .find((f) => BADGE_FIELD_NAME.test(f.name))
            : undefined;
          if (!field) {
            return reply.status(409).send({
              error: "badge_field_missing",
              message:
                "Le formulaire billet de l'événement Billetweb n'a pas de champ « Numéro de badge » : créez-le, ou saisissez son identifiant dans les réglages.",
            });
          }
          fieldId = String(field.id);
          await prisma.edition.update({ where: { id: edition.id }, data: { billetwebBadgeFieldId: fieldId } });
        }

        // A cancelled ticket keeps its number here but needs no trace in Billetweb.
        const pending = await prisma.attendee.findMany({
          where: { editionId: edition.id, badgeNumber: { not: null }, badgeWrittenAt: null, isCancelled: false },
          select: { id: true, billetwebId: true, badgeNumber: true },
          orderBy: { badgeNumber: "asc" },
        });

        // ~2 s per batch at Billetweb: 1 200 tickets outlast the proxies' 30 s, so
        // the write runs on after the reply and the screen follows it on GET.
        writeBadgeNumbers(request.log, edition.id, `${eventPath}/update_product?${params}`, fieldId, pending)
          .catch((err) => request.log.error({ err, editionId: edition.id }, "Billetweb badge write crashed"))
          .finally(() => runningWrites.delete(edition.id));
        isStarted = true;
        return reply.status(202).send({ pending: pending.length, fieldId });
      } finally {
        // Held from the check on, so two clicks cannot both start; released by
        // the write itself once it runs.
        if (!isStarted) runningWrites.delete(edition.id);
      }
    },
  );
}

async function writeBadgeNumbers(
  log: FastifyBaseLogger,
  editionId: number,
  url: string,
  fieldId: string,
  pending: Array<{ id: number; billetwebId: string; badgeNumber: number | null }>,
) {
  for (let i = 0; i < pending.length; i += WRITE_BATCH_SIZE) {
    const batch = pending.slice(i, i + WRITE_BATCH_SIZE);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: batch.map((a) => ({ id: Number(a.billetwebId), custom: { [fieldId]: String(a.badgeNumber) } })),
      }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as Record<string, unknown> | null;
    // Billetweb answers each written ticket under its id; anything else is a failure.
    const isAcknowledged = (id: string) => {
      const entry = body?.[id] as Record<string, unknown> | undefined;
      return !!entry && typeof entry === "object" && !("error" in entry);
    };
    const ok = batch.filter((a) => isAcknowledged(a.billetwebId));
    const ko = batch.filter((a) => !isAcknowledged(a.billetwebId));
    if (ok.length > 0) {
      await prisma.attendee.updateMany({
        where: { id: { in: ok.map((a) => a.id) } },
        data: { badgeWrittenAt: new Date(), badgeWriteError: null },
      });
    }
    if (ko.length > 0) {
      const reason = String(body?.error ?? (res ? `HTTP ${res.status}` : "network")).slice(0, 200);
      log.warn({ editionId, failed: ko.length, reason }, "Billetweb badge write failed");
      await prisma.attendee.updateMany({
        where: { id: { in: ko.map((a) => a.id) } },
        data: { badgeWriteError: reason },
      });
    }
  }
}
