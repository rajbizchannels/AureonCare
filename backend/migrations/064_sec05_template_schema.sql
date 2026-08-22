-- Migration 064: SEC-05 Model D — Step S2: golden template schema + provisioner
--
-- Builds a versioned `template` schema that mirrors the STRUCTURE (no data) of the
-- tenant-scoped tables, and a per-schema `schema_migrations` tracking table. The
-- template is what new tenant schemas are stamped from (S7) and what the migration
-- fan-out runner (S5) advances.
--
-- Rather than hand-copy ~20 tables' DDL (which would drift from reality), the
-- structure is cloned generically from `public` via reusable functions. Those same
-- functions ARE the tenant provisioner reused in S7. Additive and non-invasive:
-- creates only the `template` schema + `control` helpers; touches no PHI data and
-- no request path. Fully idempotent.

-- ── Canonical tenant table set ────────────────────────────────────────────────
-- The tables that live inside each tenant's schema. Data-driven so it stays visible
-- and easy to amend. Identity tables (users/providers) are handled by the identity
-- plane in S3/S4 and are intentionally excluded here. clone skips any name absent
-- from public, so an entry that doesn't exist yet is harmless.
CREATE TABLE IF NOT EXISTS control.tenant_tables (
  table_name  text PRIMARY KEY,
  sort_order  integer NOT NULL DEFAULT 100
);

INSERT INTO control.tenant_tables (table_name, sort_order) VALUES
  ('patients', 10),
  ('appointments', 20),
  ('claims', 30),
  ('medical_records', 40),
  ('prescriptions', 50),
  ('lab_orders', 60),
  ('diagnosis', 70),
  ('diagnoses', 71),
  ('payments', 80),
  ('payment_postings', 81),
  ('denials', 82),
  ('preapprovals', 90),
  ('patient_intake_forms', 100),
  ('patient_portal_sessions', 110),
  ('fhir_resources', 120)
ON CONFLICT (table_name) DO NOTHING;

-- ── clone_public_table: copy one table's STRUCTURE into a target schema ────────
-- LIKE INCLUDING ALL copies columns, defaults, NOT NULL, CHECKs, identity, storage,
-- comments, and indexes (incl. PK/unique) — but NOT cross-table foreign keys, which
-- are recreated intra-schema by replicate_intra_fks below.
CREATE OR REPLACE FUNCTION control.clone_public_table(p_table text, p_dst text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = p_table AND c.relkind = 'r'
  ) THEN
    RAISE NOTICE 'clone_public_table: public.% does not exist, skipping', p_table;
    RETURN;
  END IF;
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.%I (LIKE public.%I INCLUDING ALL)',
                 p_dst, p_table, p_table);
END $$;

-- ── replicate_intra_fks: recreate FKs whose BOTH ends are in the tenant set ────
-- Rebuilt from pg_catalog (not pg_get_constraintdef, which would keep pointing at
-- public), so the copied FKs reference tables inside the destination schema. FKs to
-- tables outside the tenant set (e.g. users) are intentionally dropped here and, if
-- needed, handled by the identity plane. Idempotent: skips constraints already present.
CREATE OR REPLACE FUNCTION control.replicate_intra_fks(p_dst text, p_tables text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r record;
  del_action text; upd_action text;
  map constant "char"[] := ARRAY['a','r','c','n','d'];  -- placeholder to document mapping
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
    WHERE con.contype = 'f' AND cn.nspname = 'public' AND pn.nspname = 'public'
      AND child.relname  = ANY(p_tables)
      AND parent.relname = ANY(p_tables)
  LOOP
    -- skip if a constraint of this name already exists in the destination schema
    IF EXISTS (
      SELECT 1 FROM pg_constraint c2
      JOIN pg_class cl ON cl.oid = c2.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE ns.nspname = p_dst AND cl.relname = r.child_table AND c2.conname = r.conname
    ) THEN
      CONTINUE;
    END IF;

    del_action := CASE r.confdeltype WHEN 'c' THEN ' ON DELETE CASCADE'
                                     WHEN 'n' THEN ' ON DELETE SET NULL'
                                     WHEN 'd' THEN ' ON DELETE SET DEFAULT'
                                     WHEN 'r' THEN ' ON DELETE RESTRICT'
                                     ELSE '' END;
    upd_action := CASE r.confupdtype WHEN 'c' THEN ' ON UPDATE CASCADE'
                                     WHEN 'n' THEN ' ON UPDATE SET NULL'
                                     WHEN 'd' THEN ' ON UPDATE SET DEFAULT'
                                     WHEN 'r' THEN ' ON UPDATE RESTRICT'
                                     ELSE '' END;

    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %I.%I (%s)%s%s',
                   p_dst, r.child_table, r.conname, r.child_cols,
                   p_dst, r.parent_table, r.parent_cols, del_action, upd_action);
  END LOOP;
END $$;

-- ── ensure_schema_migrations: per-schema migration tracking table ─────────────
CREATE OR REPLACE FUNCTION control.ensure_schema_migrations(p_dst text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I.schema_migrations (
       version integer PRIMARY KEY,
       name text NOT NULL,
       applied_at timestamptz NOT NULL DEFAULT now())', p_dst);
END $$;

-- ── provision_schema: orchestrator (reused by S7 to create tenant schemas) ────
CREATE OR REPLACE FUNCTION control.provision_schema(p_dst text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  tset text[];
  t text;
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_dst);
  SELECT array_agg(table_name ORDER BY sort_order, table_name) INTO tset FROM control.tenant_tables;
  IF tset IS NOT NULL THEN
    FOREACH t IN ARRAY tset LOOP
      PERFORM control.clone_public_table(t, p_dst);
    END LOOP;
    PERFORM control.replicate_intra_fks(p_dst, tset);
  END IF;
  PERFORM control.ensure_schema_migrations(p_dst);
END $$;

-- ── Build the template schema and stamp it at baseline version 0 ──────────────
SELECT control.provision_schema('template');

INSERT INTO template.schema_migrations (version, name)
VALUES (0, 'baseline (structure cloned from public at S2)')
ON CONFLICT (version) DO NOTHING;
