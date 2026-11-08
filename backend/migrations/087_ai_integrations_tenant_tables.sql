-- Migration 087: register the AI integration tables for new tenants
--
-- Companion to tenant/010. control.provision_schema clones only what
-- control.tenant_tables lists, so without these rows a newly provisioned practice would
-- have no AI tables and every /api/ai call would fail. Same lesson as 071, 083 and 084.
--
-- No clone into `template` is needed here: the tenant runner targets `template` like any
-- other schema, so tenant/010 creates the tables there. Deploy order is
-- migrate -> migrate:tenants.

SET search_path TO public;

-- ai_requests comes before the two tables that reference it. Order does not affect FK
-- correctness (clone_table creates every table before replicate_intra_fks runs) but keeps
-- the provisioning log readable.
INSERT INTO control.tenant_tables (table_name, sort_order) VALUES
  ('ai_provider_credentials', 500),
  ('ai_feature_settings',     501),
  ('ai_requests',             502),
  ('ai_phi_token_map',        503),
  ('ai_suggestions',          504)
ON CONFLICT (table_name) DO NOTHING;

DO $$
DECLARE
  registered int;
  in_template int;
BEGIN
  SELECT count(*) INTO registered FROM control.tenant_tables
   WHERE table_name IN ('ai_provider_credentials', 'ai_feature_settings', 'ai_requests',
                        'ai_phi_token_map', 'ai_suggestions');
  SELECT count(*) INTO in_template FROM information_schema.tables
   WHERE table_schema = 'template'
     AND table_name IN ('ai_provider_credentials', 'ai_feature_settings', 'ai_requests',
                        'ai_phi_token_map', 'ai_suggestions');

  RAISE NOTICE '087: AI tables registered=%/5 present_in_template=%/5', registered, in_template;

  IF in_template < 5 THEN
    RAISE NOTICE '087: run `npm run migrate:tenants` next — tenant/010 creates the AI tables in template and in every tenant schema.';
  END IF;
END $$;
