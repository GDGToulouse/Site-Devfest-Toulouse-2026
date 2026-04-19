-- Deduplicate TicketTier rows that accumulated because the dev seed
-- used `where: { id: tier.sortOrder }` (a non-unique lookup) for upsert.
-- Keep the most recently updated row per (editionId, sortOrder), drop the rest.
DELETE FROM "TicketTier" t
USING "TicketTier" newer
WHERE t."editionId" = newer."editionId"
  AND t."sortOrder" = newer."sortOrder"
  AND t."id" < newer."id";

-- Enforce uniqueness so the bug cannot reappear.
CREATE UNIQUE INDEX "TicketTier_editionId_sortOrder_key"
  ON "TicketTier"("editionId", "sortOrder");
