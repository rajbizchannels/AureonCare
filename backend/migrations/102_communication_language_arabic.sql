-- Migration 102: Arabic added to the Communication Preferences form's "Preferred language for
-- communications" question in every practice — the app is translated into English, Spanish,
-- French, German and Arabic. Inserted before "Other"; not added twice. Forms already filled in
-- are unchanged. Safe to paste into the Supabase SQL editor as postgres, and to re-run.
-- The tenant runner's equivalent is tenant/018_communication_language_arabic.sql.

SET search_path TO public;

DO $fan$
DECLARE s text; done int := 0;
BEGIN
  FOR s IN SELECT 'template'::text UNION ALL SELECT schema_name FROM control.tenants ORDER BY 1 LOOP
    IF to_regclass(format('%I.form_templates', s)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format($q$
      UPDATE %I.form_templates t
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
         AND t.fields::text NOT LIKE '%%Arabic (%%'$q$, s);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', s);
    EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (18, %L) ON CONFLICT (version) DO NOTHING', s, '018_communication_language_arabic.sql');
    done := done + 1;
  END LOOP;
  RAISE NOTICE '102: form library updated in % schema(s)', done;
END $fan$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('102_communication_language_arabic.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
