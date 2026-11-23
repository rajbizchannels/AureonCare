-- Migration 071: SEC-05 Model D — capture lazily-created tenant tables
--
-- BUG FIX. Several routes create their tables on first use
-- (CREATE TABLE IF NOT EXISTS ... at runtime) rather than via a migration, so those
-- tables were absent from schema.sql and therefore missing from the 78-table tenant set
-- in migration 068. After those routes were swept to the per-request tenant db, a lazy
-- CREATE under a tenant search_path creates an EMPTY SHADOW copy inside the tenant
-- schema, and the route then reads 0 rows while the real data still sits in public.
--
-- This migration adds the affected tables to the tenant set, drops any empty shadow
-- that has already been created, and moves the real table (with its data) from public
-- into tenant_default — the same pattern as 068.
--
-- A shadow that is NOT empty is left alone and reported: that means writes landed in
-- both places and a human must reconcile them.
--
-- Idempotent and safe to re-run.

INSERT INTO control.tenant_tables (table_name, sort_order) VALUES
  ('form_categories', 300),
  ('form_templates', 301),
  ('form_template_versions', 302),
  ('form_submissions', 303),
  ('form_signatures', 304),
  ('form_audit_logs', 305),
  ('intake_flow_templates', 306),
  ('offering_form_links', 307)
ON CONFLICT (table_name) DO NOTHING;

DO $$
DECLARE
  t            text;
  in_public    boolean;
  in_tenant    boolean;
  shadow_rows  bigint;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
      'form_categories','form_templates','form_template_versions','form_submissions',
      'form_signatures','form_audit_logs','intake_flow_templates','offering_form_links'])
  LOOP
    in_public := to_regclass('public.' || quote_ident(t)) IS NOT NULL;
    in_tenant := to_regclass('tenant_default.' || quote_ident(t)) IS NOT NULL;

    IF in_public AND in_tenant THEN
      -- A shadow exists. Only reclaim it when it holds no data.
      EXECUTE format('SELECT count(*) FROM tenant_default.%I', t) INTO shadow_rows;
      IF shadow_rows = 0 THEN
        EXECUTE format('DROP TABLE tenant_default.%I', t);
        EXECUTE format('ALTER TABLE public.%I SET SCHEMA tenant_default', t);
        RAISE NOTICE '071: dropped empty shadow and moved public.% -> tenant_default', t;
      ELSE
        RAISE WARNING '071: tenant_default.% has % row(s) AND public.% still exists — manual reconciliation required, skipping',
          t, shadow_rows, t;
      END IF;

    ELSIF in_public THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA tenant_default', t);
      RAISE NOTICE '071: moved public.% -> tenant_default', t;

    ELSIF in_tenant THEN
      RAISE NOTICE '071: %s already only in tenant_default, nothing to do', t;

    ELSE
      RAISE NOTICE '071: % does not exist yet (created lazily on first use), skipping', t;
    END IF;
  END LOOP;
END $$;

-- Mirror whatever now exists in tenant_default into the golden template so newly
-- provisioned tenants get these tables too, and replicate the intra-tenant FKs.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT table_name FROM control.tenant_tables ORDER BY sort_order, table_name LOOP
    PERFORM control.clone_table('tenant_default', t, 'template');
  END LOOP;
END $$;

SELECT control.replicate_intra_fks(
  'tenant_default', 'template',
  ARRAY(SELECT table_name FROM control.tenant_tables)
);
