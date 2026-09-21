-- Which provider secrets are actually stored in the database?
--
-- The database WINS over the environment: cloudBackupStorage resolves
-- `row?.client_secret || fromEnv(...)`, and the telehealth manager only falls back to an
-- environment variable when the column is NULL. So a secret saved through
-- Admin → Integrations keeps being used no matter what you change in Vercel — rotating the
-- variable alone would look like it worked and change nothing.
--
-- These are PER-TENANT tables, so a value can be set for one practice and not another.
-- This loops every tenant schema plus `template`, so a gap in template (which every new
-- tenant is cloned from) shows up too.
--
-- Reports only WHETHER a secret is present, never its value, and is read-only.
--
-- Runs as ONE transaction on purpose: the temp table is ON COMMIT DROP, so without an
-- explicit BEGIN the DO block's own implicit transaction would drop it before the SELECTs
-- below could read it.

BEGIN;

DO $$
DECLARE
  sch text;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS secret_audit (
    schema_name text, source text, provider text,
    has_client_secret boolean, has_api_secret boolean, has_api_key boolean,
    has_webhook_secret boolean, has_access_token boolean, has_refresh_token boolean,
    updated_at timestamptz
  ) ON COMMIT DROP;
  DELETE FROM secret_audit;

  FOR sch IN
    SELECT schema_name FROM control.tenants
     WHERE schema_name IS NOT NULL AND status <> 'suspended'
    UNION SELECT 'template'
    UNION SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\_%'
  LOOP
    IF to_regclass(format('%I.telehealth_provider_settings', sch)) IS NOT NULL THEN
      EXECUTE format($q$
        INSERT INTO secret_audit
        SELECT %L, 'telehealth_provider_settings', provider_type,
               client_secret  IS NOT NULL AND client_secret  <> '',
               api_secret     IS NOT NULL AND api_secret     <> '',
               api_key        IS NOT NULL AND api_key        <> '',
               webhook_secret IS NOT NULL AND webhook_secret <> '',
               access_token   IS NOT NULL AND access_token   <> '',
               refresh_token  IS NOT NULL AND refresh_token  <> '',
               updated_at
          FROM %I.telehealth_provider_settings $q$, sch, sch);
    END IF;

    IF to_regclass(format('%I.backup_provider_settings', sch)) IS NOT NULL THEN
      EXECUTE format($q$
        INSERT INTO secret_audit
        SELECT %L, 'backup_provider_settings', provider_type,
               client_secret IS NOT NULL AND client_secret <> '',
               false, false, false,
               COALESCE(settings->>'access_token','')  <> '',
               COALESCE(settings->>'refresh_token','') <> '',
               updated_at
          FROM %I.backup_provider_settings $q$, sch, sch);
    END IF;

    IF to_regclass(format('%I.vendor_integration_settings', sch)) IS NOT NULL THEN
      EXECUTE format($q$
        INSERT INTO secret_audit
        SELECT %L, 'vendor_integration_settings', vendor_type,
               client_secret IS NOT NULL AND client_secret <> '',
               api_secret    IS NOT NULL AND api_secret    <> '',
               api_key       IS NOT NULL AND api_key       <> '',
               false, false, false,
               updated_at
          FROM %I.vendor_integration_settings $q$, sch, sch);
    END IF;
  END LOOP;
END $$;

-- 1. Every stored provider secret, newest first. Anything listed here must be rotated in
--    the UI (or cleared to NULL) as well as in Vercel.
SELECT schema_name, source, provider,
       has_client_secret AS client_secret, has_api_secret AS api_secret,
       has_api_key AS api_key, has_webhook_secret AS webhook_secret,
       has_access_token AS access_token, has_refresh_token AS refresh_token,
       updated_at
  FROM secret_audit
 WHERE has_client_secret OR has_api_secret OR has_api_key
    OR has_webhook_secret OR has_access_token OR has_refresh_token
 ORDER BY updated_at DESC NULLS LAST, schema_name, provider;

-- 2. The short answer: which providers hold a secret anywhere, and in how many practices.
SELECT provider, source,
       count(*) FILTER (WHERE has_client_secret) AS practices_with_client_secret,
       count(*) FILTER (WHERE has_api_secret OR has_api_key) AS practices_with_api_key,
       count(*) FILTER (WHERE has_refresh_token) AS practices_with_refresh_token
  FROM secret_audit
 GROUP BY provider, source
HAVING count(*) FILTER (WHERE has_client_secret OR has_api_secret
                           OR has_api_key OR has_refresh_token) > 0
 ORDER BY provider;

-- 3. Platform-level Stripe keys live in public and are NOT per-tenant.
SELECT 'public.stripe_integration_settings' AS source,
       secret_key     IS NOT NULL AND secret_key     <> '' AS has_secret_key,
       webhook_secret IS NOT NULL AND webhook_secret <> '' AS has_webhook_secret
  FROM public.stripe_integration_settings;

COMMIT;
