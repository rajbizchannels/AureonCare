-- Migration 101: personal NPI and DEA number for clinicians; Portuguese removed from the
-- Communication Preferences form.
--
--   public.users.npi         10-digit National Provider Identifier (Type 1, the person) — US only
--   public.users.dea_number  DEA registration (2 letters + 7 digits) — US prescribers of
--                            controlled substances
--   form_templates (every practice + template): the "Preferred language for communications"
--                            question of the Communication Preferences form loses the
--                            "Portuguese (Português)" option (the app is not translated into it).
--                            Forms already filled in are not changed.
--
-- Safe to paste into the Supabase SQL editor as postgres, and to re-run. The tenant runner's
-- equivalent is tenant/017_communication_language_options.sql.

SET search_path TO public;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS npi varchar(10);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dea_number varchar(9);

DO $fan$
DECLARE s text; done int := 0; skipped int := 0;
BEGIN
  FOR s IN SELECT 'template'::text UNION ALL SELECT schema_name FROM control.tenants ORDER BY 1 LOOP
    IF to_regclass(format('%I.form_templates', s)) IS NULL THEN skipped := skipped + 1; CONTINUE; END IF;
    EXECUTE format($q$
      UPDATE %I.form_templates t
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
         AND t.fields::text LIKE '%%Portuguese (Portugu%%'$q$, s);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', s);
    EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (17, %L) ON CONFLICT (version) DO NOTHING', s, '017_communication_language_options.sql');
    done := done + 1;
  END LOOP;
  RAISE NOTICE '101: form library updated in % schema(s); % skipped', done, skipped;
END $fan$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('101_us_identifiers_language_option.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
