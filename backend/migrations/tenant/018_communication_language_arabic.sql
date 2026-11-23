-- DO NOT PASTE INTO THE SQL EDITOR. Tenant-runner file (npm run migrate:tenants): it runs inside each
-- practice schema with unqualified names. For production, paste the matching global migration instead.
-- Arabic added to the Communication Preferences language question (before "Other"). Global
-- migration 102 does the same in every schema and is the one to paste into the SQL editor; this
-- file is for the tenant runner. Unqualified names.
UPDATE form_templates t
   SET fields = (
         SELECT jsonb_agg(
                  CASE WHEN f->>'id' = 'preferred_language' AND jsonb_typeof(f->'options') = 'array'
                            AND NOT (f->'options') ? 'Arabic (العربية)'
                       THEN jsonb_set(f, '{options}', (
                              SELECT jsonb_agg(o ORDER BY k) FROM (
                                SELECT o, CASE WHEN o #>> '{}' = 'Other' THEN 1000 ELSE oi END AS k
                                  FROM jsonb_array_elements(f->'options') WITH ORDINALITY AS x(o, oi)
                                UNION ALL SELECT to_jsonb('Arabic (العربية)'::text), 999) z))
                       ELSE f END
                  ORDER BY fi)
           FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS y(f, fi))
 WHERE t.slug = 'communication-preferences'
   AND jsonb_typeof(t.fields) = 'array'
   AND t.fields::text NOT LIKE '%Arabic (%';
