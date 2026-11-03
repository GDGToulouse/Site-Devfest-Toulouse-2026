-- #665: the history copied every contact message in clear, with the visitor's
-- IP. The extension now masks these fields (lib/audit.ts, PERSONAL_FIELDS);
-- this rewrites the lines written before, the same way: the field stays, its
-- value becomes "masqué" (an empty value stays empty), and the IP goes. One
-- statement, safe to replay.
UPDATE "AuditLog"
SET
  "ip" = NULL,
  "changes" = CASE
    WHEN jsonb_typeof("changes") = 'object' THEN (
      SELECT COALESCE(
        jsonb_object_agg(
          field.key,
          CASE
            WHEN field.key IN ('firstName', 'lastName', 'email', 'phone', 'company', 'jobTitle', 'message', 'webhookError')
              AND jsonb_typeof(field.value) = 'object'
            THEN jsonb_build_object(
              'before', CASE WHEN COALESCE(field.value -> 'before', 'null'::jsonb) = 'null'::jsonb THEN 'null'::jsonb ELSE '"masqué"'::jsonb END,
              'after', CASE WHEN COALESCE(field.value -> 'after', 'null'::jsonb) = 'null'::jsonb THEN 'null'::jsonb ELSE '"masqué"'::jsonb END
            )
            ELSE field.value
          END
        ),
        '{}'::jsonb
      )
      FROM jsonb_each("changes") AS field
    )
    ELSE "changes"
  END
WHERE "entity" = 'ContactMessage';
