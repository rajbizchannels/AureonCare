-- Migration 067: SEC-05 Model D — provisioner sources from `template` (post-cutover fix)
--
-- S2's provision_schema cloned tenant tables from `public`. That was correct at S2
-- time, but after the S4 cutover the tenant tables no longer live in public — the
-- golden copy is `template`. So new-tenant provisioning must clone from `template`,
-- replicate its FKs, and inherit its applied-migration state so the S5 fan-out runner
-- does not try to re-apply migrations already baked into the template clone.
--
-- Adds schema-source-parameterized helpers and redefines provision_schema to use them
-- with source = 'template'. Idempotent; does not rebuild the existing template.

-- Clone one table's structure from an arbitrary source schema.
CREATE OR REPLACE FUNCTION control.clone_table(p_src text, p_table text, p_dst text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = p_src AND c.relname = p_table AND c.relkind = 'r'
  ) THEN
    RAISE NOTICE 'clone_table: %.% does not exist, skipping', p_src, p_table;
    RETURN;
  END IF;
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.%I (LIKE %I.%I INCLUDING ALL)',
                 p_dst, p_table, p_src, p_table);
END $$;

-- Replicate intra-set FKs from an arbitrary source schema into the destination.
CREATE OR REPLACE FUNCTION control.replicate_intra_fks(p_src text, p_dst text, p_tables text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r record; del_action text; upd_action text;
BEGIN
  FOR r IN
    SELECT con.conname,
           child.relname  AS child_table,
           parent.relname AS parent_table,
           con.confdeltype, con.confupdtype,
           (SELECT string_agg(quote_ident(att.attname), ',' ORDER BY u.ord)
              FROM unnest(con.conkey)  WITH ORDINALITY u(attnum, ord)
              JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum) AS child_cols,
           (SELECT string_agg(quote_ident(att.attname), ',' ORDER BY u.ord)
              FROM unnest(con.confkey) WITH ORDINALITY u(attnum, ord)
              JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = u.attnum) AS parent_cols
    FROM pg_constraint con
    JOIN pg_class child  ON child.oid  = con.conrelid
    JOIN pg_namespace cn ON cn.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace pn ON pn.oid = parent.relnamespace
    WHERE con.contype = 'f' AND cn.nspname = p_src AND pn.nspname = p_src
      AND child.relname = ANY(p_tables) AND parent.relname = ANY(p_tables)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint c2
      JOIN pg_class cl ON cl.oid = c2.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE ns.nspname = p_dst AND cl.relname = r.child_table AND c2.conname = r.conname
    ) THEN CONTINUE; END IF;

    del_action := CASE r.confdeltype WHEN 'c' THEN ' ON DELETE CASCADE' WHEN 'n' THEN ' ON DELETE SET NULL'
                                     WHEN 'd' THEN ' ON DELETE SET DEFAULT' WHEN 'r' THEN ' ON DELETE RESTRICT' ELSE '' END;
    upd_action := CASE r.confupdtype WHEN 'c' THEN ' ON UPDATE CASCADE' WHEN 'n' THEN ' ON UPDATE SET NULL'
                                     WHEN 'd' THEN ' ON UPDATE SET DEFAULT' WHEN 'r' THEN ' ON UPDATE RESTRICT' ELSE '' END;

    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %I.%I (%s)%s%s',
                   p_dst, r.child_table, r.conname, r.child_cols,
                   p_dst, r.parent_table, r.parent_cols, del_action, upd_action);
  END LOOP;
END $$;

-- Provision a new tenant schema from the golden template (used by S7).
CREATE OR REPLACE FUNCTION control.provision_schema(p_dst text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE tset text[]; t text;
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_dst);
  SELECT array_agg(table_name ORDER BY sort_order, table_name) INTO tset FROM control.tenant_tables;
  IF tset IS NOT NULL THEN
    FOREACH t IN ARRAY tset LOOP
      PERFORM control.clone_table('template', t, p_dst);
    END LOOP;
    PERFORM control.replicate_intra_fks('template', p_dst, tset);
  END IF;
  PERFORM control.ensure_schema_migrations(p_dst);
  -- Inherit template's applied-migration state so the fan-out runner treats those
  -- versions (already baked into the cloned structure) as done.
  EXECUTE format(
    'INSERT INTO %I.schema_migrations (version, name, applied_at)
       SELECT version, name, applied_at FROM template.schema_migrations
     ON CONFLICT (version) DO NOTHING', p_dst);
END $$;
