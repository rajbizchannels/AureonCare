-- Migration 088: register module_permissions for new tenants
--
-- Companion to tenant/011. control.provision_schema clones only what
-- control.tenant_tables lists, so without this row a newly provisioned practice would have
-- no module_permissions table and the permissions screen would fail for it. Same lesson as
-- 071, 083, 084 and 087.
--
-- No clone into `template` is needed: the tenant runner targets `template` like any other
-- schema, so tenant/011 creates it there. Deploy order is migrate -> migrate:tenants.

SET search_path TO public;

-- Sorted after the AI tables, and after `users`, which it references.
INSERT INTO control.tenant_tables (table_name, sort_order) VALUES
  ('module_permissions', 510)
ON CONFLICT (table_name) DO NOTHING;

DO $verify$
DECLARE registered boolean; in_template boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM control.tenant_tables WHERE table_name = 'module_permissions')
    INTO registered;
  in_template := to_regclass('template.module_permissions') IS NOT NULL;

  RAISE NOTICE '088: module_permissions registered=% in_template=%', registered, in_template;

  IF NOT registered THEN
    RAISE WARNING '088: module_permissions is not registered; new tenants will not get the table';
  END IF;
  IF NOT in_template THEN
    RAISE NOTICE '088: not in `template` yet — that is tenant/011''s job. Run: npm run migrate:tenants';
  END IF;
END $verify$;
