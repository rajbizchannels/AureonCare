-- DO NOT PASTE INTO THE SQL EDITOR. Tenant-runner file (npm run migrate:tenants): it runs inside each
-- practice schema with unqualified names. For production, paste the matching global migration instead.
-- Portuguese removed from the Communication Preferences form's language question (the app is
-- not translated into it). Global migration 101 does the same in every schema and is the one
-- to paste into the SQL editor; this file is for the tenant runner. Unqualified names.
UPDATE form_templates t
   SET fields = (
         SELECT jsonb_agg(
                  CASE WHEN f->>'id' = 'preferred_language' AND jsonb_typeof(f->'options') = 'array'
                       THEN jsonb_set(f, '{options}', COALESCE((
                              SELECT jsonb_agg(o ORDER BY oi) FROM jsonb_array_elements(f->'options') WITH ORDINALITY AS x(o, oi)
                               WHERE o #>> '{}' <> 'Portuguese (Português)'), '[]'::jsonb))
                       ELSE f END
                  ORDER BY fi)
           FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS y(f, fi))
 WHERE t.slug = 'communication-preferences'
   AND jsonb_typeof(t.fields) = 'array'
   AND t.fields::text LIKE '%Portuguese (Portugu%';
