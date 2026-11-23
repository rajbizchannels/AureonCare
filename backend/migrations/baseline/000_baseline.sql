-- Baseline for a from-scratch install — the WHOLE migration history (global 001–100 and tenant
-- 001–016) as one snapshot, regenerated 2026-11-22.
--
-- Made by building an empty database with the full chain (npm run migrate, then
-- npm run migrate:tenants) and dumping it: schema, privileges and the seed rows the chain
-- writes (roles/permissions, plans, specialties, form library, chart of accounts, control-plane
-- registry). The historical files are kept, not run, in migrations/history/.
--
-- Applied automatically by run-migrations.js when the target database is EMPTY (no public.users);
-- contains.txt lists every historical file, which the runner then records as applied. An existing
-- database (production included) never runs this: its ledger already records those files, and the
-- runner only applies files that are new.
--
-- public.schema_migrations is left out: the runner creates the ledger itself before applying this.
-- Session settings are SET LOCAL (the runner applies this inside one transaction on a pooled
-- connection; a session-level empty search_path would leak to the next query). psql meta-commands
-- are removed so node-postgres can execute it.

-- The least-privilege application role the grants below refer to (created by 073 on the old chain).
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    CREATE ROLE aureoncare_app LOGIN;
  END IF;
END $role$;
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET LOCAL statement_timeout = 0;
SET LOCAL lock_timeout = 0;
SET LOCAL idle_in_transaction_session_timeout = 0;
SET LOCAL client_encoding = 'UTF8';
SET LOCAL standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', true);
SET LOCAL check_function_bodies = false;
SET LOCAL xmloption = content;
SET LOCAL client_min_messages = warning;
SET LOCAL row_security = off;

--
-- Name: control; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA control;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: template; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA template;


--
-- Name: tenant_default; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tenant_default;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: audit_log_append_only(); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.audit_log_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'control.audit_log is append-only (% not allowed)', TG_OP;
END $$;


--
-- Name: billing_events_append_only(); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.billing_events_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'control.billing_events is append-only (% is not permitted)', TG_OP;
END $$;


--
-- Name: clone_public_table(text, text); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.clone_public_table(p_table text, p_dst text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'control', 'public', 'pg_temp'
    AS $$
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


--
-- Name: clone_table(text, text, text); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.clone_table(p_src text, p_table text, p_dst text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'control', 'public', 'pg_temp'
    AS $$
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


--
-- Name: ensure_schema_migrations(text); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.ensure_schema_migrations(p_dst text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'control', 'public', 'pg_temp'
    AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I.schema_migrations (
       version integer PRIMARY KEY,
       name text NOT NULL,
       applied_at timestamptz NOT NULL DEFAULT now())', p_dst);
END $$;


--
-- Name: forget_booking_slug(character varying, uuid); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.forget_booking_slug(p_slug character varying, p_tenant_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
  DELETE FROM control.booking_slug_route WHERE slug = p_slug AND tenant_id = p_tenant_id
$$;


--
-- Name: forget_portal_identity(character, uuid); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.forget_portal_identity(p_email_hmac character, p_tenant_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
  DELETE FROM control.portal_identity_route WHERE email_hmac = p_email_hmac AND tenant_id = p_tenant_id
$$;


--
-- Name: forget_portal_invite(character); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.forget_portal_invite(p_token_hash character) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
  DELETE FROM control.portal_invite_route WHERE token_hash = p_token_hash
$$;


--
-- Name: forget_portal_session(character); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.forget_portal_session(p_token_hash character) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
  DELETE FROM control.portal_session_route WHERE token_hash = p_token_hash
$$;


--
-- Name: grant_tenant_access(text); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.grant_tenant_access(p_schema text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'control', 'public', 'pg_temp'
    AS $$
BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO aureoncare_app', p_schema);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO aureoncare_app', p_schema);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO aureoncare_app', p_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aureoncare_app', p_schema);
END $$;


--
-- Name: provision_schema(text); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.provision_schema(p_dst text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'control', 'public', 'pg_temp'
    AS $$
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
  EXECUTE format(
    'INSERT INTO %I.schema_migrations (version, name, applied_at)
       SELECT version, name, applied_at FROM template.schema_migrations
     ON CONFLICT (version) DO NOTHING', p_dst);
  PERFORM control.grant_tenant_access(p_dst);
END $$;


--
-- Name: purge_expired_portal_sessions(); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.purge_expired_portal_sessions() RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
DECLARE n bigint;
BEGIN
  DELETE FROM control.portal_session_route WHERE expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;


--
-- Name: register_booking_slug(character varying, uuid, uuid); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.register_booking_slug(p_slug character varying, p_tenant_id uuid, p_provider_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
DECLARE owner uuid;
BEGIN
  INSERT INTO control.booking_slug_route (slug, tenant_id, provider_id)
  VALUES (p_slug, p_tenant_id, p_provider_id)
  ON CONFLICT (slug) DO UPDATE
     SET provider_id = EXCLUDED.provider_id, updated_at = now()
   WHERE control.booking_slug_route.tenant_id = EXCLUDED.tenant_id;
  SELECT r.tenant_id INTO owner FROM control.booking_slug_route r WHERE r.slug = p_slug;
  RETURN owner = p_tenant_id;
END $$;


--
-- Name: register_portal_identity(character, uuid, smallint); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.register_portal_identity(p_email_hmac character, p_tenant_id uuid, p_key_version smallint DEFAULT 1) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
  INSERT INTO control.portal_identity_route (email_hmac, tenant_id, key_version)
  VALUES (p_email_hmac, p_tenant_id, p_key_version)
  ON CONFLICT (email_hmac, tenant_id) DO UPDATE SET key_version = EXCLUDED.key_version
$$;


--
-- Name: register_portal_invite(character, uuid, timestamp with time zone); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.register_portal_invite(p_token_hash character, p_tenant_id uuid, p_expires_at timestamp with time zone) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
  INSERT INTO control.portal_invite_route (token_hash, tenant_id, expires_at)
  VALUES (p_token_hash, p_tenant_id, p_expires_at)
  ON CONFLICT (token_hash) DO NOTHING
$$;


--
-- Name: register_portal_session(character, uuid, timestamp with time zone); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.register_portal_session(p_token_hash character, p_tenant_id uuid, p_expires_at timestamp with time zone) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
  INSERT INTO control.portal_session_route (token_hash, tenant_id, expires_at)
  VALUES (p_token_hash, p_tenant_id, p_expires_at)
  ON CONFLICT (token_hash) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, expires_at = EXCLUDED.expires_at
$$;


--
-- Name: replicate_intra_fks(text, text[]); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.replicate_intra_fks(p_dst text, p_tables text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'control', 'public', 'pg_temp'
    AS $$
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


--
-- Name: replicate_intra_fks(text, text, text[]); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.replicate_intra_fks(p_src text, p_dst text, p_tables text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'control', 'public', 'pg_temp'
    AS $$
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


--
-- Name: resolve_booking_slug(character varying); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.resolve_booking_slug(p_slug character varying) RETURNS TABLE(tenant_id uuid, schema_name character varying, provider_id uuid)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
  SELECT r.tenant_id, t.schema_name, r.provider_id
    FROM control.booking_slug_route r
    JOIN control.tenants t ON t.id = r.tenant_id
   WHERE r.slug = p_slug AND t.status = 'active'
$$;


--
-- Name: resolve_portal_invite(character); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.resolve_portal_invite(p_token_hash character) RETURNS TABLE(tenant_id uuid, schema_name character varying)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
  SELECT r.tenant_id, t.schema_name
    FROM control.portal_invite_route r
    JOIN control.tenants t ON t.id = r.tenant_id
   WHERE r.token_hash = p_token_hash AND r.expires_at > now() AND t.status = 'active'
$$;


--
-- Name: resolve_portal_session(character); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.resolve_portal_session(p_token_hash character) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
  SELECT tenant_id FROM control.portal_session_route
   WHERE token_hash = p_token_hash AND expires_at > now()
$$;


--
-- Name: resolve_portal_tenants(character); Type: FUNCTION; Schema: control; Owner: -
--

CREATE FUNCTION control.resolve_portal_tenants(p_email_hmac character) RETURNS TABLE(tenant_id uuid)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'control', 'pg_temp'
    AS $$
  SELECT tenant_id FROM control.portal_identity_route WHERE email_hmac = p_email_hmac
$$;


--
-- Name: generate_account_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_account_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN LPAD(nextval('accounts_seq')::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_ap_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_ap_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'AP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('account_ap_seq')::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_ar_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_ar_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'AR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('account_ar_seq')::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_billing_payment_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_billing_payment_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_num INTEGER;
    year_prefix VARCHAR(4);
BEGIN
    year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(payment_number FROM 8) AS INTEGER)), 0) + 1
    INTO next_num
    FROM billing_payments
    WHERE payment_number LIKE 'BPY-' || year_prefix || '-%';
    RETURN 'BPY-' || year_prefix || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_denial_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_denial_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_num INTEGER;
    year_prefix VARCHAR(4);
    denial_num VARCHAR(50);
BEGIN
    year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');

    SELECT COALESCE(MAX(CAST(SUBSTRING(denial_number FROM 8) AS INTEGER)), 0) + 1
    INTO next_num
    FROM denials
    WHERE denial_number LIKE 'DEN-' || year_prefix || '-%';

    denial_num := 'DEN-' || year_prefix || '-' || LPAD(next_num::TEXT, 6, '0');
    RETURN denial_num;
END;
$$;


--
-- Name: generate_fhir_tracking_number(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_fhir_tracking_number(resource_type character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix VARCHAR(4);
    timestamp_part VARCHAR(14);
    random_part VARCHAR(6);
BEGIN
    -- Set prefix based on resource type
    prefix := CASE resource_type
        WHEN 'MedicationRequest' THEN 'RX'
        WHEN 'ServiceRequest' THEN 'LAB'
        ELSE 'FHIR'
    END;

    -- Generate timestamp part (YYYYMMDDHHmmss)
    timestamp_part := TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');

    -- Generate random part
    random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

    RETURN prefix || '-' || timestamp_part || '-' || random_part;
END;
$$;


--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_num INTEGER;
    year_prefix VARCHAR(4);
BEGIN
    year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INTEGER)), 0) + 1
    INTO next_num
    FROM billing_invoices
    WHERE invoice_number LIKE 'INV-' || year_prefix || '-%';
    RETURN 'INV-' || year_prefix || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_item_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_item_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'INV-' || LPAD(nextval('inventory_item_number_seq')::TEXT, 4, '0');
END;
$$;


--
-- Name: generate_je_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_je_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'JE-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('account_je_seq')::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_movement_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_movement_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'MOV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('inventory_movement_number_seq')::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_po_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_po_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'PO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('inventory_po_number_seq')::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_posting_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_posting_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_num INTEGER;
    year_prefix VARCHAR(4);
    posting_num VARCHAR(50);
BEGIN
    year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');

    SELECT COALESCE(MAX(CAST(SUBSTRING(posting_number FROM 9) AS INTEGER)), 0) + 1
    INTO next_num
    FROM payment_postings
    WHERE posting_number LIKE 'POST-' || year_prefix || '-%';

    posting_num := 'POST-' || year_prefix || '-' || LPAD(next_num::TEXT, 6, '0');
    RETURN posting_num;
END;
$$;


--
-- Name: generate_quote_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_quote_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_num INTEGER;
    year_prefix VARCHAR(4);
BEGIN
    year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 8) AS INTEGER)), 0) + 1
    INTO next_num
    FROM billing_quotes
    WHERE quote_number LIKE 'QTE-' || year_prefix || '-%';
    RETURN 'QTE-' || year_prefix || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_rec_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_rec_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'REC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('account_rec_seq')::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_stm_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_stm_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'STM-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('account_stm_seq')::TEXT, 6, '0');
END;
$$;


--
-- Name: generate_supplier_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_supplier_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'SUP-' || LPAD(nextval('inventory_supplier_number_seq')::TEXT, 4, '0');
END;
$$;


--
-- Name: is_slot_available(uuid, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_slot_available(p_provider_id uuid, p_start_time timestamp without time zone, p_end_time timestamp without time zone) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    conflict_count INTEGER;
    time_off_count INTEGER;
BEGIN
    -- Check for conflicting appointments
    SELECT COUNT(*) INTO conflict_count
    FROM appointments
    WHERE provider_id = p_provider_id
      AND status NOT IN ('cancelled', 'no-show')
      AND (
          (start_time <= p_start_time AND end_time > p_start_time) OR
          (start_time < p_end_time AND end_time >= p_end_time) OR
          (start_time >= p_start_time AND end_time <= p_end_time)
      );

    -- Check for time-off periods
    SELECT COUNT(*) INTO time_off_count
    FROM doctor_time_off
    WHERE provider_id = p_provider_id
      AND (
          (start_date <= p_start_time AND end_date > p_start_time) OR
          (start_date < p_end_time AND end_date >= p_end_time) OR
          (start_date >= p_start_time AND end_date <= p_end_time)
      );

    RETURN (conflict_count = 0 AND time_off_count = 0);
END;
$$;


--
-- Name: log_fhir_tracking_event(uuid, character varying, text, character varying, character varying, boolean, character varying, text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_fhir_tracking_event(p_tracking_id uuid, p_event_type character varying, p_event_description text, p_from_status character varying DEFAULT NULL::character varying, p_to_status character varying DEFAULT NULL::character varying, p_is_error boolean DEFAULT false, p_error_code character varying DEFAULT NULL::character varying, p_error_message text DEFAULT NULL::text, p_event_data jsonb DEFAULT NULL::jsonb, p_triggered_by uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO fhir_tracking_events (
        fhir_tracking_id,
        event_type,
        event_description,
        from_status,
        to_status,
        is_error,
        error_code,
        error_message,
        event_data,
        triggered_by
    ) VALUES (
        p_tracking_id,
        p_event_type,
        p_event_description,
        p_from_status,
        p_to_status,
        p_is_error,
        p_error_code,
        p_error_message,
        p_event_data,
        p_triggered_by
    ) RETURNING id INTO event_id;

    RETURN event_id;
END;
$$;


--
-- Name: set_appeal_deadline(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_appeal_deadline() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.appeal_deadline IS NULL THEN
        NEW.appeal_deadline := NEW.denial_date + INTERVAL '90 days';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: set_denial_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_denial_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.denial_number IS NULL OR NEW.denial_number = '' THEN
        NEW.denial_number := generate_denial_number();
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: set_posting_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_posting_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.posting_number IS NULL OR NEW.posting_number = '' THEN
        NEW.posting_number := generate_posting_number();
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: sync_membership_from_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_membership_from_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.practice_id IS NOT NULL THEN
    INSERT INTO public.memberships (user_id, practice_id, role)
    VALUES (NEW.id, NEW.practice_id, COALESCE(NEW.role, 'staff'))
    ON CONFLICT (user_id, practice_id) DO UPDATE
      SET role = EXCLUDED.role, status = 'active', updated_at = now()
      WHERE memberships.role IS DISTINCT FROM EXCLUDED.role OR memberships.status <> 'active';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: touch_message_thread(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_message_thread() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE message_threads
     SET last_message_at = NEW.sent_at,
         message_count   = message_count + 1,
         updated_at      = CURRENT_TIMESTAMP
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;


--
-- Name: trigger_log_fhir_tracking_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_log_fhir_tracking_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.current_status != NEW.current_status) THEN
        PERFORM log_fhir_tracking_event(
            NEW.id,
            'status_change',
            'Status changed from ' || COALESCE(OLD.current_status, 'NULL') || ' to ' || NEW.current_status,
            OLD.current_status,
            NEW.current_status,
            NEW.has_errors,
            NEW.last_error_code,
            NEW.last_error_message,
            jsonb_build_object(
                'previous_status', OLD.current_status,
                'new_status', NEW.current_status,
                'status_reason', NEW.status_reason
            ),
            NEW.updated_by
        );
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: update_accounts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_accounts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_archive_rules_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_archive_rules_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_claim_submissions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_claim_submissions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_denials_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_denials_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_insurance_payers_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_insurance_payers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_inventory_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_inventory_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_payment_postings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_payment_postings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_preapprovals_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_preapprovals_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: audit_logs_append_only(); Type: FUNCTION; Schema: template; Owner: -
--

CREATE FUNCTION template.audit_logs_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% is not permitted)', TG_OP
    USING HINT = 'Audit records may be inserted and read, never altered or removed.';
END $$;


--
-- Name: audit_logs_append_only(); Type: FUNCTION; Schema: tenant_default; Owner: -
--

CREATE FUNCTION tenant_default.audit_logs_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% is not permitted)', TG_OP
    USING HINT = 'Audit records may be inserted and read, never altered or removed.';
END $$;


SET LOCAL default_tablespace = '';

SET LOCAL default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.audit_log (
    id bigint NOT NULL,
    operator_id uuid,
    action character varying(64) NOT NULL,
    target_type character varying(32),
    target_id character varying(128),
    tenant_id uuid,
    detail jsonb,
    ip_address character varying(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_type character varying(16),
    actor_label character varying(255),
    CONSTRAINT audit_log_actor_type_check CHECK (((actor_type IS NULL) OR ((actor_type)::text = ANY ((ARRAY['operator'::character varying, 'tenant_user'::character varying, 'stripe'::character varying, 'system'::character varying])::text[]))))
);


--
-- Name: COLUMN audit_log.actor_type; Type: COMMENT; Schema: control; Owner: -
--

COMMENT ON COLUMN control.audit_log.actor_type IS 'operator | tenant_user | stripe | system. Null on rows written before migration 086; derive those from operator_id.';


--
-- Name: COLUMN audit_log.actor_label; Type: COMMENT; Schema: control; Owner: -
--

COMMENT ON COLUMN control.audit_log.actor_label IS 'Human-readable actor (an email, or "stripe webhook"). operator_id stays the authoritative link for operators.';


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: control; Owner: -
--

ALTER TABLE control.audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME control.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: billing_events; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.billing_events (
    id bigint NOT NULL,
    tenant_id uuid,
    practice_id uuid,
    event_type character varying(64) NOT NULL,
    stripe_object_id character varying(255),
    stripe_customer_id character varying(255),
    amount_minor bigint DEFAULT 0 NOT NULL,
    currency character varying(3),
    description text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    operator_id uuid,
    entry_kind character varying(16) DEFAULT 'cash'::character varying NOT NULL,
    CONSTRAINT billing_events_entry_kind_check CHECK (((entry_kind)::text = ANY ((ARRAY['cash'::character varying, 'accrual'::character varying])::text[])))
);


--
-- Name: COLUMN billing_events.occurred_at; Type: COMMENT; Schema: control; Owner: -
--

COMMENT ON COLUMN control.billing_events.occurred_at IS 'When the entry takes effect — for an accrual, the proration date the change was priced at. created_at is when we wrote the row.';


--
-- Name: COLUMN billing_events.entry_kind; Type: COMMENT; Schema: control; Owner: -
--

COMMENT ON COLUMN control.billing_events.entry_kind IS 'cash = money moved (counts towards collected revenue). accrual = recognised at occurred_at and settled on a later invoice (proration credits and charges); excluded from collected totals so it is not counted twice.';


--
-- Name: billing_events_id_seq; Type: SEQUENCE; Schema: control; Owner: -
--

ALTER TABLE control.billing_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME control.billing_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: booking_slug_route; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.booking_slug_route (
    slug character varying(100) NOT NULL,
    tenant_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: break_glass_sessions; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.break_glass_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operator_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    reason text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: config_baseline; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.config_baseline (
    key character varying(120) NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: operators; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.operators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    mfa_secret character varying(255),
    mfa_enabled boolean DEFAULT false NOT NULL,
    token_version integer DEFAULT 0 NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role character varying(20) DEFAULT 'owner'::character varying NOT NULL,
    notify_platform_events boolean DEFAULT true NOT NULL,
    CONSTRAINT operators_role_check CHECK (((role)::text = ANY ((ARRAY['owner'::character varying, 'billing'::character varying, 'support'::character varying, 'readonly'::character varying])::text[])))
);


--
-- Name: platform_notifications; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.platform_notifications (
    id bigint NOT NULL,
    dedupe_key text NOT NULL,
    action character varying(64) NOT NULL,
    severity character varying(16) DEFAULT 'info'::character varying NOT NULL,
    subject text NOT NULL,
    recipients text[] DEFAULT '{}'::text[] NOT NULL,
    tenant_id uuid,
    actor_id uuid,
    detail jsonb,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_notifications_id_seq; Type: SEQUENCE; Schema: control; Owner: -
--

ALTER TABLE control.platform_notifications ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME control.platform_notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: portal_identity_route; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.portal_identity_route (
    email_hmac character(64) NOT NULL,
    tenant_id uuid NOT NULL,
    key_version smallint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: portal_invite_route; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.portal_invite_route (
    token_hash character(64) NOT NULL,
    tenant_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: portal_session_route; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.portal_session_route (
    token_hash character(64) NOT NULL,
    tenant_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: signup_intents; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.signup_intents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    practice_name character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    password_hash character varying(255) NOT NULL,
    plan_id integer,
    country character varying(2),
    timezone character varying(64),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    stripe_checkout_session_id character varying(255),
    stripe_customer_id character varying(255),
    stripe_subscription_id character varying(255),
    tenant_id uuid,
    failure_reason text,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: subscription_grants; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.subscription_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    grant_type character varying(32) NOT NULL,
    months integer,
    stripe_coupon_id character varying(255),
    reason text NOT NULL,
    operator_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    practice_id uuid,
    plan_id integer,
    plan_name character varying(100),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    seats integer DEFAULT 0 NOT NULL,
    enforcement_enabled boolean DEFAULT true NOT NULL,
    stripe_customer_id character varying(255),
    stripe_subscription_id character varying(255),
    trial_end timestamp with time zone,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    current_period_start timestamp with time zone
);


--
-- Name: COLUMN subscriptions.current_period_start; Type: COMMENT; Schema: control; Owner: -
--

COMMENT ON COLUMN control.subscriptions.current_period_start IS 'Start of the period current_period_end closes. Populated from Stripe; null on rows predating migration 086 and on tenants not billed through Stripe, where the start is derived from the plan billing cycle.';


--
-- Name: tenant_tables; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.tenant_tables (
    table_name text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: control; Owner: -
--

CREATE TABLE control.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid,
    slug character varying(63) NOT NULL,
    name character varying(255) NOT NULL,
    schema_name character varying(63) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    plan_tier character varying(20) DEFAULT 'professional'::character varying,
    region character varying(64),
    country character varying(2),
    timezone character varying(100),
    app_version character varying(32),
    schema_version integer DEFAULT 0 NOT NULL,
    migration_status character varying(20) DEFAULT 'idle'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account_ap_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_ap_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_ar_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_ar_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_backups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backup_type character varying(30) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    file_name character varying(255),
    file_size_bytes bigint,
    record_count integer,
    period_start date,
    period_end date,
    checksum character varying(64),
    storage_location text,
    error_message text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_backups_backup_type_check CHECK (((backup_type)::text = ANY ((ARRAY['full'::character varying, 'accounts'::character varying, 'journal'::character varying, 'ar'::character varying, 'ap'::character varying, 'reconciliation'::character varying, 'statements'::character varying])::text[]))),
    CONSTRAINT account_backups_file_size_bytes_check CHECK ((file_size_bytes >= 0)),
    CONSTRAINT account_backups_record_count_check CHECK ((record_count >= 0)),
    CONSTRAINT account_backups_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: account_je_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_je_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_rec_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_rec_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_stm_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_stm_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: archive_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archive_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archive_name character varying(255) NOT NULL,
    description text,
    archived_tables text[] NOT NULL,
    archived_modules text[] NOT NULL,
    record_counts jsonb,
    archive_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    archived_by uuid,
    status character varying(50) DEFAULT 'active'::character varying,
    metadata jsonb
);


--
-- Name: TABLE archive_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.archive_metadata IS 'Tracks archived data stored in this archive database';


--
-- Name: COLUMN archive_metadata.archived_tables; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.archive_metadata.archived_tables IS 'List of tables that contain archived data';


--
-- Name: COLUMN archive_metadata.archived_modules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.archive_metadata.archived_modules IS 'List of modules (logical groupings) that were archived';


--
-- Name: COLUMN archive_metadata.record_counts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.archive_metadata.record_counts IS 'JSON object with table names as keys and record counts as values';


--
-- Name: billing_coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_coupons (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(12,2) NOT NULL,
    min_amount numeric(12,2) DEFAULT 0,
    max_discount numeric(12,2),
    usage_limit integer,
    used_count integer DEFAULT 0,
    start_date date,
    end_date date,
    is_active boolean DEFAULT true,
    applicable_offerings uuid[] DEFAULT '{}'::uuid[],
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT billing_coupons_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['percentage'::character varying, 'fixed'::character varying])::text[])))
);


--
-- Name: billing_invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_invoice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_id uuid NOT NULL,
    description text NOT NULL,
    quantity integer DEFAULT 1,
    unit_price numeric(12,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    total numeric(12,2) NOT NULL,
    offering_id uuid,
    diagnosis_id uuid,
    cpt_code character varying(20),
    icd_code character varying(20),
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: billing_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_number character varying(50) NOT NULL,
    quote_id uuid,
    patient_id uuid,
    provider_id uuid,
    status character varying(30) DEFAULT 'draft'::character varying,
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    subtotal numeric(12,2) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    amount_paid numeric(12,2) DEFAULT 0,
    balance_due numeric(12,2) DEFAULT 0,
    notes text,
    terms text,
    diagnosis_ids uuid[] DEFAULT '{}'::uuid[],
    offering_ids uuid[] DEFAULT '{}'::uuid[],
    coupon_id uuid,
    reminder_task_id integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT billing_invoices_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'partially_paid'::character varying, 'paid'::character varying, 'overdue'::character varying, 'cancelled'::character varying, 'refunded'::character varying])::text[])))
);


--
-- Name: billing_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    payment_number character varying(50) NOT NULL,
    invoice_id uuid,
    patient_id uuid,
    amount numeric(12,2) NOT NULL,
    payment_method character varying(50),
    payment_date timestamp without time zone DEFAULT now(),
    status character varying(30) DEFAULT 'completed'::character varying,
    transaction_id character varying(200),
    reference_number character varying(200),
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT billing_payments_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'credit_card'::character varying, 'debit_card'::character varying, 'check'::character varying, 'ach'::character varying, 'wire'::character varying, 'insurance'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT billing_payments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying, 'partially_refunded'::character varying])::text[])))
);


--
-- Name: billing_quote_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_quote_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    quote_id uuid NOT NULL,
    description text NOT NULL,
    quantity integer DEFAULT 1,
    unit_price numeric(12,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    total numeric(12,2) NOT NULL,
    offering_id uuid,
    diagnosis_id uuid,
    cpt_code character varying(20),
    icd_code character varying(20),
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: billing_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_quotes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    quote_number character varying(50) NOT NULL,
    patient_id uuid,
    provider_id uuid,
    status character varying(30) DEFAULT 'draft'::character varying,
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    expiry_date date,
    subtotal numeric(12,2) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    notes text,
    terms text,
    diagnosis_ids uuid[] DEFAULT '{}'::uuid[],
    offering_ids uuid[] DEFAULT '{}'::uuid[],
    coupon_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT billing_quotes_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'accepted'::character varying, 'declined'::character varying, 'expired'::character varying, 'converted'::character varying])::text[])))
);


--
-- Name: directory_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directory_events (
    id bigint NOT NULL,
    practice_id uuid NOT NULL,
    provider_id uuid,
    action character varying(32) NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: directory_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directory_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directory_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directory_events_id_seq OWNED BY public.directory_events.id;


--
-- Name: drug_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drug_interactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    drug1_ndc character varying(20) NOT NULL,
    drug2_ndc character varying(20) NOT NULL,
    interaction_severity character varying(50) NOT NULL,
    interaction_type character varying(100),
    description text NOT NULL,
    clinical_effects text,
    management_recommendations text,
    reference_sources text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE drug_interactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.drug_interactions IS 'Known drug-drug interactions database';


--
-- Name: inventory_item_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_item_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_movement_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_movement_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_po_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_po_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_purchase_order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_purchase_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid NOT NULL,
    item_id uuid NOT NULL,
    line_number integer NOT NULL,
    quantity_ordered numeric(12,3) NOT NULL,
    quantity_received numeric(12,3) DEFAULT 0 NOT NULL,
    unit_cost numeric(15,2) NOT NULL,
    line_total numeric(15,2) GENERATED ALWAYS AS ((quantity_ordered * unit_cost)) STORED,
    lot_number character varying(50),
    expiry_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_purchase_order_lines_line_number_check CHECK ((line_number > 0)),
    CONSTRAINT inventory_purchase_order_lines_quantity_ordered_check CHECK ((quantity_ordered > (0)::numeric)),
    CONSTRAINT inventory_purchase_order_lines_quantity_received_check CHECK ((quantity_received >= (0)::numeric)),
    CONSTRAINT inventory_purchase_order_lines_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: inventory_supplier_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_supplier_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: join_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.join_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid NOT NULL,
    user_id uuid,
    email text NOT NULL,
    requested_role character varying(32) DEFAULT 'staff'::character varying NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    email_verified_via character varying(32),
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    source character varying(16) DEFAULT 'domain'::character varying NOT NULL,
    verify_token_hash character(64),
    verify_expires_at timestamp with time zone,
    CONSTRAINT join_requests_status_check CHECK (((status)::text = ANY ((ARRAY['unverified'::character varying, 'pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: license_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(50) NOT NULL,
    plan_name character varying(50) NOT NULL,
    max_providers integer DEFAULT 1 NOT NULL,
    max_users integer DEFAULT '-1'::integer NOT NULL,
    max_patients integer DEFAULT '-1'::integer NOT NULL,
    valid_from date DEFAULT CURRENT_DATE NOT NULL,
    valid_until date,
    status character varying(20) DEFAULT 'unactivated'::character varying NOT NULL,
    activated_at timestamp without time zone,
    installation_id character varying(255) DEFAULT NULL::character varying,
    notes text,
    created_by character varying(255) DEFAULT NULL::character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT license_keys_status_check CHECK (((status)::text = ANY ((ARRAY['unactivated'::character varying, 'active'::character varying, 'expired'::character varying, 'revoked'::character varying])::text[])))
);


--
-- Name: TABLE license_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.license_keys IS 'Software license keys issued for On-Premises and Customer Cloud deployments';


--
-- Name: login_lockouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_lockouts (
    key_hash character(64) NOT NULL,
    scope character varying(10) NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    last_failed_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_until timestamp with time zone,
    CONSTRAINT login_lockouts_scope_check CHECK (((scope)::text = ANY ((ARRAY['staff'::character varying, 'portal'::character varying])::text[])))
);


--
-- Name: medical_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    description text NOT NULL,
    code_type character varying(20) NOT NULL,
    category character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    pa_type integer
);


--
-- Name: TABLE medical_codes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.medical_codes IS 'Stores all medical codes including ICD-10 diagnosis codes and CPT procedure codes';


--
-- Name: COLUMN medical_codes.code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medical_codes.code IS 'The medical code (e.g., I10, 99213)';


--
-- Name: COLUMN medical_codes.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medical_codes.description IS 'Full description of the medical code';


--
-- Name: COLUMN medical_codes.code_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medical_codes.code_type IS 'Type of code: ICD-10 for diagnoses, CPT for procedures';


--
-- Name: COLUMN medical_codes.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medical_codes.category IS 'Category for grouping codes (e.g., Primary Care, Chronic Conditions)';


--
-- Name: COLUMN medical_codes.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.medical_codes.is_active IS 'Whether this code is currently active/valid';


--
-- Name: medication_alternatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medication_alternatives (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    original_ndc character varying(20),
    alternative_ndc character varying(20),
    relationship_type character varying(50) NOT NULL,
    cost_difference numeric(10,2),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE medication_alternatives; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.medication_alternatives IS 'Generic and therapeutic alternatives for cost savings';


--
-- Name: medications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ndc_code character varying(500),
    drug_name character varying(500),
    generic_name character varying(500),
    brand_name character varying(500),
    drug_class character varying(500),
    strength character varying(1000),
    dosage_form character varying(500),
    route character varying(500),
    manufacturer character varying(500),
    controlled_substance boolean DEFAULT false,
    dea_schedule character varying(10),
    requires_prior_auth boolean DEFAULT false,
    formulary_status character varying(500) DEFAULT 'preferred'::character varying,
    average_cost numeric(10,2),
    common_dosages text[],
    indications text[],
    contraindications text[],
    warnings text,
    side_effects text[],
    drug_interactions text,
    pregnancy_category character varying(5),
    is_generic boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE medications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.medications IS 'Drug formulary database with NDC codes and drug information';


--
-- Name: memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memberships (
    user_id uuid NOT NULL,
    practice_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    status character varying(12) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    CONSTRAINT memberships_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'disabled'::character varying])::text[])))
);


--
-- Name: message_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    mime_type character varying(127),
    size_bytes bigint NOT NULL,
    content_ciphertext text NOT NULL,
    content_iv character varying(32) NOT NULL,
    content_tag character varying(32) NOT NULL,
    key_version smallint DEFAULT 1 NOT NULL,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: message_read_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_read_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    reader_kind character varying(10) NOT NULL,
    reader_id uuid NOT NULL,
    read_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT message_read_receipts_reader_kind_check CHECK (((reader_kind)::text = ANY ((ARRAY['user'::character varying, 'patient'::character varying])::text[])))
);


--
-- Name: message_thread_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_thread_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    participant_kind character varying(10) NOT NULL,
    participant_id uuid NOT NULL,
    participant_role character varying(20) DEFAULT 'member'::character varying NOT NULL,
    last_read_at timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    removed_at timestamp without time zone,
    CONSTRAINT message_thread_participants_participant_kind_check CHECK (((participant_kind)::text = ANY ((ARRAY['user'::character varying, 'patient'::character varying])::text[]))),
    CONSTRAINT message_thread_participants_participant_role_check CHECK (((participant_role)::text = ANY ((ARRAY['owner'::character varying, 'member'::character varying])::text[])))
);


--
-- Name: message_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject character varying(255) NOT NULL,
    thread_type character varying(20) DEFAULT 'care_team'::character varying NOT NULL,
    patient_id uuid,
    priority character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    created_by_kind character varying(10) NOT NULL,
    created_by_id uuid NOT NULL,
    last_message_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    message_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT message_threads_created_by_kind_check CHECK (((created_by_kind)::text = ANY ((ARRAY['user'::character varying, 'patient'::character varying])::text[]))),
    CONSTRAINT message_threads_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT message_threads_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying])::text[]))),
    CONSTRAINT message_threads_thread_type_check CHECK (((thread_type)::text = ANY ((ARRAY['care_team'::character varying, 'patient'::character varying])::text[])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    sender_kind character varying(10) NOT NULL,
    sender_id uuid,
    message_type character varying(20) DEFAULT 'message'::character varying NOT NULL,
    body_ciphertext text NOT NULL,
    body_iv character varying(32) NOT NULL,
    body_tag character varying(32) NOT NULL,
    key_version smallint DEFAULT 1 NOT NULL,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    edited_at timestamp without time zone,
    deleted_at timestamp without time zone,
    deleted_by_kind character varying(10),
    deleted_by_id uuid,
    CONSTRAINT messages_deleted_by_kind_check CHECK (((deleted_by_kind)::text = ANY ((ARRAY['user'::character varying, 'patient'::character varying])::text[]))),
    CONSTRAINT messages_message_type_check CHECK (((message_type)::text = ANY ((ARRAY['message'::character varying, 'system'::character varying])::text[]))),
    CONSTRAINT messages_sender_kind_check CHECK (((sender_kind)::text = ANY ((ARRAY['user'::character varying, 'patient'::character varying, 'system'::character varying])::text[])))
);


--
-- Name: mobile_oauth_flows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mobile_oauth_flows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider character varying(16) NOT NULL,
    state_hash character(64) NOT NULL,
    app_challenge character varying(128) NOT NULL,
    app_redirect text NOT NULL,
    provider_verifier text NOT NULL,
    code_hash character(64),
    token_ciphertext text,
    token_iv text,
    token_tag text,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mobile_oauth_flows_provider_check CHECK (((provider)::text = ANY ((ARRAY['google'::character varying, 'microsoft'::character varying])::text[])))
);


--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_settings (
    id integer NOT NULL,
    organization_name character varying(255),
    current_plan_id integer,
    plan_start_date date,
    plan_end_date date,
    auto_renew boolean DEFAULT true,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    provider_seats_purchased integer DEFAULT 0 NOT NULL,
    is_trial boolean DEFAULT false NOT NULL,
    trial_end_date date,
    enforcement_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE organization_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organization_settings IS 'Organization-level settings including current plan';


--
-- Name: organization_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organization_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organization_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organization_settings_id_seq OWNED BY public.organization_settings.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    module character varying(50),
    action character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.permissions IS 'RBAC permissions including offerings management permissions';


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: practice_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.practice_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid NOT NULL,
    domain text NOT NULL,
    verification_token text NOT NULL,
    verified_at timestamp with time zone,
    join_policy character varying(16) DEFAULT 'auto_request'::character varying NOT NULL,
    default_role character varying(32) DEFAULT 'staff'::character varying NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT practice_domains_default_role_check CHECK (((default_role)::text = ANY ((ARRAY['staff'::character varying, 'nurse'::character varying, 'doctor'::character varying])::text[]))),
    CONSTRAINT practice_domains_join_policy_check CHECK (((join_policy)::text = ANY ((ARRAY['auto_request'::character varying, 'auto_join'::character varying, 'disabled'::character varying])::text[])))
);


--
-- Name: practice_profile_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.practice_profile_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid NOT NULL,
    kind character varying(12) NOT NULL,
    provider_id uuid,
    mime character varying(16) NOT NULL,
    bytes bytea NOT NULL,
    status character varying(12) DEFAULT 'pending'::character varying NOT NULL,
    uploaded_by uuid,
    reviewed_by uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT practice_profile_photos_kind_check CHECK (((kind)::text = ANY ((ARRAY['cover'::character varying, 'logo'::character varying, 'gallery'::character varying, 'provider'::character varying])::text[]))),
    CONSTRAINT practice_profile_photos_mime_check CHECK (((mime)::text = ANY ((ARRAY['image/jpeg'::character varying, 'image/png'::character varying])::text[]))),
    CONSTRAINT practice_profile_photos_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: practice_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.practice_profiles (
    practice_id uuid NOT NULL,
    visibility character varying(12) DEFAULT 'off'::character varying NOT NULL,
    slug character varying(80),
    random_slug character varying(16),
    use_random_link boolean DEFAULT false NOT NULL,
    display_name character varying(160),
    about text,
    phone character varying(40),
    email character varying(160),
    website character varying(255),
    specialty_codes text[] DEFAULT '{}'::text[] NOT NULL,
    location_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    locations jsonb DEFAULT '[]'::jsonb NOT NULL,
    cover_photo_id uuid,
    logo_photo_id uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT practice_profiles_about_check CHECK ((char_length(about) <= 4000)),
    CONSTRAINT practice_profiles_random_slug_check CHECK (((random_slug)::text ~ '^[A-Za-z0-9]{12,16}$'::text)),
    CONSTRAINT practice_profiles_slug_check CHECK (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
    CONSTRAINT practice_profiles_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['off'::character varying, 'link'::character varying, 'searchable'::character varying])::text[])))
);


--
-- Name: practices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.practices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    tax_id character varying(20),
    phone character varying(20),
    email character varying(255),
    address jsonb,
    plan_tier character varying(20) DEFAULT 'professional'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    country character varying(2),
    timezone character varying(100),
    session_idle_minutes integer,
    require_mfa boolean DEFAULT false NOT NULL,
    setup jsonb DEFAULT '{}'::jsonb NOT NULL,
    npi character varying(10),
    website character varying(200),
    currency character varying(3),
    CONSTRAINT practices_session_idle_minutes_range CHECK (((session_idle_minutes IS NULL) OR ((session_idle_minutes >= 5) AND (session_idle_minutes <= 1440))))
);


--
-- Name: COLUMN practices.country; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.practices.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, CA, GB)';


--
-- Name: COLUMN practices.timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.practices.timezone IS 'IANA timezone string (e.g., America/New_York)';


--
-- Name: COLUMN practices.setup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.practices.setup IS 'Per-practice wizard and specialty state: { onboarding, specialtyCodes, terminology, hiddenModules, favouriteCodes, appliedPacks }. Lives here rather than organization_settings, which holds a single row shared by every tenant.';


--
-- Name: provider_listing_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_listing_consents (
    practice_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    consented boolean DEFAULT false NOT NULL,
    show_photo boolean DEFAULT false NOT NULL,
    show_bio boolean DEFAULT false NOT NULL,
    show_languages boolean DEFAULT false NOT NULL,
    show_specialties boolean DEFAULT true NOT NULL,
    bio text,
    languages text[] DEFAULT '{}'::text[] NOT NULL,
    specialty_codes text[] DEFAULT '{}'::text[] NOT NULL,
    photo_id uuid,
    consent_version character varying(20),
    consented_at timestamp with time zone,
    withdrawn_at timestamp with time zone,
    hidden_by_admin boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT provider_listing_consents_bio_check CHECK ((char_length(bio) <= 1500))
);


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    id uuid NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    specialization character varying(100),
    email character varying(255),
    phone character varying(20),
    license_number character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    specialty_code character varying(60)
);


--
-- Name: TABLE providers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.providers IS 'Provider records. id directly references users.id (provider IS a user). Users can have multiple roles.';


--
-- Name: COLUMN providers.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.providers.id IS 'Primary key - references users.id directly (provider IS a user)';


--
-- Name: COLUMN providers.specialty_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.providers.specialty_code IS 'References public.specialties.code. Added alongside the free-text specialization (expand/contract); neither is dropped until every tenant is migrated.';


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);


--
-- Name: TABLE role_permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.role_permissions IS 'Mapping between roles and their permissions';


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    is_system_role boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.roles IS 'System and custom user roles';


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;




--
-- Name: short_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.short_links (
    code_hash character(64) NOT NULL,
    iv bytea NOT NULL,
    tag bytea NOT NULL,
    target_enc bytea NOT NULL,
    kind character varying(32) DEFAULT 'link'::character varying NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    use_count integer DEFAULT 0 NOT NULL
);


--
-- Name: social_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_auth (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    patient_id uuid,
    provider character varying(20) NOT NULL,
    provider_user_id character varying(255) NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    profile_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: specialties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specialties (
    code character varying(60) NOT NULL,
    name character varying(150) NOT NULL,
    parent_code character varying(60),
    taxonomy_code character varying(20),
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE specialties; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.specialties IS 'Global specialty taxonomy. Reference data shared by every tenant, not per-practice configuration.';


--
-- Name: specialty_packs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specialty_packs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(60) NOT NULL,
    version integer NOT NULL,
    label character varying(150),
    definition jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    clinical_review_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by character varying(255),
    reviewed_at timestamp without time zone,
    published_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT specialty_packs_review_chk CHECK (((clinical_review_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'withdrawn'::character varying])::text[]))),
    CONSTRAINT specialty_packs_version_chk CHECK ((version > 0))
);


--
-- Name: TABLE specialty_packs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.specialty_packs IS 'Declarative specialty content packs. Data, never code: the definition contains no SQL, function references or file paths — see backend/utils/specialtyPackSchema.js.';


--
-- Name: staff_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash character(64) NOT NULL,
    email character varying(255) NOT NULL,
    practice_id uuid NOT NULL,
    role character varying(100) DEFAULT 'staff'::character varying NOT NULL,
    invited_by uuid,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    accepted_by uuid,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone
);


--
-- Name: stripe_integration_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_integration_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_enabled boolean DEFAULT false,
    publishable_key character varying(500),
    secret_key character varying(500),
    webhook_secret character varying(500),
    sandbox_mode boolean DEFAULT true,
    use_platform_integration boolean DEFAULT false,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_tested_at timestamp without time zone,
    test_status character varying(50),
    test_message text
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    price numeric(10,2),
    billing_cycle character varying(20),
    max_users integer,
    max_patients integer,
    features jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    max_providers integer DEFAULT '-1'::integer NOT NULL,
    base_price_per_provider numeric(10,2) DEFAULT NULL::numeric,
    trial_days integer DEFAULT 0 NOT NULL,
    stripe_price_id character varying(255),
    self_serve boolean DEFAULT false NOT NULL,
    stripe_product_id character varying(255),
    currency character varying(3) DEFAULT 'usd'::character varying NOT NULL,
    free_months integer DEFAULT 0 NOT NULL
);


--
-- Name: TABLE subscription_plans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_plans IS 'Available subscription plans';


--
-- Name: subscription_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_plans_id_seq OWNED BY public.subscription_plans.id;


--
-- Name: user_role_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role_history (
    id integer NOT NULL,
    user_id uuid,
    old_role character varying(50),
    new_role character varying(50),
    changed_at timestamp without time zone DEFAULT now(),
    changed_by uuid
);


--
-- Name: user_role_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_role_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_role_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_role_history_id_seq OWNED BY public.user_role_history.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    role_id integer NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id uuid,
    assigned_by uuid
);


--
-- Name: TABLE user_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_roles IS 'Users can have multiple roles';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    name character varying(255),
    role character varying(100) DEFAULT 'user'::character varying,
    practice character varying(255),
    avatar character varying(10),
    email character varying(255),
    phone character varying(20),
    license character varying(50),
    specialty character varying(100),
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    password_hash character varying(255),
    reset_token character varying(255),
    reset_token_expires timestamp without time zone,
    status character varying(20) DEFAULT 'active'::character varying,
    language character varying(10) DEFAULT 'en'::character varying,
    active_role character varying(100),
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country character varying(2),
    timezone character varying(100),
    license_number character varying(100),
    last_login timestamp without time zone,
    token_version integer DEFAULT 0 NOT NULL,
    practice_id uuid,
    mfa_secret text,
    mfa_enabled boolean DEFAULT false NOT NULL,
    mfa_enrolled_at timestamp with time zone,
    mfa_backup_codes text[] DEFAULT '{}'::text[] NOT NULL,
    last_activity_at timestamp with time zone
);


--
-- Name: COLUMN users.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.status IS 'User account status: active (can login), blocked (cannot login), pending (awaiting approval)';


--
-- Name: COLUMN users.language; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.language IS 'User preferred language (en, es, fr, etc.)';


--
-- Name: COLUMN users.active_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.active_role IS 'Currently active role when user has multiple roles';


--
-- Name: COLUMN users.country; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, CA, GB)';


--
-- Name: COLUMN users.timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.timezone IS 'IANA timezone string (e.g., America/New_York)';


--
-- Name: fhir_error_actions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.fhir_error_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    error_code character varying(50) NOT NULL,
    error_pattern text,
    resource_type character varying(50),
    vendor_name character varying(50),
    error_title character varying(255) NOT NULL,
    error_description text,
    error_severity character varying(20) DEFAULT 'error'::character varying,
    suggested_actions jsonb NOT NULL,
    auto_retry boolean DEFAULT false,
    max_retry_attempts integer DEFAULT 0,
    retry_delay_seconds integer DEFAULT 60,
    requires_manual_intervention boolean DEFAULT false,
    escalation_required boolean DEFAULT false,
    resolution_guide text,
    documentation_url character varying(500),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE fhir_error_actions; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.fhir_error_actions IS 'Predefined actions and resolution guides for common FHIR errors';


--
-- Name: fhir_tracking; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.fhir_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fhir_resource_id uuid,
    resource_type character varying(50) NOT NULL,
    resource_reference character varying(255) NOT NULL,
    current_status character varying(50) NOT NULL,
    previous_status character varying(50),
    status_reason text,
    fhir_status character varying(50),
    intent character varying(50),
    priority character varying(20),
    tracking_number character varying(100),
    vendor_name character varying(50),
    vendor_tracking_id character varying(255),
    vendor_status character varying(50),
    sent_to_vendor_at timestamp without time zone,
    vendor_last_updated timestamp without time zone,
    has_errors boolean DEFAULT false,
    error_count integer DEFAULT 0,
    last_error_message text,
    last_error_code character varying(50),
    last_error_at timestamp without time zone,
    error_details jsonb,
    suggested_actions jsonb,
    action_required boolean DEFAULT false,
    action_deadline timestamp without time zone,
    initiated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_resource_type CHECK (((resource_type)::text = ANY (ARRAY[('MedicationRequest'::character varying)::text, ('ServiceRequest'::character varying)::text])))
);


--
-- Name: TABLE fhir_tracking; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.fhir_tracking IS 'End-to-end tracking for FHIR resources (MedicationRequest and ServiceRequest)';


--
-- Name: v_fhir_tracking_errors; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_fhir_tracking_errors AS
 SELECT ft.id,
    ft.resource_type,
    ft.resource_reference,
    ft.tracking_number,
    ft.current_status,
    ft.has_errors,
    ft.error_count,
    ft.last_error_code,
    ft.last_error_message,
    ft.last_error_at,
    ft.suggested_actions,
    ft.action_required,
    ft.action_deadline,
    ea.error_title,
    ea.error_description,
    ea.error_severity,
    ea.requires_manual_intervention,
    ea.resolution_guide,
    ft.vendor_name,
    ft.vendor_tracking_id
   FROM (tenant_default.fhir_tracking ft
     LEFT JOIN tenant_default.fhir_error_actions ea ON (((ft.last_error_code)::text = (ea.error_code)::text)))
  WHERE (ft.has_errors = true);


--
-- Name: fhir_tracking_events; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.fhir_tracking_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fhir_tracking_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    event_category character varying(50),
    from_status character varying(50),
    to_status character varying(50),
    event_description text NOT NULL,
    event_data jsonb,
    is_error boolean DEFAULT false,
    error_code character varying(50),
    error_message text,
    error_severity character varying(20),
    vendor_name character varying(50),
    vendor_response jsonb,
    action_taken text,
    action_result character varying(50),
    triggered_by uuid,
    triggered_by_system character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_event_type CHECK (((event_type)::text = ANY (ARRAY[('status_change'::character varying)::text, ('vendor_sync'::character varying)::text, ('error'::character varying)::text, ('retry'::character varying)::text, ('manual_intervention'::character varying)::text, ('created'::character varying)::text, ('updated'::character varying)::text, ('cancelled'::character varying)::text, ('completed'::character varying)::text, ('sent_to_vendor'::character varying)::text, ('vendor_response'::character varying)::text, ('error_resolved'::character varying)::text, ('action_applied'::character varying)::text])))
);


--
-- Name: TABLE fhir_tracking_events; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.fhir_tracking_events IS 'Event log for all FHIR tracking status changes and interactions';


--
-- Name: v_fhir_tracking_timeline; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_fhir_tracking_timeline AS
 SELECT ft.id AS tracking_id,
    ft.tracking_number,
    ft.resource_type,
    ft.resource_reference,
    fte.id AS event_id,
    fte.event_type,
    fte.event_description,
    fte.from_status,
    fte.to_status,
    fte.is_error,
    fte.error_code,
    fte.error_message,
    fte.error_severity,
    fte.vendor_name,
    fte.action_taken,
    fte.action_result,
    fte.created_at AS event_time
   FROM (tenant_default.fhir_tracking ft
     LEFT JOIN tenant_default.fhir_tracking_events fte ON ((ft.id = fte.fhir_tracking_id)))
  ORDER BY ft.created_at DESC, fte.created_at DESC;


--
-- Name: lab_orders; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.lab_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    order_number character varying(100),
    order_type character varying(50) DEFAULT 'lab_test'::character varying,
    priority character varying(20) DEFAULT 'routine'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    vendor_order_id character varying(255),
    vendor_status character varying(50),
    sent_to_vendor_at timestamp without time zone,
    vendor_response jsonb,
    diagnosis_codes jsonb,
    test_codes jsonb,
    clinical_notes text,
    special_instructions text,
    specimen_type character varying(100),
    collection_date timestamp without time zone,
    collection_site character varying(255),
    results_data jsonb,
    results_received_at timestamp without time zone,
    results_reviewed_by uuid,
    results_reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    laboratory_id uuid,
    linked_diagnosis_id uuid,
    order_status character varying(50) DEFAULT 'one-time'::character varying,
    order_status_date date,
    frequency character varying(50),
    collection_class character varying(50) DEFAULT 'clinic-collect'::character varying,
    result_recipients jsonb DEFAULT '[]'::jsonb,
    fhir_tracking_id uuid,
    camp_id uuid
);


--
-- Name: TABLE lab_orders; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.lab_orders IS 'Laboratory test orders with Labcorp integration support';


--
-- Name: v_lab_order_tracking; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_lab_order_tracking AS
 SELECT lo.id AS lab_order_id,
    lo.patient_id,
    lo.provider_id,
    lo.order_number,
    lo.order_type,
    lo.status AS lab_order_status,
    ft.id AS tracking_id,
    ft.tracking_number,
    ft.current_status AS tracking_status,
    ft.fhir_status,
    ft.priority,
    ft.vendor_name,
    ft.vendor_tracking_id,
    ft.vendor_status,
    ft.has_errors,
    ft.error_count,
    ft.last_error_message,
    ft.suggested_actions,
    ft.action_required,
    ft.initiated_at,
    ft.completed_at,
    lo.created_at AS order_created_at
   FROM (tenant_default.lab_orders lo
     LEFT JOIN tenant_default.fhir_tracking ft ON ((lo.fhir_tracking_id = ft.id)));


--
-- Name: prescriptions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    provider_id uuid,
    appointment_id uuid,
    medication_name character varying(255),
    dosage character varying(100) NOT NULL,
    frequency character varying(100) NOT NULL,
    duration character varying(100),
    instructions text,
    refills integer DEFAULT 0,
    status character varying(50) DEFAULT 'Active'::character varying,
    prescribed_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ndc_code character varying(20),
    drug_strength character varying(50),
    drug_form character varying(50),
    quantity integer,
    days_supply integer,
    daw_code integer DEFAULT 0,
    prior_auth_required boolean DEFAULT false,
    prior_auth_number character varying(50),
    pharmacy_id uuid,
    erx_message_id character varying(100),
    erx_status character varying(50) DEFAULT 'draft'::character varying,
    erx_sent_date timestamp without time zone,
    erx_response_date timestamp without time zone,
    erx_error_message text,
    controlled_substance_class character varying(10),
    prescriber_dea_number character varying(20),
    diagnosis_code character varying(20),
    substitution_allowed boolean DEFAULT true,
    sig_code text,
    notes_to_pharmacist text,
    refills_remaining integer DEFAULT 0,
    last_filled_date date,
    cancelled_reason text,
    cancelled_date timestamp without time zone,
    cancelled_by uuid,
    vendor_prescription_id character varying(255),
    vendor_status character varying(50),
    sent_to_vendor_at timestamp without time zone,
    vendor_response jsonb,
    diagnosis_id uuid,
    fhir_tracking_id uuid,
    camp_id uuid
);


--
-- Name: TABLE prescriptions; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.prescriptions IS 'Stores patient prescriptions with medication details';


--
-- Name: v_prescription_tracking; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_prescription_tracking AS
 SELECT p.id AS prescription_id,
    p.patient_id,
    p.provider_id,
    p.medication_name,
    p.status AS prescription_status,
    ft.id AS tracking_id,
    ft.tracking_number,
    ft.current_status AS tracking_status,
    ft.fhir_status,
    ft.vendor_name,
    ft.vendor_tracking_id,
    ft.vendor_status,
    ft.has_errors,
    ft.error_count,
    ft.last_error_message,
    ft.suggested_actions,
    ft.action_required,
    ft.initiated_at,
    ft.completed_at,
    p.created_at AS prescription_created_at
   FROM (tenant_default.prescriptions p
     LEFT JOIN tenant_default.fhir_tracking ft ON ((p.fhir_tracking_id = ft.id)))
  WHERE ((p.status)::text <> 'Deleted'::text);


--
-- Name: account_ar_aging_snapshots; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.account_ar_aging_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_date date NOT NULL,
    snapshot_type character varying(20) DEFAULT 'patient'::character varying NOT NULL,
    total_ar numeric(15,2) DEFAULT 0.00 NOT NULL,
    current_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    days_1_30 numeric(15,2) DEFAULT 0.00 NOT NULL,
    days_31_60 numeric(15,2) DEFAULT 0.00 NOT NULL,
    days_61_90 numeric(15,2) DEFAULT 0.00 NOT NULL,
    days_91_120 numeric(15,2) DEFAULT 0.00 NOT NULL,
    days_120_plus numeric(15,2) DEFAULT 0.00 NOT NULL,
    total_accounts integer DEFAULT 0 NOT NULL,
    current_count integer DEFAULT 0 NOT NULL,
    days_1_30_count integer DEFAULT 0 NOT NULL,
    days_31_60_count integer DEFAULT 0 NOT NULL,
    days_61_90_count integer DEFAULT 0 NOT NULL,
    days_91_120_count integer DEFAULT 0 NOT NULL,
    days_120_plus_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_ar_aging_snapshots_snapshot_type_check CHECK (((snapshot_type)::text = ANY ((ARRAY['patient'::character varying, 'insurance'::character varying, 'combined'::character varying])::text[])))
);


--
-- Name: account_journal_entries; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.account_journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_number character varying(30) NOT NULL,
    entry_date date NOT NULL,
    post_date date,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    entry_type character varying(30) DEFAULT 'manual'::character varying NOT NULL,
    description text NOT NULL,
    reference_type character varying(30),
    reference_id uuid,
    reference_number character varying(50),
    total_debit numeric(15,2) DEFAULT 0.00 NOT NULL,
    total_credit numeric(15,2) DEFAULT 0.00 NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    is_recurring boolean DEFAULT false NOT NULL,
    recurring_frequency character varying(20),
    next_recurrence date,
    reversal_of uuid,
    notes text,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_by uuid,
    updated_by uuid,
    posted_by uuid,
    voided_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_journal_entries_entry_type_check CHECK (((entry_type)::text = ANY ((ARRAY['manual'::character varying, 'adjusting'::character varying, 'closing'::character varying, 'reversing'::character varying, 'auto_billing'::character varying, 'auto_rcm'::character varying, 'auto_payment'::character varying, 'auto_ar'::character varying, 'auto_ap'::character varying])::text[]))),
    CONSTRAINT account_journal_entries_recurring_frequency_check CHECK (((recurring_frequency)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying, 'quarterly'::character varying, 'yearly'::character varying, NULL::character varying])::text[]))),
    CONSTRAINT account_journal_entries_reference_type_check CHECK (((reference_type)::text = ANY ((ARRAY['invoice'::character varying, 'claim'::character varying, 'payment'::character varying, 'denial'::character varying, 'preapproval'::character varying, 'payment_posting'::character varying, 'quote'::character varying, NULL::character varying])::text[]))),
    CONSTRAINT account_journal_entries_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'posted'::character varying, 'voided'::character varying, 'reversed'::character varying])::text[]))),
    CONSTRAINT chk_je_date_valid CHECK ((entry_date <= (CURRENT_DATE + '1 year'::interval))),
    CONSTRAINT chk_je_description_nonempty CHECK ((length(TRIM(BOTH FROM description)) > 0))
);


--
-- Name: account_journal_lines; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.account_journal_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_entry_id uuid NOT NULL,
    account_id uuid NOT NULL,
    line_number integer NOT NULL,
    entry_type character varying(6) NOT NULL,
    amount numeric(15,2) NOT NULL,
    description text,
    patient_id uuid,
    provider_id uuid,
    department character varying(100),
    cost_center character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_journal_lines_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT account_journal_lines_entry_type_check CHECK (((entry_type)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying])::text[]))),
    CONSTRAINT chk_ajl_line_number CHECK ((line_number > 0))
);


--
-- Name: account_payables; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.account_payables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ap_number character varying(30) NOT NULL,
    ap_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    vendor_name character varying(255) NOT NULL,
    vendor_reference character varying(100),
    account_id uuid,
    invoice_amount numeric(15,2) NOT NULL,
    paid_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    discount_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    balance_due numeric(15,2) GENERATED ALWAYS AS (((invoice_amount - paid_amount) - discount_amount)) STORED,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    payment_date date,
    payment_method character varying(20),
    payment_reference character varying(100),
    bank_account character varying(50),
    expense_category character varying(100),
    department character varying(100),
    notes text,
    attachments jsonb DEFAULT '[]'::jsonb,
    approved_by uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_payables_ap_type_check CHECK (((ap_type)::text = ANY ((ARRAY['vendor'::character varying, 'refund'::character varying, 'employee'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT account_payables_discount_amount_check CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT account_payables_invoice_amount_check CHECK ((invoice_amount > (0)::numeric)),
    CONSTRAINT account_payables_paid_amount_check CHECK ((paid_amount >= (0)::numeric)),
    CONSTRAINT account_payables_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['check'::character varying, 'ach'::character varying, 'wire'::character varying, 'card'::character varying, 'cash'::character varying, NULL::character varying])::text[]))),
    CONSTRAINT account_payables_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'partial'::character varying, 'paid'::character varying, 'voided'::character varying, 'disputed'::character varying])::text[]))),
    CONSTRAINT account_payables_vendor_name_check CHECK ((length(TRIM(BOTH FROM vendor_name)) > 0))
);


--
-- Name: account_receivables; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.account_receivables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ar_number character varying(30) NOT NULL,
    ar_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    patient_id uuid,
    payer_id uuid,
    account_id uuid,
    invoice_id uuid,
    claim_id uuid,
    original_amount numeric(15,2) NOT NULL,
    paid_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    adjusted_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    written_off_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    balance_due numeric(15,2) GENERATED ALWAYS AS ((((original_amount - paid_amount) - adjusted_amount) - written_off_amount)) STORED,
    due_date date NOT NULL,
    service_date date,
    last_payment_date date,
    aging_bucket character varying(20),
    aging_days integer DEFAULT 0,
    collection_stage character varying(30) DEFAULT 'statement'::character varying,
    last_contact_date date,
    notes text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_receivables_aging_bucket_check CHECK (((aging_bucket)::text = ANY ((ARRAY['current'::character varying, '1_30'::character varying, '31_60'::character varying, '61_90'::character varying, '91_120'::character varying, '120_plus'::character varying, NULL::character varying])::text[]))),
    CONSTRAINT account_receivables_aging_days_check CHECK ((aging_days >= 0)),
    CONSTRAINT account_receivables_ar_type_check CHECK (((ar_type)::text = ANY ((ARRAY['patient'::character varying, 'insurance'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT account_receivables_collection_stage_check CHECK (((collection_stage)::text = ANY ((ARRAY['statement'::character varying, 'reminder_1'::character varying, 'reminder_2'::character varying, 'final_notice'::character varying, 'collections'::character varying, 'legal'::character varying, NULL::character varying])::text[]))),
    CONSTRAINT account_receivables_original_amount_check CHECK ((original_amount >= (0)::numeric)),
    CONSTRAINT account_receivables_paid_amount_check CHECK ((paid_amount >= (0)::numeric)),
    CONSTRAINT account_receivables_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'partial'::character varying, 'paid'::character varying, 'written_off'::character varying, 'disputed'::character varying, 'collections'::character varying])::text[]))),
    CONSTRAINT account_receivables_written_off_amount_check CHECK ((written_off_amount >= (0)::numeric))
);


--
-- Name: account_reconciliation_items; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.account_reconciliation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reconciliation_id uuid NOT NULL,
    item_type character varying(20) NOT NULL,
    transaction_date date NOT NULL,
    description text NOT NULL,
    reference_number character varying(100),
    amount numeric(15,2) NOT NULL,
    is_cleared boolean DEFAULT false NOT NULL,
    cleared_date date,
    journal_line_id uuid,
    payment_id uuid,
    invoice_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_reconciliation_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['deposit'::character varying, 'check'::character varying, 'payment'::character varying, 'adjustment'::character varying, 'fee'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: account_reconciliations; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.account_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reconciliation_number character varying(30) NOT NULL,
    account_id uuid NOT NULL,
    reconciliation_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'in_progress'::character varying NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    statement_balance numeric(15,2) NOT NULL,
    system_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    cleared_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    outstanding_deposits numeric(15,2) DEFAULT 0.00 NOT NULL,
    outstanding_checks numeric(15,2) DEFAULT 0.00 NOT NULL,
    discrepancy_amount numeric(15,2) GENERATED ALWAYS AS ((((statement_balance - cleared_balance) - outstanding_deposits) + outstanding_checks)) STORED,
    notes text,
    completed_at timestamp with time zone,
    created_by uuid,
    completed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_reconciliations_reconciliation_type_check CHECK (((reconciliation_type)::text = ANY ((ARRAY['bank'::character varying, 'insurance'::character varying, 'patient'::character varying, 'vendor'::character varying])::text[]))),
    CONSTRAINT account_reconciliations_status_check CHECK (((status)::text = ANY ((ARRAY['in_progress'::character varying, 'completed'::character varying, 'discrepancy'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT chk_rec_period CHECK ((period_end >= period_start))
);


--
-- Name: account_role_permissions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.account_role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name character varying(50) NOT NULL,
    resource character varying(50) NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_create boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    can_approve boolean DEFAULT false NOT NULL,
    can_export boolean DEFAULT false NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_role_permissions_resource_check CHECK (((resource)::text = ANY ((ARRAY['chart_of_accounts'::character varying, 'journal_entries'::character varying, 'accounts_receivable'::character varying, 'accounts_payable'::character varying, 'reconciliation'::character varying, 'statements'::character varying, 'reports'::character varying, 'backup'::character varying, 'archive'::character varying, 'rbac_settings'::character varying])::text[])))
);


--
-- Name: account_statement_items; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.account_statement_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    statement_id uuid NOT NULL,
    item_date date NOT NULL,
    description text NOT NULL,
    item_type character varying(20) NOT NULL,
    reference_type character varying(30),
    reference_id uuid,
    reference_number character varying(50),
    amount numeric(15,2) NOT NULL,
    running_balance numeric(15,2),
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_statement_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['charge'::character varying, 'payment'::character varying, 'adjustment'::character varying, 'credit'::character varying, 'balance_forward'::character varying])::text[])))
);


--
-- Name: account_statements; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.account_statements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    statement_number character varying(30) NOT NULL,
    statement_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    patient_id uuid,
    payer_id uuid,
    recipient_name character varying(255),
    recipient_email character varying(255),
    recipient_address jsonb,
    statement_date date NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    due_date date,
    previous_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    charges numeric(15,2) DEFAULT 0.00 NOT NULL,
    payments numeric(15,2) DEFAULT 0.00 NOT NULL,
    adjustments numeric(15,2) DEFAULT 0.00 NOT NULL,
    current_balance numeric(15,2) GENERATED ALWAYS AS ((((previous_balance + charges) - payments) - adjustments)) STORED,
    sent_at timestamp with time zone,
    viewed_at timestamp with time zone,
    payment_url text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_statements_statement_type_check CHECK (((statement_type)::text = ANY ((ARRAY['patient'::character varying, 'insurance'::character varying, 'vendor'::character varying, 'internal'::character varying])::text[]))),
    CONSTRAINT account_statements_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'viewed'::character varying, 'paid'::character varying, 'disputed'::character varying])::text[]))),
    CONSTRAINT chk_stm_period CHECK ((period_end >= period_start))
);


--
-- Name: accounts; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_number character varying(20) NOT NULL,
    account_name character varying(255) NOT NULL,
    account_type character varying(30) NOT NULL,
    account_subtype character varying(50),
    parent_account_id uuid,
    description text,
    normal_balance character varying(6) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    allow_journal_entries boolean DEFAULT true NOT NULL,
    opening_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    current_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    linked_to_ar boolean DEFAULT false NOT NULL,
    linked_to_ap boolean DEFAULT false NOT NULL,
    linked_to_billing boolean DEFAULT false NOT NULL,
    linked_to_claims boolean DEFAULT false NOT NULL,
    tags text[],
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accounts_account_type_check CHECK (((account_type)::text = ANY ((ARRAY['asset'::character varying, 'liability'::character varying, 'equity'::character varying, 'revenue'::character varying, 'expense'::character varying, 'contra_asset'::character varying, 'contra_liability'::character varying, 'contra_revenue'::character varying])::text[]))),
    CONSTRAINT accounts_currency_check CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT accounts_normal_balance_check CHECK (((normal_balance)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying])::text[]))),
    CONSTRAINT chk_account_name_nonempty CHECK ((length(TRIM(BOTH FROM account_name)) > 0)),
    CONSTRAINT chk_account_number_format CHECK (((account_number)::text ~ '^[0-9A-Z\-]+$'::text))
);


--
-- Name: ai_feature_settings; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.ai_feature_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_key character varying(50) NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    provider character varying(30),
    model character varying(120),
    monthly_request_limit integer,
    monthly_budget_usd numeric(10,2),
    draft_ttl_hours integer DEFAULT 72 NOT NULL,
    enabled_by uuid,
    enabled_at timestamp without time zone,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ai_feature_settings_provider_chk CHECK (((provider IS NULL) OR ((provider)::text = ANY ((ARRAY['anthropic'::character varying, 'openai'::character varying, 'azure_openai'::character varying, 'google_gemini'::character varying, 'mistral'::character varying, 'offline'::character varying])::text[])))),
    CONSTRAINT ai_feature_settings_ttl_chk CHECK (((draft_ttl_hours >= 1) AND (draft_ttl_hours <= 720)))
);


--
-- Name: ai_phi_token_map; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.ai_phi_token_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    token character varying(60) NOT NULL,
    phi_category character varying(30) NOT NULL,
    detection_method character varying(20) DEFAULT 'pattern'::character varying NOT NULL,
    original_ciphertext text NOT NULL,
    original_iv text NOT NULL,
    original_tag text NOT NULL,
    key_version smallint NOT NULL,
    occurrences integer DEFAULT 1 NOT NULL,
    restored_in_response boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ai_phi_token_map_method_chk CHECK (((detection_method)::text = ANY ((ARRAY['record'::character varying, 'pattern'::character varying])::text[])))
);


--
-- Name: ai_provider_credentials; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.ai_provider_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider character varying(30) NOT NULL,
    display_name character varying(120),
    api_key_ciphertext text,
    api_key_iv text,
    api_key_tag text,
    api_key_version smallint,
    api_key_last4 character varying(8),
    base_url text,
    region character varying(50),
    api_version character varying(30),
    default_model character varying(120),
    baa_confirmed boolean DEFAULT false NOT NULL,
    baa_confirmed_by uuid,
    baa_confirmed_at timestamp without time zone,
    zero_data_retention boolean DEFAULT false NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    last_tested_at timestamp without time zone,
    test_status character varying(20),
    test_message text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ai_provider_credentials_provider_chk CHECK (((provider)::text = ANY ((ARRAY['anthropic'::character varying, 'openai'::character varying, 'azure_openai'::character varying, 'google_gemini'::character varying, 'mistral'::character varying, 'offline'::character varying])::text[])))
);


--
-- Name: ai_requests; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.ai_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_key character varying(50) NOT NULL,
    user_id uuid,
    provider character varying(30) NOT NULL,
    model character varying(120) NOT NULL,
    prompt_template_version character varying(20) NOT NULL,
    input_hash character varying(64),
    entity_type character varying(50),
    entity_id character varying(255),
    patient_id uuid,
    phi_tokens_count integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'started'::character varying NOT NULL,
    stop_reason character varying(30),
    input_tokens integer,
    output_tokens integer,
    estimated_cost_usd numeric(12,6),
    latency_ms integer,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    CONSTRAINT ai_requests_status_chk CHECK (((status)::text = ANY ((ARRAY['started'::character varying, 'succeeded'::character varying, 'failed'::character varying, 'refused'::character varying, 'blocked'::character varying])::text[])))
);


--
-- Name: ai_suggestions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.ai_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    feature_key character varying(50) NOT NULL,
    entity_type character varying(50),
    entity_id character varying(255),
    patient_id uuid,
    draft_ciphertext text NOT NULL,
    draft_iv text NOT NULL,
    draft_tag text NOT NULL,
    draft_key_version smallint NOT NULL,
    final_ciphertext text,
    final_iv text,
    final_tag text,
    final_key_version smallint,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    requested_by uuid,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    review_reason text,
    attested boolean DEFAULT false NOT NULL,
    edit_distance_pct numeric(5,2),
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ai_suggestions_reviewer_chk CHECK ((((status)::text = ANY ((ARRAY['pending'::character varying, 'expired'::character varying])::text[])) OR (reviewed_by IS NOT NULL))),
    CONSTRAINT ai_suggestions_status_chk CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'edited'::character varying, 'rejected'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: appointment_reminders; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.appointment_reminders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    appointment_id uuid NOT NULL,
    reminder_type character varying(50) NOT NULL,
    scheduled_for timestamp without time zone NOT NULL,
    sent_at timestamp without time zone,
    delivery_status character varying(50) DEFAULT 'pending'::character varying,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: appointment_type_config; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.appointment_type_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid,
    name character varying(100) NOT NULL,
    description text,
    duration_minutes integer DEFAULT 30 NOT NULL,
    buffer_minutes integer DEFAULT 0,
    color character varying(20) DEFAULT '#3B82F6'::character varying,
    price numeric(10,2) DEFAULT 0.00,
    is_active boolean DEFAULT true,
    requires_approval boolean DEFAULT false,
    max_advance_booking_days integer DEFAULT 90,
    min_advance_booking_hours integer DEFAULT 24,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: appointment_types; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.appointment_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    duration_minutes integer DEFAULT 30,
    color character varying(20) DEFAULT '#3B82F6'::character varying,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_pack character varying(60),
    source_pack_version integer,
    is_customised boolean DEFAULT false NOT NULL,
    department_id uuid
);


--
-- Name: appointment_types_id_seq; Type: SEQUENCE; Schema: tenant_default; Owner: -
--

CREATE SEQUENCE tenant_default.appointment_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: appointment_types_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_default; Owner: -
--

ALTER SEQUENCE tenant_default.appointment_types_id_seq OWNED BY tenant_default.appointment_types.id;


--
-- Name: appointment_types; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.appointment_types (
    id integer DEFAULT nextval('tenant_default.appointment_types_id_seq'::regclass) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    duration_minutes integer DEFAULT 30,
    color character varying(20) DEFAULT '#3B82F6'::character varying,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_pack character varying(60),
    source_pack_version integer,
    is_customised boolean DEFAULT false NOT NULL,
    department_id uuid
);


--
-- Name: appointment_waitlist; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.appointment_waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid,
    preferred_date date NOT NULL,
    preferred_time_start time without time zone,
    preferred_time_end time without time zone,
    appointment_type character varying(100),
    reason text,
    priority integer DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    notified_at timestamp without time zone,
    expires_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT appointment_waitlist_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('notified'::character varying)::text, ('scheduled'::character varying)::text, ('cancelled'::character varying)::text, ('expired'::character varying)::text])))
);


--
-- Name: COLUMN appointment_waitlist.priority; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.appointment_waitlist.priority IS 'Higher priority = contacted first (0 = normal, 1+ = higher priority)';


--
-- Name: COLUMN appointment_waitlist.status; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.appointment_waitlist.status IS 'active: waiting, notified: slot available notification sent, scheduled: appointment booked, cancelled: patient cancelled, expired: notification expired';


--
-- Name: COLUMN appointment_waitlist.expires_at; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.appointment_waitlist.expires_at IS 'Notification expiry time - if not booked by this time, offer to next person';


--
-- Name: appointments; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid,
    patient_id uuid,
    provider_id uuid,
    appointment_type character varying(50),
    status character varying(20) DEFAULT 'scheduled'::character varying,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    duration_minutes integer,
    reason text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    appointment_type_id uuid,
    recurring_appointment_id uuid,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    booking_source character varying(50) DEFAULT 'staff'::character varying,
    confirmation_sent_at timestamp without time zone,
    reminder_sent_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancelled_by uuid,
    cancellation_reason text,
    rescheduled_from uuid,
    no_show_notified_at timestamp without time zone,
    custom_form_data jsonb DEFAULT '{}'::jsonb,
    offering_id uuid,
    package_enrollment_id uuid,
    location_id uuid,
    camp_id uuid,
    meeting_url text
);


--
-- Name: COLUMN appointments.location_id; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.appointments.location_id IS 'Site this appointment happens at. NULL means the tenant primary site.';


--
-- Name: archive_rules; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.archive_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_name character varying(255) NOT NULL,
    description text,
    enabled boolean DEFAULT true,
    selected_modules text[] NOT NULL,
    schedule_type character varying(50) NOT NULL,
    schedule_cron character varying(100),
    schedule_time time without time zone DEFAULT '02:00:00'::time without time zone,
    schedule_day_of_week integer,
    schedule_day_of_month integer,
    retention_days integer,
    retention_criteria jsonb,
    last_run_at timestamp with time zone,
    last_run_status character varying(50),
    last_run_details jsonb,
    next_run_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: COLUMN archive_rules.schedule_type; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.archive_rules.schedule_type IS 'Type of schedule: daily, weekly, monthly, or custom (cron)';


--
-- Name: COLUMN archive_rules.schedule_cron; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.archive_rules.schedule_cron IS 'Cron expression for custom schedules (e.g., "0 2 * * *")';


--
-- Name: COLUMN archive_rules.retention_days; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.archive_rules.retention_days IS 'Archive data older than this many days (null = archive all)';


--
-- Name: COLUMN archive_rules.retention_criteria; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.archive_rules.retention_criteria IS 'Additional filtering criteria for data to archive';


--
-- Name: COLUMN archive_rules.last_run_status; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.archive_rules.last_run_status IS 'Status of last execution: success, failed, or running';


--
-- Name: archives; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.archives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archive_name character varying(255) NOT NULL,
    description text,
    modules text[] NOT NULL,
    archive_data jsonb NOT NULL,
    metadata jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    size_bytes integer,
    record_count integer,
    status character varying(50) DEFAULT 'active'::character varying
);


--
-- Name: COLUMN archives.modules; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.archives.modules IS 'Array of module names included in this archive (e.g., patients, appointments, medical_records)';


--
-- Name: COLUMN archives.archive_data; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.archives.archive_data IS 'Complete archived data organized by module name as keys';


--
-- Name: COLUMN archives.metadata; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.archives.metadata IS 'Statistics and metadata about the archive including record counts per module and timestamp';


--
-- Name: audit_logs; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    user_email character varying(255),
    user_name character varying(255),
    user_role character varying(100),
    session_id character varying(255),
    ip_address character varying(45),
    user_agent text,
    action_type character varying(50) NOT NULL,
    resource_type character varying(100) NOT NULL,
    resource_name character varying(255) NOT NULL,
    resource_id character varying(255),
    action_description text,
    module character varying(100),
    old_values jsonb,
    new_values jsonb,
    changed_fields text[],
    patient_id uuid,
    provider_id uuid,
    appointment_id uuid,
    claim_id uuid,
    status character varying(50) DEFAULT 'success'::character varying,
    error_message text,
    duration_ms integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    retention_days integer DEFAULT 90
);


--
-- Name: COLUMN audit_logs.action_type; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.audit_logs.action_type IS 'Type of action: view, create, update, delete, submit, open, close';


--
-- Name: COLUMN audit_logs.resource_type; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.audit_logs.resource_type IS 'Type of resource: form, modal, view';


--
-- Name: COLUMN audit_logs.resource_name; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.audit_logs.resource_name IS 'Name of the specific form/modal/view component';


--
-- Name: COLUMN audit_logs.changed_fields; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.audit_logs.changed_fields IS 'Array of field names that were modified during update actions';


--
-- Name: COLUMN audit_logs.metadata; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.audit_logs.metadata IS 'Additional context like form validation errors, navigation path, etc.';


--
-- Name: backup_provider_settings; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.backup_provider_settings (
    id integer NOT NULL,
    provider_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT false,
    client_id character varying(255),
    client_secret character varying(255),
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: backup_provider_settings_id_seq; Type: SEQUENCE; Schema: tenant_default; Owner: -
--

CREATE SEQUENCE tenant_default.backup_provider_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: backup_provider_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_default; Owner: -
--

ALTER SEQUENCE tenant_default.backup_provider_settings_id_seq OWNED BY tenant_default.backup_provider_settings.id;


--
-- Name: backup_provider_settings; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.backup_provider_settings (
    id integer DEFAULT nextval('tenant_default.backup_provider_settings_id_seq'::regclass) NOT NULL,
    provider_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT false,
    client_id character varying(255),
    client_secret character varying(255),
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: booking_analytics; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.booking_analytics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid,
    event_type character varying(50) NOT NULL,
    appointment_id uuid,
    appointment_type_id uuid,
    patient_id uuid,
    session_id character varying(100),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: camp_inventory_allocations; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.camp_inventory_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camp_id uuid NOT NULL,
    item_id uuid NOT NULL,
    qty_issued numeric(12,3) NOT NULL,
    qty_consumed numeric(12,3) DEFAULT 0 NOT NULL,
    qty_returned numeric(12,3) DEFAULT 0 NOT NULL,
    issue_movement_id uuid,
    return_movement_id uuid,
    reconciled_at timestamp without time zone,
    reconciled_by uuid,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camp_alloc_balance_chk CHECK (((qty_consumed + qty_returned) <= qty_issued)),
    CONSTRAINT camp_alloc_consumed_chk CHECK ((qty_consumed >= (0)::numeric)),
    CONSTRAINT camp_alloc_issued_chk CHECK ((qty_issued > (0)::numeric)),
    CONSTRAINT camp_alloc_returned_chk CHECK ((qty_returned >= (0)::numeric))
);


--
-- Name: camp_registrations; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.camp_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camp_id uuid NOT NULL,
    token_no integer NOT NULL,
    full_name character varying(255) NOT NULL,
    phone character varying(50),
    email character varying(255),
    age_years integer,
    date_of_birth date,
    gender character varying(20),
    address text,
    city character varying(100),
    consent_given_at timestamp without time zone,
    consent_form_submission_id uuid,
    status character varying(20) DEFAULT 'registered'::character varying NOT NULL,
    patient_id uuid,
    promoted_at timestamp without time zone,
    registered_by uuid,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camp_reg_age_chk CHECK (((age_years IS NOT NULL) OR (date_of_birth IS NOT NULL))),
    CONSTRAINT camp_reg_age_range_chk CHECK (((age_years IS NULL) OR ((age_years >= 0) AND (age_years <= 130)))),
    CONSTRAINT camp_reg_status_chk CHECK (((status)::text = ANY ((ARRAY['registered'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'left_early'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE camp_registrations; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON TABLE template.camp_registrations IS 'Lightweight pre-patient records for camp attendees. Promoted to a patients row on first clinical touch; patient_id is null until then.';


--
-- Name: camp_services; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.camp_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camp_id uuid NOT NULL,
    offering_id uuid,
    label character varying(255),
    is_free boolean DEFAULT true NOT NULL,
    price numeric(12,2),
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camp_services_free_price_chk CHECK ((NOT (is_free AND (price IS NOT NULL) AND (price > (0)::numeric)))),
    CONSTRAINT camp_services_identified_chk CHECK (((offering_id IS NOT NULL) OR (label IS NOT NULL))),
    CONSTRAINT camp_services_price_chk CHECK (((price IS NULL) OR (price >= (0)::numeric)))
);


--
-- Name: camp_staff; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.camp_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camp_id uuid NOT NULL,
    user_id uuid NOT NULL,
    camp_role character varying(30) DEFAULT 'clinician'::character varying NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camp_staff_role_chk CHECK (((camp_role)::text = ANY ((ARRAY['lead'::character varying, 'registrar'::character varying, 'clinician'::character varying, 'nurse'::character varying, 'lab'::character varying, 'pharmacy'::character varying, 'volunteer'::character varying])::text[])))
);


--
-- Name: camp_station_visits; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.camp_station_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    registration_id uuid NOT NULL,
    station_id uuid NOT NULL,
    status character varying(20) DEFAULT 'queued'::character varying NOT NULL,
    queued_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    handled_by uuid,
    outcome character varying(30),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camp_visit_outcome_chk CHECK (((outcome IS NULL) OR ((outcome)::text = ANY ((ARRAY['normal'::character varying, 'referred'::character varying, 'follow_up'::character varying, 'declined'::character varying, 'no_show'::character varying])::text[])))),
    CONSTRAINT camp_visit_status_chk CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'skipped'::character varying])::text[])))
);


--
-- Name: camp_stations; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.camp_stations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camp_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    step_order integer DEFAULT 0 NOT NULL,
    offering_id uuid,
    form_template_id uuid,
    is_clinical boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: campaigns; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.campaigns (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    subject character varying(500),
    email_content text,
    target_audience character varying(100),
    status character varying(50) DEFAULT 'draft'::character varying,
    scheduled_date timestamp without time zone,
    offering_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    camp_id uuid
);


--
-- Name: campaigns_id_seq; Type: SEQUENCE; Schema: tenant_default; Owner: -
--

CREATE SEQUENCE tenant_default.campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_default; Owner: -
--

ALTER SEQUENCE tenant_default.campaigns_id_seq OWNED BY tenant_default.campaigns.id;


--
-- Name: campaigns; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.campaigns (
    id integer DEFAULT nextval('tenant_default.campaigns_id_seq'::regclass) NOT NULL,
    name character varying(255) NOT NULL,
    subject character varying(500),
    email_content text,
    target_audience character varying(100),
    status character varying(50) DEFAULT 'draft'::character varying,
    scheduled_date timestamp without time zone,
    offering_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    camp_id uuid
);


--
-- Name: camps; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.camps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    location_id uuid,
    sponsor_name character varying(255),
    sponsor_contact character varying(255),
    funding_source character varying(30) DEFAULT 'self_funded'::character varying NOT NULL,
    is_free boolean DEFAULT true NOT NULL,
    budget numeric(14,2),
    currency character varying(3),
    starts_at timestamp without time zone NOT NULL,
    ends_at timestamp without time zone NOT NULL,
    timezone character varying(100),
    capacity integer,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    next_token_no integer DEFAULT 1 NOT NULL,
    published_at timestamp without time zone,
    started_at timestamp without time zone,
    closed_at timestamp without time zone,
    closed_by uuid,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camps_budget_chk CHECK (((budget IS NULL) OR (budget >= (0)::numeric))),
    CONSTRAINT camps_capacity_chk CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT camps_funding_chk CHECK (((funding_source)::text = ANY ((ARRAY['self_funded'::character varying, 'sponsored'::character varying, 'government'::character varying, 'ngo'::character varying, 'csr'::character varying])::text[]))),
    CONSTRAINT camps_status_chk CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'in_progress'::character varying, 'closed'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT camps_window_chk CHECK ((ends_at > starts_at))
);


--
-- Name: TABLE camps; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON TABLE template.camps IS 'Medical camps: time-boxed events at a venue, run as a station pipeline. Clinical output is stamped onto the ordinary clinical tables with camp_id.';


--
-- Name: COLUMN camps.next_token_no; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.camps.next_token_no IS 'Next queue token to hand out. Incremented under a row lock on this camp so concurrent registration desks cannot collide.';


--
-- Name: claim_submissions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.claim_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid,
    submission_type character varying(50) DEFAULT 'EDI_837'::character varying,
    submission_date timestamp without time zone NOT NULL,
    submission_id character varying(100),
    clearinghouse_name character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    edi_content text,
    response_code character varying(50),
    response_message text,
    response_date timestamp without time zone,
    acknowledgment_number character varying(100),
    batch_number character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT claim_submissions_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('submitted'::character varying)::text, ('accepted'::character varying)::text, ('rejected'::character varying)::text, ('acknowledged'::character varying)::text]))),
    CONSTRAINT claim_submissions_submission_type_check CHECK (((submission_type)::text = ANY (ARRAY[('EDI_837'::character varying)::text, ('Manual'::character varying)::text, ('Portal'::character varying)::text, ('Fax'::character varying)::text, ('Mail'::character varying)::text])))
);


--
-- Name: COLUMN claim_submissions.submission_type; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.claim_submissions.submission_type IS 'Type of submission (EDI_837, Manual, Portal, etc.)';


--
-- Name: COLUMN claim_submissions.submission_id; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.claim_submissions.submission_id IS 'Unique submission ID from clearinghouse';


--
-- Name: COLUMN claim_submissions.edi_content; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.claim_submissions.edi_content IS 'Full EDI 837 file content for record keeping';


--
-- Name: COLUMN claim_submissions.acknowledgment_number; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.claim_submissions.acknowledgment_number IS '997 Functional Acknowledgment number';


--
-- Name: claims; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid,
    patient_id uuid,
    claim_number character varying(50) NOT NULL,
    payer character varying(255),
    service_date date NOT NULL,
    amount numeric(10,2),
    status character varying(20) DEFAULT 'pending'::character varying,
    diagnosis_codes text[],
    procedure_codes text[],
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    clearinghouse_claim_id character varying(255),
    clearinghouse_status character varying(50),
    submitted_to_clearinghouse_at timestamp without time zone,
    clearinghouse_response jsonb,
    preapproval_id uuid,
    scrub_status character varying(12),
    scrub_result jsonb,
    scrubbed_at timestamp with time zone,
    scrub_override_by uuid,
    scrub_override_reason text
);


--
-- Name: clinic_appointment_settings; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.clinic_appointment_settings (
    id integer NOT NULL,
    default_duration integer DEFAULT 30,
    slot_interval integer DEFAULT 15,
    max_advance_booking integer DEFAULT 90,
    cancellation_deadline integer DEFAULT 24,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: clinic_appointment_settings_id_seq; Type: SEQUENCE; Schema: tenant_default; Owner: -
--

CREATE SEQUENCE tenant_default.clinic_appointment_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clinic_appointment_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_default; Owner: -
--

ALTER SEQUENCE tenant_default.clinic_appointment_settings_id_seq OWNED BY tenant_default.clinic_appointment_settings.id;


--
-- Name: clinic_appointment_settings; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.clinic_appointment_settings (
    id integer DEFAULT nextval('tenant_default.clinic_appointment_settings_id_seq'::regclass) NOT NULL,
    default_duration integer DEFAULT 30,
    slot_interval integer DEFAULT 15,
    max_advance_booking integer DEFAULT 90,
    cancellation_deadline integer DEFAULT 24,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: clinic_info; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.clinic_info (
    id integer NOT NULL,
    name character varying(255) DEFAULT 'Medical Practice'::character varying,
    address text,
    phone character varying(50),
    email character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: clinic_info_id_seq; Type: SEQUENCE; Schema: tenant_default; Owner: -
--

CREATE SEQUENCE tenant_default.clinic_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clinic_info_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_default; Owner: -
--

ALTER SEQUENCE tenant_default.clinic_info_id_seq OWNED BY tenant_default.clinic_info.id;


--
-- Name: clinic_info; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.clinic_info (
    id integer DEFAULT nextval('tenant_default.clinic_info_id_seq'::regclass) NOT NULL,
    name character varying(255) DEFAULT 'Medical Practice'::character varying,
    address text,
    phone character varying(50),
    email character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: clinic_working_hours; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.clinic_working_hours (
    id integer NOT NULL,
    day character varying(20) NOT NULL,
    is_working boolean DEFAULT true,
    start_time time without time zone,
    end_time time without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_id uuid
);


--
-- Name: clinic_working_hours_id_seq; Type: SEQUENCE; Schema: tenant_default; Owner: -
--

CREATE SEQUENCE tenant_default.clinic_working_hours_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clinic_working_hours_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_default; Owner: -
--

ALTER SEQUENCE tenant_default.clinic_working_hours_id_seq OWNED BY tenant_default.clinic_working_hours.id;


--
-- Name: clinic_working_hours; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.clinic_working_hours (
    id integer DEFAULT nextval('tenant_default.clinic_working_hours_id_seq'::regclass) NOT NULL,
    day character varying(20) NOT NULL,
    is_working boolean DEFAULT true,
    start_time time without time zone,
    end_time time without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_id uuid
);


--
-- Name: denials; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.denials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    denial_number character varying(50) NOT NULL,
    claim_id uuid,
    patient_id uuid,
    insurance_payer_id uuid,
    denial_date date NOT NULL,
    denial_amount numeric(10,2) NOT NULL,
    denied_service_date date,
    denial_reason_code character varying(50),
    denial_reason_description text,
    denial_category character varying(100),
    appeal_status character varying(50) DEFAULT 'not_appealed'::character varying,
    appeal_deadline date,
    appeal_submitted_date date,
    appeal_decision_date date,
    appeal_outcome character varying(50),
    appeal_amount_recovered numeric(10,2) DEFAULT 0,
    status character varying(50) DEFAULT 'open'::character varying,
    resolution_date date,
    resolution_notes text,
    eob_number character varying(100),
    era_number character varying(100),
    supporting_documents jsonb,
    assigned_to character varying(255),
    priority character varying(20) DEFAULT 'medium'::character varying,
    notes text,
    internal_notes text,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT denials_appeal_status_check CHECK (((appeal_status)::text = ANY (ARRAY[('not_appealed'::character varying)::text, ('appeal_pending'::character varying)::text, ('appeal_submitted'::character varying)::text, ('appeal_approved'::character varying)::text, ('appeal_denied'::character varying)::text, ('appeal_withdrawn'::character varying)::text]))),
    CONSTRAINT denials_denial_category_check CHECK (((denial_category)::text = ANY (ARRAY[('Medical Necessity'::character varying)::text, ('Prior Authorization Required'::character varying)::text, ('Timely Filing'::character varying)::text, ('Coordination of Benefits'::character varying)::text, ('Duplicate Claim'::character varying)::text, ('Invalid/Missing Information'::character varying)::text, ('Non-Covered Service'::character varying)::text, ('Patient Eligibility'::character varying)::text, ('Coding Error'::character varying)::text, ('Other'::character varying)::text]))),
    CONSTRAINT denials_priority_check CHECK (((priority)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('urgent'::character varying)::text]))),
    CONSTRAINT denials_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('under_review'::character varying)::text, ('appealing'::character varying)::text, ('resolved'::character varying)::text, ('written_off'::character varying)::text, ('patient_responsibility'::character varying)::text])))
);


--
-- Name: COLUMN denials.denial_number; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.denials.denial_number IS 'Unique identifier for the denial (e.g., DEN-2024-000001)';


--
-- Name: COLUMN denials.denial_category; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.denials.denial_category IS 'Category of denial reason for reporting and analysis';


--
-- Name: COLUMN denials.appeal_deadline; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.denials.appeal_deadline IS 'Deadline for submitting appeal (auto-calculated as 90 days from denial date)';


--
-- Name: COLUMN denials.supporting_documents; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.denials.supporting_documents IS 'JSON array of document references for appeal';


--
-- Name: COLUMN denials.priority; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.denials.priority IS 'Priority level for denial management';


--
-- Name: diagnoses; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.diagnoses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid,
    diagnosis_name character varying(255),
    diagnosis_code character varying(50),
    description text,
    severity character varying(50),
    status character varying(50) DEFAULT 'Active'::character varying,
    diagnosed_date date,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: diagnosis; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.diagnosis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    provider_id uuid,
    appointment_id uuid,
    diagnosis_code character varying(20),
    diagnosis_name character varying(255) NOT NULL,
    severity character varying(50),
    status character varying(50) DEFAULT 'Active'::character varying,
    diagnosed_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    soap_notes text,
    camp_id uuid
);


--
-- Name: COLUMN diagnosis.soap_notes; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.diagnosis.soap_notes IS 'SOAP notes: Subjective, Objective, Assessment, and Plan documentation for the diagnosis';


--
-- Name: doctor_availability; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.doctor_availability (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_available boolean DEFAULT true,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_id uuid,
    CONSTRAINT check_time_order CHECK ((end_time > start_time)),
    CONSTRAINT doctor_availability_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: doctor_time_off; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.doctor_time_off (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    reason character varying(500),
    is_recurring boolean DEFAULT false,
    recurrence_rule character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_date_order CHECK ((end_date >= start_date))
);


--
-- Name: eligibility_checks; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.eligibility_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    claim_id uuid,
    payer_id uuid,
    payer_name character varying(200),
    member_id character varying(80),
    service_date date NOT NULL,
    service_type character varying(10) DEFAULT '30'::character varying NOT NULL,
    status character varying(12) NOT NULL,
    coverage jsonb DEFAULT '{}'::jsonb NOT NULL,
    message text,
    vendor_reference character varying(120),
    checked_by uuid,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT eligibility_checks_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'unknown'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: erx_message_queue; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.erx_message_queue (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prescription_id uuid,
    message_type character varying(50) NOT NULL,
    message_direction character varying(20) NOT NULL,
    pharmacy_id uuid,
    message_payload jsonb NOT NULL,
    message_status character varying(50) DEFAULT 'pending'::character varying,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    error_message text,
    sent_date timestamp without time zone,
    delivered_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: fhir_error_actions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.fhir_error_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    error_code character varying(50) NOT NULL,
    error_pattern text,
    resource_type character varying(50),
    vendor_name character varying(50),
    error_title character varying(255) NOT NULL,
    error_description text,
    error_severity character varying(20) DEFAULT 'error'::character varying,
    suggested_actions jsonb NOT NULL,
    auto_retry boolean DEFAULT false,
    max_retry_attempts integer DEFAULT 0,
    retry_delay_seconds integer DEFAULT 60,
    requires_manual_intervention boolean DEFAULT false,
    escalation_required boolean DEFAULT false,
    resolution_guide text,
    documentation_url character varying(500),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: fhir_resources; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.fhir_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id character varying(100) NOT NULL,
    patient_id uuid,
    fhir_version character varying(10) DEFAULT 'R4'::character varying,
    resource_data jsonb NOT NULL,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: fhir_tracking; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.fhir_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fhir_resource_id uuid,
    resource_type character varying(50) NOT NULL,
    resource_reference character varying(255) NOT NULL,
    current_status character varying(50) NOT NULL,
    previous_status character varying(50),
    status_reason text,
    fhir_status character varying(50),
    intent character varying(50),
    priority character varying(20),
    tracking_number character varying(100),
    vendor_name character varying(50),
    vendor_tracking_id character varying(255),
    vendor_status character varying(50),
    sent_to_vendor_at timestamp without time zone,
    vendor_last_updated timestamp without time zone,
    has_errors boolean DEFAULT false,
    error_count integer DEFAULT 0,
    last_error_message text,
    last_error_code character varying(50),
    last_error_at timestamp without time zone,
    error_details jsonb,
    suggested_actions jsonb,
    action_required boolean DEFAULT false,
    action_deadline timestamp without time zone,
    initiated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_resource_type CHECK (((resource_type)::text = ANY (ARRAY[('MedicationRequest'::character varying)::text, ('ServiceRequest'::character varying)::text])))
);


--
-- Name: fhir_tracking_events; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.fhir_tracking_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fhir_tracking_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    event_category character varying(50),
    from_status character varying(50),
    to_status character varying(50),
    event_description text NOT NULL,
    event_data jsonb,
    is_error boolean DEFAULT false,
    error_code character varying(50),
    error_message text,
    error_severity character varying(20),
    vendor_name character varying(50),
    vendor_response jsonb,
    action_taken text,
    action_result character varying(50),
    triggered_by uuid,
    triggered_by_system character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_event_type CHECK (((event_type)::text = ANY (ARRAY[('status_change'::character varying)::text, ('vendor_sync'::character varying)::text, ('error'::character varying)::text, ('retry'::character varying)::text, ('manual_intervention'::character varying)::text, ('created'::character varying)::text, ('updated'::character varying)::text, ('cancelled'::character varying)::text, ('completed'::character varying)::text, ('sent_to_vendor'::character varying)::text, ('vendor_response'::character varying)::text, ('error_resolved'::character varying)::text, ('action_applied'::character varying)::text])))
);


--
-- Name: form_audit_logs; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.form_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    actor_id uuid,
    actor_role character varying(50),
    actor_name character varying(255),
    patient_id uuid,
    previous_state jsonb,
    new_state jsonb,
    change_details jsonb,
    ip_address inet,
    user_agent text,
    session_id character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: form_categories; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.form_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    color character varying(50),
    icon character varying(50),
    parent_id uuid,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: form_signatures; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.form_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    signer_name character varying(255) NOT NULL,
    signer_role character varying(100),
    signer_user_id uuid,
    signature_data text NOT NULL,
    signature_type character varying(50) DEFAULT 'drawn'::character varying,
    is_witness boolean DEFAULT false,
    relation character varying(100),
    ip_address inet,
    user_agent text,
    signed_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: form_submissions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    template_name character varying(255),
    template_version character varying(20),
    patient_id uuid,
    appointment_id uuid,
    intake_flow_id uuid,
    submitted_by uuid,
    submitted_by_role character varying(50),
    form_data jsonb DEFAULT '{}'::jsonb,
    status character varying(50) DEFAULT 'draft'::character varying,
    language character varying(10) DEFAULT 'en'::character varying,
    ip_address inet,
    user_agent text,
    submitted_at timestamp without time zone,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    reviewer_notes text,
    expires_at timestamp without time zone,
    is_signed boolean DEFAULT false,
    fhir_response jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    source character varying(30) DEFAULT 'template'::character varying,
    source_message_id uuid,
    document_attachment_id uuid,
    document_name character varying(255),
    document_action character varying(20) DEFAULT 'acknowledge'::character varying,
    CONSTRAINT form_submissions_document_action_check CHECK (((document_action IS NULL) OR ((document_action)::text = ANY ((ARRAY['acknowledge'::character varying, 'sign'::character varying])::text[])))),
    CONSTRAINT form_submissions_has_subject CHECK (((template_id IS NOT NULL) OR (document_attachment_id IS NOT NULL))),
    CONSTRAINT form_submissions_source_check CHECK (((source)::text = ANY ((ARRAY['template'::character varying, 'secure_message'::character varying])::text[])))
);


--
-- Name: form_template_versions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.form_template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    version character varying(20) NOT NULL,
    version_number integer NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    fhir_questionnaire jsonb,
    change_summary text,
    changed_by uuid,
    is_published boolean DEFAULT false,
    published_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: form_templates; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.form_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255),
    description text,
    category_id uuid,
    category_slug character varying(100),
    subcategory character varying(100),
    template_type character varying(100),
    is_system_template boolean DEFAULT false,
    is_active boolean DEFAULT true,
    version character varying(20) DEFAULT '1.0'::character varying,
    version_number integer DEFAULT 1,
    fields jsonb DEFAULT '[]'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    fhir_questionnaire jsonb,
    role_visibility jsonb DEFAULT '["admin", "provider", "staff", "patient"]'::jsonb,
    require_signature boolean DEFAULT false,
    require_witness boolean DEFAULT false,
    allow_pdf_export boolean DEFAULT true,
    languages jsonb DEFAULT '["en"]'::jsonb,
    translations jsonb DEFAULT '{}'::jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    intake_flow_eligible boolean DEFAULT true,
    specialty character varying(100),
    compliance_tags jsonb DEFAULT '[]'::jsonb,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    source_pack character varying(60),
    source_pack_version integer,
    is_customised boolean DEFAULT false NOT NULL,
    department_id uuid
);


--
-- Name: healthcare_offerings; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.healthcare_offerings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id uuid,
    duration_minutes integer,
    requires_preparation boolean DEFAULT false,
    preparation_instructions text,
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    available_online boolean DEFAULT true,
    requires_referral boolean DEFAULT false,
    cpt_codes text[],
    icd_codes text[],
    hcpcs_codes text[],
    min_age integer,
    max_age integer,
    gender_restriction character varying(20),
    contraindications text,
    prerequisites text,
    allowed_provider_specializations text[],
    image_url text,
    video_url text,
    brochure_url text,
    consent_form_required boolean DEFAULT false,
    consent_form_url text,
    seo_title character varying(255),
    seo_description text,
    seo_keywords text[],
    view_count integer DEFAULT 0,
    booking_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    consent_form_id uuid,
    source_pack character varying(60),
    source_pack_version integer,
    is_customised boolean DEFAULT false NOT NULL,
    department_id uuid
);


--
-- Name: COLUMN healthcare_offerings.is_customised; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.healthcare_offerings.is_customised IS 'True once a user has edited this row. A pack upgrade never overwrites a customised row; it reports it as a conflict instead.';


--
-- Name: COLUMN healthcare_offerings.department_id; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.healthcare_offerings.department_id IS 'Reserved for department-level configuration (multi-specialty hospitals). NULL means practice-wide.';


--
-- Name: insurance_payers; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.insurance_payers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    payer_id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    payer_type character varying(50) DEFAULT 'insurance'::character varying,
    phone character varying(50),
    email character varying(255),
    website character varying(255),
    address text,
    city character varying(100),
    state character varying(50),
    zip_code character varying(20),
    contact_person character varying(255),
    contact_phone character varying(50),
    contact_email character varying(255),
    claim_submission_method character varying(50),
    claim_submission_address text,
    electronic_payer_id character varying(100),
    timely_filing_limit integer DEFAULT 365,
    prior_authorization_required boolean DEFAULT false,
    accepts_assignment boolean DEFAULT true,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: COLUMN insurance_payers.payer_id; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.insurance_payers.payer_id IS 'Unique identifier for the payer (e.g., BC001)';


--
-- Name: COLUMN insurance_payers.electronic_payer_id; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.insurance_payers.electronic_payer_id IS 'EDI payer ID for electronic claims submission';


--
-- Name: COLUMN insurance_payers.timely_filing_limit; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.insurance_payers.timely_filing_limit IS 'Number of days within which claims must be filed';


--
-- Name: intake_flow_templates; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.intake_flow_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flow_id uuid NOT NULL,
    template_id uuid NOT NULL,
    step_order integer DEFAULT 0 NOT NULL,
    is_required boolean DEFAULT true,
    is_conditional boolean DEFAULT false,
    condition_rules jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: inventory_categories; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.inventory_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    parent_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_pack character varying(60),
    source_pack_version integer,
    is_customised boolean DEFAULT false NOT NULL,
    department_id uuid,
    CONSTRAINT chk_inv_cat_code_nonempty CHECK ((length(TRIM(BOTH FROM code)) > 0)),
    CONSTRAINT chk_inv_cat_name_nonempty CHECK ((length(TRIM(BOTH FROM name)) > 0))
);


--
-- Name: inventory_items; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_number character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id uuid,
    supplier_id uuid,
    unit_of_measure character varying(20) NOT NULL,
    item_type character varying(30) NOT NULL,
    sku character varying(50),
    barcode character varying(100),
    unit_cost numeric(15,2) NOT NULL,
    selling_price numeric(15,2),
    quantity_on_hand numeric(12,3) DEFAULT 0 NOT NULL,
    quantity_reserved numeric(12,3) DEFAULT 0 NOT NULL,
    quantity_on_order numeric(12,3) DEFAULT 0 NOT NULL,
    reorder_level numeric(12,3) DEFAULT 0 NOT NULL,
    reorder_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    expiry_date date,
    lot_number character varying(50),
    is_lot_tracked boolean DEFAULT false NOT NULL,
    is_expiry_tracked boolean DEFAULT false NOT NULL,
    requires_refrigeration boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    linked_account_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    low_stock_alerted_at timestamp with time zone,
    CONSTRAINT chk_inv_item_name_nonempty CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT chk_inv_item_number_format CHECK (((item_number)::text ~ '^[A-Z0-9\-]+$'::text)),
    CONSTRAINT chk_inv_item_qty_on_hand CHECK ((quantity_on_hand >= (0)::numeric)),
    CONSTRAINT chk_inv_item_qty_on_order CHECK ((quantity_on_order >= (0)::numeric)),
    CONSTRAINT chk_inv_item_qty_reserved CHECK ((quantity_reserved >= (0)::numeric)),
    CONSTRAINT chk_inv_item_reorder_level CHECK ((reorder_level >= (0)::numeric)),
    CONSTRAINT chk_inv_item_reorder_qty CHECK ((reorder_quantity >= (0)::numeric)),
    CONSTRAINT inventory_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['medication'::character varying, 'supply'::character varying, 'equipment'::character varying, 'consumable'::character varying, 'reagent'::character varying, 'implant'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT inventory_items_selling_price_check CHECK (((selling_price IS NULL) OR (selling_price >= (0)::numeric))),
    CONSTRAINT inventory_items_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'discontinued'::character varying, 'out_of_stock'::character varying])::text[]))),
    CONSTRAINT inventory_items_unit_cost_check CHECK ((unit_cost >= (0)::numeric)),
    CONSTRAINT inventory_items_unit_of_measure_check CHECK (((unit_of_measure)::text = ANY ((ARRAY['unit'::character varying, 'pack'::character varying, 'box'::character varying, 'kg'::character varying, 'g'::character varying, 'l'::character varying, 'ml'::character varying, 'each'::character varying, 'dozen'::character varying, 'case'::character varying])::text[])))
);


--
-- Name: inventory_purchase_orders; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.inventory_purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number character varying(30) NOT NULL,
    supplier_id uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_date date,
    received_date date,
    total_amount numeric(15,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
    shipping_amount numeric(15,2) DEFAULT 0 NOT NULL,
    notes text,
    linked_account_id uuid,
    approved_by uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_inv_po_expected_date CHECK (((expected_date IS NULL) OR (expected_date >= order_date))),
    CONSTRAINT inventory_purchase_orders_shipping_amount_check CHECK ((shipping_amount >= (0)::numeric)),
    CONSTRAINT inventory_purchase_orders_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'approved'::character varying, 'partially_received'::character varying, 'received'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT inventory_purchase_orders_tax_amount_check CHECK ((tax_amount >= (0)::numeric)),
    CONSTRAINT inventory_purchase_orders_total_amount_check CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: inventory_role_permissions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.inventory_role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name character varying(50) NOT NULL,
    resource character varying(50) NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_create boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    can_approve boolean DEFAULT false NOT NULL,
    can_export boolean DEFAULT false NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_role_permissions_resource_check CHECK (((resource)::text = ANY ((ARRAY['items'::character varying, 'categories'::character varying, 'suppliers'::character varying, 'stock_movements'::character varying, 'purchase_orders'::character varying])::text[])))
);


--
-- Name: inventory_stock_movements; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.inventory_stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    movement_number character varying(30) NOT NULL,
    item_id uuid NOT NULL,
    movement_type character varying(30) NOT NULL,
    reference_type character varying(30),
    reference_id uuid,
    quantity numeric(12,3) NOT NULL,
    unit_cost numeric(15,2),
    lot_number character varying(50),
    expiry_date date,
    movement_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    balance_after numeric(12,3),
    journal_entry_id uuid,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    location_id uuid,
    CONSTRAINT chk_inv_mov_quantity_nonzero CHECK ((quantity <> (0)::numeric)),
    CONSTRAINT inventory_stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['receipt'::character varying, 'issue'::character varying, 'adjustment'::character varying, 'transfer'::character varying, 'return'::character varying, 'write_off'::character varying, 'opening'::character varying])::text[]))),
    CONSTRAINT inventory_stock_movements_reference_type_check CHECK (((reference_type IS NULL) OR ((reference_type)::text = ANY ((ARRAY['purchase_order'::character varying, 'patient'::character varying, 'department'::character varying, 'adjustment'::character varying, 'camp'::character varying])::text[]))))
);


--
-- Name: COLUMN inventory_stock_movements.location_id; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.inventory_stock_movements.location_id IS 'Site this stock movement happened at. NULL means the tenant primary site.';


--
-- Name: inventory_suppliers; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.inventory_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_number character varying(20),
    name character varying(255) NOT NULL,
    contact_name character varying(100),
    email character varying(255),
    phone character varying(30),
    address text,
    city character varying(100),
    country character varying(3),
    payment_terms character varying(30),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    tax_id character varying(50),
    notes text,
    linked_account_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_inv_sup_name_nonempty CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT inventory_suppliers_email_check CHECK (((email IS NULL) OR ((email)::text ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'::text))),
    CONSTRAINT inventory_suppliers_payment_terms_check CHECK (((payment_terms IS NULL) OR ((payment_terms)::text = ANY ((ARRAY['net_30'::character varying, 'net_60'::character varying, 'net_90'::character varying, 'immediate'::character varying, 'custom'::character varying])::text[])))),
    CONSTRAINT inventory_suppliers_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'blacklisted'::character varying])::text[])))
);


--
-- Name: lab_orders; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.lab_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    order_number character varying(100),
    order_type character varying(50) DEFAULT 'lab_test'::character varying,
    priority character varying(20) DEFAULT 'routine'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    vendor_order_id character varying(255),
    vendor_status character varying(50),
    sent_to_vendor_at timestamp without time zone,
    vendor_response jsonb,
    diagnosis_codes jsonb,
    test_codes jsonb,
    clinical_notes text,
    special_instructions text,
    specimen_type character varying(100),
    collection_date timestamp without time zone,
    collection_site character varying(255),
    results_data jsonb,
    results_received_at timestamp without time zone,
    results_reviewed_by uuid,
    results_reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    laboratory_id uuid,
    linked_diagnosis_id uuid,
    order_status character varying(50) DEFAULT 'one-time'::character varying,
    order_status_date date,
    frequency character varying(50),
    collection_class character varying(50) DEFAULT 'clinic-collect'::character varying,
    result_recipients jsonb DEFAULT '[]'::jsonb,
    fhir_tracking_id uuid,
    camp_id uuid
);


--
-- Name: laboratories; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.laboratories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lab_name character varying(255) NOT NULL,
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(2),
    zip_code character varying(10),
    phone character varying(20),
    fax character varying(20),
    email character varying(255),
    website character varying(255),
    clia_number character varying(50),
    npi character varying(20),
    is_active boolean DEFAULT true,
    accepts_electronic_orders boolean DEFAULT true,
    specialty character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: locations; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    location_type character varying(30) DEFAULT 'clinic'::character varying NOT NULL,
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(2),
    postal_code character varying(20),
    phone character varying(50),
    email character varying(255),
    latitude numeric(9,6),
    longitude numeric(9,6),
    timezone character varying(100),
    notes text,
    is_primary boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT locations_type_chk CHECK (((location_type)::text = ANY ((ARRAY['clinic'::character varying, 'camp'::character varying, 'mobile'::character varying, 'partner'::character varying])::text[])))
);


--
-- Name: TABLE locations; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON TABLE template.locations IS 'Physical sites belonging to this tenant: clinics, branches, camp venues, mobile units. Exactly one row is is_primary.';


--
-- Name: COLUMN locations.location_type; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.locations.location_type IS 'clinic = owned premises, camp = temporary off-site venue, mobile = vehicle/van, partner = third-party premises';


--
-- Name: medical_records; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.medical_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    provider_id uuid,
    record_type character varying(50) NOT NULL,
    record_date date NOT NULL,
    title character varying(255),
    description text,
    diagnosis text,
    treatment text,
    medications jsonb,
    attachments jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source character varying(30) DEFAULT 'manual'::character varying,
    source_message_id uuid,
    review_status character varying(20),
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    reviewer_notes text,
    camp_id uuid,
    CONSTRAINT medical_records_review_status_check CHECK (((review_status IS NULL) OR ((review_status)::text = ANY ((ARRAY['pending_review'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[]))))
);


--
-- Name: module_permissions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.module_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module character varying(50) NOT NULL,
    role_name character varying(50) NOT NULL,
    resource character varying(60) NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_create boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    can_approve boolean DEFAULT false NOT NULL,
    can_export boolean DEFAULT false NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE module_permissions; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON TABLE template.module_permissions IS 'Fine-grained access control: one row per (module, role, resource) with six action flags. Absence of a row is NOT a denial — see middleware/modulePermissions.js, which falls back to the role defaults so a practice that has never opened the permissions screen keeps working.';


--
-- Name: COLUMN module_permissions.module; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.module_permissions.module IS 'Module key from utils/permissionRegistry.js. Not constrained here on purpose; the route validates against the registry.';


--
-- Name: notification_preferences; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.notification_preferences (
    id integer NOT NULL,
    patient_id uuid NOT NULL,
    channel_type character varying(20) NOT NULL,
    is_enabled boolean DEFAULT true,
    contact_info character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE notification_preferences; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.notification_preferences IS 'Patient notification preferences for different channels (email, sms, whatsapp)';


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE; Schema: tenant_default; Owner: -
--

CREATE SEQUENCE tenant_default.notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_default; Owner: -
--

ALTER SEQUENCE tenant_default.notification_preferences_id_seq OWNED BY tenant_default.notification_preferences.id;


--
-- Name: notification_preferences; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.notification_preferences (
    id integer DEFAULT nextval('tenant_default.notification_preferences_id_seq'::regclass) NOT NULL,
    patient_id uuid NOT NULL,
    channel_type character varying(20) NOT NULL,
    is_enabled boolean DEFAULT true,
    contact_info character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: notifications; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.notifications (
    id integer NOT NULL,
    type character varying(50),
    message text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id uuid
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: tenant_default; Owner: -
--

CREATE SEQUENCE tenant_default.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_default; Owner: -
--

ALTER SEQUENCE tenant_default.notifications_id_seq OWNED BY tenant_default.notifications.id;


--
-- Name: notifications; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.notifications (
    id integer DEFAULT nextval('tenant_default.notifications_id_seq'::regclass) NOT NULL,
    type character varying(50),
    message text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id uuid
);


--
-- Name: offering_form_links; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.offering_form_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid NOT NULL,
    form_template_id text NOT NULL,
    form_template_name character varying(255),
    trigger_on character varying(50) DEFAULT 'order'::character varying,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: offering_insurance_mappings; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.offering_insurance_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid,
    insurance_provider character varying(255) NOT NULL,
    insurance_plan character varying(255),
    is_covered boolean DEFAULT true,
    coverage_percentage numeric(5,2),
    copay_amount numeric(10,2),
    deductible_applies boolean DEFAULT false,
    requires_preauthorization boolean DEFAULT false,
    preauth_phone character varying(50),
    preauth_instructions text,
    primary_cpt_code character varying(20),
    modifier_codes text[],
    diagnosis_codes_required text[],
    coverage_notes text,
    billing_notes text,
    is_active boolean DEFAULT true,
    effective_from date,
    effective_until date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: offering_packages; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.offering_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id uuid,
    package_type character varying(50) DEFAULT 'bundle'::character varying,
    validity_days integer,
    max_uses integer,
    base_price numeric(10,2),
    discount_percentage numeric(5,2),
    final_price numeric(10,2),
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    available_from date,
    available_until date,
    benefits text[],
    features text[],
    image_url text,
    terms_and_conditions text,
    enrollment_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: offering_pricing; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.offering_pricing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid,
    pricing_type character varying(50) NOT NULL,
    pricing_name character varying(255),
    base_price numeric(10,2) NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    final_price numeric(10,2),
    insurance_provider character varying(255),
    copay_amount numeric(10,2),
    requires_preauthorization boolean DEFAULT false,
    effective_from date,
    effective_until date,
    is_active boolean DEFAULT true,
    additional_fees jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: offering_promotions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.offering_promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    promo_code character varying(50),
    discount_type character varying(20),
    discount_value numeric(10,2),
    applicable_to character varying(20) DEFAULT 'all'::character varying,
    offering_ids uuid[],
    package_ids uuid[],
    category_ids uuid[],
    valid_from timestamp without time zone,
    valid_until timestamp without time zone,
    max_uses integer,
    max_uses_per_patient integer DEFAULT 1,
    current_uses integer DEFAULT 0,
    min_purchase_amount numeric(10,2),
    new_patients_only boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: offering_reviews; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.offering_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid,
    patient_id uuid,
    appointment_id uuid,
    rating integer,
    review_text text,
    is_approved boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    moderated_by uuid,
    moderated_at timestamp without time zone,
    provider_response text,
    response_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: package_offerings; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.package_offerings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    package_id uuid,
    offering_id uuid,
    quantity_included integer DEFAULT 1,
    is_optional boolean DEFAULT false,
    display_order integer DEFAULT 0,
    price_override numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_allergies; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.patient_allergies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid,
    allergen_type character varying(50) NOT NULL,
    allergen_name character varying(255) NOT NULL,
    ndc_code character varying(20),
    reaction_type character varying(100),
    severity character varying(50),
    onset_date date,
    reported_date date DEFAULT CURRENT_DATE,
    reported_by uuid,
    verified boolean DEFAULT false,
    verified_by uuid,
    verified_date timestamp without time zone,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_consent_forms; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.patient_consent_forms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    consent_type character varying(100) NOT NULL,
    consent_title character varying(255) NOT NULL,
    consent_description text,
    consent_content text NOT NULL,
    version character varying(50) DEFAULT '1.0'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    signed_at timestamp without time zone,
    signature_data text,
    signature_method character varying(50),
    witness_name character varying(255),
    witness_signature text,
    ip_address character varying(45),
    user_agent text,
    expires_at timestamp without time zone,
    revoked_at timestamp without time zone,
    revocation_reason text,
    parent_guardian_name character varying(255),
    parent_guardian_relation character varying(100),
    attachments jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_intake_flows; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.patient_intake_flows (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    flow_name character varying(255) NOT NULL,
    flow_type character varying(100) NOT NULL,
    current_step integer DEFAULT 1,
    total_steps integer NOT NULL,
    steps_completed jsonb DEFAULT '[]'::jsonb,
    step_data jsonb DEFAULT '{}'::jsonb,
    status character varying(50) DEFAULT 'in_progress'::character varying,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    expires_at timestamp without time zone,
    reminder_sent boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_intake_forms; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.patient_intake_forms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    form_type character varying(100) NOT NULL,
    form_name character varying(255) NOT NULL,
    form_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    submitted_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    reviewed_by uuid,
    notes text,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_offering_enrollments; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.patient_offering_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    package_id uuid,
    offering_id uuid,
    enrollment_date date DEFAULT CURRENT_DATE NOT NULL,
    expiry_date date,
    status character varying(50) DEFAULT 'active'::character varying,
    total_allowed_uses integer DEFAULT 1,
    used_count integer DEFAULT 0,
    remaining_uses integer,
    amount_paid numeric(10,2),
    payment_method character varying(50),
    payment_status character varying(50) DEFAULT 'pending'::character varying,
    payment_id uuid,
    notes text,
    cancellation_reason text,
    cancelled_at timestamp without time zone,
    cancelled_by uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_pharmacies; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.patient_pharmacies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid,
    pharmacy_id uuid,
    is_preferred boolean DEFAULT false,
    added_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patient_portal_sessions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.patient_portal_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    session_token character varying(255) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patients; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.patients (
    practice_id uuid,
    mrn character varying(50) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    date_of_birth date NOT NULL,
    gender character varying(20),
    phone character varying(20),
    email character varying(255),
    address text,
    emergency_contact jsonb,
    insurance_info jsonb,
    status character varying(20) DEFAULT 'active'::character varying,
    portal_enabled boolean DEFAULT false,
    portal_password_hash character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    height character varying(20),
    weight character varying(20),
    blood_type character varying(10),
    allergies text,
    past_history text,
    family_history text,
    current_medications text,
    id uuid NOT NULL,
    country character varying(2),
    timezone character varying(100),
    insurance_payer_id uuid,
    city character varying(100),
    state character varying(2),
    zip character varying(10),
    insurance character varying(100),
    insurance_id character varying(100),
    telehealth_preference character varying(50) DEFAULT NULL::character varying,
    social_history text,
    previous_medications jsonb DEFAULT '[]'::jsonb,
    additional_current_medications jsonb DEFAULT '[]'::jsonb
);


--
-- Name: COLUMN patients.height; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.height IS 'Patient height (e.g., 5''10", 178cm)';


--
-- Name: COLUMN patients.weight; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.weight IS 'Patient weight (e.g., 180 lbs, 82kg)';


--
-- Name: COLUMN patients.blood_type; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.blood_type IS 'Patient blood type (e.g., O+, A-, AB+)';


--
-- Name: COLUMN patients.id; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.id IS 'Primary key - references users.id directly (no separate user_id column)';


--
-- Name: COLUMN patients.country; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, CA, GB)';


--
-- Name: COLUMN patients.timezone; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.timezone IS 'IANA timezone string (e.g., America/New_York)';


--
-- Name: COLUMN patients.insurance_payer_id; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.insurance_payer_id IS 'Foreign key to insurance_payers table - patients default/primary insurance payer';


--
-- Name: COLUMN patients.city; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.city IS 'Patient city';


--
-- Name: COLUMN patients.state; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.state IS 'Patient state (2-letter code)';


--
-- Name: COLUMN patients.zip; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.zip IS 'Patient ZIP/postal code';


--
-- Name: COLUMN patients.insurance; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.insurance IS 'Insurance provider name';


--
-- Name: COLUMN patients.insurance_id; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.insurance_id IS 'Insurance member ID';


--
-- Name: COLUMN patients.telehealth_preference; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.telehealth_preference IS 'Preferred telehealth provider (zoom, google_meet, microsoft_teams, webex). NULL = clinic default.';


--
-- Name: COLUMN patients.social_history; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.social_history IS 'Patient social history including smoking, alcohol, occupation, etc.';


--
-- Name: COLUMN patients.previous_medications; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.previous_medications IS 'JSON array of previous medications with NDC codes and drug details';


--
-- Name: COLUMN patients.additional_current_medications; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.patients.additional_current_medications IS 'JSON array of additional current medications not from prescriptions';


--
-- Name: payment_postings; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.payment_postings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    posting_number character varying(50) NOT NULL,
    claim_id uuid,
    patient_id uuid,
    insurance_payer_id uuid,
    check_number character varying(100),
    check_date date,
    payment_amount numeric(10,2) NOT NULL,
    allowed_amount numeric(10,2),
    deductible_amount numeric(10,2) DEFAULT 0,
    coinsurance_amount numeric(10,2) DEFAULT 0,
    copay_amount numeric(10,2) DEFAULT 0,
    adjustment_amount numeric(10,2) DEFAULT 0,
    adjustment_reason character varying(255),
    adjustment_code character varying(50),
    posting_date date NOT NULL,
    status character varying(50) DEFAULT 'posted'::character varying,
    payment_method character varying(50) DEFAULT 'check'::character varying,
    era_number character varying(100),
    eob_number character varying(100),
    notes text,
    internal_notes text,
    posted_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_postings_payment_method_check CHECK (((payment_method)::text = ANY (ARRAY[('check'::character varying)::text, ('eft'::character varying)::text, ('credit_card'::character varying)::text, ('cash'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT payment_postings_status_check CHECK (((status)::text = ANY (ARRAY[('posted'::character varying)::text, ('pending'::character varying)::text, ('reversed'::character varying)::text, ('voided'::character varying)::text])))
);


--
-- Name: COLUMN payment_postings.posting_number; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.payment_postings.posting_number IS 'Unique identifier for the payment posting (e.g., POST-2024-000001)';


--
-- Name: COLUMN payment_postings.allowed_amount; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.payment_postings.allowed_amount IS 'Amount allowed by insurance for the claim';


--
-- Name: COLUMN payment_postings.adjustment_amount; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.payment_postings.adjustment_amount IS 'Amount adjusted (write-off)';


--
-- Name: COLUMN payment_postings.era_number; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.payment_postings.era_number IS 'Electronic Remittance Advice number';


--
-- Name: COLUMN payment_postings.eob_number; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.payment_postings.eob_number IS 'Explanation of Benefits number';


--
-- Name: payments; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.payments (
    payment_number character varying(50),
    patient_id uuid,
    claim_id uuid,
    amount numeric(10,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    payment_status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    transaction_id character varying(100),
    card_last_four character varying(4),
    card_brand character varying(20),
    payment_date timestamp without time zone,
    description text,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text
);


--
-- Name: COLUMN payments.id; Type: COMMENT; Schema: template; Owner: -
--

COMMENT ON COLUMN template.payments.id IS 'UUID primary key for payments';


--
-- Name: pharmacies; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.pharmacies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ncpdp_id character varying(20),
    npi character varying(20),
    pharmacy_name character varying(255) NOT NULL,
    chain_name character varying(255),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(2),
    zip_code character varying(10),
    phone character varying(20),
    fax character varying(20),
    email character varying(255),
    website character varying(255),
    is_24_hours boolean DEFAULT false,
    accepts_erx boolean DEFAULT true,
    erx_endpoint_url character varying(500),
    erx_system_type character varying(50),
    delivery_available boolean DEFAULT false,
    drive_through boolean DEFAULT false,
    accepts_insurance boolean DEFAULT true,
    preferred_network boolean DEFAULT false,
    distance_miles numeric(10,2),
    latitude numeric(10,8),
    longitude numeric(11,8),
    operating_hours jsonb,
    services jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: portal_invites; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.portal_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    token_hash character(64) NOT NULL,
    email character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_by uuid,
    emailed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: preapprovals; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.preapprovals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    preapproval_number character varying(100) NOT NULL,
    patient_id uuid,
    insurance_payer_id uuid,
    requested_service character varying(255) NOT NULL,
    diagnosis_codes jsonb,
    procedure_codes jsonb,
    service_start_date date,
    service_end_date date,
    estimated_cost numeric(10,2),
    authorization_number character varying(100),
    status character varying(50) DEFAULT 'Pending'::character varying,
    clearinghouse_request_id character varying(255),
    clearinghouse_status character varying(50),
    submitted_to_clearinghouse_at timestamp without time zone,
    clearinghouse_response jsonb,
    approved_by character varying(255),
    approved_at timestamp without time zone,
    approval_valid_until date,
    denied_reason text,
    clinical_notes text,
    supporting_documents jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: prescription_history; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.prescription_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prescription_id uuid,
    action character varying(50) NOT NULL,
    action_by uuid,
    action_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    old_status character varying(50),
    new_status character varying(50),
    pharmacy_id uuid,
    fill_number integer,
    quantity_dispensed integer,
    pharmacist_name character varying(255),
    pharmacist_license character varying(50),
    notes text,
    metadata jsonb
);


--
-- Name: prescriptions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    provider_id uuid,
    appointment_id uuid,
    medication_name character varying(255),
    dosage character varying(100) NOT NULL,
    frequency character varying(100) NOT NULL,
    duration character varying(100),
    instructions text,
    refills integer DEFAULT 0,
    status character varying(50) DEFAULT 'Active'::character varying,
    prescribed_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ndc_code character varying(20),
    drug_strength character varying(50),
    drug_form character varying(50),
    quantity integer,
    days_supply integer,
    daw_code integer DEFAULT 0,
    prior_auth_required boolean DEFAULT false,
    prior_auth_number character varying(50),
    pharmacy_id uuid,
    erx_message_id character varying(100),
    erx_status character varying(50) DEFAULT 'draft'::character varying,
    erx_sent_date timestamp without time zone,
    erx_response_date timestamp without time zone,
    erx_error_message text,
    controlled_substance_class character varying(10),
    prescriber_dea_number character varying(20),
    diagnosis_code character varying(20),
    substitution_allowed boolean DEFAULT true,
    sig_code text,
    notes_to_pharmacist text,
    refills_remaining integer DEFAULT 0,
    last_filled_date date,
    cancelled_reason text,
    cancelled_date timestamp without time zone,
    cancelled_by uuid,
    vendor_prescription_id character varying(255),
    vendor_status character varying(50),
    sent_to_vendor_at timestamp without time zone,
    vendor_response jsonb,
    diagnosis_id uuid,
    fhir_tracking_id uuid,
    camp_id uuid
);


--
-- Name: provider_booking_config; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.provider_booking_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid NOT NULL,
    booking_url_slug character varying(100),
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    slot_interval_minutes integer DEFAULT 15,
    max_concurrent_bookings integer DEFAULT 1,
    allow_public_booking boolean DEFAULT true,
    require_patient_account boolean DEFAULT false,
    send_confirmation_email boolean DEFAULT true,
    send_reminder_email boolean DEFAULT true,
    reminder_hours_before integer DEFAULT 24,
    allow_cancellation boolean DEFAULT true,
    cancellation_hours_before integer DEFAULT 24,
    allow_rescheduling boolean DEFAULT true,
    reschedule_hours_before integer DEFAULT 24,
    booking_instructions text,
    custom_fields jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: recurring_appointments; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.recurring_appointments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    appointment_type_id uuid,
    recurrence_rule character varying(255) NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone,
    duration_minutes integer NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: schema_migrations; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.schema_migrations (
    version integer NOT NULL,
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_categories; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.service_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    icon character varying(100),
    color character varying(50),
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_pack character varying(60),
    source_pack_version integer,
    is_customised boolean DEFAULT false NOT NULL,
    department_id uuid
);


--
-- Name: sick_note_requests; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.sick_note_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    purpose character varying(12) DEFAULT 'work'::character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text NOT NULL,
    status character varying(10) DEFAULT 'pending'::character varying NOT NULL,
    sick_note_id uuid,
    decided_by uuid,
    decision_reason text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sick_note_requests_check CHECK ((end_date >= start_date)),
    CONSTRAINT sick_note_requests_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['work'::character varying, 'school'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT sick_note_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'issued'::character varying, 'declined'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: sick_notes; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.sick_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference character varying(32) NOT NULL,
    patient_id uuid NOT NULL,
    purpose character varying(12) DEFAULT 'work'::character varying NOT NULL,
    fitness character varying(12) NOT NULL,
    assessed_on date NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    condition_text text,
    adjustments text[] DEFAULT '{}'::text[] NOT NULL,
    comments text,
    follow_up boolean DEFAULT false NOT NULL,
    issued_by uuid NOT NULL,
    issuer_name character varying(200) NOT NULL,
    issuer_title character varying(100),
    issuer_registration character varying(100),
    status character varying(10) DEFAULT 'issued'::character varying NOT NULL,
    void_reason text,
    voided_by uuid,
    voided_at timestamp with time zone,
    emailed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sick_notes_check CHECK ((end_date >= start_date)),
    CONSTRAINT sick_notes_fitness_check CHECK (((fitness)::text = ANY ((ARRAY['not_fit'::character varying, 'may_be_fit'::character varying])::text[]))),
    CONSTRAINT sick_notes_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['work'::character varying, 'school'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT sick_notes_status_check CHECK (((status)::text = ANY ((ARRAY['issued'::character varying, 'voided'::character varying])::text[])))
);


--
-- Name: staff_notification_preferences; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.staff_notification_preferences (
    user_id uuid NOT NULL,
    event_key character varying(60) NOT NULL,
    channel character varying(20) NOT NULL,
    enabled boolean NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_notification_preferences_channel_check CHECK (((channel)::text = ANY ((ARRAY['in_app'::character varying, 'email'::character varying, 'whatsapp'::character varying])::text[])))
);


--
-- Name: tasks; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.tasks (
    id integer NOT NULL,
    title text NOT NULL,
    priority character varying(50) DEFAULT 'Medium'::character varying,
    due_date date,
    status character varying(50) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text,
    assigned_to uuid
);


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: tenant_default; Owner: -
--

CREATE SEQUENCE tenant_default.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_default; Owner: -
--

ALTER SEQUENCE tenant_default.tasks_id_seq OWNED BY tenant_default.tasks.id;


--
-- Name: tasks; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.tasks (
    id integer DEFAULT nextval('tenant_default.tasks_id_seq'::regclass) NOT NULL,
    title text NOT NULL,
    priority character varying(50) DEFAULT 'Medium'::character varying,
    due_date date,
    status character varying(50) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text,
    assigned_to uuid
);


--
-- Name: telehealth_provider_settings; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.telehealth_provider_settings (
    id integer NOT NULL,
    provider_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT false,
    api_key text,
    api_secret text,
    client_id text,
    client_secret text,
    webhook_secret text,
    access_token text,
    refresh_token text,
    token_type character varying(50) DEFAULT 'Bearer'::character varying,
    token_scope text,
    token_expires_at bigint,
    account_id character varying(255),
    zoom_user_id character varying(255),
    zoom_user_email character varying(255),
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE telehealth_provider_settings; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.telehealth_provider_settings IS 'Settings for different telehealth providers (Zoom, Google Meet, Webex)';


--
-- Name: telehealth_provider_settings_id_seq; Type: SEQUENCE; Schema: tenant_default; Owner: -
--

CREATE SEQUENCE tenant_default.telehealth_provider_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: telehealth_provider_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_default; Owner: -
--

ALTER SEQUENCE tenant_default.telehealth_provider_settings_id_seq OWNED BY tenant_default.telehealth_provider_settings.id;


--
-- Name: telehealth_provider_settings; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.telehealth_provider_settings (
    id integer DEFAULT nextval('tenant_default.telehealth_provider_settings_id_seq'::regclass) NOT NULL,
    provider_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT false,
    api_key text,
    api_secret text,
    client_id text,
    client_secret text,
    webhook_secret text,
    access_token text,
    refresh_token text,
    token_type character varying(50) DEFAULT 'Bearer'::character varying,
    token_scope text,
    token_expires_at bigint,
    account_id character varying(255),
    zoom_user_id character varying(255),
    zoom_user_email character varying(255),
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: telehealth_sessions; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.telehealth_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid,
    patient_id uuid,
    provider_id uuid,
    session_status character varying(20) DEFAULT 'scheduled'::character varying,
    room_id character varying(100) NOT NULL,
    meeting_url text,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    duration_minutes integer,
    recording_url text,
    recording_enabled boolean DEFAULT false,
    participants jsonb DEFAULT '[]'::jsonb,
    session_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    provider_type character varying(50) DEFAULT 'medflow'::character varying
);


--
-- Name: vendor_integration_settings; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.vendor_integration_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT false,
    api_key character varying(500),
    api_secret character varying(500),
    client_id character varying(500),
    client_secret character varying(500),
    username character varying(255),
    password character varying(500),
    base_url character varying(500),
    sandbox_mode boolean DEFAULT true,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_tested_at timestamp without time zone,
    test_status character varying(50),
    test_message text
);


--
-- Name: vendor_transaction_log; Type: TABLE; Schema: template; Owner: -
--

CREATE TABLE template.vendor_transaction_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_type character varying(50) NOT NULL,
    transaction_type character varying(100) NOT NULL,
    request_data jsonb,
    response_data jsonb,
    status character varying(50),
    error_message text,
    external_id character varying(255),
    internal_reference_id uuid,
    patient_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


--
-- Name: account_ar_aging_snapshots; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.account_ar_aging_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_date date NOT NULL,
    snapshot_type character varying(20) DEFAULT 'patient'::character varying NOT NULL,
    total_ar numeric(15,2) DEFAULT 0.00 NOT NULL,
    current_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    days_1_30 numeric(15,2) DEFAULT 0.00 NOT NULL,
    days_31_60 numeric(15,2) DEFAULT 0.00 NOT NULL,
    days_61_90 numeric(15,2) DEFAULT 0.00 NOT NULL,
    days_91_120 numeric(15,2) DEFAULT 0.00 NOT NULL,
    days_120_plus numeric(15,2) DEFAULT 0.00 NOT NULL,
    total_accounts integer DEFAULT 0 NOT NULL,
    current_count integer DEFAULT 0 NOT NULL,
    days_1_30_count integer DEFAULT 0 NOT NULL,
    days_31_60_count integer DEFAULT 0 NOT NULL,
    days_61_90_count integer DEFAULT 0 NOT NULL,
    days_91_120_count integer DEFAULT 0 NOT NULL,
    days_120_plus_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_ar_aging_snapshots_snapshot_type_check CHECK (((snapshot_type)::text = ANY ((ARRAY['patient'::character varying, 'insurance'::character varying, 'combined'::character varying])::text[])))
);


--
-- Name: account_journal_entries; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.account_journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_number character varying(30) NOT NULL,
    entry_date date NOT NULL,
    post_date date,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    entry_type character varying(30) DEFAULT 'manual'::character varying NOT NULL,
    description text NOT NULL,
    reference_type character varying(30),
    reference_id uuid,
    reference_number character varying(50),
    total_debit numeric(15,2) DEFAULT 0.00 NOT NULL,
    total_credit numeric(15,2) DEFAULT 0.00 NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    is_recurring boolean DEFAULT false NOT NULL,
    recurring_frequency character varying(20),
    next_recurrence date,
    reversal_of uuid,
    notes text,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_by uuid,
    updated_by uuid,
    posted_by uuid,
    voided_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_journal_entries_entry_type_check CHECK (((entry_type)::text = ANY ((ARRAY['manual'::character varying, 'adjusting'::character varying, 'closing'::character varying, 'reversing'::character varying, 'auto_billing'::character varying, 'auto_rcm'::character varying, 'auto_payment'::character varying, 'auto_ar'::character varying, 'auto_ap'::character varying])::text[]))),
    CONSTRAINT account_journal_entries_recurring_frequency_check CHECK (((recurring_frequency)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying, 'quarterly'::character varying, 'yearly'::character varying, NULL::character varying])::text[]))),
    CONSTRAINT account_journal_entries_reference_type_check CHECK (((reference_type)::text = ANY ((ARRAY['invoice'::character varying, 'claim'::character varying, 'payment'::character varying, 'denial'::character varying, 'preapproval'::character varying, 'payment_posting'::character varying, 'quote'::character varying, NULL::character varying])::text[]))),
    CONSTRAINT account_journal_entries_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'posted'::character varying, 'voided'::character varying, 'reversed'::character varying])::text[]))),
    CONSTRAINT chk_je_date_valid CHECK ((entry_date <= (CURRENT_DATE + '1 year'::interval))),
    CONSTRAINT chk_je_description_nonempty CHECK ((length(TRIM(BOTH FROM description)) > 0))
);


--
-- Name: account_journal_lines; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.account_journal_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_entry_id uuid NOT NULL,
    account_id uuid NOT NULL,
    line_number integer NOT NULL,
    entry_type character varying(6) NOT NULL,
    amount numeric(15,2) NOT NULL,
    description text,
    patient_id uuid,
    provider_id uuid,
    department character varying(100),
    cost_center character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_journal_lines_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT account_journal_lines_entry_type_check CHECK (((entry_type)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying])::text[]))),
    CONSTRAINT chk_ajl_line_number CHECK ((line_number > 0))
);


--
-- Name: account_payables; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.account_payables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ap_number character varying(30) NOT NULL,
    ap_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    vendor_name character varying(255) NOT NULL,
    vendor_reference character varying(100),
    account_id uuid,
    invoice_amount numeric(15,2) NOT NULL,
    paid_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    discount_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    balance_due numeric(15,2) GENERATED ALWAYS AS (((invoice_amount - paid_amount) - discount_amount)) STORED,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    payment_date date,
    payment_method character varying(20),
    payment_reference character varying(100),
    bank_account character varying(50),
    expense_category character varying(100),
    department character varying(100),
    notes text,
    attachments jsonb DEFAULT '[]'::jsonb,
    approved_by uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_payables_ap_type_check CHECK (((ap_type)::text = ANY ((ARRAY['vendor'::character varying, 'refund'::character varying, 'employee'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT account_payables_discount_amount_check CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT account_payables_invoice_amount_check CHECK ((invoice_amount > (0)::numeric)),
    CONSTRAINT account_payables_paid_amount_check CHECK ((paid_amount >= (0)::numeric)),
    CONSTRAINT account_payables_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['check'::character varying, 'ach'::character varying, 'wire'::character varying, 'card'::character varying, 'cash'::character varying, NULL::character varying])::text[]))),
    CONSTRAINT account_payables_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'partial'::character varying, 'paid'::character varying, 'voided'::character varying, 'disputed'::character varying])::text[]))),
    CONSTRAINT account_payables_vendor_name_check CHECK ((length(TRIM(BOTH FROM vendor_name)) > 0))
);


--
-- Name: account_receivables; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.account_receivables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ar_number character varying(30) NOT NULL,
    ar_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    patient_id uuid,
    payer_id uuid,
    account_id uuid,
    invoice_id uuid,
    claim_id uuid,
    original_amount numeric(15,2) NOT NULL,
    paid_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    adjusted_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    written_off_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    balance_due numeric(15,2) GENERATED ALWAYS AS ((((original_amount - paid_amount) - adjusted_amount) - written_off_amount)) STORED,
    due_date date NOT NULL,
    service_date date,
    last_payment_date date,
    aging_bucket character varying(20),
    aging_days integer DEFAULT 0,
    collection_stage character varying(30) DEFAULT 'statement'::character varying,
    last_contact_date date,
    notes text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_receivables_aging_bucket_check CHECK (((aging_bucket)::text = ANY ((ARRAY['current'::character varying, '1_30'::character varying, '31_60'::character varying, '61_90'::character varying, '91_120'::character varying, '120_plus'::character varying, NULL::character varying])::text[]))),
    CONSTRAINT account_receivables_aging_days_check CHECK ((aging_days >= 0)),
    CONSTRAINT account_receivables_ar_type_check CHECK (((ar_type)::text = ANY ((ARRAY['patient'::character varying, 'insurance'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT account_receivables_collection_stage_check CHECK (((collection_stage)::text = ANY ((ARRAY['statement'::character varying, 'reminder_1'::character varying, 'reminder_2'::character varying, 'final_notice'::character varying, 'collections'::character varying, 'legal'::character varying, NULL::character varying])::text[]))),
    CONSTRAINT account_receivables_original_amount_check CHECK ((original_amount >= (0)::numeric)),
    CONSTRAINT account_receivables_paid_amount_check CHECK ((paid_amount >= (0)::numeric)),
    CONSTRAINT account_receivables_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'partial'::character varying, 'paid'::character varying, 'written_off'::character varying, 'disputed'::character varying, 'collections'::character varying])::text[]))),
    CONSTRAINT account_receivables_written_off_amount_check CHECK ((written_off_amount >= (0)::numeric))
);


--
-- Name: account_reconciliation_items; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.account_reconciliation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reconciliation_id uuid NOT NULL,
    item_type character varying(20) NOT NULL,
    transaction_date date NOT NULL,
    description text NOT NULL,
    reference_number character varying(100),
    amount numeric(15,2) NOT NULL,
    is_cleared boolean DEFAULT false NOT NULL,
    cleared_date date,
    journal_line_id uuid,
    payment_id uuid,
    invoice_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_reconciliation_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['deposit'::character varying, 'check'::character varying, 'payment'::character varying, 'adjustment'::character varying, 'fee'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: account_reconciliations; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.account_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reconciliation_number character varying(30) NOT NULL,
    account_id uuid NOT NULL,
    reconciliation_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'in_progress'::character varying NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    statement_balance numeric(15,2) NOT NULL,
    system_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    cleared_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    outstanding_deposits numeric(15,2) DEFAULT 0.00 NOT NULL,
    outstanding_checks numeric(15,2) DEFAULT 0.00 NOT NULL,
    discrepancy_amount numeric(15,2) GENERATED ALWAYS AS ((((statement_balance - cleared_balance) - outstanding_deposits) + outstanding_checks)) STORED,
    notes text,
    completed_at timestamp with time zone,
    created_by uuid,
    completed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_reconciliations_reconciliation_type_check CHECK (((reconciliation_type)::text = ANY ((ARRAY['bank'::character varying, 'insurance'::character varying, 'patient'::character varying, 'vendor'::character varying])::text[]))),
    CONSTRAINT account_reconciliations_status_check CHECK (((status)::text = ANY ((ARRAY['in_progress'::character varying, 'completed'::character varying, 'discrepancy'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT chk_rec_period CHECK ((period_end >= period_start))
);


--
-- Name: account_role_permissions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.account_role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name character varying(50) NOT NULL,
    resource character varying(50) NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_create boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    can_approve boolean DEFAULT false NOT NULL,
    can_export boolean DEFAULT false NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_role_permissions_resource_check CHECK (((resource)::text = ANY ((ARRAY['chart_of_accounts'::character varying, 'journal_entries'::character varying, 'accounts_receivable'::character varying, 'accounts_payable'::character varying, 'reconciliation'::character varying, 'statements'::character varying, 'reports'::character varying, 'backup'::character varying, 'archive'::character varying, 'rbac_settings'::character varying])::text[])))
);


--
-- Name: account_statement_items; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.account_statement_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    statement_id uuid NOT NULL,
    item_date date NOT NULL,
    description text NOT NULL,
    item_type character varying(20) NOT NULL,
    reference_type character varying(30),
    reference_id uuid,
    reference_number character varying(50),
    amount numeric(15,2) NOT NULL,
    running_balance numeric(15,2),
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_statement_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['charge'::character varying, 'payment'::character varying, 'adjustment'::character varying, 'credit'::character varying, 'balance_forward'::character varying])::text[])))
);


--
-- Name: account_statements; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.account_statements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    statement_number character varying(30) NOT NULL,
    statement_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    patient_id uuid,
    payer_id uuid,
    recipient_name character varying(255),
    recipient_email character varying(255),
    recipient_address jsonb,
    statement_date date NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    due_date date,
    previous_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    charges numeric(15,2) DEFAULT 0.00 NOT NULL,
    payments numeric(15,2) DEFAULT 0.00 NOT NULL,
    adjustments numeric(15,2) DEFAULT 0.00 NOT NULL,
    current_balance numeric(15,2) GENERATED ALWAYS AS ((((previous_balance + charges) - payments) - adjustments)) STORED,
    sent_at timestamp with time zone,
    viewed_at timestamp with time zone,
    payment_url text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_statements_statement_type_check CHECK (((statement_type)::text = ANY ((ARRAY['patient'::character varying, 'insurance'::character varying, 'vendor'::character varying, 'internal'::character varying])::text[]))),
    CONSTRAINT account_statements_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'viewed'::character varying, 'paid'::character varying, 'disputed'::character varying])::text[]))),
    CONSTRAINT chk_stm_period CHECK ((period_end >= period_start))
);


--
-- Name: accounts; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_number character varying(20) NOT NULL,
    account_name character varying(255) NOT NULL,
    account_type character varying(30) NOT NULL,
    account_subtype character varying(50),
    parent_account_id uuid,
    description text,
    normal_balance character varying(6) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    allow_journal_entries boolean DEFAULT true NOT NULL,
    opening_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    current_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    linked_to_ar boolean DEFAULT false NOT NULL,
    linked_to_ap boolean DEFAULT false NOT NULL,
    linked_to_billing boolean DEFAULT false NOT NULL,
    linked_to_claims boolean DEFAULT false NOT NULL,
    tags text[],
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accounts_account_type_check CHECK (((account_type)::text = ANY ((ARRAY['asset'::character varying, 'liability'::character varying, 'equity'::character varying, 'revenue'::character varying, 'expense'::character varying, 'contra_asset'::character varying, 'contra_liability'::character varying, 'contra_revenue'::character varying])::text[]))),
    CONSTRAINT accounts_currency_check CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT accounts_normal_balance_check CHECK (((normal_balance)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying])::text[]))),
    CONSTRAINT chk_account_name_nonempty CHECK ((length(TRIM(BOTH FROM account_name)) > 0)),
    CONSTRAINT chk_account_number_format CHECK (((account_number)::text ~ '^[0-9A-Z\-]+$'::text))
);


--
-- Name: ai_feature_settings; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.ai_feature_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_key character varying(50) NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    provider character varying(30),
    model character varying(120),
    monthly_request_limit integer,
    monthly_budget_usd numeric(10,2),
    draft_ttl_hours integer DEFAULT 72 NOT NULL,
    enabled_by uuid,
    enabled_at timestamp without time zone,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ai_feature_settings_provider_chk CHECK (((provider IS NULL) OR ((provider)::text = ANY ((ARRAY['anthropic'::character varying, 'openai'::character varying, 'azure_openai'::character varying, 'google_gemini'::character varying, 'mistral'::character varying, 'offline'::character varying])::text[])))),
    CONSTRAINT ai_feature_settings_ttl_chk CHECK (((draft_ttl_hours >= 1) AND (draft_ttl_hours <= 720)))
);


--
-- Name: ai_phi_token_map; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.ai_phi_token_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    token character varying(60) NOT NULL,
    phi_category character varying(30) NOT NULL,
    detection_method character varying(20) DEFAULT 'pattern'::character varying NOT NULL,
    original_ciphertext text NOT NULL,
    original_iv text NOT NULL,
    original_tag text NOT NULL,
    key_version smallint NOT NULL,
    occurrences integer DEFAULT 1 NOT NULL,
    restored_in_response boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ai_phi_token_map_method_chk CHECK (((detection_method)::text = ANY ((ARRAY['record'::character varying, 'pattern'::character varying])::text[])))
);


--
-- Name: ai_provider_credentials; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.ai_provider_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider character varying(30) NOT NULL,
    display_name character varying(120),
    api_key_ciphertext text,
    api_key_iv text,
    api_key_tag text,
    api_key_version smallint,
    api_key_last4 character varying(8),
    base_url text,
    region character varying(50),
    api_version character varying(30),
    default_model character varying(120),
    baa_confirmed boolean DEFAULT false NOT NULL,
    baa_confirmed_by uuid,
    baa_confirmed_at timestamp without time zone,
    zero_data_retention boolean DEFAULT false NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    last_tested_at timestamp without time zone,
    test_status character varying(20),
    test_message text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ai_provider_credentials_provider_chk CHECK (((provider)::text = ANY ((ARRAY['anthropic'::character varying, 'openai'::character varying, 'azure_openai'::character varying, 'google_gemini'::character varying, 'mistral'::character varying, 'offline'::character varying])::text[])))
);


--
-- Name: ai_requests; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.ai_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_key character varying(50) NOT NULL,
    user_id uuid,
    provider character varying(30) NOT NULL,
    model character varying(120) NOT NULL,
    prompt_template_version character varying(20) NOT NULL,
    input_hash character varying(64),
    entity_type character varying(50),
    entity_id character varying(255),
    patient_id uuid,
    phi_tokens_count integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'started'::character varying NOT NULL,
    stop_reason character varying(30),
    input_tokens integer,
    output_tokens integer,
    estimated_cost_usd numeric(12,6),
    latency_ms integer,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    CONSTRAINT ai_requests_status_chk CHECK (((status)::text = ANY ((ARRAY['started'::character varying, 'succeeded'::character varying, 'failed'::character varying, 'refused'::character varying, 'blocked'::character varying])::text[])))
);


--
-- Name: ai_suggestions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.ai_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    feature_key character varying(50) NOT NULL,
    entity_type character varying(50),
    entity_id character varying(255),
    patient_id uuid,
    draft_ciphertext text NOT NULL,
    draft_iv text NOT NULL,
    draft_tag text NOT NULL,
    draft_key_version smallint NOT NULL,
    final_ciphertext text,
    final_iv text,
    final_tag text,
    final_key_version smallint,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    requested_by uuid,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    review_reason text,
    attested boolean DEFAULT false NOT NULL,
    edit_distance_pct numeric(5,2),
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ai_suggestions_reviewer_chk CHECK ((((status)::text = ANY ((ARRAY['pending'::character varying, 'expired'::character varying])::text[])) OR (reviewed_by IS NOT NULL))),
    CONSTRAINT ai_suggestions_status_chk CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'edited'::character varying, 'rejected'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: appointment_reminders; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.appointment_reminders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    appointment_id uuid NOT NULL,
    reminder_type character varying(50) NOT NULL,
    scheduled_for timestamp without time zone NOT NULL,
    sent_at timestamp without time zone,
    delivery_status character varying(50) DEFAULT 'pending'::character varying,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE appointment_reminders; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.appointment_reminders IS 'Tracks scheduled appointment reminders (email/SMS)';


--
-- Name: appointment_type_config; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.appointment_type_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid,
    name character varying(100) NOT NULL,
    description text,
    duration_minutes integer DEFAULT 30 NOT NULL,
    buffer_minutes integer DEFAULT 0,
    color character varying(20) DEFAULT '#3B82F6'::character varying,
    price numeric(10,2) DEFAULT 0.00,
    is_active boolean DEFAULT true,
    requires_approval boolean DEFAULT false,
    max_advance_booking_days integer DEFAULT 90,
    min_advance_booking_hours integer DEFAULT 24,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE appointment_type_config; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.appointment_type_config IS 'Defines available appointment types with duration and pricing';


--
-- Name: appointment_waitlist; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.appointment_waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid,
    preferred_date date NOT NULL,
    preferred_time_start time without time zone,
    preferred_time_end time without time zone,
    appointment_type character varying(100),
    reason text,
    priority integer DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    notified_at timestamp without time zone,
    expires_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT appointment_waitlist_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('notified'::character varying)::text, ('scheduled'::character varying)::text, ('cancelled'::character varying)::text, ('expired'::character varying)::text])))
);


--
-- Name: TABLE appointment_waitlist; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.appointment_waitlist IS 'Patient waitlist for appointment slots that are fully booked';


--
-- Name: COLUMN appointment_waitlist.priority; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.appointment_waitlist.priority IS 'Higher priority = contacted first (0 = normal, 1+ = higher priority)';


--
-- Name: COLUMN appointment_waitlist.status; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.appointment_waitlist.status IS 'active: waiting, notified: slot available notification sent, scheduled: appointment booked, cancelled: patient cancelled, expired: notification expired';


--
-- Name: COLUMN appointment_waitlist.expires_at; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.appointment_waitlist.expires_at IS 'Notification expiry time - if not booked by this time, offer to next person';


--
-- Name: appointments; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid,
    patient_id uuid,
    provider_id uuid,
    appointment_type character varying(50),
    status character varying(20) DEFAULT 'scheduled'::character varying,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    duration_minutes integer,
    reason text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    appointment_type_id uuid,
    recurring_appointment_id uuid,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    booking_source character varying(50) DEFAULT 'staff'::character varying,
    confirmation_sent_at timestamp without time zone,
    reminder_sent_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancelled_by uuid,
    cancellation_reason text,
    rescheduled_from uuid,
    no_show_notified_at timestamp without time zone,
    custom_form_data jsonb DEFAULT '{}'::jsonb,
    offering_id uuid,
    package_enrollment_id uuid,
    location_id uuid,
    camp_id uuid,
    meeting_url text
);


--
-- Name: TABLE appointments; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.appointments IS 'Patient appointments with healthcare providers';


--
-- Name: COLUMN appointments.location_id; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.appointments.location_id IS 'Site this appointment happens at. NULL means the tenant primary site.';


--
-- Name: archive_rules; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.archive_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_name character varying(255) NOT NULL,
    description text,
    enabled boolean DEFAULT true,
    selected_modules text[] NOT NULL,
    schedule_type character varying(50) NOT NULL,
    schedule_cron character varying(100),
    schedule_time time without time zone DEFAULT '02:00:00'::time without time zone,
    schedule_day_of_week integer,
    schedule_day_of_month integer,
    retention_days integer,
    retention_criteria jsonb,
    last_run_at timestamp with time zone,
    last_run_status character varying(50),
    last_run_details jsonb,
    next_run_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE archive_rules; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.archive_rules IS 'Defines automatic archiving rules with schedules';


--
-- Name: COLUMN archive_rules.schedule_type; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.archive_rules.schedule_type IS 'Type of schedule: daily, weekly, monthly, or custom (cron)';


--
-- Name: COLUMN archive_rules.schedule_cron; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.archive_rules.schedule_cron IS 'Cron expression for custom schedules (e.g., "0 2 * * *")';


--
-- Name: COLUMN archive_rules.retention_days; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.archive_rules.retention_days IS 'Archive data older than this many days (null = archive all)';


--
-- Name: COLUMN archive_rules.retention_criteria; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.archive_rules.retention_criteria IS 'Additional filtering criteria for data to archive';


--
-- Name: COLUMN archive_rules.last_run_status; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.archive_rules.last_run_status IS 'Status of last execution: success, failed, or running';


--
-- Name: archives; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.archives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archive_name character varying(255) NOT NULL,
    description text,
    modules text[] NOT NULL,
    archive_data jsonb NOT NULL,
    metadata jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    size_bytes integer,
    record_count integer,
    status character varying(50) DEFAULT 'active'::character varying
);


--
-- Name: TABLE archives; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.archives IS 'Stores archived data with module selection and deduplication support';


--
-- Name: COLUMN archives.modules; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.archives.modules IS 'Array of module names included in this archive (e.g., patients, appointments, medical_records)';


--
-- Name: COLUMN archives.archive_data; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.archives.archive_data IS 'Complete archived data organized by module name as keys';


--
-- Name: COLUMN archives.metadata; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.archives.metadata IS 'Statistics and metadata about the archive including record counts per module and timestamp';


--
-- Name: audit_logs; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    user_email character varying(255),
    user_name character varying(255),
    user_role character varying(100),
    session_id character varying(255),
    ip_address character varying(45),
    user_agent text,
    action_type character varying(50) NOT NULL,
    resource_type character varying(100) NOT NULL,
    resource_name character varying(255) NOT NULL,
    resource_id character varying(255),
    action_description text,
    module character varying(100),
    old_values jsonb,
    new_values jsonb,
    changed_fields text[],
    patient_id uuid,
    provider_id uuid,
    appointment_id uuid,
    claim_id uuid,
    status character varying(50) DEFAULT 'success'::character varying,
    error_message text,
    duration_ms integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    retention_days integer DEFAULT 90
);


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.audit_logs IS 'Comprehensive audit trail for all forms, modals, and views in the system';


--
-- Name: COLUMN audit_logs.action_type; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.audit_logs.action_type IS 'Type of action: view, create, update, delete, submit, open, close';


--
-- Name: COLUMN audit_logs.resource_type; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.audit_logs.resource_type IS 'Type of resource: form, modal, view';


--
-- Name: COLUMN audit_logs.resource_name; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.audit_logs.resource_name IS 'Name of the specific form/modal/view component';


--
-- Name: COLUMN audit_logs.changed_fields; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.audit_logs.changed_fields IS 'Array of field names that were modified during update actions';


--
-- Name: COLUMN audit_logs.metadata; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.audit_logs.metadata IS 'Additional context like form validation errors, navigation path, etc.';


--
-- Name: booking_analytics; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.booking_analytics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid,
    event_type character varying(50) NOT NULL,
    appointment_id uuid,
    appointment_type_id uuid,
    patient_id uuid,
    session_id character varying(100),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE booking_analytics; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.booking_analytics IS 'Booking funnel analytics for insights and reporting';


--
-- Name: camp_inventory_allocations; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.camp_inventory_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camp_id uuid NOT NULL,
    item_id uuid NOT NULL,
    qty_issued numeric(12,3) NOT NULL,
    qty_consumed numeric(12,3) DEFAULT 0 NOT NULL,
    qty_returned numeric(12,3) DEFAULT 0 NOT NULL,
    issue_movement_id uuid,
    return_movement_id uuid,
    reconciled_at timestamp without time zone,
    reconciled_by uuid,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camp_alloc_balance_chk CHECK (((qty_consumed + qty_returned) <= qty_issued)),
    CONSTRAINT camp_alloc_consumed_chk CHECK ((qty_consumed >= (0)::numeric)),
    CONSTRAINT camp_alloc_issued_chk CHECK ((qty_issued > (0)::numeric)),
    CONSTRAINT camp_alloc_returned_chk CHECK ((qty_returned >= (0)::numeric))
);


--
-- Name: camp_registrations; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.camp_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camp_id uuid NOT NULL,
    token_no integer NOT NULL,
    full_name character varying(255) NOT NULL,
    phone character varying(50),
    email character varying(255),
    age_years integer,
    date_of_birth date,
    gender character varying(20),
    address text,
    city character varying(100),
    consent_given_at timestamp without time zone,
    consent_form_submission_id uuid,
    status character varying(20) DEFAULT 'registered'::character varying NOT NULL,
    patient_id uuid,
    promoted_at timestamp without time zone,
    registered_by uuid,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camp_reg_age_chk CHECK (((age_years IS NOT NULL) OR (date_of_birth IS NOT NULL))),
    CONSTRAINT camp_reg_age_range_chk CHECK (((age_years IS NULL) OR ((age_years >= 0) AND (age_years <= 130)))),
    CONSTRAINT camp_reg_status_chk CHECK (((status)::text = ANY ((ARRAY['registered'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'left_early'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE camp_registrations; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.camp_registrations IS 'Lightweight pre-patient records for camp attendees. Promoted to a patients row on first clinical touch; patient_id is null until then.';


--
-- Name: camp_services; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.camp_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camp_id uuid NOT NULL,
    offering_id uuid,
    label character varying(255),
    is_free boolean DEFAULT true NOT NULL,
    price numeric(12,2),
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camp_services_free_price_chk CHECK ((NOT (is_free AND (price IS NOT NULL) AND (price > (0)::numeric)))),
    CONSTRAINT camp_services_identified_chk CHECK (((offering_id IS NOT NULL) OR (label IS NOT NULL))),
    CONSTRAINT camp_services_price_chk CHECK (((price IS NULL) OR (price >= (0)::numeric)))
);


--
-- Name: camp_staff; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.camp_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camp_id uuid NOT NULL,
    user_id uuid NOT NULL,
    camp_role character varying(30) DEFAULT 'clinician'::character varying NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camp_staff_role_chk CHECK (((camp_role)::text = ANY ((ARRAY['lead'::character varying, 'registrar'::character varying, 'clinician'::character varying, 'nurse'::character varying, 'lab'::character varying, 'pharmacy'::character varying, 'volunteer'::character varying])::text[])))
);


--
-- Name: camp_station_visits; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.camp_station_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    registration_id uuid NOT NULL,
    station_id uuid NOT NULL,
    status character varying(20) DEFAULT 'queued'::character varying NOT NULL,
    queued_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    handled_by uuid,
    outcome character varying(30),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camp_visit_outcome_chk CHECK (((outcome IS NULL) OR ((outcome)::text = ANY ((ARRAY['normal'::character varying, 'referred'::character varying, 'follow_up'::character varying, 'declined'::character varying, 'no_show'::character varying])::text[])))),
    CONSTRAINT camp_visit_status_chk CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'skipped'::character varying])::text[])))
);


--
-- Name: camp_stations; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.camp_stations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camp_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    step_order integer DEFAULT 0 NOT NULL,
    offering_id uuid,
    form_template_id uuid,
    is_clinical boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: camps; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.camps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    location_id uuid,
    sponsor_name character varying(255),
    sponsor_contact character varying(255),
    funding_source character varying(30) DEFAULT 'self_funded'::character varying NOT NULL,
    is_free boolean DEFAULT true NOT NULL,
    budget numeric(14,2),
    currency character varying(3),
    starts_at timestamp without time zone NOT NULL,
    ends_at timestamp without time zone NOT NULL,
    timezone character varying(100),
    capacity integer,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    next_token_no integer DEFAULT 1 NOT NULL,
    published_at timestamp without time zone,
    started_at timestamp without time zone,
    closed_at timestamp without time zone,
    closed_by uuid,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT camps_budget_chk CHECK (((budget IS NULL) OR (budget >= (0)::numeric))),
    CONSTRAINT camps_capacity_chk CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT camps_funding_chk CHECK (((funding_source)::text = ANY ((ARRAY['self_funded'::character varying, 'sponsored'::character varying, 'government'::character varying, 'ngo'::character varying, 'csr'::character varying])::text[]))),
    CONSTRAINT camps_status_chk CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'in_progress'::character varying, 'closed'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT camps_window_chk CHECK ((ends_at > starts_at))
);


--
-- Name: TABLE camps; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.camps IS 'Medical camps: time-boxed events at a venue, run as a station pipeline. Clinical output is stamped onto the ordinary clinical tables with camp_id.';


--
-- Name: COLUMN camps.next_token_no; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.camps.next_token_no IS 'Next queue token to hand out. Incremented under a row lock on this camp so concurrent registration desks cannot collide.';


--
-- Name: claim_submissions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.claim_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid,
    submission_type character varying(50) DEFAULT 'EDI_837'::character varying,
    submission_date timestamp without time zone NOT NULL,
    submission_id character varying(100),
    clearinghouse_name character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    edi_content text,
    response_code character varying(50),
    response_message text,
    response_date timestamp without time zone,
    acknowledgment_number character varying(100),
    batch_number character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT claim_submissions_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('submitted'::character varying)::text, ('accepted'::character varying)::text, ('rejected'::character varying)::text, ('acknowledged'::character varying)::text]))),
    CONSTRAINT claim_submissions_submission_type_check CHECK (((submission_type)::text = ANY (ARRAY[('EDI_837'::character varying)::text, ('Manual'::character varying)::text, ('Portal'::character varying)::text, ('Fax'::character varying)::text, ('Mail'::character varying)::text])))
);


--
-- Name: TABLE claim_submissions; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.claim_submissions IS 'Tracks EDI 837 and other claim submissions to clearinghouses';


--
-- Name: COLUMN claim_submissions.submission_type; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.claim_submissions.submission_type IS 'Type of submission (EDI_837, Manual, Portal, etc.)';


--
-- Name: COLUMN claim_submissions.submission_id; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.claim_submissions.submission_id IS 'Unique submission ID from clearinghouse';


--
-- Name: COLUMN claim_submissions.edi_content; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.claim_submissions.edi_content IS 'Full EDI 837 file content for record keeping';


--
-- Name: COLUMN claim_submissions.acknowledgment_number; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.claim_submissions.acknowledgment_number IS '997 Functional Acknowledgment number';


--
-- Name: claims; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    practice_id uuid,
    patient_id uuid,
    claim_number character varying(50) NOT NULL,
    payer character varying(255),
    service_date date NOT NULL,
    amount numeric(10,2),
    status character varying(20) DEFAULT 'pending'::character varying,
    diagnosis_codes text[],
    procedure_codes text[],
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    clearinghouse_claim_id character varying(255),
    clearinghouse_status character varying(50),
    submitted_to_clearinghouse_at timestamp without time zone,
    clearinghouse_response jsonb,
    preapproval_id uuid,
    scrub_status character varying(12),
    scrub_result jsonb,
    scrubbed_at timestamp with time zone,
    scrub_override_by uuid,
    scrub_override_reason text
);


--
-- Name: denials; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.denials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    denial_number character varying(50) NOT NULL,
    claim_id uuid,
    patient_id uuid,
    insurance_payer_id uuid,
    denial_date date NOT NULL,
    denial_amount numeric(10,2) NOT NULL,
    denied_service_date date,
    denial_reason_code character varying(50),
    denial_reason_description text,
    denial_category character varying(100),
    appeal_status character varying(50) DEFAULT 'not_appealed'::character varying,
    appeal_deadline date,
    appeal_submitted_date date,
    appeal_decision_date date,
    appeal_outcome character varying(50),
    appeal_amount_recovered numeric(10,2) DEFAULT 0,
    status character varying(50) DEFAULT 'open'::character varying,
    resolution_date date,
    resolution_notes text,
    eob_number character varying(100),
    era_number character varying(100),
    supporting_documents jsonb,
    assigned_to character varying(255),
    priority character varying(20) DEFAULT 'medium'::character varying,
    notes text,
    internal_notes text,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT denials_appeal_status_check CHECK (((appeal_status)::text = ANY (ARRAY[('not_appealed'::character varying)::text, ('appeal_pending'::character varying)::text, ('appeal_submitted'::character varying)::text, ('appeal_approved'::character varying)::text, ('appeal_denied'::character varying)::text, ('appeal_withdrawn'::character varying)::text]))),
    CONSTRAINT denials_denial_category_check CHECK (((denial_category)::text = ANY (ARRAY[('Medical Necessity'::character varying)::text, ('Prior Authorization Required'::character varying)::text, ('Timely Filing'::character varying)::text, ('Coordination of Benefits'::character varying)::text, ('Duplicate Claim'::character varying)::text, ('Invalid/Missing Information'::character varying)::text, ('Non-Covered Service'::character varying)::text, ('Patient Eligibility'::character varying)::text, ('Coding Error'::character varying)::text, ('Other'::character varying)::text]))),
    CONSTRAINT denials_priority_check CHECK (((priority)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('urgent'::character varying)::text]))),
    CONSTRAINT denials_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('under_review'::character varying)::text, ('appealing'::character varying)::text, ('resolved'::character varying)::text, ('written_off'::character varying)::text, ('patient_responsibility'::character varying)::text])))
);


--
-- Name: TABLE denials; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.denials IS 'Tracks claim denials and appeal management';


--
-- Name: COLUMN denials.denial_number; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.denials.denial_number IS 'Unique identifier for the denial (e.g., DEN-2024-000001)';


--
-- Name: COLUMN denials.denial_category; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.denials.denial_category IS 'Category of denial reason for reporting and analysis';


--
-- Name: COLUMN denials.appeal_deadline; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.denials.appeal_deadline IS 'Deadline for submitting appeal (auto-calculated as 90 days from denial date)';


--
-- Name: COLUMN denials.supporting_documents; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.denials.supporting_documents IS 'JSON array of document references for appeal';


--
-- Name: COLUMN denials.priority; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.denials.priority IS 'Priority level for denial management';


--
-- Name: diagnoses; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.diagnoses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid,
    diagnosis_name character varying(255),
    diagnosis_code character varying(50),
    description text,
    severity character varying(50),
    status character varying(50) DEFAULT 'Active'::character varying,
    diagnosed_date date,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: diagnosis; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.diagnosis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    provider_id uuid,
    appointment_id uuid,
    diagnosis_code character varying(20),
    diagnosis_name character varying(255) NOT NULL,
    severity character varying(50),
    status character varying(50) DEFAULT 'Active'::character varying,
    diagnosed_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    soap_notes text,
    camp_id uuid
);


--
-- Name: TABLE diagnosis; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.diagnosis IS 'Stores patient diagnoses with ICD codes and severity';


--
-- Name: COLUMN diagnosis.soap_notes; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.diagnosis.soap_notes IS 'SOAP notes: Subjective, Objective, Assessment, and Plan documentation for the diagnosis';


--
-- Name: doctor_availability; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.doctor_availability (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_available boolean DEFAULT true,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_id uuid,
    CONSTRAINT check_time_order CHECK ((end_time > start_time)),
    CONSTRAINT doctor_availability_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: TABLE doctor_availability; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.doctor_availability IS 'Stores doctor weekly availability schedule (working hours)';


--
-- Name: doctor_time_off; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.doctor_time_off (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    reason character varying(500),
    is_recurring boolean DEFAULT false,
    recurrence_rule character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_date_order CHECK ((end_date >= start_date))
);


--
-- Name: TABLE doctor_time_off; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.doctor_time_off IS 'Tracks doctor time-off, vacations, and schedule exceptions';


--
-- Name: eligibility_checks; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.eligibility_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    claim_id uuid,
    payer_id uuid,
    payer_name character varying(200),
    member_id character varying(80),
    service_date date NOT NULL,
    service_type character varying(10) DEFAULT '30'::character varying NOT NULL,
    status character varying(12) NOT NULL,
    coverage jsonb DEFAULT '{}'::jsonb NOT NULL,
    message text,
    vendor_reference character varying(120),
    checked_by uuid,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT eligibility_checks_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'unknown'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: erx_message_queue; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.erx_message_queue (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prescription_id uuid,
    message_type character varying(50) NOT NULL,
    message_direction character varying(20) NOT NULL,
    pharmacy_id uuid,
    message_payload jsonb NOT NULL,
    message_status character varying(50) DEFAULT 'pending'::character varying,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    error_message text,
    sent_date timestamp without time zone,
    delivered_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE erx_message_queue; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.erx_message_queue IS 'Queue for electronic prescription messages to/from pharmacies';


--
-- Name: fhir_resources; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.fhir_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id character varying(100) NOT NULL,
    patient_id uuid,
    fhir_version character varying(10) DEFAULT 'R4'::character varying,
    resource_data jsonb NOT NULL,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: form_audit_logs; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.form_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    actor_id uuid,
    actor_role character varying(50),
    actor_name character varying(255),
    patient_id uuid,
    previous_state jsonb,
    new_state jsonb,
    change_details jsonb,
    ip_address inet,
    user_agent text,
    session_id character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: form_categories; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.form_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    color character varying(50),
    icon character varying(50),
    parent_id uuid,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: form_signatures; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.form_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    signer_name character varying(255) NOT NULL,
    signer_role character varying(100),
    signer_user_id uuid,
    signature_data text NOT NULL,
    signature_type character varying(50) DEFAULT 'drawn'::character varying,
    is_witness boolean DEFAULT false,
    relation character varying(100),
    ip_address inet,
    user_agent text,
    signed_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: form_submissions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    template_name character varying(255),
    template_version character varying(20),
    patient_id uuid,
    appointment_id uuid,
    intake_flow_id uuid,
    submitted_by uuid,
    submitted_by_role character varying(50),
    form_data jsonb DEFAULT '{}'::jsonb,
    status character varying(50) DEFAULT 'draft'::character varying,
    language character varying(10) DEFAULT 'en'::character varying,
    ip_address inet,
    user_agent text,
    submitted_at timestamp without time zone,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    reviewer_notes text,
    expires_at timestamp without time zone,
    is_signed boolean DEFAULT false,
    fhir_response jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    source character varying(30) DEFAULT 'template'::character varying,
    source_message_id uuid,
    document_attachment_id uuid,
    document_name character varying(255),
    document_action character varying(20) DEFAULT 'acknowledge'::character varying,
    CONSTRAINT form_submissions_document_action_check CHECK (((document_action IS NULL) OR ((document_action)::text = ANY ((ARRAY['acknowledge'::character varying, 'sign'::character varying])::text[])))),
    CONSTRAINT form_submissions_has_subject CHECK (((template_id IS NOT NULL) OR (document_attachment_id IS NOT NULL))),
    CONSTRAINT form_submissions_source_check CHECK (((source)::text = ANY ((ARRAY['template'::character varying, 'secure_message'::character varying])::text[])))
);


--
-- Name: form_template_versions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.form_template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    version character varying(20) NOT NULL,
    version_number integer NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    fhir_questionnaire jsonb,
    change_summary text,
    changed_by uuid,
    is_published boolean DEFAULT false,
    published_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: form_templates; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.form_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255),
    description text,
    category_id uuid,
    category_slug character varying(100),
    subcategory character varying(100),
    template_type character varying(100),
    is_system_template boolean DEFAULT false,
    is_active boolean DEFAULT true,
    version character varying(20) DEFAULT '1.0'::character varying,
    version_number integer DEFAULT 1,
    fields jsonb DEFAULT '[]'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    fhir_questionnaire jsonb,
    role_visibility jsonb DEFAULT '["admin", "provider", "staff", "patient"]'::jsonb,
    require_signature boolean DEFAULT false,
    require_witness boolean DEFAULT false,
    allow_pdf_export boolean DEFAULT true,
    languages jsonb DEFAULT '["en"]'::jsonb,
    translations jsonb DEFAULT '{}'::jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    intake_flow_eligible boolean DEFAULT true,
    specialty character varying(100),
    compliance_tags jsonb DEFAULT '[]'::jsonb,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    source_pack character varying(60),
    source_pack_version integer,
    is_customised boolean DEFAULT false NOT NULL,
    department_id uuid
);


--
-- Name: healthcare_offerings; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.healthcare_offerings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id uuid,
    duration_minutes integer,
    requires_preparation boolean DEFAULT false,
    preparation_instructions text,
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    available_online boolean DEFAULT true,
    requires_referral boolean DEFAULT false,
    cpt_codes text[],
    icd_codes text[],
    hcpcs_codes text[],
    min_age integer,
    max_age integer,
    gender_restriction character varying(20),
    contraindications text,
    prerequisites text,
    allowed_provider_specializations text[],
    image_url text,
    video_url text,
    brochure_url text,
    consent_form_required boolean DEFAULT false,
    consent_form_url text,
    seo_title character varying(255),
    seo_description text,
    seo_keywords text[],
    view_count integer DEFAULT 0,
    booking_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    consent_form_id uuid,
    source_pack character varying(60),
    source_pack_version integer,
    is_customised boolean DEFAULT false NOT NULL,
    department_id uuid
);


--
-- Name: TABLE healthcare_offerings; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.healthcare_offerings IS 'Individual medical services and procedures available to patients';


--
-- Name: COLUMN healthcare_offerings.is_customised; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.healthcare_offerings.is_customised IS 'True once a user has edited this row. A pack upgrade never overwrites a customised row; it reports it as a conflict instead.';


--
-- Name: COLUMN healthcare_offerings.department_id; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.healthcare_offerings.department_id IS 'Reserved for department-level configuration (multi-specialty hospitals). NULL means practice-wide.';


--
-- Name: insurance_payers; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.insurance_payers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    payer_id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    payer_type character varying(50) DEFAULT 'insurance'::character varying,
    phone character varying(50),
    email character varying(255),
    website character varying(255),
    address text,
    city character varying(100),
    state character varying(50),
    zip_code character varying(20),
    contact_person character varying(255),
    contact_phone character varying(50),
    contact_email character varying(255),
    claim_submission_method character varying(50),
    claim_submission_address text,
    electronic_payer_id character varying(100),
    timely_filing_limit integer DEFAULT 365,
    prior_authorization_required boolean DEFAULT false,
    accepts_assignment boolean DEFAULT true,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE insurance_payers; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.insurance_payers IS 'Insurance payers and organizations for claims submission';


--
-- Name: COLUMN insurance_payers.payer_id; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.insurance_payers.payer_id IS 'Unique identifier for the payer (e.g., BC001)';


--
-- Name: COLUMN insurance_payers.electronic_payer_id; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.insurance_payers.electronic_payer_id IS 'EDI payer ID for electronic claims submission';


--
-- Name: COLUMN insurance_payers.timely_filing_limit; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.insurance_payers.timely_filing_limit IS 'Number of days within which claims must be filed';


--
-- Name: intake_flow_templates; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.intake_flow_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flow_id uuid NOT NULL,
    template_id uuid NOT NULL,
    step_order integer DEFAULT 0 NOT NULL,
    is_required boolean DEFAULT true,
    is_conditional boolean DEFAULT false,
    condition_rules jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: inventory_categories; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.inventory_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    parent_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_pack character varying(60),
    source_pack_version integer,
    is_customised boolean DEFAULT false NOT NULL,
    department_id uuid,
    CONSTRAINT chk_inv_cat_code_nonempty CHECK ((length(TRIM(BOTH FROM code)) > 0)),
    CONSTRAINT chk_inv_cat_name_nonempty CHECK ((length(TRIM(BOTH FROM name)) > 0))
);


--
-- Name: inventory_items; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_number character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id uuid,
    supplier_id uuid,
    unit_of_measure character varying(20) NOT NULL,
    item_type character varying(30) NOT NULL,
    sku character varying(50),
    barcode character varying(100),
    unit_cost numeric(15,2) NOT NULL,
    selling_price numeric(15,2),
    quantity_on_hand numeric(12,3) DEFAULT 0 NOT NULL,
    quantity_reserved numeric(12,3) DEFAULT 0 NOT NULL,
    quantity_on_order numeric(12,3) DEFAULT 0 NOT NULL,
    reorder_level numeric(12,3) DEFAULT 0 NOT NULL,
    reorder_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    expiry_date date,
    lot_number character varying(50),
    is_lot_tracked boolean DEFAULT false NOT NULL,
    is_expiry_tracked boolean DEFAULT false NOT NULL,
    requires_refrigeration boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    linked_account_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    low_stock_alerted_at timestamp with time zone,
    CONSTRAINT chk_inv_item_name_nonempty CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT chk_inv_item_number_format CHECK (((item_number)::text ~ '^[A-Z0-9\-]+$'::text)),
    CONSTRAINT chk_inv_item_qty_on_hand CHECK ((quantity_on_hand >= (0)::numeric)),
    CONSTRAINT chk_inv_item_qty_on_order CHECK ((quantity_on_order >= (0)::numeric)),
    CONSTRAINT chk_inv_item_qty_reserved CHECK ((quantity_reserved >= (0)::numeric)),
    CONSTRAINT chk_inv_item_reorder_level CHECK ((reorder_level >= (0)::numeric)),
    CONSTRAINT chk_inv_item_reorder_qty CHECK ((reorder_quantity >= (0)::numeric)),
    CONSTRAINT inventory_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['medication'::character varying, 'supply'::character varying, 'equipment'::character varying, 'consumable'::character varying, 'reagent'::character varying, 'implant'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT inventory_items_selling_price_check CHECK (((selling_price IS NULL) OR (selling_price >= (0)::numeric))),
    CONSTRAINT inventory_items_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'discontinued'::character varying, 'out_of_stock'::character varying])::text[]))),
    CONSTRAINT inventory_items_unit_cost_check CHECK ((unit_cost >= (0)::numeric)),
    CONSTRAINT inventory_items_unit_of_measure_check CHECK (((unit_of_measure)::text = ANY ((ARRAY['unit'::character varying, 'pack'::character varying, 'box'::character varying, 'kg'::character varying, 'g'::character varying, 'l'::character varying, 'ml'::character varying, 'each'::character varying, 'dozen'::character varying, 'case'::character varying])::text[])))
);


--
-- Name: inventory_purchase_orders; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.inventory_purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number character varying(30) NOT NULL,
    supplier_id uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_date date,
    received_date date,
    total_amount numeric(15,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
    shipping_amount numeric(15,2) DEFAULT 0 NOT NULL,
    notes text,
    linked_account_id uuid,
    approved_by uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_inv_po_expected_date CHECK (((expected_date IS NULL) OR (expected_date >= order_date))),
    CONSTRAINT inventory_purchase_orders_shipping_amount_check CHECK ((shipping_amount >= (0)::numeric)),
    CONSTRAINT inventory_purchase_orders_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'approved'::character varying, 'partially_received'::character varying, 'received'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT inventory_purchase_orders_tax_amount_check CHECK ((tax_amount >= (0)::numeric)),
    CONSTRAINT inventory_purchase_orders_total_amount_check CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: inventory_role_permissions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.inventory_role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name character varying(50) NOT NULL,
    resource character varying(50) NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_create boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    can_approve boolean DEFAULT false NOT NULL,
    can_export boolean DEFAULT false NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_role_permissions_resource_check CHECK (((resource)::text = ANY ((ARRAY['items'::character varying, 'categories'::character varying, 'suppliers'::character varying, 'stock_movements'::character varying, 'purchase_orders'::character varying])::text[])))
);


--
-- Name: inventory_stock_movements; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.inventory_stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    movement_number character varying(30) NOT NULL,
    item_id uuid NOT NULL,
    movement_type character varying(30) NOT NULL,
    reference_type character varying(30),
    reference_id uuid,
    quantity numeric(12,3) NOT NULL,
    unit_cost numeric(15,2),
    lot_number character varying(50),
    expiry_date date,
    movement_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    balance_after numeric(12,3),
    journal_entry_id uuid,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    location_id uuid,
    CONSTRAINT chk_inv_mov_quantity_nonzero CHECK ((quantity <> (0)::numeric)),
    CONSTRAINT inventory_stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['receipt'::character varying, 'issue'::character varying, 'adjustment'::character varying, 'transfer'::character varying, 'return'::character varying, 'write_off'::character varying, 'opening'::character varying])::text[]))),
    CONSTRAINT inventory_stock_movements_reference_type_check CHECK (((reference_type IS NULL) OR ((reference_type)::text = ANY ((ARRAY['purchase_order'::character varying, 'patient'::character varying, 'department'::character varying, 'adjustment'::character varying, 'camp'::character varying])::text[]))))
);


--
-- Name: COLUMN inventory_stock_movements.location_id; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.inventory_stock_movements.location_id IS 'Site this stock movement happened at. NULL means the tenant primary site.';


--
-- Name: inventory_suppliers; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.inventory_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_number character varying(20),
    name character varying(255) NOT NULL,
    contact_name character varying(100),
    email character varying(255),
    phone character varying(30),
    address text,
    city character varying(100),
    country character varying(3),
    payment_terms character varying(30),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    tax_id character varying(50),
    notes text,
    linked_account_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_inv_sup_name_nonempty CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT inventory_suppliers_email_check CHECK (((email IS NULL) OR ((email)::text ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'::text))),
    CONSTRAINT inventory_suppliers_payment_terms_check CHECK (((payment_terms IS NULL) OR ((payment_terms)::text = ANY ((ARRAY['net_30'::character varying, 'net_60'::character varying, 'net_90'::character varying, 'immediate'::character varying, 'custom'::character varying])::text[])))),
    CONSTRAINT inventory_suppliers_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'blacklisted'::character varying])::text[])))
);


--
-- Name: laboratories; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.laboratories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lab_name character varying(255) NOT NULL,
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(2),
    zip_code character varying(10),
    phone character varying(20),
    fax character varying(20),
    email character varying(255),
    website character varying(255),
    clia_number character varying(50),
    npi character varying(20),
    is_active boolean DEFAULT true,
    accepts_electronic_orders boolean DEFAULT true,
    specialty character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: locations; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    location_type character varying(30) DEFAULT 'clinic'::character varying NOT NULL,
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(2),
    postal_code character varying(20),
    phone character varying(50),
    email character varying(255),
    latitude numeric(9,6),
    longitude numeric(9,6),
    timezone character varying(100),
    notes text,
    is_primary boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT locations_type_chk CHECK (((location_type)::text = ANY ((ARRAY['clinic'::character varying, 'camp'::character varying, 'mobile'::character varying, 'partner'::character varying])::text[])))
);


--
-- Name: TABLE locations; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.locations IS 'Physical sites belonging to this tenant: clinics, branches, camp venues, mobile units. Exactly one row is is_primary.';


--
-- Name: COLUMN locations.location_type; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.locations.location_type IS 'clinic = owned premises, camp = temporary off-site venue, mobile = vehicle/van, partner = third-party premises';


--
-- Name: medical_records; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.medical_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    provider_id uuid,
    record_type character varying(50) NOT NULL,
    record_date date NOT NULL,
    title character varying(255),
    description text,
    diagnosis text,
    treatment text,
    medications jsonb,
    attachments jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source character varying(30) DEFAULT 'manual'::character varying,
    source_message_id uuid,
    review_status character varying(20),
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    reviewer_notes text,
    camp_id uuid,
    CONSTRAINT medical_records_review_status_check CHECK (((review_status IS NULL) OR ((review_status)::text = ANY ((ARRAY['pending_review'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[]))))
);


--
-- Name: module_permissions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.module_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module character varying(50) NOT NULL,
    role_name character varying(50) NOT NULL,
    resource character varying(60) NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_create boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    can_approve boolean DEFAULT false NOT NULL,
    can_export boolean DEFAULT false NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE module_permissions; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.module_permissions IS 'Fine-grained access control: one row per (module, role, resource) with six action flags. Absence of a row is NOT a denial — see middleware/modulePermissions.js, which falls back to the role defaults so a practice that has never opened the permissions screen keeps working.';


--
-- Name: COLUMN module_permissions.module; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.module_permissions.module IS 'Module key from utils/permissionRegistry.js. Not constrained here on purpose; the route validates against the registry.';


--
-- Name: offering_form_links; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.offering_form_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid NOT NULL,
    form_template_id text NOT NULL,
    form_template_name character varying(255),
    trigger_on character varying(50) DEFAULT 'order'::character varying,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: offering_insurance_mappings; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.offering_insurance_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid,
    insurance_provider character varying(255) NOT NULL,
    insurance_plan character varying(255),
    is_covered boolean DEFAULT true,
    coverage_percentage numeric(5,2),
    copay_amount numeric(10,2),
    deductible_applies boolean DEFAULT false,
    requires_preauthorization boolean DEFAULT false,
    preauth_phone character varying(50),
    preauth_instructions text,
    primary_cpt_code character varying(20),
    modifier_codes text[],
    diagnosis_codes_required text[],
    coverage_notes text,
    billing_notes text,
    is_active boolean DEFAULT true,
    effective_from date,
    effective_until date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE offering_insurance_mappings; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.offering_insurance_mappings IS 'Insurance coverage details for specific offerings';


--
-- Name: offering_packages; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.offering_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id uuid,
    package_type character varying(50) DEFAULT 'bundle'::character varying,
    validity_days integer,
    max_uses integer,
    base_price numeric(10,2),
    discount_percentage numeric(5,2),
    final_price numeric(10,2),
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    available_from date,
    available_until date,
    benefits text[],
    features text[],
    image_url text,
    terms_and_conditions text,
    enrollment_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE offering_packages; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.offering_packages IS 'Bundled healthcare service packages and memberships';


--
-- Name: offering_pricing; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.offering_pricing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid,
    pricing_type character varying(50) NOT NULL,
    pricing_name character varying(255),
    base_price numeric(10,2) NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    final_price numeric(10,2),
    insurance_provider character varying(255),
    copay_amount numeric(10,2),
    requires_preauthorization boolean DEFAULT false,
    effective_from date,
    effective_until date,
    is_active boolean DEFAULT true,
    additional_fees jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE offering_pricing; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.offering_pricing IS 'Multiple pricing tiers for offerings (cash, insurance, membership)';


--
-- Name: offering_promotions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.offering_promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    promo_code character varying(50),
    discount_type character varying(20),
    discount_value numeric(10,2),
    applicable_to character varying(20) DEFAULT 'all'::character varying,
    offering_ids uuid[],
    package_ids uuid[],
    category_ids uuid[],
    valid_from timestamp without time zone,
    valid_until timestamp without time zone,
    max_uses integer,
    max_uses_per_patient integer DEFAULT 1,
    current_uses integer DEFAULT 0,
    min_purchase_amount numeric(10,2),
    new_patients_only boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE offering_promotions; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.offering_promotions IS 'Promotional campaigns and discount codes for offerings';


--
-- Name: offering_reviews; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.offering_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid,
    patient_id uuid,
    appointment_id uuid,
    rating integer,
    review_text text,
    is_approved boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    moderated_by uuid,
    moderated_at timestamp without time zone,
    provider_response text,
    response_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE offering_reviews; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.offering_reviews IS 'Patient reviews and ratings for healthcare offerings';


--
-- Name: package_offerings; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.package_offerings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    package_id uuid,
    offering_id uuid,
    quantity_included integer DEFAULT 1,
    is_optional boolean DEFAULT false,
    display_order integer DEFAULT 0,
    price_override numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE package_offerings; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.package_offerings IS 'Junction table linking packages to individual offerings';


--
-- Name: patient_allergies; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.patient_allergies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid,
    allergen_type character varying(50) NOT NULL,
    allergen_name character varying(255) NOT NULL,
    ndc_code character varying(20),
    reaction_type character varying(100),
    severity character varying(50),
    onset_date date,
    reported_date date DEFAULT CURRENT_DATE,
    reported_by uuid,
    verified boolean DEFAULT false,
    verified_by uuid,
    verified_date timestamp without time zone,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE patient_allergies; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.patient_allergies IS 'Patient allergy and adverse reaction tracking';


--
-- Name: patient_consent_forms; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.patient_consent_forms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    consent_type character varying(100) NOT NULL,
    consent_title character varying(255) NOT NULL,
    consent_description text,
    consent_content text NOT NULL,
    version character varying(50) DEFAULT '1.0'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    signed_at timestamp without time zone,
    signature_data text,
    signature_method character varying(50),
    witness_name character varying(255),
    witness_signature text,
    ip_address character varying(45),
    user_agent text,
    expires_at timestamp without time zone,
    revoked_at timestamp without time zone,
    revocation_reason text,
    parent_guardian_name character varying(255),
    parent_guardian_relation character varying(100),
    attachments jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE patient_consent_forms; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.patient_consent_forms IS 'Manages patient consent forms with digital signatures and audit trail';


--
-- Name: patient_intake_flows; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.patient_intake_flows (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    flow_name character varying(255) NOT NULL,
    flow_type character varying(100) NOT NULL,
    current_step integer DEFAULT 1,
    total_steps integer NOT NULL,
    steps_completed jsonb DEFAULT '[]'::jsonb,
    step_data jsonb DEFAULT '{}'::jsonb,
    status character varying(50) DEFAULT 'in_progress'::character varying,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    expires_at timestamp without time zone,
    reminder_sent boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE patient_intake_flows; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.patient_intake_flows IS 'Tracks multi-step intake workflows and patient progress';


--
-- Name: patient_intake_forms; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.patient_intake_forms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    form_type character varying(100) NOT NULL,
    form_name character varying(255) NOT NULL,
    form_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    submitted_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    reviewed_by uuid,
    notes text,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE patient_intake_forms; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.patient_intake_forms IS 'Stores patient intake forms with flexible JSON data structure';


--
-- Name: patient_offering_enrollments; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.patient_offering_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    package_id uuid,
    offering_id uuid,
    enrollment_date date DEFAULT CURRENT_DATE NOT NULL,
    expiry_date date,
    status character varying(50) DEFAULT 'active'::character varying,
    total_allowed_uses integer DEFAULT 1,
    used_count integer DEFAULT 0,
    remaining_uses integer,
    amount_paid numeric(10,2),
    payment_method character varying(50),
    payment_status character varying(50) DEFAULT 'pending'::character varying,
    payment_id uuid,
    notes text,
    cancellation_reason text,
    cancelled_at timestamp without time zone,
    cancelled_by uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE patient_offering_enrollments; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.patient_offering_enrollments IS 'Track patient enrollments in packages and offerings';


--
-- Name: patient_pharmacies; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.patient_pharmacies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid,
    pharmacy_id uuid,
    is_preferred boolean DEFAULT false,
    added_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE patient_pharmacies; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.patient_pharmacies IS 'Patient preferred pharmacy selections';


--
-- Name: patient_portal_sessions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.patient_portal_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    session_token character varying(255) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patients; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.patients (
    practice_id uuid,
    mrn character varying(50) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    date_of_birth date NOT NULL,
    gender character varying(20),
    phone character varying(20),
    email character varying(255),
    address text,
    emergency_contact jsonb,
    insurance_info jsonb,
    status character varying(20) DEFAULT 'active'::character varying,
    portal_enabled boolean DEFAULT false,
    portal_password_hash character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    height character varying(20),
    weight character varying(20),
    blood_type character varying(10),
    allergies text,
    past_history text,
    family_history text,
    current_medications text,
    id uuid NOT NULL,
    country character varying(2),
    timezone character varying(100),
    insurance_payer_id uuid,
    city character varying(100),
    state character varying(2),
    zip character varying(10),
    insurance character varying(100),
    insurance_id character varying(100),
    telehealth_preference character varying(50) DEFAULT NULL::character varying,
    social_history text,
    previous_medications jsonb DEFAULT '[]'::jsonb,
    additional_current_medications jsonb DEFAULT '[]'::jsonb
);


--
-- Name: TABLE patients; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.patients IS 'Patient records. Users with patient role will have entries here. Users can have multiple roles.';


--
-- Name: COLUMN patients.height; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.height IS 'Patient height (e.g., 5''10", 178cm)';


--
-- Name: COLUMN patients.weight; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.weight IS 'Patient weight (e.g., 180 lbs, 82kg)';


--
-- Name: COLUMN patients.blood_type; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.blood_type IS 'Patient blood type (e.g., O+, A-, AB+)';


--
-- Name: COLUMN patients.id; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.id IS 'Primary key - references users.id directly (no separate user_id column)';


--
-- Name: COLUMN patients.country; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, CA, GB)';


--
-- Name: COLUMN patients.timezone; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.timezone IS 'IANA timezone string (e.g., America/New_York)';


--
-- Name: COLUMN patients.insurance_payer_id; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.insurance_payer_id IS 'Foreign key to insurance_payers table - patients default/primary insurance payer';


--
-- Name: COLUMN patients.city; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.city IS 'Patient city';


--
-- Name: COLUMN patients.state; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.state IS 'Patient state (2-letter code)';


--
-- Name: COLUMN patients.zip; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.zip IS 'Patient ZIP/postal code';


--
-- Name: COLUMN patients.insurance; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.insurance IS 'Insurance provider name';


--
-- Name: COLUMN patients.insurance_id; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.insurance_id IS 'Insurance member ID';


--
-- Name: COLUMN patients.telehealth_preference; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.telehealth_preference IS 'Preferred telehealth provider (zoom, google_meet, microsoft_teams, webex). NULL = clinic default.';


--
-- Name: COLUMN patients.social_history; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.social_history IS 'Patient social history including smoking, alcohol, occupation, etc.';


--
-- Name: COLUMN patients.previous_medications; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.previous_medications IS 'JSON array of previous medications with NDC codes and drug details';


--
-- Name: COLUMN patients.additional_current_medications; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.patients.additional_current_medications IS 'JSON array of additional current medications not from prescriptions';


--
-- Name: payment_postings; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.payment_postings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    posting_number character varying(50) NOT NULL,
    claim_id uuid,
    patient_id uuid,
    insurance_payer_id uuid,
    check_number character varying(100),
    check_date date,
    payment_amount numeric(10,2) NOT NULL,
    allowed_amount numeric(10,2),
    deductible_amount numeric(10,2) DEFAULT 0,
    coinsurance_amount numeric(10,2) DEFAULT 0,
    copay_amount numeric(10,2) DEFAULT 0,
    adjustment_amount numeric(10,2) DEFAULT 0,
    adjustment_reason character varying(255),
    adjustment_code character varying(50),
    posting_date date NOT NULL,
    status character varying(50) DEFAULT 'posted'::character varying,
    payment_method character varying(50) DEFAULT 'check'::character varying,
    era_number character varying(100),
    eob_number character varying(100),
    notes text,
    internal_notes text,
    posted_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_postings_payment_method_check CHECK (((payment_method)::text = ANY (ARRAY[('check'::character varying)::text, ('eft'::character varying)::text, ('credit_card'::character varying)::text, ('cash'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT payment_postings_status_check CHECK (((status)::text = ANY (ARRAY[('posted'::character varying)::text, ('pending'::character varying)::text, ('reversed'::character varying)::text, ('voided'::character varying)::text])))
);


--
-- Name: TABLE payment_postings; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.payment_postings IS 'Tracks insurance payment postings to claims';


--
-- Name: COLUMN payment_postings.posting_number; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.payment_postings.posting_number IS 'Unique identifier for the payment posting (e.g., POST-2024-000001)';


--
-- Name: COLUMN payment_postings.allowed_amount; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.payment_postings.allowed_amount IS 'Amount allowed by insurance for the claim';


--
-- Name: COLUMN payment_postings.adjustment_amount; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.payment_postings.adjustment_amount IS 'Amount adjusted (write-off)';


--
-- Name: COLUMN payment_postings.era_number; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.payment_postings.era_number IS 'Electronic Remittance Advice number';


--
-- Name: COLUMN payment_postings.eob_number; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.payment_postings.eob_number IS 'Explanation of Benefits number';


--
-- Name: payments; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.payments (
    payment_number character varying(50),
    patient_id uuid,
    claim_id uuid,
    amount numeric(10,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    payment_status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    transaction_id character varying(100),
    card_last_four character varying(4),
    card_brand character varying(20),
    payment_date timestamp without time zone,
    description text,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text
);


--
-- Name: TABLE payments; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.payments IS 'Payment tracking with UUID primary key';


--
-- Name: COLUMN payments.id; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON COLUMN tenant_default.payments.id IS 'UUID primary key for payments';


--
-- Name: pharmacies; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.pharmacies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ncpdp_id character varying(20),
    npi character varying(20),
    pharmacy_name character varying(255) NOT NULL,
    chain_name character varying(255),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(2),
    zip_code character varying(10),
    phone character varying(20),
    fax character varying(20),
    email character varying(255),
    website character varying(255),
    is_24_hours boolean DEFAULT false,
    accepts_erx boolean DEFAULT true,
    erx_endpoint_url character varying(500),
    erx_system_type character varying(50),
    delivery_available boolean DEFAULT false,
    drive_through boolean DEFAULT false,
    accepts_insurance boolean DEFAULT true,
    preferred_network boolean DEFAULT false,
    distance_miles numeric(10,2),
    latitude numeric(10,8),
    longitude numeric(11,8),
    operating_hours jsonb,
    services jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE pharmacies; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.pharmacies IS 'Network of pharmacies that accept electronic prescriptions';


--
-- Name: portal_invites; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.portal_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    token_hash character(64) NOT NULL,
    email character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_by uuid,
    emailed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: preapprovals; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.preapprovals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    preapproval_number character varying(100) NOT NULL,
    patient_id uuid,
    insurance_payer_id uuid,
    requested_service character varying(255) NOT NULL,
    diagnosis_codes jsonb,
    procedure_codes jsonb,
    service_start_date date,
    service_end_date date,
    estimated_cost numeric(10,2),
    authorization_number character varying(100),
    status character varying(50) DEFAULT 'Pending'::character varying,
    clearinghouse_request_id character varying(255),
    clearinghouse_status character varying(50),
    submitted_to_clearinghouse_at timestamp without time zone,
    clearinghouse_response jsonb,
    approved_by character varying(255),
    approved_at timestamp without time zone,
    approval_valid_until date,
    denied_reason text,
    clinical_notes text,
    supporting_documents jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: prescription_history; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.prescription_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prescription_id uuid,
    action character varying(50) NOT NULL,
    action_by uuid,
    action_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    old_status character varying(50),
    new_status character varying(50),
    pharmacy_id uuid,
    fill_number integer,
    quantity_dispensed integer,
    pharmacist_name character varying(255),
    pharmacist_license character varying(50),
    notes text,
    metadata jsonb
);


--
-- Name: TABLE prescription_history; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.prescription_history IS 'Audit log of all prescription actions and fills';


--
-- Name: provider_booking_config; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.provider_booking_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id uuid NOT NULL,
    booking_url_slug character varying(100),
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    slot_interval_minutes integer DEFAULT 15,
    max_concurrent_bookings integer DEFAULT 1,
    allow_public_booking boolean DEFAULT true,
    require_patient_account boolean DEFAULT false,
    send_confirmation_email boolean DEFAULT true,
    send_reminder_email boolean DEFAULT true,
    reminder_hours_before integer DEFAULT 24,
    allow_cancellation boolean DEFAULT true,
    cancellation_hours_before integer DEFAULT 24,
    allow_rescheduling boolean DEFAULT true,
    reschedule_hours_before integer DEFAULT 24,
    booking_instructions text,
    custom_fields jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE provider_booking_config; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.provider_booking_config IS 'Provider-specific booking settings and public booking URLs';


--
-- Name: recurring_appointments; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.recurring_appointments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    appointment_type_id uuid,
    recurrence_rule character varying(255) NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone,
    duration_minutes integer NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE recurring_appointments; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.recurring_appointments IS 'Manages recurring appointment series';


--
-- Name: schema_migrations; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.schema_migrations (
    version integer NOT NULL,
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_categories; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.service_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    icon character varying(100),
    color character varying(50),
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_pack character varying(60),
    source_pack_version integer,
    is_customised boolean DEFAULT false NOT NULL,
    department_id uuid
);


--
-- Name: TABLE service_categories; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.service_categories IS 'Categories for organizing healthcare offerings';


--
-- Name: sick_note_requests; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.sick_note_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    purpose character varying(12) DEFAULT 'work'::character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text NOT NULL,
    status character varying(10) DEFAULT 'pending'::character varying NOT NULL,
    sick_note_id uuid,
    decided_by uuid,
    decision_reason text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sick_note_requests_check CHECK ((end_date >= start_date)),
    CONSTRAINT sick_note_requests_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['work'::character varying, 'school'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT sick_note_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'issued'::character varying, 'declined'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: sick_notes; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.sick_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference character varying(32) NOT NULL,
    patient_id uuid NOT NULL,
    purpose character varying(12) DEFAULT 'work'::character varying NOT NULL,
    fitness character varying(12) NOT NULL,
    assessed_on date NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    condition_text text,
    adjustments text[] DEFAULT '{}'::text[] NOT NULL,
    comments text,
    follow_up boolean DEFAULT false NOT NULL,
    issued_by uuid NOT NULL,
    issuer_name character varying(200) NOT NULL,
    issuer_title character varying(100),
    issuer_registration character varying(100),
    status character varying(10) DEFAULT 'issued'::character varying NOT NULL,
    void_reason text,
    voided_by uuid,
    voided_at timestamp with time zone,
    emailed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sick_notes_check CHECK ((end_date >= start_date)),
    CONSTRAINT sick_notes_fitness_check CHECK (((fitness)::text = ANY ((ARRAY['not_fit'::character varying, 'may_be_fit'::character varying])::text[]))),
    CONSTRAINT sick_notes_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['work'::character varying, 'school'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT sick_notes_status_check CHECK (((status)::text = ANY ((ARRAY['issued'::character varying, 'voided'::character varying])::text[])))
);


--
-- Name: staff_notification_preferences; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.staff_notification_preferences (
    user_id uuid NOT NULL,
    event_key character varying(60) NOT NULL,
    channel character varying(20) NOT NULL,
    enabled boolean NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_notification_preferences_channel_check CHECK (((channel)::text = ANY ((ARRAY['in_app'::character varying, 'email'::character varying, 'whatsapp'::character varying])::text[])))
);


--
-- Name: telehealth_sessions; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.telehealth_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid,
    patient_id uuid,
    provider_id uuid,
    session_status character varying(20) DEFAULT 'scheduled'::character varying,
    room_id character varying(100) NOT NULL,
    meeting_url text,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    duration_minutes integer,
    recording_url text,
    recording_enabled boolean DEFAULT false,
    participants jsonb DEFAULT '[]'::jsonb,
    session_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    provider_type character varying(50) DEFAULT 'medflow'::character varying
);


--
-- Name: vendor_integration_settings; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.vendor_integration_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT false,
    api_key character varying(500),
    api_secret character varying(500),
    client_id character varying(500),
    client_secret character varying(500),
    username character varying(255),
    password character varying(500),
    base_url character varying(500),
    sandbox_mode boolean DEFAULT true,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_tested_at timestamp without time zone,
    test_status character varying(50),
    test_message text
);


--
-- Name: TABLE vendor_integration_settings; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.vendor_integration_settings IS 'Stores configuration and credentials for healthcare vendor integrations (Surescripts, Labcorp, Optum)';


--
-- Name: vendor_transaction_log; Type: TABLE; Schema: tenant_default; Owner: -
--

CREATE TABLE tenant_default.vendor_transaction_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_type character varying(50) NOT NULL,
    transaction_type character varying(100) NOT NULL,
    request_data jsonb,
    response_data jsonb,
    status character varying(50),
    error_message text,
    external_id character varying(255),
    internal_reference_id uuid,
    patient_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


--
-- Name: TABLE vendor_transaction_log; Type: COMMENT; Schema: tenant_default; Owner: -
--

COMMENT ON TABLE tenant_default.vendor_transaction_log IS 'Audit log for all vendor API transactions';


--
-- Name: directory_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directory_events ALTER COLUMN id SET DEFAULT nextval('public.directory_events_id_seq'::regclass);


--
-- Name: organization_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings ALTER COLUMN id SET DEFAULT nextval('public.organization_settings_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: subscription_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans ALTER COLUMN id SET DEFAULT nextval('public.subscription_plans_id_seq'::regclass);


--
-- Name: user_role_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_history ALTER COLUMN id SET DEFAULT nextval('public.user_role_history_id_seq'::regclass);


--
-- Name: appointment_types id; Type: DEFAULT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointment_types ALTER COLUMN id SET DEFAULT nextval('tenant_default.appointment_types_id_seq'::regclass);


--
-- Name: backup_provider_settings id; Type: DEFAULT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.backup_provider_settings ALTER COLUMN id SET DEFAULT nextval('tenant_default.backup_provider_settings_id_seq'::regclass);


--
-- Name: campaigns id; Type: DEFAULT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.campaigns ALTER COLUMN id SET DEFAULT nextval('tenant_default.campaigns_id_seq'::regclass);


--
-- Name: clinic_appointment_settings id; Type: DEFAULT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.clinic_appointment_settings ALTER COLUMN id SET DEFAULT nextval('tenant_default.clinic_appointment_settings_id_seq'::regclass);


--
-- Name: clinic_info id; Type: DEFAULT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.clinic_info ALTER COLUMN id SET DEFAULT nextval('tenant_default.clinic_info_id_seq'::regclass);


--
-- Name: clinic_working_hours id; Type: DEFAULT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.clinic_working_hours ALTER COLUMN id SET DEFAULT nextval('tenant_default.clinic_working_hours_id_seq'::regclass);


--
-- Name: notification_preferences id; Type: DEFAULT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.notification_preferences ALTER COLUMN id SET DEFAULT nextval('tenant_default.notification_preferences_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.notifications ALTER COLUMN id SET DEFAULT nextval('tenant_default.notifications_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.tasks ALTER COLUMN id SET DEFAULT nextval('tenant_default.tasks_id_seq'::regclass);


--
-- Name: telehealth_provider_settings id; Type: DEFAULT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.telehealth_provider_settings ALTER COLUMN id SET DEFAULT nextval('tenant_default.telehealth_provider_settings_id_seq'::regclass);


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: control; Owner: -
--



--
-- Data for Name: billing_events; Type: TABLE DATA; Schema: control; Owner: -
--



--
-- Data for Name: booking_slug_route; Type: TABLE DATA; Schema: control; Owner: -
--



--
-- Data for Name: break_glass_sessions; Type: TABLE DATA; Schema: control; Owner: -
--



--
-- Data for Name: config_baseline; Type: TABLE DATA; Schema: control; Owner: -
--

INSERT INTO control.config_baseline VALUES
	('default_plan_tier', '"professional"', 'Default subscription tier for new tenants', '2026-11-22 22:00:14.369609+00'),
	('default_timezone', '"UTC"', 'Fallback timezone when a tenant has none set', '2026-11-22 22:00:14.369609+00'),
	('default_language', '"en"', 'Fallback UI language', '2026-11-22 22:00:14.369609+00'),
	('schema_version', '0', 'Baseline schema version shipped with this app build', '2026-11-22 22:00:14.369609+00');


--
-- Data for Name: operators; Type: TABLE DATA; Schema: control; Owner: -
--



--
-- Data for Name: platform_notifications; Type: TABLE DATA; Schema: control; Owner: -
--



--
-- Data for Name: portal_identity_route; Type: TABLE DATA; Schema: control; Owner: -
--



--
-- Data for Name: portal_invite_route; Type: TABLE DATA; Schema: control; Owner: -
--



--
-- Data for Name: portal_session_route; Type: TABLE DATA; Schema: control; Owner: -
--



--
-- Data for Name: signup_intents; Type: TABLE DATA; Schema: control; Owner: -
--



--
-- Data for Name: subscription_grants; Type: TABLE DATA; Schema: control; Owner: -
--



--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: control; Owner: -
--

INSERT INTO control.subscriptions VALUES
	('9dea1057-341d-416c-bae2-9e93bd02dd66', 'fb4cf7d4-a910-4950-86d8-963c9acc73cd', 'fb5fc4f9-3d9f-4097-b886-c64d05634fcc', 4, 'onprem', 'active', 0, true, NULL, NULL, NULL, NULL, '2026-11-22 22:00:14.868077+00', '2026-11-22 22:00:14.868077+00', NULL);


--
-- Data for Name: tenant_tables; Type: TABLE DATA; Schema: control; Owner: -
--

INSERT INTO control.tenant_tables VALUES
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
	('fhir_resources', 120),
	('appointment_reminders', 200),
	('appointment_type_config', 201),
	('appointment_types', 202),
	('appointment_waitlist', 203),
	('booking_analytics', 204),
	('campaigns', 205),
	('claim_submissions', 206),
	('doctor_availability', 207),
	('doctor_time_off', 208),
	('erx_message_queue', 209),
	('fhir_error_actions', 210),
	('fhir_tracking', 211),
	('fhir_tracking_events', 212),
	('healthcare_offerings', 213),
	('offering_insurance_mappings', 214),
	('offering_packages', 215),
	('offering_pricing', 216),
	('offering_promotions', 217),
	('offering_reviews', 218),
	('package_offerings', 219),
	('patient_offering_enrollments', 220),
	('notification_preferences', 221),
	('notifications', 222),
	('patient_allergies', 223),
	('patient_consent_forms', 224),
	('patient_intake_flows', 225),
	('patient_pharmacies', 226),
	('prescription_history', 227),
	('provider_booking_config', 228),
	('recurring_appointments', 229),
	('tasks', 230),
	('telehealth_sessions', 231),
	('vendor_transaction_log', 232),
	('archives', 233),
	('archive_rules', 234),
	('clinic_info', 235),
	('clinic_working_hours', 236),
	('clinic_appointment_settings', 237),
	('backup_provider_settings', 238),
	('vendor_integration_settings', 239),
	('telehealth_provider_settings', 240),
	('audit_logs', 241),
	('insurance_payers', 242),
	('pharmacies', 243),
	('laboratories', 244),
	('service_categories', 245),
	('accounts', 246),
	('account_journal_entries', 247),
	('account_journal_lines', 248),
	('account_receivables', 249),
	('account_payables', 250),
	('account_reconciliations', 251),
	('account_reconciliation_items', 252),
	('account_statements', 253),
	('account_statement_items', 254),
	('account_ar_aging_snapshots', 255),
	('account_role_permissions', 256),
	('inventory_items', 257),
	('inventory_categories', 258),
	('inventory_suppliers', 259),
	('inventory_stock_movements', 260),
	('inventory_purchase_orders', 261),
	('inventory_role_permissions', 262),
	('form_categories', 300),
	('form_templates', 301),
	('form_template_versions', 302),
	('form_submissions', 303),
	('form_signatures', 304),
	('form_audit_logs', 305),
	('intake_flow_templates', 306),
	('offering_form_links', 307),
	('locations', 400),
	('camps', 410),
	('camp_services', 411),
	('camp_staff', 412),
	('camp_stations', 413),
	('camp_inventory_allocations', 414),
	('camp_registrations', 415),
	('camp_station_visits', 416),
	('ai_provider_credentials', 500),
	('ai_feature_settings', 501),
	('ai_requests', 502),
	('ai_phi_token_map', 503),
	('ai_suggestions', 504),
	('module_permissions', 510),
	('portal_invites', 520),
	('sick_notes', 530),
	('sick_note_requests', 540),
	('staff_notification_preferences', 550),
	('eligibility_checks', 560);


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: control; Owner: -
--

INSERT INTO control.tenants VALUES
	('fb4cf7d4-a910-4950-86d8-963c9acc73cd', 'fb5fc4f9-3d9f-4097-b886-c64d05634fcc', 'default', 'Default Clinic', 'tenant_default', 'active', 'professional', NULL, NULL, NULL, NULL, 16, 'idle', '2026-11-22 22:00:14.369609+00', '2026-11-22 22:00:15.421754+00');


--
-- Data for Name: account_backups; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: archive_metadata; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: billing_coupons; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: billing_invoice_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: billing_invoices; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: billing_payments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: billing_quote_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: billing_quotes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: directory_events; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: drug_interactions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: inventory_purchase_order_lines; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: join_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: license_keys; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: login_lockouts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: medical_codes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: medication_alternatives; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: medications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: memberships; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: message_attachments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: message_read_receipts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: message_thread_participants; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: message_threads; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: mobile_oauth_flows; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: organization_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.organization_settings VALUES
	(1, 'My Practice', 1, '2026-11-22', '2026-12-22', true, '{"currency": "USD"}', '2026-11-22 22:00:14.260547', '2026-11-22 22:00:14.260547', 0, true, '2026-12-22', true);


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: practice_domains; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: practice_profile_photos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: practice_profiles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: practices; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.practices VALUES
	('fb5fc4f9-3d9f-4097-b886-c64d05634fcc', 'Default Clinic', NULL, NULL, NULL, NULL, 'professional', '2026-11-22 22:00:14.485413', '2026-11-22 22:00:14.485413', NULL, NULL, NULL, false, '{}', NULL, NULL, 'USD');


--
-- Data for Name: provider_listing_consents; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: providers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: short_links; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: social_auth; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: specialties; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.specialties VALUES
	('general_practice', 'General Practice / Family Medicine', NULL, NULL, true, 10, '2026-11-22 22:00:14.990147'),
	('internal_medicine', 'Internal Medicine', NULL, NULL, true, 20, '2026-11-22 22:00:14.990147'),
	('paediatrics', 'Paediatrics', NULL, NULL, true, 30, '2026-11-22 22:00:14.990147'),
	('obstetrics_gynae', 'Obstetrics & Gynaecology', NULL, NULL, true, 40, '2026-11-22 22:00:14.990147'),
	('dentistry', 'Dentistry', NULL, NULL, true, 50, '2026-11-22 22:00:14.990147'),
	('ophthalmology', 'Ophthalmology', NULL, NULL, true, 60, '2026-11-22 22:00:14.990147'),
	('ent', 'ENT / Otolaryngology', NULL, NULL, true, 70, '2026-11-22 22:00:14.990147'),
	('dermatology', 'Dermatology', NULL, NULL, true, 80, '2026-11-22 22:00:14.990147'),
	('orthopaedics', 'Orthopaedics', NULL, NULL, true, 90, '2026-11-22 22:00:14.990147'),
	('cardiology', 'Cardiology', NULL, NULL, true, 100, '2026-11-22 22:00:14.990147'),
	('neurology', 'Neurology', NULL, NULL, true, 110, '2026-11-22 22:00:14.990147'),
	('gastroenterology', 'Gastroenterology', NULL, NULL, true, 120, '2026-11-22 22:00:14.990147'),
	('pulmonology', 'Pulmonology', NULL, NULL, true, 130, '2026-11-22 22:00:14.990147'),
	('nephrology', 'Nephrology', NULL, NULL, true, 140, '2026-11-22 22:00:14.990147'),
	('urology', 'Urology', NULL, NULL, true, 150, '2026-11-22 22:00:14.990147'),
	('endocrinology', 'Endocrinology & Diabetes', NULL, NULL, true, 160, '2026-11-22 22:00:14.990147'),
	('oncology', 'Oncology', NULL, NULL, true, 170, '2026-11-22 22:00:14.990147'),
	('rheumatology', 'Rheumatology', NULL, NULL, true, 180, '2026-11-22 22:00:14.990147'),
	('psychiatry', 'Psychiatry', NULL, NULL, true, 190, '2026-11-22 22:00:14.990147'),
	('behavioral_health', 'Behavioural Health & Counselling', NULL, NULL, true, 200, '2026-11-22 22:00:14.990147'),
	('physiotherapy', 'Physiotherapy & Rehabilitation', NULL, NULL, true, 210, '2026-11-22 22:00:14.990147'),
	('fertility', 'Fertility / IVF', NULL, NULL, true, 220, '2026-11-22 22:00:14.990147'),
	('radiology', 'Radiology & Imaging', NULL, NULL, true, 230, '2026-11-22 22:00:14.990147'),
	('pathology', 'Pathology & Laboratory Medicine', NULL, NULL, true, 240, '2026-11-22 22:00:14.990147'),
	('anaesthesiology', 'Anaesthesiology', NULL, NULL, true, 250, '2026-11-22 22:00:14.990147'),
	('general_surgery', 'General Surgery', NULL, NULL, true, 260, '2026-11-22 22:00:14.990147'),
	('plastic_surgery', 'Plastic & Reconstructive Surgery', NULL, NULL, true, 270, '2026-11-22 22:00:14.990147'),
	('vascular_surgery', 'Vascular Surgery', NULL, NULL, true, 280, '2026-11-22 22:00:14.990147'),
	('neurosurgery', 'Neurosurgery', NULL, NULL, true, 290, '2026-11-22 22:00:14.990147'),
	('cardiac_surgery', 'Cardiothoracic Surgery', NULL, NULL, true, 300, '2026-11-22 22:00:14.990147'),
	('emergency_medicine', 'Emergency Medicine', NULL, NULL, true, 310, '2026-11-22 22:00:14.990147'),
	('geriatrics', 'Geriatrics', NULL, NULL, true, 320, '2026-11-22 22:00:14.990147'),
	('nutrition', 'Nutrition & Dietetics', NULL, NULL, true, 330, '2026-11-22 22:00:14.990147'),
	('audiology', 'Audiology & Speech Therapy', NULL, NULL, true, 340, '2026-11-22 22:00:14.990147'),
	('podiatry', 'Podiatry', NULL, NULL, true, 350, '2026-11-22 22:00:14.990147'),
	('occupational_health', 'Occupational Health', NULL, NULL, true, 360, '2026-11-22 22:00:14.990147'),
	('paediatric_cardiology', 'Paediatric Cardiology', 'paediatrics', NULL, true, 31, '2026-11-22 22:00:14.990147'),
	('neonatology', 'Neonatology', 'paediatrics', NULL, true, 32, '2026-11-22 22:00:14.990147'),
	('orthodontics', 'Orthodontics', 'dentistry', NULL, true, 51, '2026-11-22 22:00:14.990147'),
	('endodontics', 'Endodontics', 'dentistry', NULL, true, 52, '2026-11-22 22:00:14.990147'),
	('periodontics', 'Periodontics', 'dentistry', NULL, true, 53, '2026-11-22 22:00:14.990147'),
	('oral_surgery', 'Oral & Maxillofacial Surgery', 'dentistry', NULL, true, 54, '2026-11-22 22:00:14.990147'),
	('retina', 'Vitreoretinal Surgery', 'ophthalmology', NULL, true, 61, '2026-11-22 22:00:14.990147'),
	('cornea', 'Cornea & Refractive', 'ophthalmology', NULL, true, 62, '2026-11-22 22:00:14.990147'),
	('interventional_cardiology', 'Interventional Cardiology', 'cardiology', NULL, true, 101, '2026-11-22 22:00:14.990147'),
	('electrophysiology', 'Cardiac Electrophysiology', 'cardiology', NULL, true, 102, '2026-11-22 22:00:14.990147'),
	('spine_surgery', 'Spine Surgery', 'orthopaedics', NULL, true, 91, '2026-11-22 22:00:14.990147'),
	('sports_medicine', 'Sports Medicine', 'orthopaedics', NULL, true, 92, '2026-11-22 22:00:14.990147'),
	('joint_replacement', 'Joint Replacement', 'orthopaedics', NULL, true, 93, '2026-11-22 22:00:14.990147');


--
-- Data for Name: specialty_packs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: staff_invites; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: stripe_integration_settings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: subscription_plans; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.subscription_plans VALUES
	(1, 'essentials', 'Practice Essentials', 'For solo practitioners — everything needed to run a real clinic from day one.', 149.00, 'monthly', 4, 300, '{"ehr": true, "billing": true, "reports": true, "scheduling": true, "appointments": true, "patientPortal": true, "formManagement": true, "clinicalServices": true, "practiceManagement": true, "providerManagement": true}', true, '2026-11-22 22:00:14.260547', '2026-11-22 22:00:14.260547', 1, NULL, 30, NULL, false, NULL, 'usd', 0),
	(2, 'clinical_pro', 'Clinical Pro', 'For small-to-mid group practices — full clinical, billing and engagement workflow.', 349.00, 'monthly', -1, -1, '{"crm": true, "ehr": true, "rcm": true, "camps": true, "claims": true, "billing": true, "reports": true, "labOrders": true, "offerings": true, "scheduling": true, "telehealth": true, "appointments": true, "preapprovals": true, "patientPortal": true, "prescriptions": true, "formManagement": true, "clinicalServices": true, "advancedScheduling": true, "practiceManagement": true, "providerManagement": true, "calendarIntegrations": true}', true, '2026-11-22 22:00:14.260547', '2026-11-22 22:00:14.260547', 10, 99.00, 14, NULL, false, NULL, 'usd', 0),
	(3, 'enterprise', 'Enterprise', 'For multi-location practices and health systems — full platform with SSO, API access and white-label.', 799.00, 'monthly', -1, -1, '{"crm": true, "ehr": true, "rcm": true, "sso": true, "camps": true, "claims": true, "billing": true, "reports": true, "apiAccess": true, "labOrders": true, "offerings": true, "scheduling": true, "telehealth": true, "auditExport": true, "appointments": true, "integrations": true, "preapprovals": true, "multiLocation": true, "patientPortal": true, "prescriptions": true, "customBranding": true, "formManagement": true, "advancedReports": true, "clinicalServices": true, "advancedScheduling": true, "practiceManagement": true, "providerManagement": true, "calendarIntegrations": true}', true, '2026-11-22 22:00:14.260547', '2026-11-22 22:00:14.260547', -1, 149.00, 14, NULL, false, NULL, 'usd', 0),
	(4, 'onprem', 'On-Premises / Customer Cloud', 'Annual software license for self-hosted deployments. All Enterprise features included. Governed by a license key.', 0.00, 'yearly', -1, -1, '{"crm": true, "ehr": true, "rcm": true, "sso": true, "camps": true, "claims": true, "billing": true, "reports": true, "apiAccess": true, "labOrders": true, "offerings": true, "licenseKey": true, "scheduling": true, "selfHosted": true, "telehealth": true, "auditExport": true, "appointments": true, "integrations": true, "preapprovals": true, "multiLocation": true, "patientPortal": true, "prescriptions": true, "customBranding": true, "formManagement": true, "advancedReports": true, "clinicalServices": true, "advancedScheduling": true, "practiceManagement": true, "providerManagement": true, "calendarIntegrations": true}', true, '2026-11-22 22:00:14.260547', '2026-11-22 22:00:14.260547', -1, NULL, 0, NULL, false, NULL, 'usd', 0);


--
-- Data for Name: user_role_history; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: account_ar_aging_snapshots; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: account_journal_entries; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: account_journal_lines; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: account_payables; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: account_receivables; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: account_reconciliation_items; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: account_reconciliations; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: account_role_permissions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: account_statement_items; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: account_statements; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: accounts; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: ai_feature_settings; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: ai_phi_token_map; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: ai_provider_credentials; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: ai_requests; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: ai_suggestions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: appointment_reminders; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: appointment_type_config; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: appointment_types; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: appointment_waitlist; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: appointments; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: archive_rules; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: archives; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: backup_provider_settings; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: booking_analytics; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: camp_inventory_allocations; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: camp_registrations; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: camp_services; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: camp_staff; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: camp_station_visits; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: camp_stations; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: campaigns; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: camps; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: claim_submissions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: claims; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: clinic_appointment_settings; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: clinic_info; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: clinic_working_hours; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: denials; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: diagnoses; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: diagnosis; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: doctor_availability; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: doctor_time_off; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: eligibility_checks; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: erx_message_queue; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: fhir_error_actions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: fhir_resources; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: fhir_tracking; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: fhir_tracking_events; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: form_audit_logs; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: form_categories; Type: TABLE DATA; Schema: template; Owner: -
--

INSERT INTO template.form_categories VALUES
	('29f721a5-c43b-5003-8918-38b87677938d', 'Patient Onboarding', 'onboarding', NULL, NULL, NULL, NULL, 10, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('220f1e56-211f-5d13-a9ed-5eae07d17edc', 'Medical Information', 'medical', NULL, NULL, NULL, NULL, 20, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('7d963ba8-8e52-5866-9d7e-b8bb900b7b4b', 'Consent Forms', 'consent', NULL, NULL, NULL, NULL, 30, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('5419697e-13f9-5e83-af18-ec63d0358422', 'Privacy & Compliance', 'privacy', NULL, NULL, NULL, NULL, 40, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('76a5499f-72f9-5420-8367-8cb876090c5e', 'Insurance & Billing', 'billing', NULL, NULL, NULL, NULL, 50, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('65095b88-8c71-5367-8aad-733654388c51', 'Scheduling', 'scheduling', NULL, NULL, NULL, NULL, 60, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('efbc7fe1-0249-556b-ae14-ed28cdaa46bf', 'Clinical Workflow', 'clinical', NULL, NULL, NULL, NULL, 70, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('8a4f2e1a-9cd1-5afb-a9a2-ef1a14c472b0', 'Communication', 'communication', NULL, NULL, NULL, NULL, 80, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('e00c39ea-814a-5b45-b399-388c39d5ca46', 'Legal & Administrative', 'legal', NULL, NULL, NULL, NULL, 90, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('c31f64a8-b072-5225-aef0-d352e5fc2f9a', 'Feedback & Quality', 'feedback', NULL, NULL, NULL, NULL, 100, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('d98faacd-fe1e-5d2a-9b80-d217c844f1c8', 'Behavioral Health', 'behavioral_health', NULL, NULL, NULL, NULL, 110, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('5a304909-ae89-55ba-a285-adc743169ca4', 'Dentistry', 'dentistry', NULL, NULL, NULL, NULL, 120, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('73215f2f-c14e-5df7-8275-c4f47fce53a1', 'Pediatrics', 'pediatrics', NULL, NULL, NULL, NULL, 130, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289'),
	('6bcae6c6-7434-5954-98b7-d67eb20680b4', 'Operational (Staff)', 'operational', NULL, NULL, NULL, NULL, 140, true, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289');


--
-- Data for Name: form_signatures; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: form_submissions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: form_template_versions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: form_templates; Type: TABLE DATA; Schema: template; Owner: -
--

INSERT INTO template.form_templates VALUES
	('e32761c3-8c68-5bf3-91c6-193c31d62851', 'New Patient Registration', 'new-patient-registration', 'Collect demographic, contact, and emergency contact information for new patients.', '29f721a5-c43b-5003-8918-38b87677938d', 'onboarding', 'Demographics', 'onboarding', true, true, '2.1', 2, '[{"id": "heading_personal", "type": "heading", "label": "Personal Information"}, {"id": "first_name", "type": "text", "label": "First Name", "required": true}, {"id": "last_name", "type": "text", "label": "Last Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "gender", "type": "select", "label": "Gender", "options": ["Male", "Female", "Non-binary", "Prefer not to say", "Other"], "required": true}, {"id": "ssn", "type": "text", "label": "Social Security Number (last 4)", "required": false}, {"id": "heading_contact", "type": "heading", "label": "Contact Information"}, {"id": "address", "type": "text", "label": "Street Address", "required": true}, {"id": "city", "type": "text", "label": "City", "required": true}, {"id": "state", "type": "text", "label": "State", "required": true}, {"id": "zip", "type": "text", "label": "ZIP Code", "required": true}, {"id": "phone", "type": "text", "label": "Phone Number", "required": true}, {"id": "email", "type": "email", "label": "Email Address", "required": false}, {"id": "heading_emergency", "type": "heading", "label": "Emergency Contact"}, {"id": "emergency_name", "type": "text", "label": "Emergency Contact Name", "required": true}, {"id": "emergency_relationship", "type": "text", "label": "Relationship", "required": true}, {"id": "emergency_phone", "type": "text", "label": "Emergency Contact Phone", "required": true}, {"id": "signature", "type": "signature", "label": "Patient Signature", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en", "es"]', '{}', '["registration", "demographics", "new patient"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('8210a7bb-aff1-5dfc-b528-026fd84948c1', 'Patient Intake Questionnaire', 'patient-intake-questionnaire', 'Comprehensive intake form covering medical history, current medications, and reason for visit.', '29f721a5-c43b-5003-8918-38b87677938d', 'onboarding', 'Medical History', 'onboarding', true, true, '3.0', 3, '[{"id": "heading_reason", "type": "heading", "label": "Reason for Visit"}, {"id": "chief_complaint", "type": "textarea", "label": "Chief Complaint / Reason for Visit", "required": true}, {"id": "symptom_duration", "type": "text", "label": "How long have you had these symptoms?", "required": false}, {"id": "heading_history", "type": "heading", "label": "Medical History"}, {"id": "past_conditions", "type": "checkboxes", "label": "Past Medical Conditions", "options": ["Hypertension", "Diabetes", "Heart Disease", "Asthma/COPD", "Cancer", "Thyroid Disease", "Kidney Disease", "Liver Disease", "Depression/Anxiety", "None of the above"], "required": false}, {"id": "surgeries", "type": "textarea", "label": "Previous Surgeries / Hospitalizations", "required": false}, {"id": "heading_medications", "type": "heading", "label": "Current Medications"}, {"id": "medications_list", "type": "textarea", "label": "List all current medications (name, dose, frequency)", "required": false}, {"id": "allergies", "type": "textarea", "label": "Drug Allergies / Adverse Reactions", "required": false}, {"id": "heading_family", "type": "heading", "label": "Family History"}, {"id": "family_history", "type": "checkboxes", "label": "Family Medical History", "options": ["Hypertension", "Diabetes", "Heart Disease", "Stroke", "Cancer", "Mental Illness", "None known"], "required": false}, {"id": "heading_social", "type": "heading", "label": "Social History"}, {"id": "smoking", "type": "select", "label": "Tobacco Use", "options": ["Never", "Former smoker", "Current smoker"], "required": false}, {"id": "alcohol", "type": "select", "label": "Alcohol Use", "options": ["None", "Occasional", "Moderate", "Heavy"], "required": false}, {"id": "signature", "type": "signature", "label": "Patient Signature", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en", "es", "fr"]', '{}', '["intake", "medical history", "medications"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('762ad837-9e9d-5187-9273-baf299ec1327', 'HIPAA Authorization Form', 'hipaa-authorization', 'Authorization for use and disclosure of protected health information per HIPAA requirements.', '5419697e-13f9-5e83-af18-ec63d0358422', 'privacy', 'HIPAA Compliance', 'privacy', true, true, '1.3', 1, '[{"id": "paragraph_intro", "type": "paragraph", "label": "I authorize the use or disclosure of my protected health information (PHI) as described below. I understand that by signing this form I am authorizing the practice to use and disclose my health information for the purposes indicated."}, {"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "recipient_name", "type": "text", "label": "Authorized Recipient Name / Organization", "required": true}, {"id": "purpose", "type": "textarea", "label": "Purpose of Disclosure", "required": true}, {"id": "information_type", "type": "checkboxes", "label": "Type of Information to be Disclosed", "options": ["All medical records", "Lab results", "Radiology/imaging", "Mental health records", "Substance use records", "HIV/AIDS records", "Billing records"], "required": true}, {"id": "expiration", "type": "date", "label": "Expiration Date (or leave blank for one year)", "required": false}, {"id": "revocation_note", "type": "paragraph", "label": "I understand that I have the right to revoke this authorization at any time by submitting a written request to the Privacy Officer."}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date Signed", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en", "es"]', '{}', '["HIPAA", "authorization", "PHI", "privacy"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('8d823479-680f-5a04-9dc9-e318c6d46a69', 'Consent for Treatment', 'consent-for-treatment', 'General informed consent authorizing medical examination and treatment.', '7d963ba8-8e52-5866-9d7e-b8bb900b7b4b', 'consent', 'General Consent', 'consent', true, true, '2.0', 2, '[{"id": "paragraph_consent", "type": "paragraph", "label": "I voluntarily consent to treatment by the physicians and clinical staff of this practice. I understand that the practice of medicine is not an exact science and that results cannot be guaranteed. I acknowledge that no promises have been made to me regarding the outcome of my treatment."}, {"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "understand_rights", "type": "checkbox", "label": "I have been informed of my patient rights", "required": true}, {"id": "understand_billing", "type": "checkbox", "label": "I authorize insurance billing on my behalf", "required": true}, {"id": "paragraph_witness", "type": "paragraph", "label": "This consent was explained to the patient and they appeared to understand."}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}, {"id": "witness_signature", "type": "signature", "label": "Witness Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, true, true, '["en", "es"]', '{}', '["consent", "treatment", "authorization"]', true, NULL, '["HIPAA", "JCAHO"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('b2abe091-e16b-53b8-9c67-238ab9aba0f9', 'Telehealth Consent Form', 'telehealth-consent', 'Informed consent for telehealth / virtual care services including risks and benefits.', '7d963ba8-8e52-5866-9d7e-b8bb900b7b4b', 'consent', 'Telehealth', 'consent', true, true, '1.2', 1, '[{"id": "paragraph_intro", "type": "paragraph", "label": "Telehealth involves the use of electronic communications to enable healthcare providers to connect with patients remotely. The laws that protect the confidentiality of your medical information also apply to telehealth services."}, {"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "heading_understand", "type": "heading", "label": "I understand and agree to the following:"}, {"id": "understand_limits", "type": "checkbox", "label": "Telehealth has limitations compared to in-person care", "required": true}, {"id": "understand_tech", "type": "checkbox", "label": "Technical failures may interrupt the session", "required": true}, {"id": "understand_privacy", "type": "checkbox", "label": "I will participate in a private location to protect my PHI", "required": true}, {"id": "understand_emergency", "type": "checkbox", "label": "I know to call 911 in a medical emergency", "required": true}, {"id": "device_type", "type": "select", "label": "Primary Device for Telehealth", "options": ["Smartphone", "Tablet", "Laptop/Desktop", "Other"], "required": true}, {"id": "signature", "type": "signature", "label": "Patient Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en"]', '{}', '["telehealth", "virtual", "consent"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('d73acf1f-394b-5056-bd93-883eefd5feeb', 'Surgical / Procedure Consent', 'surgical-consent', 'Informed consent for surgical procedures including risks, benefits, and alternatives.', '7d963ba8-8e52-5866-9d7e-b8bb900b7b4b', 'consent', 'Surgical Consent', 'consent', true, true, '1.5', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "procedure_name", "type": "text", "label": "Procedure / Surgery Name", "required": true}, {"id": "surgeon", "type": "text", "label": "Surgeon / Provider Name", "required": true}, {"id": "paragraph_risks", "type": "paragraph", "label": "I have been informed of the nature of the procedure, expected benefits, material risks, and alternatives. I understand that no guarantee of results has been made."}, {"id": "risks_explained", "type": "checkbox", "label": "Risks and complications have been explained to me", "required": true}, {"id": "alternatives_explained", "type": "checkbox", "label": "Alternatives to this procedure have been discussed", "required": true}, {"id": "anesthesia_consent", "type": "checkbox", "label": "I consent to necessary anesthesia", "required": true}, {"id": "blood_consent", "type": "checkbox", "label": "I consent to blood transfusion if medically necessary", "required": false}, {"id": "questions_answered", "type": "checkbox", "label": "All my questions have been answered to my satisfaction", "required": true}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}, {"id": "witness_signature", "type": "signature", "label": "Witness Signature", "required": true}, {"id": "provider_signature", "type": "signature", "label": "Provider Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date & Time", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, true, true, '["en"]', '{}', '["surgery", "procedure", "consent", "anesthesia"]', false, NULL, '["HIPAA", "JCAHO"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('063e966c-ac3e-586e-a519-0e418c2d7b33', 'Medication Reconciliation Form', 'medication-reconciliation', 'Complete list of current medications, vitamins, supplements, and over-the-counter drugs.', '220f1e56-211f-5d13-a9ed-5eae07d17edc', 'medical', 'Medications', 'medical', true, true, '1.0', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "visit_date", "type": "date", "label": "Visit Date", "required": true}, {"id": "paragraph_intro", "type": "paragraph", "label": "Please list ALL medications you are currently taking, including prescription drugs, over-the-counter medications, vitamins, and herbal supplements."}, {"id": "med_1_name", "type": "text", "label": "Medication 1 – Name", "required": false}, {"id": "med_1_dose", "type": "text", "label": "Medication 1 – Dose", "required": false}, {"id": "med_1_freq", "type": "text", "label": "Medication 1 – Frequency", "required": false}, {"id": "med_2_name", "type": "text", "label": "Medication 2 – Name", "required": false}, {"id": "med_2_dose", "type": "text", "label": "Medication 2 – Dose", "required": false}, {"id": "med_2_freq", "type": "text", "label": "Medication 2 – Frequency", "required": false}, {"id": "med_3_name", "type": "text", "label": "Medication 3 – Name", "required": false}, {"id": "med_3_dose", "type": "text", "label": "Medication 3 – Dose", "required": false}, {"id": "med_3_freq", "type": "text", "label": "Medication 3 – Frequency", "required": false}, {"id": "additional_meds", "type": "textarea", "label": "Additional Medications (name, dose, frequency)", "required": false}, {"id": "allergies", "type": "textarea", "label": "Known Drug Allergies / Reactions", "required": false}, {"id": "no_meds", "type": "checkbox", "label": "I am not currently taking any medications", "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en"]', '{}', '["medications", "reconciliation", "pharmacy"]', true, NULL, '["HIPAA", "JCAHO"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('5c690ea8-161d-5f96-9122-78f3a663c79a', 'Review of Systems (ROS)', 'review-of-systems', 'Systematic checklist of symptoms across major body systems for clinical documentation.', 'efbc7fe1-0249-556b-ae14-ed28cdaa46bf', 'clinical', 'Clinical Assessment', 'clinical', true, true, '1.1', 1, '[{"id": "heading_general", "type": "heading", "label": "General"}, {"id": "general_symptoms", "type": "checkboxes", "label": "General Symptoms", "options": ["Fatigue", "Weight loss", "Weight gain", "Fever", "Chills", "Night sweats", "No complaints"], "required": false}, {"id": "heading_cardiovascular", "type": "heading", "label": "Cardiovascular"}, {"id": "cardio_symptoms", "type": "checkboxes", "label": "Cardiovascular Symptoms", "options": ["Chest pain", "Palpitations", "Shortness of breath", "Leg swelling", "No complaints"], "required": false}, {"id": "heading_respiratory", "type": "heading", "label": "Respiratory"}, {"id": "resp_symptoms", "type": "checkboxes", "label": "Respiratory Symptoms", "options": ["Cough", "Wheezing", "Shortness of breath", "Hemoptysis", "No complaints"], "required": false}, {"id": "heading_gi", "type": "heading", "label": "Gastrointestinal"}, {"id": "gi_symptoms", "type": "checkboxes", "label": "GI Symptoms", "options": ["Nausea", "Vomiting", "Diarrhea", "Constipation", "Abdominal pain", "Heartburn", "Blood in stool", "No complaints"], "required": false}, {"id": "heading_neuro", "type": "heading", "label": "Neurological"}, {"id": "neuro_symptoms", "type": "checkboxes", "label": "Neurological Symptoms", "options": ["Headache", "Dizziness", "Numbness/tingling", "Weakness", "Seizures", "Memory problems", "No complaints"], "required": false}, {"id": "heading_musculo", "type": "heading", "label": "Musculoskeletal"}, {"id": "musculo_symptoms", "type": "checkboxes", "label": "Musculoskeletal Symptoms", "options": ["Joint pain", "Muscle pain", "Swelling", "Stiffness", "Limited range of motion", "No complaints"], "required": false}, {"id": "additional_notes", "type": "textarea", "label": "Additional Symptoms / Comments", "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en"]', '{}', '["ROS", "symptoms", "systems review"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('81c6229b-9fa9-5467-b2e2-294711cfe5f3', 'Pain Assessment Form', 'pain-assessment', 'Structured pain evaluation including location, severity, quality, and functional impact.', 'efbc7fe1-0249-556b-ae14-ed28cdaa46bf', 'clinical', 'Pain Management', 'clinical', true, true, '1.0', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "visit_date", "type": "date", "label": "Assessment Date", "required": true}, {"id": "pain_location", "type": "textarea", "label": "Pain Location (describe or list all areas)", "required": true}, {"id": "pain_score", "type": "select", "label": "Current Pain Score (0 = none, 10 = worst possible)", "options": ["0 – No pain", "1", "2", "3", "4", "5 – Moderate", "6", "7", "8", "9", "10 – Worst possible"], "required": true}, {"id": "pain_quality", "type": "checkboxes", "label": "Quality of Pain", "options": ["Aching", "Burning", "Sharp", "Stabbing", "Throbbing", "Cramping", "Shooting", "Pressure", "Tingling"], "required": false}, {"id": "pain_pattern", "type": "select", "label": "Pain Pattern", "options": ["Constant", "Intermittent", "Comes and goes", "Worse with activity", "Worse at rest"], "required": false}, {"id": "pain_duration", "type": "text", "label": "How long have you had this pain?", "required": false}, {"id": "aggravating", "type": "textarea", "label": "What makes the pain worse?", "required": false}, {"id": "relieving", "type": "textarea", "label": "What makes the pain better?", "required": false}, {"id": "functional_impact", "type": "checkboxes", "label": "Impact on Daily Activities", "options": ["Sleep", "Work", "Walking", "Self-care", "Concentration", "Mood", "Social activities"], "required": false}, {"id": "prior_treatment", "type": "textarea", "label": "Prior Treatments / Medications Tried", "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en", "es"]', '{}', '["pain", "assessment", "VAS", "NRS"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('ce414c52-ef8d-575b-93c3-7def7006ce8c', 'Insurance Verification Form', 'insurance-verification', 'Collect primary and secondary insurance details for eligibility and billing purposes.', '76a5499f-72f9-5420-8367-8cb876090c5e', 'billing', 'Insurance', 'billing', true, true, '1.4', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "heading_primary", "type": "heading", "label": "Primary Insurance"}, {"id": "primary_insurer", "type": "text", "label": "Insurance Company Name", "required": true}, {"id": "primary_plan", "type": "text", "label": "Plan / Group Name", "required": false}, {"id": "primary_member_id", "type": "text", "label": "Member ID / Subscriber ID", "required": true}, {"id": "primary_group_no", "type": "text", "label": "Group Number", "required": false}, {"id": "primary_subscriber_name", "type": "text", "label": "Subscriber Name (if different from patient)", "required": false}, {"id": "primary_subscriber_dob", "type": "date", "label": "Subscriber Date of Birth", "required": false}, {"id": "primary_relationship", "type": "select", "label": "Patient Relationship to Subscriber", "options": ["Self", "Spouse", "Child", "Other"], "required": true}, {"id": "heading_secondary", "type": "heading", "label": "Secondary Insurance (if applicable)"}, {"id": "secondary_insurer", "type": "text", "label": "Secondary Insurance Company", "required": false}, {"id": "secondary_member_id", "type": "text", "label": "Secondary Member ID", "required": false}, {"id": "secondary_group_no", "type": "text", "label": "Secondary Group Number", "required": false}, {"id": "assignment_benefits", "type": "checkbox", "label": "I authorize assignment of insurance benefits to this practice", "required": true}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en"]', '{}', '["insurance", "billing", "eligibility", "verification"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('d76215e3-4332-5848-9003-a48306e9ef59', 'Financial Responsibility Agreement', 'financial-responsibility', 'Patient acknowledgment of financial responsibility for services rendered.', '76a5499f-72f9-5420-8367-8cb876090c5e', 'billing', 'Financial Policy', 'billing', true, true, '1.2', 1, '[{"id": "paragraph_policy", "type": "paragraph", "label": "As a patient of this practice, you are responsible for all charges not covered by your insurance, including co-pays, co-insurance, deductibles, and non-covered services. Payment is expected at the time of service unless prior arrangements have been made."}, {"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "understand_copay", "type": "checkbox", "label": "I understand I must pay my co-pay at each visit", "required": true}, {"id": "understand_deductible", "type": "checkbox", "label": "I am responsible for any deductible amounts", "required": true}, {"id": "understand_noncovered", "type": "checkbox", "label": "I am responsible for non-covered or denied services", "required": true}, {"id": "understand_collections", "type": "checkbox", "label": "Unpaid balances may be sent to collections after 90 days", "required": true}, {"id": "payment_plan", "type": "select", "label": "Preferred Payment Method", "options": ["Credit/Debit Card", "Cash", "Check", "Payment plan (if eligible)"], "required": false}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en"]', '{}', '["billing", "financial", "policy", "copay"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('e404440c-3ad6-54ac-8c8e-9286c734f056', 'Appointment Request Form', 'appointment-request', 'Patient self-scheduling request capturing preferred times, provider, and visit type.', '65095b88-8c71-5367-8aad-733654388c51', 'scheduling', 'Scheduling', 'scheduling', true, true, '1.0', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "phone", "type": "text", "label": "Phone Number", "required": true}, {"id": "email", "type": "email", "label": "Email", "required": false}, {"id": "visit_type", "type": "select", "label": "Type of Visit", "options": ["New patient", "Follow-up", "Annual physical", "Sick visit", "Telehealth", "Specialist consultation", "Procedure"], "required": true}, {"id": "reason", "type": "textarea", "label": "Brief reason for visit", "required": true}, {"id": "preferred_date_1", "type": "date", "label": "Preferred Date (1st choice)", "required": true}, {"id": "preferred_date_2", "type": "date", "label": "Preferred Date (2nd choice)", "required": false}, {"id": "preferred_time", "type": "checkboxes", "label": "Preferred Time", "options": ["Morning (8am–12pm)", "Afternoon (12pm–4pm)", "Late afternoon (4pm–6pm)"], "required": false}, {"id": "provider_preference", "type": "text", "label": "Preferred Provider (if any)", "required": false}, {"id": "special_needs", "type": "textarea", "label": "Special accommodations or accessibility needs", "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en"]', '{}', '["scheduling", "appointment", "self-service"]', false, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('142a1f27-9453-5d38-962a-c841c0524db2', 'Patient Satisfaction Survey', 'patient-satisfaction-survey', 'Post-visit satisfaction survey measuring patient experience across care, communication, and facilities.', 'c31f64a8-b072-5225-aef0-d352e5fc2f9a', 'feedback', 'Satisfaction Survey', 'feedback', true, true, '2.0', 2, '[{"id": "visit_date", "type": "date", "label": "Date of Visit", "required": false}, {"id": "provider_name", "type": "text", "label": "Provider Seen", "required": false}, {"id": "heading_care", "type": "heading", "label": "Quality of Care"}, {"id": "overall_rating", "type": "select", "label": "Overall, how would you rate your care today?", "options": ["5 – Excellent", "4 – Very Good", "3 – Good", "2 – Fair", "1 – Poor"], "required": true}, {"id": "provider_listens", "type": "select", "label": "Did your provider listen carefully to you?", "options": ["Always", "Usually", "Sometimes", "Never"], "required": true}, {"id": "provider_explained", "type": "select", "label": "Did your provider explain things clearly?", "options": ["Always", "Usually", "Sometimes", "Never"], "required": true}, {"id": "heading_access", "type": "heading", "label": "Access & Wait Times"}, {"id": "wait_time", "type": "select", "label": "Wait time before seeing the provider", "options": ["Under 10 minutes", "10-20 minutes", "20-30 minutes", "Over 30 minutes"], "required": false}, {"id": "wait_satisfaction", "type": "select", "label": "Were you satisfied with the wait time?", "options": ["Very satisfied", "Satisfied", "Dissatisfied", "Very dissatisfied"], "required": false}, {"id": "heading_recommend", "type": "heading", "label": "Recommendation"}, {"id": "recommend", "type": "select", "label": "Would you recommend us to family or friends?", "options": ["Definitely yes", "Probably yes", "Probably no", "Definitely no"], "required": true}, {"id": "nps", "type": "select", "label": "On a scale of 0-10, how likely are you to recommend this practice?", "options": ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "0"], "required": false}, {"id": "comments", "type": "textarea", "label": "Additional comments or suggestions", "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en", "es"]', '{}', '["satisfaction", "survey", "CAHPS", "quality"]', false, NULL, '[]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('cbd295ab-4da9-5848-b1bf-64edc27011b6', 'Release of Information (ROI)', 'release-of-information', 'Authorization to release medical records to specified third parties.', 'e00c39ea-814a-5b45-b399-388c39d5ca46', 'legal', 'Records Release', 'legal', true, true, '1.3', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "address", "type": "text", "label": "Address", "required": false}, {"id": "heading_release_to", "type": "heading", "label": "Release Information To"}, {"id": "recipient_name", "type": "text", "label": "Name / Organization", "required": true}, {"id": "recipient_address", "type": "text", "label": "Address", "required": false}, {"id": "recipient_phone", "type": "text", "label": "Phone / Fax", "required": false}, {"id": "heading_records", "type": "heading", "label": "Records Requested"}, {"id": "records_type", "type": "checkboxes", "label": "Type of Records", "options": ["Complete medical record", "Office notes", "Lab results", "Radiology reports", "Imaging (CD/digital)", "Operative reports", "Discharge summary", "Mental health records", "Immunization records", "Billing records"], "required": true}, {"id": "date_range_from", "type": "date", "label": "Records From Date", "required": false}, {"id": "date_range_to", "type": "date", "label": "Records To Date", "required": false}, {"id": "purpose", "type": "select", "label": "Purpose of Release", "options": ["Continuing care", "Personal use", "Insurance/legal", "Second opinion", "Other"], "required": true}, {"id": "expiration", "type": "date", "label": "Authorization Expiration Date", "required": false}, {"id": "revocation_note", "type": "paragraph", "label": "I understand I may revoke this authorization in writing at any time. Revocation will not apply to actions already taken."}, {"id": "signature", "type": "signature", "label": "Patient / Legal Representative Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date Signed", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en"]', '{}', '["records", "release", "ROI", "authorization"]', false, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('63b14b4b-9349-5290-a8d4-7e1cc0320252', 'Notice of Privacy Practices Acknowledgment', 'notice-of-privacy-practices', 'Patient acknowledgment of receipt of the Notice of Privacy Practices (NPP) as required by HIPAA.', '5419697e-13f9-5e83-af18-ec63d0358422', 'privacy', 'NPP Acknowledgment', 'privacy', true, true, '1.0', 1, '[{"id": "paragraph_npp", "type": "paragraph", "label": "Our Notice of Privacy Practices describes how we may use and disclose your protected health information to carry out treatment, payment, and healthcare operations. It also describes your rights related to your health information."}, {"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "received_npp", "type": "checkbox", "label": "I have received a copy of the Notice of Privacy Practices", "required": true}, {"id": "understand_npp", "type": "checkbox", "label": "I understand my privacy rights as described in the NPP", "required": true}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en", "es"]', '{}', '["HIPAA", "NPP", "privacy", "acknowledgment"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('6f3c92ce-29eb-5db2-ae12-e31e9945f20e', 'Communication Preferences', 'communication-preferences', 'Patient preferences for appointment reminders, health notifications, and portal communications.', '8a4f2e1a-9cd1-5afb-a9a2-ef1a14c472b0', 'communication', 'Patient Preferences', 'communication', true, true, '1.1', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "heading_reminders", "type": "heading", "label": "Appointment Reminders"}, {"id": "reminder_method", "type": "checkboxes", "label": "How would you like to receive appointment reminders?", "options": ["Phone call", "Text/SMS", "Email", "Patient portal notification", "Mail"], "required": false}, {"id": "reminder_timing", "type": "select", "label": "How far in advance do you prefer reminders?", "options": ["1 day before", "2 days before", "1 week before", "Both 1 week and 1 day before"], "required": false}, {"id": "heading_notifications", "type": "heading", "label": "Health Notifications"}, {"id": "lab_results", "type": "select", "label": "How to receive lab results?", "options": ["Patient portal", "Email", "Phone call from staff", "Mail"], "required": false}, {"id": "marketing_consent", "type": "select", "label": "Health education and wellness newsletters", "options": ["Yes, I would like to receive these", "No, please do not send these"], "required": false}, {"id": "heading_language", "type": "heading", "label": "Language Preference"}, {"id": "preferred_language", "type": "select", "label": "Preferred language for communications", "options": ["English", "Spanish (Español)", "French (Français)", "Portuguese (Português)", "German (Deutsch)", "Other"], "required": false}, {"id": "interpreter_needed", "type": "select", "label": "Do you need an interpreter for in-person visits?", "options": ["No", "Yes – Spanish", "Yes – Other language"], "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en"]', '{}', '["communication", "preferences", "reminders", "portal"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL),
	('273b584d-39ad-5cbe-b18a-6dd04b433524', 'Staff Incident / Event Report', 'staff-incident-report', 'Internal staff form for documenting patient safety events, near misses, and workplace incidents.', '6bcae6c6-7434-5954-98b7-d67eb20680b4', 'operational', 'Incident Reporting', 'operational', true, true, '1.0', 1, '[{"id": "reporter_name", "type": "text", "label": "Reporter Name", "required": true}, {"id": "reporter_role", "type": "select", "label": "Reporter Role", "options": ["Physician", "Nurse/MA", "Pharmacist", "Administrative", "Lab/Radiology", "Other"], "required": true}, {"id": "incident_date", "type": "date", "label": "Date of Incident", "required": true}, {"id": "incident_time", "type": "text", "label": "Time of Incident", "required": false}, {"id": "location", "type": "text", "label": "Location / Department", "required": true}, {"id": "incident_type", "type": "select", "label": "Type of Incident", "options": ["Patient fall", "Medication error", "Wrong patient/procedure", "Near miss", "Equipment failure", "Workplace injury", "Patient complaint", "Other"], "required": true}, {"id": "patient_involved", "type": "select", "label": "Was a patient involved?", "options": ["Yes", "No"], "required": true}, {"id": "patient_id", "type": "text", "label": "Patient MRN (if applicable)", "required": false}, {"id": "description", "type": "textarea", "label": "Description of Incident", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Immediate Action Taken", "required": true}, {"id": "witnesses", "type": "textarea", "label": "Witness Names / Roles", "required": false}, {"id": "contributing_factors", "type": "checkboxes", "label": "Contributing Factors", "options": ["Communication failure", "Equipment/supplies", "Staffing/workload", "Policy/procedure", "Training", "Environment", "Patient factors", "Unknown"], "required": false}, {"id": "severity", "type": "select", "label": "Severity / Harm Level", "options": ["No harm – near miss", "No harm – reached patient", "Harm – minor/temporary", "Harm – major/permanent", "Death"], "required": true}, {"id": "signature", "type": "signature", "label": "Reporter Signature", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en"]', '{}', '["incident", "safety", "staff", "event report"]', false, NULL, '["JCAHO"]', NULL, NULL, '2026-11-22 22:00:15.393289', '2026-11-22 22:00:15.393289', 'base', 1, false, NULL);


--
-- Data for Name: healthcare_offerings; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: insurance_payers; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: intake_flow_templates; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: inventory_categories; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: inventory_purchase_orders; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: inventory_role_permissions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: inventory_stock_movements; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: inventory_suppliers; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: lab_orders; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: laboratories; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: locations; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: medical_records; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: module_permissions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: offering_form_links; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: offering_insurance_mappings; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: offering_packages; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: offering_pricing; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: offering_promotions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: offering_reviews; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: package_offerings; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: patient_allergies; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: patient_consent_forms; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: patient_intake_flows; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: patient_intake_forms; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: patient_offering_enrollments; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: patient_pharmacies; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: patient_portal_sessions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: patients; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: payment_postings; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: payments; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: pharmacies; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: portal_invites; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: preapprovals; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: prescription_history; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: prescriptions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: provider_booking_config; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: recurring_appointments; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: template; Owner: -
--

INSERT INTO template.schema_migrations VALUES
	(0, 'baseline (structure cloned from public at S2)', '2026-11-22 22:00:14.376954+00'),
	(14, '014_sick_notes.sql', '2026-11-22 22:00:15.054252+00'),
	(15, '015_sick_note_requests.sql', '2026-11-22 22:00:15.071401+00'),
	(16, '016_notifications_eligibility_scrub.sql', '2026-11-22 22:00:15.080681+00'),
	(1, '001_adopt_runtime_created_tables.sql', '2026-11-22 22:00:15.297591+00'),
	(2, '002_audit_log_append_only.sql', '2026-11-22 22:00:15.306696+00'),
	(3, '003_audit_logs_keep_history.sql', '2026-11-22 22:00:15.309186+00'),
	(4, '004_locations.sql', '2026-11-22 22:00:15.314976+00'),
	(5, '005_location_id_columns.sql', '2026-11-22 22:00:15.322466+00'),
	(6, '006_camps.sql', '2026-11-22 22:00:15.331708+00'),
	(7, '007_pack_provenance.sql', '2026-11-22 22:00:15.385022+00'),
	(8, '008_seed_form_library.sql', '2026-11-22 22:00:15.393289+00'),
	(9, '009_specialty_forms_move_to_packs.sql', '2026-11-22 22:00:15.401258+00'),
	(10, '010_ai_integrations.sql', '2026-11-22 22:00:15.406344+00'),
	(11, '011_module_permissions.sql', '2026-11-22 22:00:15.426537+00'),
	(12, '012_portal_invites.sql', '2026-11-22 22:00:15.431173+00'),
	(13, '013_appointments_meeting_url.sql', '2026-11-22 22:00:15.43559+00');


--
-- Data for Name: service_categories; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: sick_note_requests; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: sick_notes; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: staff_notification_preferences; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: tasks; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: telehealth_provider_settings; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: telehealth_sessions; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: vendor_integration_settings; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: vendor_transaction_log; Type: TABLE DATA; Schema: template; Owner: -
--



--
-- Data for Name: account_ar_aging_snapshots; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: account_journal_entries; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: account_journal_lines; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: account_payables; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: account_receivables; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: account_reconciliation_items; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: account_reconciliations; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: account_role_permissions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--

INSERT INTO tenant_default.account_role_permissions VALUES
	('39271229-fd93-4891-bdb4-41845154fef0', 'admin', 'chart_of_accounts', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('1d1ee6fc-3ff1-477d-9a20-f65089a9cfe0', 'admin', 'journal_entries', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('8b83c7bb-8d4c-4ba1-b385-daabdcc01336', 'admin', 'accounts_receivable', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('0ec2527c-79c1-4062-9970-3ad7532dbe53', 'admin', 'accounts_payable', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('b46d0442-f8c8-418a-9aaa-f663ce9ae655', 'admin', 'reconciliation', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('385bafdf-6dc1-4ac1-81cd-e244f121b084', 'admin', 'statements', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('12ff440e-6f88-44cc-9456-d2f745614fbc', 'admin', 'reports', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('24811216-4229-4670-ba4a-59e8fffb0e61', 'admin', 'backup', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('e28000b4-31ac-4280-ba4f-75aba7fe3a6b', 'admin', 'archive', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('e1963dee-9d66-4572-bbff-1b440ba03473', 'admin', 'rbac_settings', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('0b8b8cba-b835-498a-9bca-0de80c6a7531', 'billing_manager', 'chart_of_accounts', true, false, false, false, false, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('b1bf006a-b112-47e0-950a-4cd20cf83342', 'billing_manager', 'journal_entries', true, true, false, false, false, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('e2494220-6356-4d02-a0da-f3a02dff5917', 'billing_manager', 'accounts_receivable', true, true, true, false, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('aacf7be4-9286-42a7-89f4-f633a29c5d49', 'billing_manager', 'accounts_payable', true, true, true, false, true, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('2290c008-064e-45a9-b245-f957e0627189', 'billing_manager', 'reconciliation', true, true, true, false, false, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('cda308b4-3518-4ffe-b7c1-46a30f691384', 'billing_manager', 'statements', true, true, true, false, false, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('1cc1ffa8-8161-4a79-97f1-19ec0108cdb6', 'billing_manager', 'reports', true, true, false, false, false, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('af6e8862-ec84-4989-8a75-31bb2a2c847d', 'billing_manager', 'backup', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('eeae2a25-815f-41e0-ad88-f41acfb72a37', 'billing_manager', 'archive', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('6e507a75-8323-4e14-8ffc-26804dd647b3', 'billing_manager', 'rbac_settings', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('71cb25a7-121c-4b9e-bbdb-2934a0a2b59e', 'doctor', 'chart_of_accounts', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('51d2f47e-d908-4f04-a429-937b12e425dc', 'doctor', 'journal_entries', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('027b70ae-3fb2-41b5-8cf0-b068f94584a7', 'doctor', 'accounts_receivable', true, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('0366504c-e9ca-4625-9dcd-b3340d3fb07a', 'doctor', 'accounts_payable', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('db0b1684-0fcd-40bd-aaf0-b626fbaa515e', 'doctor', 'reconciliation', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('cb10cc18-961a-4777-b6ee-bf56624e1b7f', 'doctor', 'statements', true, false, false, false, false, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('7da0d7c4-b745-4e02-8c80-0594b543f52c', 'doctor', 'reports', true, false, false, false, false, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('a6e29e6c-64a3-4f46-a14e-f6a9a55823d9', 'doctor', 'backup', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('bd43169d-7d94-4320-8ba6-1c591f34ff74', 'doctor', 'archive', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('4fa02a1d-df99-4fb6-a32d-4b5846f4b8df', 'doctor', 'rbac_settings', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('0894ed6b-82cb-4dd3-b3fb-caa8610ef831', 'receptionist', 'chart_of_accounts', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('85fed80c-0ce3-409e-a335-01c2e8761d69', 'receptionist', 'journal_entries', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('132db7cd-69b9-4c35-a0d0-8d51c3952e5e', 'receptionist', 'accounts_receivable', true, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('8290abd4-ac78-4469-80b1-64464796fae2', 'receptionist', 'accounts_payable', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('38aeb7a6-9ff7-4751-a6d8-d333012d6b43', 'receptionist', 'reconciliation', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('e05de616-0787-40f2-94cf-23d5f5eafb6d', 'receptionist', 'statements', true, true, false, false, false, true, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('6f22b234-8069-473c-8b92-97151e755c52', 'receptionist', 'reports', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('9498ebb2-2ac0-4c4f-a85b-461861d94249', 'receptionist', 'backup', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('3991f79d-5fd8-4d53-aee7-c888a9988902', 'receptionist', 'archive', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('1dc27657-1f49-43ef-85b8-cc3728d150b0', 'receptionist', 'rbac_settings', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00');


--
-- Data for Name: account_statement_items; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: account_statements; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: accounts; Type: TABLE DATA; Schema: tenant_default; Owner: -
--

INSERT INTO tenant_default.accounts VALUES
	('c136fb72-ed1d-4dc1-b5b9-97db14acbef3', '1000', 'Cash and Cash Equivalents', 'asset', 'current_asset', NULL, 'Primary cash accounts', 'debit', 'USD', true, true, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('9f5d8266-f586-444e-beae-df8893cdc540', '1100', 'Accounts Receivable - Patient', 'asset', 'accounts_receivable', NULL, 'Patient AR linked to billing invoices', 'debit', 'USD', true, true, true, 0.00, 0.00, true, false, true, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('788a6cd4-1d68-41f0-9a65-1c950ad99629', '1110', 'Accounts Receivable - Insurance', 'asset', 'accounts_receivable', NULL, 'Insurance AR linked to claims', 'debit', 'USD', true, true, true, 0.00, 0.00, true, false, false, true, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('77148837-8511-4129-a24d-6d40f02599ca', '1200', 'Prepaid Expenses', 'asset', 'current_asset', NULL, 'Prepaid insurance, rent, etc.', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('041603eb-713c-4060-8773-a58b95206983', '1500', 'Property and Equipment', 'asset', 'fixed_asset', NULL, 'Medical equipment, furniture', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('35970806-fd9d-4e3f-908d-e8b3d7fe91a7', '1510', 'Accumulated Depreciation', 'contra_asset', 'fixed_asset', NULL, 'Contra account for fixed assets', 'credit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('a6626839-40bb-4515-8936-1e51531e8be1', '2000', 'Accounts Payable', 'liability', 'current_liability', NULL, 'Vendor AP linked to AP module', 'credit', 'USD', true, true, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('b81196a4-cff0-4e78-9082-cd6231a4d885', '2100', 'Accrued Liabilities', 'liability', 'current_liability', NULL, 'Accrued wages, interest', 'credit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('b288ce3d-393b-4051-8c81-617bb5b3275c', '2200', 'Patient Deposits', 'liability', 'current_liability', NULL, 'Patient prepayments held in trust', 'credit', 'USD', true, false, true, 0.00, 0.00, false, false, true, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('d94c82da-41c4-4b4e-8787-5c0b8c945e9e', '2500', 'Long-Term Debt', 'liability', 'long_term_liability', NULL, 'Loans, mortgages', 'credit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('5be8e581-d469-4de7-9fc4-71ed2668ffa6', '3000', 'Owner Equity', 'equity', 'equity', NULL, 'Owner capital accounts', 'credit', 'USD', true, true, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('c504f1eb-bfa0-400f-a9fe-9bd8e98b50f8', '3100', 'Retained Earnings', 'equity', 'equity', NULL, 'Accumulated earnings', 'credit', 'USD', true, true, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('349a32b1-f1e9-41bc-9c31-e09c6814a9da', '3200', 'Current Year Earnings', 'equity', 'equity', NULL, 'Current period net income', 'credit', 'USD', true, true, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('8fe20743-e81a-4e7a-8748-a8d8c1f9391d', '4000', 'Patient Service Revenue', 'revenue', 'operating_revenue', NULL, 'Revenue from clinical services', 'credit', 'USD', true, true, true, 0.00, 0.00, false, false, true, true, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('a7a1e506-6559-46cd-b0ed-e5b940298b19', '4100', 'Insurance Reimbursements', 'revenue', 'operating_revenue', NULL, 'Insurance claim payments', 'credit', 'USD', true, true, true, 0.00, 0.00, false, false, false, true, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('6ffd31c5-2af1-4830-95fa-cb6d3b3722f0', '4200', 'Telehealth Revenue', 'revenue', 'operating_revenue', NULL, 'Revenue from telehealth services', 'credit', 'USD', true, false, true, 0.00, 0.00, false, false, true, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('e7d079b6-a1a8-42cc-9ac7-fdfbce2719ce', '4300', 'Ancillary Revenue', 'revenue', 'operating_revenue', NULL, 'Lab, pharmacy, ancillary services', 'credit', 'USD', true, false, true, 0.00, 0.00, false, false, true, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('e915c30a-3045-49c6-b3ca-8f529cffc9ec', '4900', 'Other Revenue', 'revenue', 'non_operating_revenue', NULL, 'Miscellaneous revenue', 'credit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('3f498874-beaf-408e-924c-9f316c7d2b62', '5000', 'Cost of Services', 'expense', 'cost_of_goods_sold', NULL, 'Direct cost of patient services', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('00621a2f-2573-4edc-857d-7aca211fd5b8', '5100', 'Salaries and Wages', 'expense', 'operating_expense', NULL, 'Staff compensation', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('25819419-fd0b-4c90-b0fe-b0f827d5f32c', '5200', 'Medical Supplies', 'expense', 'operating_expense', NULL, 'Clinical supplies', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('4dc6bdc4-e036-4bf8-b8d6-701762384ec7', '5300', 'Occupancy Expenses', 'expense', 'operating_expense', NULL, 'Rent, utilities', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('36de6901-efd8-4e84-9a5b-104332be5de8', '5400', 'Insurance Expense', 'expense', 'operating_expense', NULL, 'Malpractice and general insurance', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('98d7132f-7c11-49cb-bf29-b622dd522ba7', '5500', 'Technology and Software', 'expense', 'operating_expense', NULL, 'EMR, billing software', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('5f63b88b-62a0-4b3f-89e1-a44ae765e667', '5600', 'Billing and Collections', 'expense', 'operating_expense', NULL, 'RCM, clearinghouse fees', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('88f6155b-8245-40c7-ae02-f5568d48d5a2', '5700', 'Marketing and CRM', 'expense', 'operating_expense', NULL, 'Advertising, patient outreach', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('111e25c1-4bdb-4e01-a0e7-f6133298b3c6', '5800', 'Depreciation Expense', 'expense', 'operating_expense', NULL, 'Equipment depreciation', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('8aa66dbb-e2ba-4f80-921a-4c02465fc186', '5900', 'Other Operating Expenses', 'expense', 'operating_expense', NULL, 'Miscellaneous expenses', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('490fcdfd-2b3e-470f-a262-1025b621072a', '6000', 'Bad Debt Expense', 'expense', 'operating_expense', NULL, 'Write-offs from uncollectible AR', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, false, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00'),
	('3d9e9e22-3a48-485b-88ad-e95e5cefddc0', '6100', 'Contractual Adjustments', 'contra_revenue', 'revenue_adjustment', NULL, 'Insurance contractual write-downs', 'debit', 'USD', true, false, true, 0.00, 0.00, false, false, false, true, NULL, NULL, NULL, '2026-11-22 22:00:14.204545+00', '2026-11-22 22:00:14.204545+00');


--
-- Data for Name: ai_feature_settings; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: ai_phi_token_map; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: ai_provider_credentials; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: ai_requests; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: ai_suggestions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: appointment_reminders; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: appointment_type_config; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: appointment_types; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: appointment_waitlist; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: appointments; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: archive_rules; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: archives; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: backup_provider_settings; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: booking_analytics; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: camp_inventory_allocations; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: camp_registrations; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: camp_services; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: camp_staff; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: camp_station_visits; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: camp_stations; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: campaigns; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: camps; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: claim_submissions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: claims; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: clinic_appointment_settings; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: clinic_info; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: clinic_working_hours; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: denials; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: diagnoses; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: diagnosis; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: doctor_availability; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: doctor_time_off; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: eligibility_checks; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: erx_message_queue; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: fhir_error_actions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: fhir_resources; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: fhir_tracking; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: fhir_tracking_events; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: form_audit_logs; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: form_categories; Type: TABLE DATA; Schema: tenant_default; Owner: -
--

INSERT INTO tenant_default.form_categories VALUES
	('29f721a5-c43b-5003-8918-38b87677938d', 'Patient Onboarding', 'onboarding', NULL, NULL, NULL, NULL, 10, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('220f1e56-211f-5d13-a9ed-5eae07d17edc', 'Medical Information', 'medical', NULL, NULL, NULL, NULL, 20, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('7d963ba8-8e52-5866-9d7e-b8bb900b7b4b', 'Consent Forms', 'consent', NULL, NULL, NULL, NULL, 30, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('5419697e-13f9-5e83-af18-ec63d0358422', 'Privacy & Compliance', 'privacy', NULL, NULL, NULL, NULL, 40, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('76a5499f-72f9-5420-8367-8cb876090c5e', 'Insurance & Billing', 'billing', NULL, NULL, NULL, NULL, 50, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('65095b88-8c71-5367-8aad-733654388c51', 'Scheduling', 'scheduling', NULL, NULL, NULL, NULL, 60, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('efbc7fe1-0249-556b-ae14-ed28cdaa46bf', 'Clinical Workflow', 'clinical', NULL, NULL, NULL, NULL, 70, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('8a4f2e1a-9cd1-5afb-a9a2-ef1a14c472b0', 'Communication', 'communication', NULL, NULL, NULL, NULL, 80, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('e00c39ea-814a-5b45-b399-388c39d5ca46', 'Legal & Administrative', 'legal', NULL, NULL, NULL, NULL, 90, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('c31f64a8-b072-5225-aef0-d352e5fc2f9a', 'Feedback & Quality', 'feedback', NULL, NULL, NULL, NULL, 100, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('d98faacd-fe1e-5d2a-9b80-d217c844f1c8', 'Behavioral Health', 'behavioral_health', NULL, NULL, NULL, NULL, 110, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('5a304909-ae89-55ba-a285-adc743169ca4', 'Dentistry', 'dentistry', NULL, NULL, NULL, NULL, 120, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('73215f2f-c14e-5df7-8275-c4f47fce53a1', 'Pediatrics', 'pediatrics', NULL, NULL, NULL, NULL, 130, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293'),
	('6bcae6c6-7434-5954-98b7-d67eb20680b4', 'Operational (Staff)', 'operational', NULL, NULL, NULL, NULL, 140, true, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293');


--
-- Data for Name: form_signatures; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: form_submissions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: form_template_versions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: form_templates; Type: TABLE DATA; Schema: tenant_default; Owner: -
--

INSERT INTO tenant_default.form_templates VALUES
	('e32761c3-8c68-5bf3-91c6-193c31d62851', 'New Patient Registration', 'new-patient-registration', 'Collect demographic, contact, and emergency contact information for new patients.', '29f721a5-c43b-5003-8918-38b87677938d', 'onboarding', 'Demographics', 'onboarding', true, true, '2.1', 2, '[{"id": "heading_personal", "type": "heading", "label": "Personal Information"}, {"id": "first_name", "type": "text", "label": "First Name", "required": true}, {"id": "last_name", "type": "text", "label": "Last Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "gender", "type": "select", "label": "Gender", "options": ["Male", "Female", "Non-binary", "Prefer not to say", "Other"], "required": true}, {"id": "ssn", "type": "text", "label": "Social Security Number (last 4)", "required": false}, {"id": "heading_contact", "type": "heading", "label": "Contact Information"}, {"id": "address", "type": "text", "label": "Street Address", "required": true}, {"id": "city", "type": "text", "label": "City", "required": true}, {"id": "state", "type": "text", "label": "State", "required": true}, {"id": "zip", "type": "text", "label": "ZIP Code", "required": true}, {"id": "phone", "type": "text", "label": "Phone Number", "required": true}, {"id": "email", "type": "email", "label": "Email Address", "required": false}, {"id": "heading_emergency", "type": "heading", "label": "Emergency Contact"}, {"id": "emergency_name", "type": "text", "label": "Emergency Contact Name", "required": true}, {"id": "emergency_relationship", "type": "text", "label": "Relationship", "required": true}, {"id": "emergency_phone", "type": "text", "label": "Emergency Contact Phone", "required": true}, {"id": "signature", "type": "signature", "label": "Patient Signature", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en", "es"]', '{}', '["registration", "demographics", "new patient"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('8210a7bb-aff1-5dfc-b528-026fd84948c1', 'Patient Intake Questionnaire', 'patient-intake-questionnaire', 'Comprehensive intake form covering medical history, current medications, and reason for visit.', '29f721a5-c43b-5003-8918-38b87677938d', 'onboarding', 'Medical History', 'onboarding', true, true, '3.0', 3, '[{"id": "heading_reason", "type": "heading", "label": "Reason for Visit"}, {"id": "chief_complaint", "type": "textarea", "label": "Chief Complaint / Reason for Visit", "required": true}, {"id": "symptom_duration", "type": "text", "label": "How long have you had these symptoms?", "required": false}, {"id": "heading_history", "type": "heading", "label": "Medical History"}, {"id": "past_conditions", "type": "checkboxes", "label": "Past Medical Conditions", "options": ["Hypertension", "Diabetes", "Heart Disease", "Asthma/COPD", "Cancer", "Thyroid Disease", "Kidney Disease", "Liver Disease", "Depression/Anxiety", "None of the above"], "required": false}, {"id": "surgeries", "type": "textarea", "label": "Previous Surgeries / Hospitalizations", "required": false}, {"id": "heading_medications", "type": "heading", "label": "Current Medications"}, {"id": "medications_list", "type": "textarea", "label": "List all current medications (name, dose, frequency)", "required": false}, {"id": "allergies", "type": "textarea", "label": "Drug Allergies / Adverse Reactions", "required": false}, {"id": "heading_family", "type": "heading", "label": "Family History"}, {"id": "family_history", "type": "checkboxes", "label": "Family Medical History", "options": ["Hypertension", "Diabetes", "Heart Disease", "Stroke", "Cancer", "Mental Illness", "None known"], "required": false}, {"id": "heading_social", "type": "heading", "label": "Social History"}, {"id": "smoking", "type": "select", "label": "Tobacco Use", "options": ["Never", "Former smoker", "Current smoker"], "required": false}, {"id": "alcohol", "type": "select", "label": "Alcohol Use", "options": ["None", "Occasional", "Moderate", "Heavy"], "required": false}, {"id": "signature", "type": "signature", "label": "Patient Signature", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en", "es", "fr"]', '{}', '["intake", "medical history", "medications"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('762ad837-9e9d-5187-9273-baf299ec1327', 'HIPAA Authorization Form', 'hipaa-authorization', 'Authorization for use and disclosure of protected health information per HIPAA requirements.', '5419697e-13f9-5e83-af18-ec63d0358422', 'privacy', 'HIPAA Compliance', 'privacy', true, true, '1.3', 1, '[{"id": "paragraph_intro", "type": "paragraph", "label": "I authorize the use or disclosure of my protected health information (PHI) as described below. I understand that by signing this form I am authorizing the practice to use and disclose my health information for the purposes indicated."}, {"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "recipient_name", "type": "text", "label": "Authorized Recipient Name / Organization", "required": true}, {"id": "purpose", "type": "textarea", "label": "Purpose of Disclosure", "required": true}, {"id": "information_type", "type": "checkboxes", "label": "Type of Information to be Disclosed", "options": ["All medical records", "Lab results", "Radiology/imaging", "Mental health records", "Substance use records", "HIV/AIDS records", "Billing records"], "required": true}, {"id": "expiration", "type": "date", "label": "Expiration Date (or leave blank for one year)", "required": false}, {"id": "revocation_note", "type": "paragraph", "label": "I understand that I have the right to revoke this authorization at any time by submitting a written request to the Privacy Officer."}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date Signed", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en", "es"]', '{}', '["HIPAA", "authorization", "PHI", "privacy"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('8d823479-680f-5a04-9dc9-e318c6d46a69', 'Consent for Treatment', 'consent-for-treatment', 'General informed consent authorizing medical examination and treatment.', '7d963ba8-8e52-5866-9d7e-b8bb900b7b4b', 'consent', 'General Consent', 'consent', true, true, '2.0', 2, '[{"id": "paragraph_consent", "type": "paragraph", "label": "I voluntarily consent to treatment by the physicians and clinical staff of this practice. I understand that the practice of medicine is not an exact science and that results cannot be guaranteed. I acknowledge that no promises have been made to me regarding the outcome of my treatment."}, {"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "understand_rights", "type": "checkbox", "label": "I have been informed of my patient rights", "required": true}, {"id": "understand_billing", "type": "checkbox", "label": "I authorize insurance billing on my behalf", "required": true}, {"id": "paragraph_witness", "type": "paragraph", "label": "This consent was explained to the patient and they appeared to understand."}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}, {"id": "witness_signature", "type": "signature", "label": "Witness Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, true, true, '["en", "es"]', '{}', '["consent", "treatment", "authorization"]', true, NULL, '["HIPAA", "JCAHO"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('b2abe091-e16b-53b8-9c67-238ab9aba0f9', 'Telehealth Consent Form', 'telehealth-consent', 'Informed consent for telehealth / virtual care services including risks and benefits.', '7d963ba8-8e52-5866-9d7e-b8bb900b7b4b', 'consent', 'Telehealth', 'consent', true, true, '1.2', 1, '[{"id": "paragraph_intro", "type": "paragraph", "label": "Telehealth involves the use of electronic communications to enable healthcare providers to connect with patients remotely. The laws that protect the confidentiality of your medical information also apply to telehealth services."}, {"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "heading_understand", "type": "heading", "label": "I understand and agree to the following:"}, {"id": "understand_limits", "type": "checkbox", "label": "Telehealth has limitations compared to in-person care", "required": true}, {"id": "understand_tech", "type": "checkbox", "label": "Technical failures may interrupt the session", "required": true}, {"id": "understand_privacy", "type": "checkbox", "label": "I will participate in a private location to protect my PHI", "required": true}, {"id": "understand_emergency", "type": "checkbox", "label": "I know to call 911 in a medical emergency", "required": true}, {"id": "device_type", "type": "select", "label": "Primary Device for Telehealth", "options": ["Smartphone", "Tablet", "Laptop/Desktop", "Other"], "required": true}, {"id": "signature", "type": "signature", "label": "Patient Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en"]', '{}', '["telehealth", "virtual", "consent"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('d73acf1f-394b-5056-bd93-883eefd5feeb', 'Surgical / Procedure Consent', 'surgical-consent', 'Informed consent for surgical procedures including risks, benefits, and alternatives.', '7d963ba8-8e52-5866-9d7e-b8bb900b7b4b', 'consent', 'Surgical Consent', 'consent', true, true, '1.5', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "procedure_name", "type": "text", "label": "Procedure / Surgery Name", "required": true}, {"id": "surgeon", "type": "text", "label": "Surgeon / Provider Name", "required": true}, {"id": "paragraph_risks", "type": "paragraph", "label": "I have been informed of the nature of the procedure, expected benefits, material risks, and alternatives. I understand that no guarantee of results has been made."}, {"id": "risks_explained", "type": "checkbox", "label": "Risks and complications have been explained to me", "required": true}, {"id": "alternatives_explained", "type": "checkbox", "label": "Alternatives to this procedure have been discussed", "required": true}, {"id": "anesthesia_consent", "type": "checkbox", "label": "I consent to necessary anesthesia", "required": true}, {"id": "blood_consent", "type": "checkbox", "label": "I consent to blood transfusion if medically necessary", "required": false}, {"id": "questions_answered", "type": "checkbox", "label": "All my questions have been answered to my satisfaction", "required": true}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}, {"id": "witness_signature", "type": "signature", "label": "Witness Signature", "required": true}, {"id": "provider_signature", "type": "signature", "label": "Provider Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date & Time", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, true, true, '["en"]', '{}', '["surgery", "procedure", "consent", "anesthesia"]', false, NULL, '["HIPAA", "JCAHO"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('063e966c-ac3e-586e-a519-0e418c2d7b33', 'Medication Reconciliation Form', 'medication-reconciliation', 'Complete list of current medications, vitamins, supplements, and over-the-counter drugs.', '220f1e56-211f-5d13-a9ed-5eae07d17edc', 'medical', 'Medications', 'medical', true, true, '1.0', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "visit_date", "type": "date", "label": "Visit Date", "required": true}, {"id": "paragraph_intro", "type": "paragraph", "label": "Please list ALL medications you are currently taking, including prescription drugs, over-the-counter medications, vitamins, and herbal supplements."}, {"id": "med_1_name", "type": "text", "label": "Medication 1 – Name", "required": false}, {"id": "med_1_dose", "type": "text", "label": "Medication 1 – Dose", "required": false}, {"id": "med_1_freq", "type": "text", "label": "Medication 1 – Frequency", "required": false}, {"id": "med_2_name", "type": "text", "label": "Medication 2 – Name", "required": false}, {"id": "med_2_dose", "type": "text", "label": "Medication 2 – Dose", "required": false}, {"id": "med_2_freq", "type": "text", "label": "Medication 2 – Frequency", "required": false}, {"id": "med_3_name", "type": "text", "label": "Medication 3 – Name", "required": false}, {"id": "med_3_dose", "type": "text", "label": "Medication 3 – Dose", "required": false}, {"id": "med_3_freq", "type": "text", "label": "Medication 3 – Frequency", "required": false}, {"id": "additional_meds", "type": "textarea", "label": "Additional Medications (name, dose, frequency)", "required": false}, {"id": "allergies", "type": "textarea", "label": "Known Drug Allergies / Reactions", "required": false}, {"id": "no_meds", "type": "checkbox", "label": "I am not currently taking any medications", "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en"]', '{}', '["medications", "reconciliation", "pharmacy"]', true, NULL, '["HIPAA", "JCAHO"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('5c690ea8-161d-5f96-9122-78f3a663c79a', 'Review of Systems (ROS)', 'review-of-systems', 'Systematic checklist of symptoms across major body systems for clinical documentation.', 'efbc7fe1-0249-556b-ae14-ed28cdaa46bf', 'clinical', 'Clinical Assessment', 'clinical', true, true, '1.1', 1, '[{"id": "heading_general", "type": "heading", "label": "General"}, {"id": "general_symptoms", "type": "checkboxes", "label": "General Symptoms", "options": ["Fatigue", "Weight loss", "Weight gain", "Fever", "Chills", "Night sweats", "No complaints"], "required": false}, {"id": "heading_cardiovascular", "type": "heading", "label": "Cardiovascular"}, {"id": "cardio_symptoms", "type": "checkboxes", "label": "Cardiovascular Symptoms", "options": ["Chest pain", "Palpitations", "Shortness of breath", "Leg swelling", "No complaints"], "required": false}, {"id": "heading_respiratory", "type": "heading", "label": "Respiratory"}, {"id": "resp_symptoms", "type": "checkboxes", "label": "Respiratory Symptoms", "options": ["Cough", "Wheezing", "Shortness of breath", "Hemoptysis", "No complaints"], "required": false}, {"id": "heading_gi", "type": "heading", "label": "Gastrointestinal"}, {"id": "gi_symptoms", "type": "checkboxes", "label": "GI Symptoms", "options": ["Nausea", "Vomiting", "Diarrhea", "Constipation", "Abdominal pain", "Heartburn", "Blood in stool", "No complaints"], "required": false}, {"id": "heading_neuro", "type": "heading", "label": "Neurological"}, {"id": "neuro_symptoms", "type": "checkboxes", "label": "Neurological Symptoms", "options": ["Headache", "Dizziness", "Numbness/tingling", "Weakness", "Seizures", "Memory problems", "No complaints"], "required": false}, {"id": "heading_musculo", "type": "heading", "label": "Musculoskeletal"}, {"id": "musculo_symptoms", "type": "checkboxes", "label": "Musculoskeletal Symptoms", "options": ["Joint pain", "Muscle pain", "Swelling", "Stiffness", "Limited range of motion", "No complaints"], "required": false}, {"id": "additional_notes", "type": "textarea", "label": "Additional Symptoms / Comments", "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en"]', '{}', '["ROS", "symptoms", "systems review"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('81c6229b-9fa9-5467-b2e2-294711cfe5f3', 'Pain Assessment Form', 'pain-assessment', 'Structured pain evaluation including location, severity, quality, and functional impact.', 'efbc7fe1-0249-556b-ae14-ed28cdaa46bf', 'clinical', 'Pain Management', 'clinical', true, true, '1.0', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "visit_date", "type": "date", "label": "Assessment Date", "required": true}, {"id": "pain_location", "type": "textarea", "label": "Pain Location (describe or list all areas)", "required": true}, {"id": "pain_score", "type": "select", "label": "Current Pain Score (0 = none, 10 = worst possible)", "options": ["0 – No pain", "1", "2", "3", "4", "5 – Moderate", "6", "7", "8", "9", "10 – Worst possible"], "required": true}, {"id": "pain_quality", "type": "checkboxes", "label": "Quality of Pain", "options": ["Aching", "Burning", "Sharp", "Stabbing", "Throbbing", "Cramping", "Shooting", "Pressure", "Tingling"], "required": false}, {"id": "pain_pattern", "type": "select", "label": "Pain Pattern", "options": ["Constant", "Intermittent", "Comes and goes", "Worse with activity", "Worse at rest"], "required": false}, {"id": "pain_duration", "type": "text", "label": "How long have you had this pain?", "required": false}, {"id": "aggravating", "type": "textarea", "label": "What makes the pain worse?", "required": false}, {"id": "relieving", "type": "textarea", "label": "What makes the pain better?", "required": false}, {"id": "functional_impact", "type": "checkboxes", "label": "Impact on Daily Activities", "options": ["Sleep", "Work", "Walking", "Self-care", "Concentration", "Mood", "Social activities"], "required": false}, {"id": "prior_treatment", "type": "textarea", "label": "Prior Treatments / Medications Tried", "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en", "es"]', '{}', '["pain", "assessment", "VAS", "NRS"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('ce414c52-ef8d-575b-93c3-7def7006ce8c', 'Insurance Verification Form', 'insurance-verification', 'Collect primary and secondary insurance details for eligibility and billing purposes.', '76a5499f-72f9-5420-8367-8cb876090c5e', 'billing', 'Insurance', 'billing', true, true, '1.4', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "heading_primary", "type": "heading", "label": "Primary Insurance"}, {"id": "primary_insurer", "type": "text", "label": "Insurance Company Name", "required": true}, {"id": "primary_plan", "type": "text", "label": "Plan / Group Name", "required": false}, {"id": "primary_member_id", "type": "text", "label": "Member ID / Subscriber ID", "required": true}, {"id": "primary_group_no", "type": "text", "label": "Group Number", "required": false}, {"id": "primary_subscriber_name", "type": "text", "label": "Subscriber Name (if different from patient)", "required": false}, {"id": "primary_subscriber_dob", "type": "date", "label": "Subscriber Date of Birth", "required": false}, {"id": "primary_relationship", "type": "select", "label": "Patient Relationship to Subscriber", "options": ["Self", "Spouse", "Child", "Other"], "required": true}, {"id": "heading_secondary", "type": "heading", "label": "Secondary Insurance (if applicable)"}, {"id": "secondary_insurer", "type": "text", "label": "Secondary Insurance Company", "required": false}, {"id": "secondary_member_id", "type": "text", "label": "Secondary Member ID", "required": false}, {"id": "secondary_group_no", "type": "text", "label": "Secondary Group Number", "required": false}, {"id": "assignment_benefits", "type": "checkbox", "label": "I authorize assignment of insurance benefits to this practice", "required": true}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en"]', '{}', '["insurance", "billing", "eligibility", "verification"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('d76215e3-4332-5848-9003-a48306e9ef59', 'Financial Responsibility Agreement', 'financial-responsibility', 'Patient acknowledgment of financial responsibility for services rendered.', '76a5499f-72f9-5420-8367-8cb876090c5e', 'billing', 'Financial Policy', 'billing', true, true, '1.2', 1, '[{"id": "paragraph_policy", "type": "paragraph", "label": "As a patient of this practice, you are responsible for all charges not covered by your insurance, including co-pays, co-insurance, deductibles, and non-covered services. Payment is expected at the time of service unless prior arrangements have been made."}, {"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "understand_copay", "type": "checkbox", "label": "I understand I must pay my co-pay at each visit", "required": true}, {"id": "understand_deductible", "type": "checkbox", "label": "I am responsible for any deductible amounts", "required": true}, {"id": "understand_noncovered", "type": "checkbox", "label": "I am responsible for non-covered or denied services", "required": true}, {"id": "understand_collections", "type": "checkbox", "label": "Unpaid balances may be sent to collections after 90 days", "required": true}, {"id": "payment_plan", "type": "select", "label": "Preferred Payment Method", "options": ["Credit/Debit Card", "Cash", "Check", "Payment plan (if eligible)"], "required": false}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en"]', '{}', '["billing", "financial", "policy", "copay"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('e404440c-3ad6-54ac-8c8e-9286c734f056', 'Appointment Request Form', 'appointment-request', 'Patient self-scheduling request capturing preferred times, provider, and visit type.', '65095b88-8c71-5367-8aad-733654388c51', 'scheduling', 'Scheduling', 'scheduling', true, true, '1.0', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "phone", "type": "text", "label": "Phone Number", "required": true}, {"id": "email", "type": "email", "label": "Email", "required": false}, {"id": "visit_type", "type": "select", "label": "Type of Visit", "options": ["New patient", "Follow-up", "Annual physical", "Sick visit", "Telehealth", "Specialist consultation", "Procedure"], "required": true}, {"id": "reason", "type": "textarea", "label": "Brief reason for visit", "required": true}, {"id": "preferred_date_1", "type": "date", "label": "Preferred Date (1st choice)", "required": true}, {"id": "preferred_date_2", "type": "date", "label": "Preferred Date (2nd choice)", "required": false}, {"id": "preferred_time", "type": "checkboxes", "label": "Preferred Time", "options": ["Morning (8am–12pm)", "Afternoon (12pm–4pm)", "Late afternoon (4pm–6pm)"], "required": false}, {"id": "provider_preference", "type": "text", "label": "Preferred Provider (if any)", "required": false}, {"id": "special_needs", "type": "textarea", "label": "Special accommodations or accessibility needs", "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en"]', '{}', '["scheduling", "appointment", "self-service"]', false, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('142a1f27-9453-5d38-962a-c841c0524db2', 'Patient Satisfaction Survey', 'patient-satisfaction-survey', 'Post-visit satisfaction survey measuring patient experience across care, communication, and facilities.', 'c31f64a8-b072-5225-aef0-d352e5fc2f9a', 'feedback', 'Satisfaction Survey', 'feedback', true, true, '2.0', 2, '[{"id": "visit_date", "type": "date", "label": "Date of Visit", "required": false}, {"id": "provider_name", "type": "text", "label": "Provider Seen", "required": false}, {"id": "heading_care", "type": "heading", "label": "Quality of Care"}, {"id": "overall_rating", "type": "select", "label": "Overall, how would you rate your care today?", "options": ["5 – Excellent", "4 – Very Good", "3 – Good", "2 – Fair", "1 – Poor"], "required": true}, {"id": "provider_listens", "type": "select", "label": "Did your provider listen carefully to you?", "options": ["Always", "Usually", "Sometimes", "Never"], "required": true}, {"id": "provider_explained", "type": "select", "label": "Did your provider explain things clearly?", "options": ["Always", "Usually", "Sometimes", "Never"], "required": true}, {"id": "heading_access", "type": "heading", "label": "Access & Wait Times"}, {"id": "wait_time", "type": "select", "label": "Wait time before seeing the provider", "options": ["Under 10 minutes", "10-20 minutes", "20-30 minutes", "Over 30 minutes"], "required": false}, {"id": "wait_satisfaction", "type": "select", "label": "Were you satisfied with the wait time?", "options": ["Very satisfied", "Satisfied", "Dissatisfied", "Very dissatisfied"], "required": false}, {"id": "heading_recommend", "type": "heading", "label": "Recommendation"}, {"id": "recommend", "type": "select", "label": "Would you recommend us to family or friends?", "options": ["Definitely yes", "Probably yes", "Probably no", "Definitely no"], "required": true}, {"id": "nps", "type": "select", "label": "On a scale of 0-10, how likely are you to recommend this practice?", "options": ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "0"], "required": false}, {"id": "comments", "type": "textarea", "label": "Additional comments or suggestions", "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en", "es"]', '{}', '["satisfaction", "survey", "CAHPS", "quality"]', false, NULL, '[]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('cbd295ab-4da9-5848-b1bf-64edc27011b6', 'Release of Information (ROI)', 'release-of-information', 'Authorization to release medical records to specified third parties.', 'e00c39ea-814a-5b45-b399-388c39d5ca46', 'legal', 'Records Release', 'legal', true, true, '1.3', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "address", "type": "text", "label": "Address", "required": false}, {"id": "heading_release_to", "type": "heading", "label": "Release Information To"}, {"id": "recipient_name", "type": "text", "label": "Name / Organization", "required": true}, {"id": "recipient_address", "type": "text", "label": "Address", "required": false}, {"id": "recipient_phone", "type": "text", "label": "Phone / Fax", "required": false}, {"id": "heading_records", "type": "heading", "label": "Records Requested"}, {"id": "records_type", "type": "checkboxes", "label": "Type of Records", "options": ["Complete medical record", "Office notes", "Lab results", "Radiology reports", "Imaging (CD/digital)", "Operative reports", "Discharge summary", "Mental health records", "Immunization records", "Billing records"], "required": true}, {"id": "date_range_from", "type": "date", "label": "Records From Date", "required": false}, {"id": "date_range_to", "type": "date", "label": "Records To Date", "required": false}, {"id": "purpose", "type": "select", "label": "Purpose of Release", "options": ["Continuing care", "Personal use", "Insurance/legal", "Second opinion", "Other"], "required": true}, {"id": "expiration", "type": "date", "label": "Authorization Expiration Date", "required": false}, {"id": "revocation_note", "type": "paragraph", "label": "I understand I may revoke this authorization in writing at any time. Revocation will not apply to actions already taken."}, {"id": "signature", "type": "signature", "label": "Patient / Legal Representative Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date Signed", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en"]', '{}', '["records", "release", "ROI", "authorization"]', false, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('63b14b4b-9349-5290-a8d4-7e1cc0320252', 'Notice of Privacy Practices Acknowledgment', 'notice-of-privacy-practices', 'Patient acknowledgment of receipt of the Notice of Privacy Practices (NPP) as required by HIPAA.', '5419697e-13f9-5e83-af18-ec63d0358422', 'privacy', 'NPP Acknowledgment', 'privacy', true, true, '1.0', 1, '[{"id": "paragraph_npp", "type": "paragraph", "label": "Our Notice of Privacy Practices describes how we may use and disclose your protected health information to carry out treatment, payment, and healthcare operations. It also describes your rights related to your health information."}, {"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "dob", "type": "date", "label": "Date of Birth", "required": true}, {"id": "received_npp", "type": "checkbox", "label": "I have received a copy of the Notice of Privacy Practices", "required": true}, {"id": "understand_npp", "type": "checkbox", "label": "I understand my privacy rights as described in the NPP", "required": true}, {"id": "signature", "type": "signature", "label": "Patient / Guardian Signature", "required": true}, {"id": "signed_date", "type": "date", "label": "Date", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en", "es"]', '{}', '["HIPAA", "NPP", "privacy", "acknowledgment"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('6f3c92ce-29eb-5db2-ae12-e31e9945f20e', 'Communication Preferences', 'communication-preferences', 'Patient preferences for appointment reminders, health notifications, and portal communications.', '8a4f2e1a-9cd1-5afb-a9a2-ef1a14c472b0', 'communication', 'Patient Preferences', 'communication', true, true, '1.1', 1, '[{"id": "patient_name", "type": "text", "label": "Patient Name", "required": true}, {"id": "heading_reminders", "type": "heading", "label": "Appointment Reminders"}, {"id": "reminder_method", "type": "checkboxes", "label": "How would you like to receive appointment reminders?", "options": ["Phone call", "Text/SMS", "Email", "Patient portal notification", "Mail"], "required": false}, {"id": "reminder_timing", "type": "select", "label": "How far in advance do you prefer reminders?", "options": ["1 day before", "2 days before", "1 week before", "Both 1 week and 1 day before"], "required": false}, {"id": "heading_notifications", "type": "heading", "label": "Health Notifications"}, {"id": "lab_results", "type": "select", "label": "How to receive lab results?", "options": ["Patient portal", "Email", "Phone call from staff", "Mail"], "required": false}, {"id": "marketing_consent", "type": "select", "label": "Health education and wellness newsletters", "options": ["Yes, I would like to receive these", "No, please do not send these"], "required": false}, {"id": "heading_language", "type": "heading", "label": "Language Preference"}, {"id": "preferred_language", "type": "select", "label": "Preferred language for communications", "options": ["English", "Spanish (Español)", "French (Français)", "Portuguese (Português)", "German (Deutsch)", "Other"], "required": false}, {"id": "interpreter_needed", "type": "select", "label": "Do you need an interpreter for in-person visits?", "options": ["No", "Yes – Spanish", "Yes – Other language"], "required": false}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', false, false, true, '["en"]', '{}', '["communication", "preferences", "reminders", "portal"]', true, NULL, '["HIPAA"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL),
	('273b584d-39ad-5cbe-b18a-6dd04b433524', 'Staff Incident / Event Report', 'staff-incident-report', 'Internal staff form for documenting patient safety events, near misses, and workplace incidents.', '6bcae6c6-7434-5954-98b7-d67eb20680b4', 'operational', 'Incident Reporting', 'operational', true, true, '1.0', 1, '[{"id": "reporter_name", "type": "text", "label": "Reporter Name", "required": true}, {"id": "reporter_role", "type": "select", "label": "Reporter Role", "options": ["Physician", "Nurse/MA", "Pharmacist", "Administrative", "Lab/Radiology", "Other"], "required": true}, {"id": "incident_date", "type": "date", "label": "Date of Incident", "required": true}, {"id": "incident_time", "type": "text", "label": "Time of Incident", "required": false}, {"id": "location", "type": "text", "label": "Location / Department", "required": true}, {"id": "incident_type", "type": "select", "label": "Type of Incident", "options": ["Patient fall", "Medication error", "Wrong patient/procedure", "Near miss", "Equipment failure", "Workplace injury", "Patient complaint", "Other"], "required": true}, {"id": "patient_involved", "type": "select", "label": "Was a patient involved?", "options": ["Yes", "No"], "required": true}, {"id": "patient_id", "type": "text", "label": "Patient MRN (if applicable)", "required": false}, {"id": "description", "type": "textarea", "label": "Description of Incident", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Immediate Action Taken", "required": true}, {"id": "witnesses", "type": "textarea", "label": "Witness Names / Roles", "required": false}, {"id": "contributing_factors", "type": "checkboxes", "label": "Contributing Factors", "options": ["Communication failure", "Equipment/supplies", "Staffing/workload", "Policy/procedure", "Training", "Environment", "Patient factors", "Unknown"], "required": false}, {"id": "severity", "type": "select", "label": "Severity / Harm Level", "options": ["No harm – near miss", "No harm – reached patient", "Harm – minor/temporary", "Harm – major/permanent", "Death"], "required": true}, {"id": "signature", "type": "signature", "label": "Reporter Signature", "required": true}]', '{}', NULL, '["admin", "provider", "staff", "patient"]', true, false, true, '["en"]', '{}', '["incident", "safety", "staff", "event report"]', false, NULL, '["JCAHO"]', NULL, NULL, '2026-11-22 22:00:15.383293', '2026-11-22 22:00:15.383293', 'base', 1, false, NULL);


--
-- Data for Name: healthcare_offerings; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: insurance_payers; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: intake_flow_templates; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: inventory_categories; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: inventory_purchase_orders; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: inventory_role_permissions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--

INSERT INTO tenant_default.inventory_role_permissions VALUES
	('8382d3c6-9fb9-4338-8255-c8619a664085', 'admin', 'items', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.269194+00'),
	('dab07d0d-b8a5-49d9-8ba5-5b045aa2ce29', 'admin', 'categories', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.269194+00'),
	('853be8bd-63c8-4208-8de7-7459ca5c80d8', 'admin', 'suppliers', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.269194+00'),
	('57bb6276-0caa-4021-89eb-25770037555a', 'admin', 'stock_movements', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.269194+00'),
	('4697afd9-9e88-41e8-8eeb-d0c2f4c12c8c', 'admin', 'purchase_orders', true, true, true, true, true, true, NULL, '2026-11-22 22:00:14.269194+00'),
	('a4645828-ac06-41f7-85dd-908a60074e3e', 'billing_manager', 'items', true, false, false, false, false, true, NULL, '2026-11-22 22:00:14.269194+00'),
	('95be7be1-2de6-4c9d-b837-5e4033758fac', 'billing_manager', 'categories', true, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('db81e2be-da3b-4d43-9324-144f417d1907', 'billing_manager', 'suppliers', true, true, true, false, false, true, NULL, '2026-11-22 22:00:14.269194+00'),
	('c55582d7-bd09-4cf3-9531-f4423b89bc62', 'billing_manager', 'stock_movements', true, false, false, false, false, true, NULL, '2026-11-22 22:00:14.269194+00'),
	('92580dd3-2748-473f-8cdb-1b362212541c', 'billing_manager', 'purchase_orders', true, true, true, false, true, true, NULL, '2026-11-22 22:00:14.269194+00'),
	('bdc33e9c-8187-46b9-add8-23a2ac560496', 'doctor', 'items', true, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('3f335ebf-4413-4f4b-994a-44cfb75aa9ae', 'doctor', 'categories', true, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('4679c3b8-4cb3-4196-a3d8-b55e7a4a8599', 'doctor', 'suppliers', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('21c5c5c8-0b6f-4af9-aab9-6d1ebc29db9c', 'doctor', 'stock_movements', true, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('902807d2-f7a0-4fb1-a0ee-30fd6df79f36', 'doctor', 'purchase_orders', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('f58af63f-a724-4642-8d3e-44209d1f1f3c', 'nurse', 'items', true, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('deb051dc-609c-41c6-97b2-a7dcc0c97783', 'nurse', 'categories', true, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('cce48a81-cc38-417c-a293-5f489d89ec9a', 'nurse', 'suppliers', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('87b218c5-2cfe-4b5b-92c4-68aa8f13941b', 'nurse', 'stock_movements', true, true, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('c246104e-10f9-4d3d-98a2-366614f05a0f', 'nurse', 'purchase_orders', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('c0b35721-e709-4df2-8a5b-03e38b194519', 'receptionist', 'items', true, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('cc8d34c4-ccd6-4cfc-93ed-57dd63def349', 'receptionist', 'categories', true, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('25d26eba-2233-415c-a0aa-60829b214405', 'receptionist', 'suppliers', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('4acc5291-09fe-4f49-b51e-75c6d9596ed8', 'receptionist', 'stock_movements', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('18ce2fd5-cc0c-4e73-bf2e-d529bc8cdff9', 'receptionist', 'purchase_orders', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('eae2f6f3-e5b5-44e4-a5c6-0c34fe809700', 'crm_manager', 'items', true, false, false, false, false, true, NULL, '2026-11-22 22:00:14.269194+00'),
	('30faeb76-03ef-4347-8b43-0969087f1383', 'crm_manager', 'categories', true, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('b627fc82-11ff-4a62-8769-7584163d4c6d', 'crm_manager', 'suppliers', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('1ed05f90-e091-4708-b538-89e582f55165', 'crm_manager', 'stock_movements', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00'),
	('14e20f3a-4a3a-4360-b53b-fc979c0fa988', 'crm_manager', 'purchase_orders', false, false, false, false, false, false, NULL, '2026-11-22 22:00:14.269194+00');


--
-- Data for Name: inventory_stock_movements; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: inventory_suppliers; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: lab_orders; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: laboratories; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: locations; Type: TABLE DATA; Schema: tenant_default; Owner: -
--

INSERT INTO tenant_default.locations VALUES
	('b7070123-2aed-4719-9f7d-49167964373f', 'Default Clinic', 'clinic', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, true, '2026-11-22 22:00:15.317893', '2026-11-22 22:00:15.317893');


--
-- Data for Name: medical_records; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: module_permissions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: offering_form_links; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: offering_insurance_mappings; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: offering_packages; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: offering_pricing; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: offering_promotions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: offering_reviews; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: package_offerings; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: patient_allergies; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: patient_consent_forms; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: patient_intake_flows; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: patient_intake_forms; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: patient_offering_enrollments; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: patient_pharmacies; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: patient_portal_sessions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: patients; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: payment_postings; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: payments; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: pharmacies; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: portal_invites; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: preapprovals; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: prescription_history; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: prescriptions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: provider_booking_config; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: recurring_appointments; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: tenant_default; Owner: -
--

INSERT INTO tenant_default.schema_migrations VALUES
	(0, 'baseline (data relocated from public at S4)', '2026-11-22 22:00:14.48936+00'),
	(14, '014_sick_notes.sql', '2026-11-22 22:00:15.054252+00'),
	(15, '015_sick_note_requests.sql', '2026-11-22 22:00:15.071401+00'),
	(16, '016_notifications_eligibility_scrub.sql', '2026-11-22 22:00:15.080681+00'),
	(1, '001_adopt_runtime_created_tables.sql', '2026-11-22 22:00:15.303536+00'),
	(2, '002_audit_log_append_only.sql', '2026-11-22 22:00:15.311412+00'),
	(3, '003_audit_logs_keep_history.sql', '2026-11-22 22:00:15.313534+00'),
	(4, '004_locations.sql', '2026-11-22 22:00:15.317893+00'),
	(5, '005_location_id_columns.sql', '2026-11-22 22:00:15.325318+00'),
	(6, '006_camps.sql', '2026-11-22 22:00:15.335777+00'),
	(7, '007_pack_provenance.sql', '2026-11-22 22:00:15.376661+00'),
	(8, '008_seed_form_library.sql', '2026-11-22 22:00:15.383293+00'),
	(9, '009_specialty_forms_move_to_packs.sql', '2026-11-22 22:00:15.388919+00'),
	(10, '010_ai_integrations.sql', '2026-11-22 22:00:15.392971+00'),
	(11, '011_module_permissions.sql', '2026-11-22 22:00:15.409542+00'),
	(12, '012_portal_invites.sql', '2026-11-22 22:00:15.414797+00'),
	(13, '013_appointments_meeting_url.sql', '2026-11-22 22:00:15.419965+00');


--
-- Data for Name: service_categories; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: sick_note_requests; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: sick_notes; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: staff_notification_preferences; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: tasks; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: telehealth_provider_settings; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: telehealth_sessions; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: vendor_integration_settings; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Data for Name: vendor_transaction_log; Type: TABLE DATA; Schema: tenant_default; Owner: -
--



--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: control; Owner: -
--

SELECT pg_catalog.setval('control.audit_log_id_seq', 1, false);


--
-- Name: billing_events_id_seq; Type: SEQUENCE SET; Schema: control; Owner: -
--

SELECT pg_catalog.setval('control.billing_events_id_seq', 1, false);


--
-- Name: platform_notifications_id_seq; Type: SEQUENCE SET; Schema: control; Owner: -
--

SELECT pg_catalog.setval('control.platform_notifications_id_seq', 1, false);


--
-- Name: account_ap_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_ap_seq', 1, false);


--
-- Name: account_ar_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_ar_seq', 1, false);


--
-- Name: account_je_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_je_seq', 1, false);


--
-- Name: account_rec_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_rec_seq', 1, false);


--
-- Name: account_stm_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_stm_seq', 1, false);


--
-- Name: accounts_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.accounts_seq', 1000, false);


--
-- Name: directory_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.directory_events_id_seq', 1, false);


--
-- Name: inventory_item_number_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_item_number_seq', 1, false);


--
-- Name: inventory_movement_number_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_movement_number_seq', 1, false);


--
-- Name: inventory_po_number_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_po_number_seq', 1, false);


--
-- Name: inventory_supplier_number_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_supplier_number_seq', 1, false);


--
-- Name: organization_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.organization_settings_id_seq', 1, true);


--
-- Name: permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.permissions_id_seq', 1, false);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 1, false);


--
-- Name: subscription_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.subscription_plans_id_seq', 4, true);


--
-- Name: user_role_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_role_history_id_seq', 1, false);


--
-- Name: appointment_types_id_seq; Type: SEQUENCE SET; Schema: tenant_default; Owner: -
--

SELECT pg_catalog.setval('tenant_default.appointment_types_id_seq', 1, false);


--
-- Name: backup_provider_settings_id_seq; Type: SEQUENCE SET; Schema: tenant_default; Owner: -
--

SELECT pg_catalog.setval('tenant_default.backup_provider_settings_id_seq', 1, false);


--
-- Name: campaigns_id_seq; Type: SEQUENCE SET; Schema: tenant_default; Owner: -
--

SELECT pg_catalog.setval('tenant_default.campaigns_id_seq', 1, false);


--
-- Name: clinic_appointment_settings_id_seq; Type: SEQUENCE SET; Schema: tenant_default; Owner: -
--

SELECT pg_catalog.setval('tenant_default.clinic_appointment_settings_id_seq', 1, false);


--
-- Name: clinic_info_id_seq; Type: SEQUENCE SET; Schema: tenant_default; Owner: -
--

SELECT pg_catalog.setval('tenant_default.clinic_info_id_seq', 1, false);


--
-- Name: clinic_working_hours_id_seq; Type: SEQUENCE SET; Schema: tenant_default; Owner: -
--

SELECT pg_catalog.setval('tenant_default.clinic_working_hours_id_seq', 1, false);


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE SET; Schema: tenant_default; Owner: -
--

SELECT pg_catalog.setval('tenant_default.notification_preferences_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: tenant_default; Owner: -
--

SELECT pg_catalog.setval('tenant_default.notifications_id_seq', 1, false);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: tenant_default; Owner: -
--

SELECT pg_catalog.setval('tenant_default.tasks_id_seq', 1, false);


--
-- Name: telehealth_provider_settings_id_seq; Type: SEQUENCE SET; Schema: tenant_default; Owner: -
--

SELECT pg_catalog.setval('tenant_default.telehealth_provider_settings_id_seq', 1, false);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: billing_events billing_events_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.billing_events
    ADD CONSTRAINT billing_events_pkey PRIMARY KEY (id);


--
-- Name: billing_events billing_events_stripe_object_id_key; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.billing_events
    ADD CONSTRAINT billing_events_stripe_object_id_key UNIQUE (stripe_object_id);


--
-- Name: booking_slug_route booking_slug_route_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.booking_slug_route
    ADD CONSTRAINT booking_slug_route_pkey PRIMARY KEY (slug);


--
-- Name: break_glass_sessions break_glass_sessions_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.break_glass_sessions
    ADD CONSTRAINT break_glass_sessions_pkey PRIMARY KEY (id);


--
-- Name: config_baseline config_baseline_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.config_baseline
    ADD CONSTRAINT config_baseline_pkey PRIMARY KEY (key);


--
-- Name: operators operators_email_key; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.operators
    ADD CONSTRAINT operators_email_key UNIQUE (email);


--
-- Name: operators operators_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.operators
    ADD CONSTRAINT operators_pkey PRIMARY KEY (id);


--
-- Name: platform_notifications platform_notifications_dedupe_key_key; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.platform_notifications
    ADD CONSTRAINT platform_notifications_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: platform_notifications platform_notifications_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.platform_notifications
    ADD CONSTRAINT platform_notifications_pkey PRIMARY KEY (id);


--
-- Name: portal_identity_route portal_identity_route_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.portal_identity_route
    ADD CONSTRAINT portal_identity_route_pkey PRIMARY KEY (email_hmac, tenant_id);


--
-- Name: portal_invite_route portal_invite_route_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.portal_invite_route
    ADD CONSTRAINT portal_invite_route_pkey PRIMARY KEY (token_hash);


--
-- Name: portal_session_route portal_session_route_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.portal_session_route
    ADD CONSTRAINT portal_session_route_pkey PRIMARY KEY (token_hash);


--
-- Name: signup_intents signup_intents_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.signup_intents
    ADD CONSTRAINT signup_intents_pkey PRIMARY KEY (id);


--
-- Name: signup_intents signup_intents_stripe_checkout_session_id_key; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.signup_intents
    ADD CONSTRAINT signup_intents_stripe_checkout_session_id_key UNIQUE (stripe_checkout_session_id);


--
-- Name: subscription_grants subscription_grants_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.subscription_grants
    ADD CONSTRAINT subscription_grants_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_tenant_id_key; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.subscriptions
    ADD CONSTRAINT subscriptions_tenant_id_key UNIQUE (tenant_id);


--
-- Name: tenant_tables tenant_tables_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.tenant_tables
    ADD CONSTRAINT tenant_tables_pkey PRIMARY KEY (table_name);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_schema_name_key; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.tenants
    ADD CONSTRAINT tenants_schema_name_key UNIQUE (schema_name);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: account_backups account_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_backups
    ADD CONSTRAINT account_backups_pkey PRIMARY KEY (id);


--
-- Name: archive_metadata archive_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archive_metadata
    ADD CONSTRAINT archive_metadata_pkey PRIMARY KEY (id);


--
-- Name: billing_coupons billing_coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_coupons
    ADD CONSTRAINT billing_coupons_code_key UNIQUE (code);


--
-- Name: billing_coupons billing_coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_coupons
    ADD CONSTRAINT billing_coupons_pkey PRIMARY KEY (id);


--
-- Name: billing_invoice_items billing_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoice_items
    ADD CONSTRAINT billing_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: billing_invoices billing_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: billing_invoices billing_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_pkey PRIMARY KEY (id);


--
-- Name: billing_payments billing_payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_payments
    ADD CONSTRAINT billing_payments_payment_number_key UNIQUE (payment_number);


--
-- Name: billing_payments billing_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_payments
    ADD CONSTRAINT billing_payments_pkey PRIMARY KEY (id);


--
-- Name: billing_quote_items billing_quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_quote_items
    ADD CONSTRAINT billing_quote_items_pkey PRIMARY KEY (id);


--
-- Name: billing_quotes billing_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_quotes
    ADD CONSTRAINT billing_quotes_pkey PRIMARY KEY (id);


--
-- Name: billing_quotes billing_quotes_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_quotes
    ADD CONSTRAINT billing_quotes_quote_number_key UNIQUE (quote_number);


--
-- Name: directory_events directory_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directory_events
    ADD CONSTRAINT directory_events_pkey PRIMARY KEY (id);


--
-- Name: drug_interactions drug_interactions_drug1_ndc_drug2_ndc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_drug1_ndc_drug2_ndc_key UNIQUE (drug1_ndc, drug2_ndc);


--
-- Name: drug_interactions drug_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_pkey PRIMARY KEY (id);


--
-- Name: inventory_purchase_order_lines inventory_purchase_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_order_lines
    ADD CONSTRAINT inventory_purchase_order_lines_pkey PRIMARY KEY (id);


--
-- Name: inventory_purchase_order_lines inventory_purchase_order_lines_po_id_line_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_order_lines
    ADD CONSTRAINT inventory_purchase_order_lines_po_id_line_number_key UNIQUE (po_id, line_number);


--
-- Name: join_requests join_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.join_requests
    ADD CONSTRAINT join_requests_pkey PRIMARY KEY (id);


--
-- Name: license_keys license_keys_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_keys
    ADD CONSTRAINT license_keys_key_key UNIQUE (key);


--
-- Name: license_keys license_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_keys
    ADD CONSTRAINT license_keys_pkey PRIMARY KEY (id);


--
-- Name: login_lockouts login_lockouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_lockouts
    ADD CONSTRAINT login_lockouts_pkey PRIMARY KEY (key_hash);


--
-- Name: medical_codes medical_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_codes
    ADD CONSTRAINT medical_codes_code_key UNIQUE (code);


--
-- Name: medical_codes medical_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_codes
    ADD CONSTRAINT medical_codes_pkey PRIMARY KEY (id);


--
-- Name: medication_alternatives medication_alternatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_alternatives
    ADD CONSTRAINT medication_alternatives_pkey PRIMARY KEY (id);


--
-- Name: medications medications_ndc_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_ndc_code_key UNIQUE (ndc_code);


--
-- Name: medications medications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (user_id, practice_id);


--
-- Name: message_attachments message_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);


--
-- Name: message_read_receipts message_read_receipts_message_id_reader_kind_reader_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_message_id_reader_kind_reader_id_key UNIQUE (message_id, reader_kind, reader_id);


--
-- Name: message_read_receipts message_read_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_pkey PRIMARY KEY (id);


--
-- Name: message_thread_participants message_thread_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_thread_participants
    ADD CONSTRAINT message_thread_participants_pkey PRIMARY KEY (id);


--
-- Name: message_thread_participants message_thread_participants_thread_id_participant_kind_part_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_thread_participants
    ADD CONSTRAINT message_thread_participants_thread_id_participant_kind_part_key UNIQUE (thread_id, participant_kind, participant_id);


--
-- Name: message_threads message_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: mobile_oauth_flows mobile_oauth_flows_code_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_oauth_flows
    ADD CONSTRAINT mobile_oauth_flows_code_hash_key UNIQUE (code_hash);


--
-- Name: mobile_oauth_flows mobile_oauth_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_oauth_flows
    ADD CONSTRAINT mobile_oauth_flows_pkey PRIMARY KEY (id);


--
-- Name: mobile_oauth_flows mobile_oauth_flows_state_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_oauth_flows
    ADD CONSTRAINT mobile_oauth_flows_state_hash_key UNIQUE (state_hash);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: practice_domains practice_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_domains
    ADD CONSTRAINT practice_domains_pkey PRIMARY KEY (id);


--
-- Name: practice_profile_photos practice_profile_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_profile_photos
    ADD CONSTRAINT practice_profile_photos_pkey PRIMARY KEY (id);


--
-- Name: practice_profiles practice_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_profiles
    ADD CONSTRAINT practice_profiles_pkey PRIMARY KEY (practice_id);


--
-- Name: practice_profiles practice_profiles_random_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_profiles
    ADD CONSTRAINT practice_profiles_random_slug_key UNIQUE (random_slug);


--
-- Name: practice_profiles practice_profiles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_profiles
    ADD CONSTRAINT practice_profiles_slug_key UNIQUE (slug);


--
-- Name: practices practices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practices
    ADD CONSTRAINT practices_pkey PRIMARY KEY (id);


--
-- Name: provider_listing_consents provider_listing_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_listing_consents
    ADD CONSTRAINT provider_listing_consents_pkey PRIMARY KEY (practice_id, provider_id);


--
-- Name: providers providers_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_email_unique UNIQUE (email);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);




--
-- Name: short_links short_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.short_links
    ADD CONSTRAINT short_links_pkey PRIMARY KEY (code_hash);


--
-- Name: social_auth social_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_auth
    ADD CONSTRAINT social_auth_pkey PRIMARY KEY (id);


--
-- Name: social_auth social_auth_provider_provider_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_auth
    ADD CONSTRAINT social_auth_provider_provider_user_id_key UNIQUE (provider, provider_user_id);


--
-- Name: specialties specialties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialties
    ADD CONSTRAINT specialties_pkey PRIMARY KEY (code);


--
-- Name: specialty_packs specialty_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_packs
    ADD CONSTRAINT specialty_packs_pkey PRIMARY KEY (id);


--
-- Name: staff_invites staff_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invites
    ADD CONSTRAINT staff_invites_pkey PRIMARY KEY (id);


--
-- Name: staff_invites staff_invites_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invites
    ADD CONSTRAINT staff_invites_token_hash_key UNIQUE (token_hash);


--
-- Name: stripe_integration_settings stripe_integration_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_integration_settings
    ADD CONSTRAINT stripe_integration_settings_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_name_key UNIQUE (name);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: specialty_packs uq_specialty_packs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_packs
    ADD CONSTRAINT uq_specialty_packs UNIQUE (code, version);


--
-- Name: user_role_history user_role_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_history
    ADD CONSTRAINT user_role_history_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: account_ar_aging_snapshots account_ar_aging_snapshots_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_ar_aging_snapshots
    ADD CONSTRAINT account_ar_aging_snapshots_pkey PRIMARY KEY (id);


--
-- Name: account_journal_entries account_journal_entries_entry_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_journal_entries
    ADD CONSTRAINT account_journal_entries_entry_number_key UNIQUE (entry_number);


--
-- Name: account_journal_entries account_journal_entries_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_journal_entries
    ADD CONSTRAINT account_journal_entries_pkey PRIMARY KEY (id);


--
-- Name: account_journal_lines account_journal_lines_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_journal_lines
    ADD CONSTRAINT account_journal_lines_pkey PRIMARY KEY (id);


--
-- Name: account_payables account_payables_ap_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_payables
    ADD CONSTRAINT account_payables_ap_number_key UNIQUE (ap_number);


--
-- Name: account_payables account_payables_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_payables
    ADD CONSTRAINT account_payables_pkey PRIMARY KEY (id);


--
-- Name: account_receivables account_receivables_ar_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_receivables
    ADD CONSTRAINT account_receivables_ar_number_key UNIQUE (ar_number);


--
-- Name: account_receivables account_receivables_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_receivables
    ADD CONSTRAINT account_receivables_pkey PRIMARY KEY (id);


--
-- Name: account_reconciliation_items account_reconciliation_items_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_reconciliation_items
    ADD CONSTRAINT account_reconciliation_items_pkey PRIMARY KEY (id);


--
-- Name: account_reconciliations account_reconciliations_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_reconciliations
    ADD CONSTRAINT account_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: account_reconciliations account_reconciliations_reconciliation_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_reconciliations
    ADD CONSTRAINT account_reconciliations_reconciliation_number_key UNIQUE (reconciliation_number);


--
-- Name: account_role_permissions account_role_permissions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_role_permissions
    ADD CONSTRAINT account_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: account_role_permissions account_role_permissions_role_name_resource_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_role_permissions
    ADD CONSTRAINT account_role_permissions_role_name_resource_key UNIQUE (role_name, resource);


--
-- Name: account_statement_items account_statement_items_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_statement_items
    ADD CONSTRAINT account_statement_items_pkey PRIMARY KEY (id);


--
-- Name: account_statements account_statements_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_statements
    ADD CONSTRAINT account_statements_pkey PRIMARY KEY (id);


--
-- Name: account_statements account_statements_statement_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_statements
    ADD CONSTRAINT account_statements_statement_number_key UNIQUE (statement_number);


--
-- Name: accounts accounts_account_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.accounts
    ADD CONSTRAINT accounts_account_number_key UNIQUE (account_number);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: ai_feature_settings ai_feature_settings_key_uq; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.ai_feature_settings
    ADD CONSTRAINT ai_feature_settings_key_uq UNIQUE (feature_key);


--
-- Name: ai_feature_settings ai_feature_settings_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.ai_feature_settings
    ADD CONSTRAINT ai_feature_settings_pkey PRIMARY KEY (id);


--
-- Name: ai_phi_token_map ai_phi_token_map_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.ai_phi_token_map
    ADD CONSTRAINT ai_phi_token_map_pkey PRIMARY KEY (id);


--
-- Name: ai_phi_token_map ai_phi_token_map_uq; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.ai_phi_token_map
    ADD CONSTRAINT ai_phi_token_map_uq UNIQUE (request_id, token);


--
-- Name: ai_provider_credentials ai_provider_credentials_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.ai_provider_credentials
    ADD CONSTRAINT ai_provider_credentials_pkey PRIMARY KEY (id);


--
-- Name: ai_provider_credentials ai_provider_credentials_provider_uq; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.ai_provider_credentials
    ADD CONSTRAINT ai_provider_credentials_provider_uq UNIQUE (provider);


--
-- Name: ai_requests ai_requests_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.ai_requests
    ADD CONSTRAINT ai_requests_pkey PRIMARY KEY (id);


--
-- Name: ai_suggestions ai_suggestions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.ai_suggestions
    ADD CONSTRAINT ai_suggestions_pkey PRIMARY KEY (id);


--
-- Name: appointment_reminders appointment_reminders_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointment_reminders
    ADD CONSTRAINT appointment_reminders_pkey PRIMARY KEY (id);


--
-- Name: appointment_type_config appointment_type_config_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointment_type_config
    ADD CONSTRAINT appointment_type_config_pkey PRIMARY KEY (id);


--
-- Name: appointment_types appointment_types_name_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointment_types
    ADD CONSTRAINT appointment_types_name_key UNIQUE (name);


--
-- Name: appointment_types appointment_types_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointment_types
    ADD CONSTRAINT appointment_types_pkey PRIMARY KEY (id);


--
-- Name: appointment_waitlist appointment_waitlist_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: archive_rules archive_rules_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.archive_rules
    ADD CONSTRAINT archive_rules_pkey PRIMARY KEY (id);


--
-- Name: archive_rules archive_rules_rule_name_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.archive_rules
    ADD CONSTRAINT archive_rules_rule_name_key UNIQUE (rule_name);


--
-- Name: archives archives_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.archives
    ADD CONSTRAINT archives_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: backup_provider_settings backup_provider_settings_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.backup_provider_settings
    ADD CONSTRAINT backup_provider_settings_pkey PRIMARY KEY (id);


--
-- Name: backup_provider_settings backup_provider_settings_provider_type_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.backup_provider_settings
    ADD CONSTRAINT backup_provider_settings_provider_type_key UNIQUE (provider_type);


--
-- Name: booking_analytics booking_analytics_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.booking_analytics
    ADD CONSTRAINT booking_analytics_pkey PRIMARY KEY (id);


--
-- Name: camp_inventory_allocations camp_inventory_allocations_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_inventory_allocations
    ADD CONSTRAINT camp_inventory_allocations_pkey PRIMARY KEY (id);


--
-- Name: camp_registrations camp_registrations_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_registrations
    ADD CONSTRAINT camp_registrations_pkey PRIMARY KEY (id);


--
-- Name: camp_services camp_services_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_services
    ADD CONSTRAINT camp_services_pkey PRIMARY KEY (id);


--
-- Name: camp_staff camp_staff_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_staff
    ADD CONSTRAINT camp_staff_pkey PRIMARY KEY (id);


--
-- Name: camp_station_visits camp_station_visits_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_station_visits
    ADD CONSTRAINT camp_station_visits_pkey PRIMARY KEY (id);


--
-- Name: camp_stations camp_stations_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_stations
    ADD CONSTRAINT camp_stations_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: camps camps_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camps
    ADD CONSTRAINT camps_pkey PRIMARY KEY (id);


--
-- Name: claim_submissions claim_submissions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.claim_submissions
    ADD CONSTRAINT claim_submissions_pkey PRIMARY KEY (id);


--
-- Name: claims claims_claim_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.claims
    ADD CONSTRAINT claims_claim_number_key UNIQUE (claim_number);


--
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);


--
-- Name: clinic_appointment_settings clinic_appointment_settings_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.clinic_appointment_settings
    ADD CONSTRAINT clinic_appointment_settings_pkey PRIMARY KEY (id);


--
-- Name: clinic_info clinic_info_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.clinic_info
    ADD CONSTRAINT clinic_info_pkey PRIMARY KEY (id);


--
-- Name: clinic_working_hours clinic_working_hours_day_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.clinic_working_hours
    ADD CONSTRAINT clinic_working_hours_day_key UNIQUE (day);


--
-- Name: clinic_working_hours clinic_working_hours_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.clinic_working_hours
    ADD CONSTRAINT clinic_working_hours_pkey PRIMARY KEY (id);


--
-- Name: denials denials_denial_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.denials
    ADD CONSTRAINT denials_denial_number_key UNIQUE (denial_number);


--
-- Name: denials denials_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.denials
    ADD CONSTRAINT denials_pkey PRIMARY KEY (id);


--
-- Name: diagnoses diagnoses_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.diagnoses
    ADD CONSTRAINT diagnoses_pkey PRIMARY KEY (id);


--
-- Name: diagnosis diagnosis_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.diagnosis
    ADD CONSTRAINT diagnosis_pkey PRIMARY KEY (id);


--
-- Name: doctor_availability doctor_availability_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.doctor_availability
    ADD CONSTRAINT doctor_availability_pkey PRIMARY KEY (id);


--
-- Name: doctor_time_off doctor_time_off_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.doctor_time_off
    ADD CONSTRAINT doctor_time_off_pkey PRIMARY KEY (id);


--
-- Name: eligibility_checks eligibility_checks_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.eligibility_checks
    ADD CONSTRAINT eligibility_checks_pkey PRIMARY KEY (id);


--
-- Name: erx_message_queue erx_message_queue_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.erx_message_queue
    ADD CONSTRAINT erx_message_queue_pkey PRIMARY KEY (id);


--
-- Name: fhir_error_actions fhir_error_actions_error_code_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.fhir_error_actions
    ADD CONSTRAINT fhir_error_actions_error_code_key UNIQUE (error_code);


--
-- Name: fhir_error_actions fhir_error_actions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.fhir_error_actions
    ADD CONSTRAINT fhir_error_actions_pkey PRIMARY KEY (id);


--
-- Name: fhir_resources fhir_resources_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.fhir_resources
    ADD CONSTRAINT fhir_resources_pkey PRIMARY KEY (id);


--
-- Name: fhir_resources fhir_resources_resource_type_resource_id_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.fhir_resources
    ADD CONSTRAINT fhir_resources_resource_type_resource_id_key UNIQUE (resource_type, resource_id);


--
-- Name: fhir_tracking_events fhir_tracking_events_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.fhir_tracking_events
    ADD CONSTRAINT fhir_tracking_events_pkey PRIMARY KEY (id);


--
-- Name: fhir_tracking fhir_tracking_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.fhir_tracking
    ADD CONSTRAINT fhir_tracking_pkey PRIMARY KEY (id);


--
-- Name: fhir_tracking fhir_tracking_tracking_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.fhir_tracking
    ADD CONSTRAINT fhir_tracking_tracking_number_key UNIQUE (tracking_number);


--
-- Name: form_audit_logs form_audit_logs_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_audit_logs
    ADD CONSTRAINT form_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: form_categories form_categories_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_categories
    ADD CONSTRAINT form_categories_pkey PRIMARY KEY (id);


--
-- Name: form_categories form_categories_slug_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_categories
    ADD CONSTRAINT form_categories_slug_key UNIQUE (slug);


--
-- Name: form_signatures form_signatures_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_signatures
    ADD CONSTRAINT form_signatures_pkey PRIMARY KEY (id);


--
-- Name: form_submissions form_submissions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_submissions
    ADD CONSTRAINT form_submissions_pkey PRIMARY KEY (id);


--
-- Name: form_template_versions form_template_versions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_template_versions
    ADD CONSTRAINT form_template_versions_pkey PRIMARY KEY (id);


--
-- Name: form_templates form_templates_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_templates
    ADD CONSTRAINT form_templates_pkey PRIMARY KEY (id);


--
-- Name: form_templates form_templates_slug_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_templates
    ADD CONSTRAINT form_templates_slug_key UNIQUE (slug);


--
-- Name: healthcare_offerings healthcare_offerings_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.healthcare_offerings
    ADD CONSTRAINT healthcare_offerings_pkey PRIMARY KEY (id);


--
-- Name: insurance_payers insurance_payers_payer_id_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.insurance_payers
    ADD CONSTRAINT insurance_payers_payer_id_key UNIQUE (payer_id);


--
-- Name: insurance_payers insurance_payers_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.insurance_payers
    ADD CONSTRAINT insurance_payers_pkey PRIMARY KEY (id);


--
-- Name: intake_flow_templates intake_flow_templates_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.intake_flow_templates
    ADD CONSTRAINT intake_flow_templates_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_code_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_categories
    ADD CONSTRAINT inventory_categories_code_key UNIQUE (code);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_item_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_items
    ADD CONSTRAINT inventory_items_item_number_key UNIQUE (item_number);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_po_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: inventory_role_permissions inventory_role_permissions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_role_permissions
    ADD CONSTRAINT inventory_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: inventory_role_permissions inventory_role_permissions_role_name_resource_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_role_permissions
    ADD CONSTRAINT inventory_role_permissions_role_name_resource_key UNIQUE (role_name, resource);


--
-- Name: inventory_stock_movements inventory_stock_movements_movement_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_movement_number_key UNIQUE (movement_number);


--
-- Name: inventory_stock_movements inventory_stock_movements_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_suppliers inventory_suppliers_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_pkey PRIMARY KEY (id);


--
-- Name: inventory_suppliers inventory_suppliers_supplier_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_supplier_number_key UNIQUE (supplier_number);


--
-- Name: lab_orders lab_orders_order_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.lab_orders
    ADD CONSTRAINT lab_orders_order_number_key UNIQUE (order_number);


--
-- Name: lab_orders lab_orders_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.lab_orders
    ADD CONSTRAINT lab_orders_pkey PRIMARY KEY (id);


--
-- Name: laboratories laboratories_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.laboratories
    ADD CONSTRAINT laboratories_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: medical_records medical_records_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.medical_records
    ADD CONSTRAINT medical_records_pkey PRIMARY KEY (id);


--
-- Name: module_permissions module_permissions_module_role_name_resource_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.module_permissions
    ADD CONSTRAINT module_permissions_module_role_name_resource_key UNIQUE (module, role_name, resource);


--
-- Name: module_permissions module_permissions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.module_permissions
    ADD CONSTRAINT module_permissions_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_patient_id_channel_type_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.notification_preferences
    ADD CONSTRAINT notification_preferences_patient_id_channel_type_key UNIQUE (patient_id, channel_type);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offering_form_links offering_form_links_offering_id_form_template_id_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_form_links
    ADD CONSTRAINT offering_form_links_offering_id_form_template_id_key UNIQUE (offering_id, form_template_id);


--
-- Name: offering_form_links offering_form_links_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_form_links
    ADD CONSTRAINT offering_form_links_pkey PRIMARY KEY (id);


--
-- Name: offering_insurance_mappings offering_insurance_mappings_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_insurance_mappings
    ADD CONSTRAINT offering_insurance_mappings_pkey PRIMARY KEY (id);


--
-- Name: offering_packages offering_packages_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_packages
    ADD CONSTRAINT offering_packages_pkey PRIMARY KEY (id);


--
-- Name: offering_pricing offering_pricing_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_pricing
    ADD CONSTRAINT offering_pricing_pkey PRIMARY KEY (id);


--
-- Name: offering_promotions offering_promotions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_promotions
    ADD CONSTRAINT offering_promotions_pkey PRIMARY KEY (id);


--
-- Name: offering_promotions offering_promotions_promo_code_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_promotions
    ADD CONSTRAINT offering_promotions_promo_code_key UNIQUE (promo_code);


--
-- Name: offering_reviews offering_reviews_offering_id_patient_id_appointment_id_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_reviews
    ADD CONSTRAINT offering_reviews_offering_id_patient_id_appointment_id_key UNIQUE (offering_id, patient_id, appointment_id);


--
-- Name: offering_reviews offering_reviews_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_reviews
    ADD CONSTRAINT offering_reviews_pkey PRIMARY KEY (id);


--
-- Name: package_offerings package_offerings_package_id_offering_id_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.package_offerings
    ADD CONSTRAINT package_offerings_package_id_offering_id_key UNIQUE (package_id, offering_id);


--
-- Name: package_offerings package_offerings_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.package_offerings
    ADD CONSTRAINT package_offerings_pkey PRIMARY KEY (id);


--
-- Name: patient_allergies patient_allergies_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_allergies
    ADD CONSTRAINT patient_allergies_pkey PRIMARY KEY (id);


--
-- Name: patient_consent_forms patient_consent_forms_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_consent_forms
    ADD CONSTRAINT patient_consent_forms_pkey PRIMARY KEY (id);


--
-- Name: patient_intake_flows patient_intake_flows_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_intake_flows
    ADD CONSTRAINT patient_intake_flows_pkey PRIMARY KEY (id);


--
-- Name: patient_intake_forms patient_intake_forms_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_intake_forms
    ADD CONSTRAINT patient_intake_forms_pkey PRIMARY KEY (id);


--
-- Name: patient_offering_enrollments patient_offering_enrollments_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_pkey PRIMARY KEY (id);


--
-- Name: patient_pharmacies patient_pharmacies_patient_id_pharmacy_id_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_patient_id_pharmacy_id_key UNIQUE (patient_id, pharmacy_id);


--
-- Name: patient_pharmacies patient_pharmacies_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_pkey PRIMARY KEY (id);


--
-- Name: patient_portal_sessions patient_portal_sessions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_portal_sessions
    ADD CONSTRAINT patient_portal_sessions_pkey PRIMARY KEY (id);


--
-- Name: patient_portal_sessions patient_portal_sessions_session_token_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_portal_sessions
    ADD CONSTRAINT patient_portal_sessions_session_token_key UNIQUE (session_token);


--
-- Name: patients patients_email_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patients
    ADD CONSTRAINT patients_email_key UNIQUE (email);


--
-- Name: patients patients_mrn_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patients
    ADD CONSTRAINT patients_mrn_key UNIQUE (mrn);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payment_postings payment_postings_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.payment_postings
    ADD CONSTRAINT payment_postings_pkey PRIMARY KEY (id);


--
-- Name: payment_postings payment_postings_posting_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.payment_postings
    ADD CONSTRAINT payment_postings_posting_number_key UNIQUE (posting_number);


--
-- Name: payments payments_payment_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.payments
    ADD CONSTRAINT payments_payment_number_key UNIQUE (payment_number);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pharmacies pharmacies_ncpdp_id_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.pharmacies
    ADD CONSTRAINT pharmacies_ncpdp_id_key UNIQUE (ncpdp_id);


--
-- Name: pharmacies pharmacies_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.pharmacies
    ADD CONSTRAINT pharmacies_pkey PRIMARY KEY (id);


--
-- Name: portal_invites portal_invites_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.portal_invites
    ADD CONSTRAINT portal_invites_pkey PRIMARY KEY (id);


--
-- Name: portal_invites portal_invites_token_hash_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.portal_invites
    ADD CONSTRAINT portal_invites_token_hash_key UNIQUE (token_hash);


--
-- Name: preapprovals preapprovals_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.preapprovals
    ADD CONSTRAINT preapprovals_pkey PRIMARY KEY (id);


--
-- Name: preapprovals preapprovals_preapproval_number_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.preapprovals
    ADD CONSTRAINT preapprovals_preapproval_number_key UNIQUE (preapproval_number);


--
-- Name: prescription_history prescription_history_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.prescription_history
    ADD CONSTRAINT prescription_history_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: provider_booking_config provider_booking_config_booking_url_slug_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.provider_booking_config
    ADD CONSTRAINT provider_booking_config_booking_url_slug_key UNIQUE (booking_url_slug);


--
-- Name: provider_booking_config provider_booking_config_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.provider_booking_config
    ADD CONSTRAINT provider_booking_config_pkey PRIMARY KEY (id);


--
-- Name: provider_booking_config provider_booking_config_provider_id_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.provider_booking_config
    ADD CONSTRAINT provider_booking_config_provider_id_key UNIQUE (provider_id);


--
-- Name: recurring_appointments recurring_appointments_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.recurring_appointments
    ADD CONSTRAINT recurring_appointments_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- Name: sick_note_requests sick_note_requests_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.sick_note_requests
    ADD CONSTRAINT sick_note_requests_pkey PRIMARY KEY (id);


--
-- Name: sick_notes sick_notes_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.sick_notes
    ADD CONSTRAINT sick_notes_pkey PRIMARY KEY (id);


--
-- Name: sick_notes sick_notes_reference_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.sick_notes
    ADD CONSTRAINT sick_notes_reference_key UNIQUE (reference);


--
-- Name: staff_notification_preferences staff_notification_preferences_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.staff_notification_preferences
    ADD CONSTRAINT staff_notification_preferences_pkey PRIMARY KEY (user_id, event_key, channel);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: telehealth_provider_settings telehealth_provider_settings_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.telehealth_provider_settings
    ADD CONSTRAINT telehealth_provider_settings_pkey PRIMARY KEY (id);


--
-- Name: telehealth_provider_settings telehealth_provider_settings_provider_type_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.telehealth_provider_settings
    ADD CONSTRAINT telehealth_provider_settings_provider_type_key UNIQUE (provider_type);


--
-- Name: telehealth_sessions telehealth_sessions_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.telehealth_sessions
    ADD CONSTRAINT telehealth_sessions_pkey PRIMARY KEY (id);


--
-- Name: telehealth_sessions telehealth_sessions_room_id_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.telehealth_sessions
    ADD CONSTRAINT telehealth_sessions_room_id_key UNIQUE (room_id);


--
-- Name: camp_inventory_allocations uq_camp_alloc; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_inventory_allocations
    ADD CONSTRAINT uq_camp_alloc UNIQUE (camp_id, item_id);


--
-- Name: camp_registrations uq_camp_reg_token; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_registrations
    ADD CONSTRAINT uq_camp_reg_token UNIQUE (camp_id, token_no);


--
-- Name: camp_staff uq_camp_staff; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_staff
    ADD CONSTRAINT uq_camp_staff UNIQUE (camp_id, user_id);


--
-- Name: camp_station_visits uq_camp_visit; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_station_visits
    ADD CONSTRAINT uq_camp_visit UNIQUE (registration_id, station_id);


--
-- Name: vendor_integration_settings vendor_integration_settings_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.vendor_integration_settings
    ADD CONSTRAINT vendor_integration_settings_pkey PRIMARY KEY (id);


--
-- Name: vendor_integration_settings vendor_integration_settings_vendor_type_key; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.vendor_integration_settings
    ADD CONSTRAINT vendor_integration_settings_vendor_type_key UNIQUE (vendor_type);


--
-- Name: vendor_transaction_log vendor_transaction_log_pkey; Type: CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.vendor_transaction_log
    ADD CONSTRAINT vendor_transaction_log_pkey PRIMARY KEY (id);


--
-- Name: account_ar_aging_snapshots account_ar_aging_snapshots_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_ar_aging_snapshots
    ADD CONSTRAINT account_ar_aging_snapshots_pkey PRIMARY KEY (id);


--
-- Name: account_journal_entries account_journal_entries_entry_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_entries
    ADD CONSTRAINT account_journal_entries_entry_number_key UNIQUE (entry_number);


--
-- Name: account_journal_entries account_journal_entries_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_entries
    ADD CONSTRAINT account_journal_entries_pkey PRIMARY KEY (id);


--
-- Name: account_journal_lines account_journal_lines_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_lines
    ADD CONSTRAINT account_journal_lines_pkey PRIMARY KEY (id);


--
-- Name: account_payables account_payables_ap_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_payables
    ADD CONSTRAINT account_payables_ap_number_key UNIQUE (ap_number);


--
-- Name: account_payables account_payables_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_payables
    ADD CONSTRAINT account_payables_pkey PRIMARY KEY (id);


--
-- Name: account_receivables account_receivables_ar_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_receivables
    ADD CONSTRAINT account_receivables_ar_number_key UNIQUE (ar_number);


--
-- Name: account_receivables account_receivables_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_receivables
    ADD CONSTRAINT account_receivables_pkey PRIMARY KEY (id);


--
-- Name: account_reconciliation_items account_reconciliation_items_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_reconciliation_items
    ADD CONSTRAINT account_reconciliation_items_pkey PRIMARY KEY (id);


--
-- Name: account_reconciliations account_reconciliations_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_reconciliations
    ADD CONSTRAINT account_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: account_reconciliations account_reconciliations_reconciliation_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_reconciliations
    ADD CONSTRAINT account_reconciliations_reconciliation_number_key UNIQUE (reconciliation_number);


--
-- Name: account_role_permissions account_role_permissions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_role_permissions
    ADD CONSTRAINT account_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: account_role_permissions account_role_permissions_role_name_resource_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_role_permissions
    ADD CONSTRAINT account_role_permissions_role_name_resource_key UNIQUE (role_name, resource);


--
-- Name: account_statement_items account_statement_items_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_statement_items
    ADD CONSTRAINT account_statement_items_pkey PRIMARY KEY (id);


--
-- Name: account_statements account_statements_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_statements
    ADD CONSTRAINT account_statements_pkey PRIMARY KEY (id);


--
-- Name: account_statements account_statements_statement_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_statements
    ADD CONSTRAINT account_statements_statement_number_key UNIQUE (statement_number);


--
-- Name: accounts accounts_account_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.accounts
    ADD CONSTRAINT accounts_account_number_key UNIQUE (account_number);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: ai_feature_settings ai_feature_settings_key_uq; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.ai_feature_settings
    ADD CONSTRAINT ai_feature_settings_key_uq UNIQUE (feature_key);


--
-- Name: ai_feature_settings ai_feature_settings_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.ai_feature_settings
    ADD CONSTRAINT ai_feature_settings_pkey PRIMARY KEY (id);


--
-- Name: ai_phi_token_map ai_phi_token_map_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.ai_phi_token_map
    ADD CONSTRAINT ai_phi_token_map_pkey PRIMARY KEY (id);


--
-- Name: ai_phi_token_map ai_phi_token_map_uq; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.ai_phi_token_map
    ADD CONSTRAINT ai_phi_token_map_uq UNIQUE (request_id, token);


--
-- Name: ai_provider_credentials ai_provider_credentials_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.ai_provider_credentials
    ADD CONSTRAINT ai_provider_credentials_pkey PRIMARY KEY (id);


--
-- Name: ai_provider_credentials ai_provider_credentials_provider_uq; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.ai_provider_credentials
    ADD CONSTRAINT ai_provider_credentials_provider_uq UNIQUE (provider);


--
-- Name: ai_requests ai_requests_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.ai_requests
    ADD CONSTRAINT ai_requests_pkey PRIMARY KEY (id);


--
-- Name: ai_suggestions ai_suggestions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.ai_suggestions
    ADD CONSTRAINT ai_suggestions_pkey PRIMARY KEY (id);


--
-- Name: appointment_reminders appointment_reminders_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointment_reminders
    ADD CONSTRAINT appointment_reminders_pkey PRIMARY KEY (id);


--
-- Name: appointment_type_config appointment_type_config_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointment_type_config
    ADD CONSTRAINT appointment_type_config_pkey PRIMARY KEY (id);


--
-- Name: appointment_types appointment_types_name_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointment_types
    ADD CONSTRAINT appointment_types_name_key UNIQUE (name);


--
-- Name: appointment_types appointment_types_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointment_types
    ADD CONSTRAINT appointment_types_pkey PRIMARY KEY (id);


--
-- Name: appointment_waitlist appointment_waitlist_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: archive_rules archive_rules_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.archive_rules
    ADD CONSTRAINT archive_rules_pkey PRIMARY KEY (id);


--
-- Name: archive_rules archive_rules_rule_name_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.archive_rules
    ADD CONSTRAINT archive_rules_rule_name_key UNIQUE (rule_name);


--
-- Name: archives archives_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.archives
    ADD CONSTRAINT archives_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: backup_provider_settings backup_provider_settings_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.backup_provider_settings
    ADD CONSTRAINT backup_provider_settings_pkey PRIMARY KEY (id);


--
-- Name: backup_provider_settings backup_provider_settings_provider_type_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.backup_provider_settings
    ADD CONSTRAINT backup_provider_settings_provider_type_key UNIQUE (provider_type);


--
-- Name: booking_analytics booking_analytics_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.booking_analytics
    ADD CONSTRAINT booking_analytics_pkey PRIMARY KEY (id);


--
-- Name: camp_inventory_allocations camp_inventory_allocations_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_inventory_allocations
    ADD CONSTRAINT camp_inventory_allocations_pkey PRIMARY KEY (id);


--
-- Name: camp_registrations camp_registrations_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_registrations
    ADD CONSTRAINT camp_registrations_pkey PRIMARY KEY (id);


--
-- Name: camp_services camp_services_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_services
    ADD CONSTRAINT camp_services_pkey PRIMARY KEY (id);


--
-- Name: camp_staff camp_staff_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_staff
    ADD CONSTRAINT camp_staff_pkey PRIMARY KEY (id);


--
-- Name: camp_station_visits camp_station_visits_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_station_visits
    ADD CONSTRAINT camp_station_visits_pkey PRIMARY KEY (id);


--
-- Name: camp_stations camp_stations_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_stations
    ADD CONSTRAINT camp_stations_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: camps camps_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camps
    ADD CONSTRAINT camps_pkey PRIMARY KEY (id);


--
-- Name: claim_submissions claim_submissions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.claim_submissions
    ADD CONSTRAINT claim_submissions_pkey PRIMARY KEY (id);


--
-- Name: claims claims_claim_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.claims
    ADD CONSTRAINT claims_claim_number_key UNIQUE (claim_number);


--
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);


--
-- Name: clinic_appointment_settings clinic_appointment_settings_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.clinic_appointment_settings
    ADD CONSTRAINT clinic_appointment_settings_pkey PRIMARY KEY (id);


--
-- Name: clinic_info clinic_info_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.clinic_info
    ADD CONSTRAINT clinic_info_pkey PRIMARY KEY (id);


--
-- Name: clinic_working_hours clinic_working_hours_day_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.clinic_working_hours
    ADD CONSTRAINT clinic_working_hours_day_key UNIQUE (day);


--
-- Name: clinic_working_hours clinic_working_hours_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.clinic_working_hours
    ADD CONSTRAINT clinic_working_hours_pkey PRIMARY KEY (id);


--
-- Name: denials denials_denial_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.denials
    ADD CONSTRAINT denials_denial_number_key UNIQUE (denial_number);


--
-- Name: denials denials_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.denials
    ADD CONSTRAINT denials_pkey PRIMARY KEY (id);


--
-- Name: diagnoses diagnoses_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.diagnoses
    ADD CONSTRAINT diagnoses_pkey PRIMARY KEY (id);


--
-- Name: diagnosis diagnosis_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.diagnosis
    ADD CONSTRAINT diagnosis_pkey PRIMARY KEY (id);


--
-- Name: doctor_availability doctor_availability_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.doctor_availability
    ADD CONSTRAINT doctor_availability_pkey PRIMARY KEY (id);


--
-- Name: doctor_time_off doctor_time_off_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.doctor_time_off
    ADD CONSTRAINT doctor_time_off_pkey PRIMARY KEY (id);


--
-- Name: eligibility_checks eligibility_checks_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.eligibility_checks
    ADD CONSTRAINT eligibility_checks_pkey PRIMARY KEY (id);


--
-- Name: erx_message_queue erx_message_queue_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.erx_message_queue
    ADD CONSTRAINT erx_message_queue_pkey PRIMARY KEY (id);


--
-- Name: fhir_error_actions fhir_error_actions_error_code_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_error_actions
    ADD CONSTRAINT fhir_error_actions_error_code_key UNIQUE (error_code);


--
-- Name: fhir_error_actions fhir_error_actions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_error_actions
    ADD CONSTRAINT fhir_error_actions_pkey PRIMARY KEY (id);


--
-- Name: fhir_resources fhir_resources_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_resources
    ADD CONSTRAINT fhir_resources_pkey PRIMARY KEY (id);


--
-- Name: fhir_resources fhir_resources_resource_type_resource_id_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_resources
    ADD CONSTRAINT fhir_resources_resource_type_resource_id_key UNIQUE (resource_type, resource_id);


--
-- Name: fhir_tracking_events fhir_tracking_events_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_tracking_events
    ADD CONSTRAINT fhir_tracking_events_pkey PRIMARY KEY (id);


--
-- Name: fhir_tracking fhir_tracking_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_tracking
    ADD CONSTRAINT fhir_tracking_pkey PRIMARY KEY (id);


--
-- Name: fhir_tracking fhir_tracking_tracking_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_tracking
    ADD CONSTRAINT fhir_tracking_tracking_number_key UNIQUE (tracking_number);


--
-- Name: form_audit_logs form_audit_logs_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_audit_logs
    ADD CONSTRAINT form_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: form_categories form_categories_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_categories
    ADD CONSTRAINT form_categories_pkey PRIMARY KEY (id);


--
-- Name: form_categories form_categories_slug_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_categories
    ADD CONSTRAINT form_categories_slug_key UNIQUE (slug);


--
-- Name: form_signatures form_signatures_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_signatures
    ADD CONSTRAINT form_signatures_pkey PRIMARY KEY (id);


--
-- Name: form_submissions form_submissions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_submissions
    ADD CONSTRAINT form_submissions_pkey PRIMARY KEY (id);


--
-- Name: form_template_versions form_template_versions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_template_versions
    ADD CONSTRAINT form_template_versions_pkey PRIMARY KEY (id);


--
-- Name: form_templates form_templates_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_templates
    ADD CONSTRAINT form_templates_pkey PRIMARY KEY (id);


--
-- Name: form_templates form_templates_slug_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_templates
    ADD CONSTRAINT form_templates_slug_key UNIQUE (slug);


--
-- Name: healthcare_offerings healthcare_offerings_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.healthcare_offerings
    ADD CONSTRAINT healthcare_offerings_pkey PRIMARY KEY (id);


--
-- Name: insurance_payers insurance_payers_payer_id_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.insurance_payers
    ADD CONSTRAINT insurance_payers_payer_id_key UNIQUE (payer_id);


--
-- Name: insurance_payers insurance_payers_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.insurance_payers
    ADD CONSTRAINT insurance_payers_pkey PRIMARY KEY (id);


--
-- Name: intake_flow_templates intake_flow_templates_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.intake_flow_templates
    ADD CONSTRAINT intake_flow_templates_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_code_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_categories
    ADD CONSTRAINT inventory_categories_code_key UNIQUE (code);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_item_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_items
    ADD CONSTRAINT inventory_items_item_number_key UNIQUE (item_number);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_po_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: inventory_role_permissions inventory_role_permissions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_role_permissions
    ADD CONSTRAINT inventory_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: inventory_role_permissions inventory_role_permissions_role_name_resource_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_role_permissions
    ADD CONSTRAINT inventory_role_permissions_role_name_resource_key UNIQUE (role_name, resource);


--
-- Name: inventory_stock_movements inventory_stock_movements_movement_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_movement_number_key UNIQUE (movement_number);


--
-- Name: inventory_stock_movements inventory_stock_movements_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_suppliers inventory_suppliers_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_pkey PRIMARY KEY (id);


--
-- Name: inventory_suppliers inventory_suppliers_supplier_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_supplier_number_key UNIQUE (supplier_number);


--
-- Name: lab_orders lab_orders_order_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.lab_orders
    ADD CONSTRAINT lab_orders_order_number_key UNIQUE (order_number);


--
-- Name: lab_orders lab_orders_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.lab_orders
    ADD CONSTRAINT lab_orders_pkey PRIMARY KEY (id);


--
-- Name: laboratories laboratories_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.laboratories
    ADD CONSTRAINT laboratories_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: medical_records medical_records_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.medical_records
    ADD CONSTRAINT medical_records_pkey PRIMARY KEY (id);


--
-- Name: module_permissions module_permissions_module_role_name_resource_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.module_permissions
    ADD CONSTRAINT module_permissions_module_role_name_resource_key UNIQUE (module, role_name, resource);


--
-- Name: module_permissions module_permissions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.module_permissions
    ADD CONSTRAINT module_permissions_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_patient_channel_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.notification_preferences
    ADD CONSTRAINT notification_preferences_patient_channel_key UNIQUE (patient_id, channel_type);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offering_form_links offering_form_links_offering_id_form_template_id_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_form_links
    ADD CONSTRAINT offering_form_links_offering_id_form_template_id_key UNIQUE (offering_id, form_template_id);


--
-- Name: offering_form_links offering_form_links_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_form_links
    ADD CONSTRAINT offering_form_links_pkey PRIMARY KEY (id);


--
-- Name: offering_insurance_mappings offering_insurance_mappings_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_insurance_mappings
    ADD CONSTRAINT offering_insurance_mappings_pkey PRIMARY KEY (id);


--
-- Name: offering_packages offering_packages_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_packages
    ADD CONSTRAINT offering_packages_pkey PRIMARY KEY (id);


--
-- Name: offering_pricing offering_pricing_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_pricing
    ADD CONSTRAINT offering_pricing_pkey PRIMARY KEY (id);


--
-- Name: offering_promotions offering_promotions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_promotions
    ADD CONSTRAINT offering_promotions_pkey PRIMARY KEY (id);


--
-- Name: offering_promotions offering_promotions_promo_code_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_promotions
    ADD CONSTRAINT offering_promotions_promo_code_key UNIQUE (promo_code);


--
-- Name: offering_reviews offering_reviews_offering_id_patient_id_appointment_id_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_reviews
    ADD CONSTRAINT offering_reviews_offering_id_patient_id_appointment_id_key UNIQUE (offering_id, patient_id, appointment_id);


--
-- Name: offering_reviews offering_reviews_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_reviews
    ADD CONSTRAINT offering_reviews_pkey PRIMARY KEY (id);


--
-- Name: package_offerings package_offerings_package_id_offering_id_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.package_offerings
    ADD CONSTRAINT package_offerings_package_id_offering_id_key UNIQUE (package_id, offering_id);


--
-- Name: package_offerings package_offerings_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.package_offerings
    ADD CONSTRAINT package_offerings_pkey PRIMARY KEY (id);


--
-- Name: patient_allergies patient_allergies_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_allergies
    ADD CONSTRAINT patient_allergies_pkey PRIMARY KEY (id);


--
-- Name: patient_consent_forms patient_consent_forms_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_consent_forms
    ADD CONSTRAINT patient_consent_forms_pkey PRIMARY KEY (id);


--
-- Name: patient_intake_flows patient_intake_flows_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_intake_flows
    ADD CONSTRAINT patient_intake_flows_pkey PRIMARY KEY (id);


--
-- Name: patient_intake_forms patient_intake_forms_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_intake_forms
    ADD CONSTRAINT patient_intake_forms_pkey PRIMARY KEY (id);


--
-- Name: patient_offering_enrollments patient_offering_enrollments_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_pkey PRIMARY KEY (id);


--
-- Name: patient_pharmacies patient_pharmacies_patient_id_pharmacy_id_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_patient_id_pharmacy_id_key UNIQUE (patient_id, pharmacy_id);


--
-- Name: patient_pharmacies patient_pharmacies_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_pkey PRIMARY KEY (id);


--
-- Name: patient_portal_sessions patient_portal_sessions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_portal_sessions
    ADD CONSTRAINT patient_portal_sessions_pkey PRIMARY KEY (id);


--
-- Name: patient_portal_sessions patient_portal_sessions_session_token_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_portal_sessions
    ADD CONSTRAINT patient_portal_sessions_session_token_key UNIQUE (session_token);


--
-- Name: patients patients_email_unique; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patients
    ADD CONSTRAINT patients_email_unique UNIQUE (email);


--
-- Name: patients patients_mrn_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patients
    ADD CONSTRAINT patients_mrn_key UNIQUE (mrn);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payment_postings payment_postings_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.payment_postings
    ADD CONSTRAINT payment_postings_pkey PRIMARY KEY (id);


--
-- Name: payment_postings payment_postings_posting_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.payment_postings
    ADD CONSTRAINT payment_postings_posting_number_key UNIQUE (posting_number);


--
-- Name: payments payments_payment_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.payments
    ADD CONSTRAINT payments_payment_number_key UNIQUE (payment_number);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pharmacies pharmacies_ncpdp_id_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.pharmacies
    ADD CONSTRAINT pharmacies_ncpdp_id_key UNIQUE (ncpdp_id);


--
-- Name: pharmacies pharmacies_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.pharmacies
    ADD CONSTRAINT pharmacies_pkey PRIMARY KEY (id);


--
-- Name: portal_invites portal_invites_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.portal_invites
    ADD CONSTRAINT portal_invites_pkey PRIMARY KEY (id);


--
-- Name: portal_invites portal_invites_token_hash_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.portal_invites
    ADD CONSTRAINT portal_invites_token_hash_key UNIQUE (token_hash);


--
-- Name: preapprovals preapprovals_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.preapprovals
    ADD CONSTRAINT preapprovals_pkey PRIMARY KEY (id);


--
-- Name: preapprovals preapprovals_preapproval_number_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.preapprovals
    ADD CONSTRAINT preapprovals_preapproval_number_key UNIQUE (preapproval_number);


--
-- Name: prescription_history prescription_history_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.prescription_history
    ADD CONSTRAINT prescription_history_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: provider_booking_config provider_booking_config_booking_url_slug_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.provider_booking_config
    ADD CONSTRAINT provider_booking_config_booking_url_slug_key UNIQUE (booking_url_slug);


--
-- Name: provider_booking_config provider_booking_config_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.provider_booking_config
    ADD CONSTRAINT provider_booking_config_pkey PRIMARY KEY (id);


--
-- Name: provider_booking_config provider_booking_config_provider_id_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.provider_booking_config
    ADD CONSTRAINT provider_booking_config_provider_id_key UNIQUE (provider_id);


--
-- Name: recurring_appointments recurring_appointments_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.recurring_appointments
    ADD CONSTRAINT recurring_appointments_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- Name: sick_note_requests sick_note_requests_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.sick_note_requests
    ADD CONSTRAINT sick_note_requests_pkey PRIMARY KEY (id);


--
-- Name: sick_notes sick_notes_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.sick_notes
    ADD CONSTRAINT sick_notes_pkey PRIMARY KEY (id);


--
-- Name: sick_notes sick_notes_reference_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.sick_notes
    ADD CONSTRAINT sick_notes_reference_key UNIQUE (reference);


--
-- Name: staff_notification_preferences staff_notification_preferences_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.staff_notification_preferences
    ADD CONSTRAINT staff_notification_preferences_pkey PRIMARY KEY (user_id, event_key, channel);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: telehealth_provider_settings telehealth_provider_settings_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.telehealth_provider_settings
    ADD CONSTRAINT telehealth_provider_settings_pkey PRIMARY KEY (id);


--
-- Name: telehealth_provider_settings telehealth_provider_settings_provider_type_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.telehealth_provider_settings
    ADD CONSTRAINT telehealth_provider_settings_provider_type_key UNIQUE (provider_type);


--
-- Name: telehealth_sessions telehealth_sessions_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.telehealth_sessions
    ADD CONSTRAINT telehealth_sessions_pkey PRIMARY KEY (id);


--
-- Name: telehealth_sessions telehealth_sessions_room_id_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.telehealth_sessions
    ADD CONSTRAINT telehealth_sessions_room_id_key UNIQUE (room_id);


--
-- Name: camp_inventory_allocations uq_camp_alloc; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_inventory_allocations
    ADD CONSTRAINT uq_camp_alloc UNIQUE (camp_id, item_id);


--
-- Name: camp_registrations uq_camp_reg_token; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_registrations
    ADD CONSTRAINT uq_camp_reg_token UNIQUE (camp_id, token_no);


--
-- Name: camp_staff uq_camp_staff; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_staff
    ADD CONSTRAINT uq_camp_staff UNIQUE (camp_id, user_id);


--
-- Name: camp_station_visits uq_camp_visit; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_station_visits
    ADD CONSTRAINT uq_camp_visit UNIQUE (registration_id, station_id);


--
-- Name: vendor_integration_settings vendor_integration_settings_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.vendor_integration_settings
    ADD CONSTRAINT vendor_integration_settings_pkey PRIMARY KEY (id);


--
-- Name: vendor_integration_settings vendor_integration_settings_vendor_type_key; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.vendor_integration_settings
    ADD CONSTRAINT vendor_integration_settings_vendor_type_key UNIQUE (vendor_type);


--
-- Name: vendor_transaction_log vendor_transaction_log_pkey; Type: CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.vendor_transaction_log
    ADD CONSTRAINT vendor_transaction_log_pkey PRIMARY KEY (id);


--
-- Name: idx_billing_events_customer; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_billing_events_customer ON control.billing_events USING btree (stripe_customer_id);


--
-- Name: idx_billing_events_kind; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_billing_events_kind ON control.billing_events USING btree (entry_kind, occurred_at DESC);


--
-- Name: idx_billing_events_occurred; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_billing_events_occurred ON control.billing_events USING btree (occurred_at DESC);


--
-- Name: idx_billing_events_operator; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_billing_events_operator ON control.billing_events USING btree (operator_id) WHERE (operator_id IS NOT NULL);


--
-- Name: idx_billing_events_tenant; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_billing_events_tenant ON control.billing_events USING btree (tenant_id);


--
-- Name: idx_billing_events_type; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_billing_events_type ON control.billing_events USING btree (event_type);


--
-- Name: idx_booking_slug_route_tenant; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_booking_slug_route_tenant ON control.booking_slug_route USING btree (tenant_id);


--
-- Name: idx_break_glass_active; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_break_glass_active ON control.break_glass_sessions USING btree (operator_id, tenant_id, expires_at);


--
-- Name: idx_control_audit_created; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_control_audit_created ON control.audit_log USING btree (created_at);


--
-- Name: idx_control_audit_tenant; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_control_audit_tenant ON control.audit_log USING btree (tenant_id);


--
-- Name: idx_control_subs_practice; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_control_subs_practice ON control.subscriptions USING btree (practice_id);


--
-- Name: idx_control_subs_stripe_cust; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_control_subs_stripe_cust ON control.subscriptions USING btree (stripe_customer_id);


--
-- Name: idx_control_subs_stripe_cust_unique; Type: INDEX; Schema: control; Owner: -
--

CREATE UNIQUE INDEX idx_control_subs_stripe_cust_unique ON control.subscriptions USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);


--
-- Name: idx_control_tenants_status; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_control_tenants_status ON control.tenants USING btree (status);


--
-- Name: idx_operators_role; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_operators_role ON control.operators USING btree (role);


--
-- Name: idx_platform_notifications_action; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_platform_notifications_action ON control.platform_notifications USING btree (action);


--
-- Name: idx_platform_notifications_sent; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_platform_notifications_sent ON control.platform_notifications USING btree (sent_at DESC);


--
-- Name: idx_portal_invite_route_expiry; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_portal_invite_route_expiry ON control.portal_invite_route USING btree (expires_at);


--
-- Name: idx_portal_session_route_expiry; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_portal_session_route_expiry ON control.portal_session_route USING btree (expires_at);


--
-- Name: idx_signup_intents_pending_email; Type: INDEX; Schema: control; Owner: -
--

CREATE UNIQUE INDEX idx_signup_intents_pending_email ON control.signup_intents USING btree (lower((email)::text)) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_signup_intents_status; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_signup_intents_status ON control.signup_intents USING btree (status);


--
-- Name: idx_subscription_grants_tenant; Type: INDEX; Schema: control; Owner: -
--

CREATE INDEX idx_subscription_grants_tenant ON control.subscription_grants USING btree (tenant_id, created_at DESC);


--
-- Name: idx_archive_metadata_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_metadata_date ON public.archive_metadata USING btree (archive_date);


--
-- Name: idx_archive_metadata_modules; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_metadata_modules ON public.archive_metadata USING gin (archived_modules);


--
-- Name: idx_archive_metadata_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_metadata_status ON public.archive_metadata USING btree (status);


--
-- Name: idx_backup_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_date ON public.account_backups USING btree (created_at);


--
-- Name: idx_backup_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_status ON public.account_backups USING btree (status);


--
-- Name: idx_backup_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_type ON public.account_backups USING btree (backup_type);


--
-- Name: idx_billing_coupons_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_coupons_active ON public.billing_coupons USING btree (is_active);


--
-- Name: idx_billing_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_coupons_code ON public.billing_coupons USING btree (code);


--
-- Name: idx_billing_invoice_items_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_invoice_items_invoice ON public.billing_invoice_items USING btree (invoice_id);


--
-- Name: idx_billing_invoices_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_invoices_due_date ON public.billing_invoices USING btree (due_date);


--
-- Name: idx_billing_invoices_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_invoices_patient ON public.billing_invoices USING btree (patient_id);


--
-- Name: idx_billing_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_invoices_status ON public.billing_invoices USING btree (status);


--
-- Name: idx_billing_payments_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_payments_invoice ON public.billing_payments USING btree (invoice_id);


--
-- Name: idx_billing_payments_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_payments_patient ON public.billing_payments USING btree (patient_id);


--
-- Name: idx_billing_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_payments_status ON public.billing_payments USING btree (status);


--
-- Name: idx_billing_quote_items_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_quote_items_quote ON public.billing_quote_items USING btree (quote_id);


--
-- Name: idx_billing_quotes_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_quotes_patient ON public.billing_quotes USING btree (patient_id);


--
-- Name: idx_billing_quotes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_quotes_status ON public.billing_quotes USING btree (status);


--
-- Name: idx_directory_events_practice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_directory_events_practice ON public.directory_events USING btree (practice_id, created_at DESC);


--
-- Name: idx_drug_interactions_drug1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drug_interactions_drug1 ON public.drug_interactions USING btree (drug1_ndc);


--
-- Name: idx_drug_interactions_drug2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drug_interactions_drug2 ON public.drug_interactions USING btree (drug2_ndc);


--
-- Name: idx_inv_pol_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_pol_item ON public.inventory_purchase_order_lines USING btree (item_id);


--
-- Name: idx_inv_pol_po_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_pol_po_id ON public.inventory_purchase_order_lines USING btree (po_id);


--
-- Name: idx_join_requests_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_join_requests_email ON public.join_requests USING btree (practice_id, lower(email), status);


--
-- Name: idx_join_requests_pending_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_join_requests_pending_user ON public.join_requests USING btree (user_id) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_join_requests_practice_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_join_requests_practice_status ON public.join_requests USING btree (practice_id, status, created_at DESC);


--
-- Name: idx_join_requests_verify; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_join_requests_verify ON public.join_requests USING btree (verify_token_hash) WHERE (verify_token_hash IS NOT NULL);


--
-- Name: idx_license_keys_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_keys_key ON public.license_keys USING btree (key);


--
-- Name: idx_license_keys_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_keys_status ON public.license_keys USING btree (status);


--
-- Name: idx_login_lockouts_locked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_lockouts_locked ON public.login_lockouts USING btree (locked_until) WHERE (locked_until IS NOT NULL);


--
-- Name: idx_medical_codes_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_codes_category ON public.medical_codes USING btree (category);


--
-- Name: idx_medical_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_codes_code ON public.medical_codes USING btree (code);


--
-- Name: idx_medical_codes_code_prefix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_codes_code_prefix ON public.medical_codes USING btree (code text_pattern_ops);


--
-- Name: idx_medical_codes_description; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_codes_description ON public.medical_codes USING gin (to_tsvector('english'::regconfig, description));


--
-- Name: idx_medical_codes_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_codes_type ON public.medical_codes USING btree (code_type);


--
-- Name: idx_medications_drug_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medications_drug_class ON public.medications USING btree (drug_class);


--
-- Name: idx_medications_drug_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medications_drug_name ON public.medications USING btree (drug_name);


--
-- Name: idx_medications_generic_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medications_generic_name ON public.medications USING btree (generic_name);


--
-- Name: idx_medications_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medications_id ON public.medications USING btree (id);


--
-- Name: idx_medications_ndc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medications_ndc ON public.medications USING btree (ndc_code);


--
-- Name: idx_memberships_practice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_practice ON public.memberships USING btree (practice_id, status);


--
-- Name: idx_message_attachments_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_attachments_message ON public.message_attachments USING btree (message_id);


--
-- Name: idx_message_read_receipts_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_read_receipts_message ON public.message_read_receipts USING btree (message_id);


--
-- Name: idx_message_threads_last_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_threads_last_message ON public.message_threads USING btree (last_message_at DESC);


--
-- Name: idx_message_threads_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_threads_patient ON public.message_threads USING btree (patient_id);


--
-- Name: idx_message_threads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_threads_status ON public.message_threads USING btree (status);


--
-- Name: idx_message_threads_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_threads_type ON public.message_threads USING btree (thread_type);


--
-- Name: idx_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_kind, sender_id);


--
-- Name: idx_messages_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_thread ON public.messages USING btree (thread_id, sent_at DESC);


--
-- Name: idx_mobile_oauth_flows_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_oauth_flows_expiry ON public.mobile_oauth_flows USING btree (expires_at);


--
-- Name: idx_practice_domains_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_practice_domains_domain ON public.practice_domains USING btree (lower(domain));


--
-- Name: idx_practice_domains_practice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_practice_domains_practice ON public.practice_domains USING btree (practice_id);


--
-- Name: idx_practices_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_practices_country ON public.practices USING btree (country);


--
-- Name: idx_practices_timezone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_practices_timezone ON public.practices USING btree (timezone);


--
-- Name: idx_profile_photos_practice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_photos_practice ON public.practice_profile_photos USING btree (practice_id, kind, sort_order);


--
-- Name: idx_providers_specialty_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_providers_specialty_code ON public.providers USING btree (specialty_code);


--
-- Name: idx_role_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);


--
-- Name: idx_short_links_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_short_links_expiry ON public.short_links USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_specialties_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specialties_parent ON public.specialties USING btree (parent_code);


--
-- Name: idx_specialty_packs_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specialty_packs_code ON public.specialty_packs USING btree (code, version DESC);


--
-- Name: idx_staff_invites_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_invites_email ON public.staff_invites USING btree (lower((email)::text));


--
-- Name: idx_staff_invites_practice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_invites_practice ON public.staff_invites USING btree (practice_id);


--
-- Name: idx_stripe_integration_singleton; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_stripe_integration_singleton ON public.stripe_integration_settings USING btree ((true));


--
-- Name: idx_subscription_plans_stripe_price; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_subscription_plans_stripe_price ON public.subscription_plans USING btree (stripe_price_id) WHERE (stripe_price_id IS NOT NULL);


--
-- Name: idx_subscription_plans_stripe_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_plans_stripe_product ON public.subscription_plans USING btree (stripe_product_id) WHERE (stripe_product_id IS NOT NULL);


--
-- Name: idx_thread_participants_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_participants_lookup ON public.message_thread_participants USING btree (participant_kind, participant_id, is_active);


--
-- Name: idx_thread_participants_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_participants_thread ON public.message_thread_participants USING btree (thread_id);


--
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role_id ON public.user_roles USING btree (role_id);


--
-- Name: idx_users_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_country ON public.users USING btree (country);


--
-- Name: idx_users_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_last_activity ON public.users USING btree (last_activity_at);


--
-- Name: idx_users_practice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_practice_id ON public.users USING btree (practice_id);


--
-- Name: idx_users_timezone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_timezone ON public.users USING btree (timezone);


--
-- Name: account_ar_aging_snapshots_snapshot_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_ar_aging_snapshots_snapshot_date_idx ON template.account_ar_aging_snapshots USING btree (snapshot_date);


--
-- Name: account_ar_aging_snapshots_snapshot_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_ar_aging_snapshots_snapshot_type_idx ON template.account_ar_aging_snapshots USING btree (snapshot_type);


--
-- Name: account_journal_entries_entry_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_journal_entries_entry_date_idx ON template.account_journal_entries USING btree (entry_date);


--
-- Name: account_journal_entries_entry_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_journal_entries_entry_type_idx ON template.account_journal_entries USING btree (entry_type);


--
-- Name: account_journal_entries_reference_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_journal_entries_reference_id_idx ON template.account_journal_entries USING btree (reference_id);


--
-- Name: account_journal_entries_reference_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_journal_entries_reference_type_idx ON template.account_journal_entries USING btree (reference_type);


--
-- Name: account_journal_entries_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_journal_entries_status_idx ON template.account_journal_entries USING btree (status);


--
-- Name: account_journal_lines_account_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_journal_lines_account_id_idx ON template.account_journal_lines USING btree (account_id);


--
-- Name: account_journal_lines_journal_entry_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_journal_lines_journal_entry_id_idx ON template.account_journal_lines USING btree (journal_entry_id);


--
-- Name: account_journal_lines_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_journal_lines_patient_id_idx ON template.account_journal_lines USING btree (patient_id);


--
-- Name: account_payables_due_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_payables_due_date_idx ON template.account_payables USING btree (due_date);


--
-- Name: account_payables_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_payables_status_idx ON template.account_payables USING btree (status);


--
-- Name: account_payables_vendor_name_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_payables_vendor_name_idx ON template.account_payables USING btree (vendor_name);


--
-- Name: account_receivables_aging_bucket_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_receivables_aging_bucket_idx ON template.account_receivables USING btree (aging_bucket);


--
-- Name: account_receivables_due_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_receivables_due_date_idx ON template.account_receivables USING btree (due_date);


--
-- Name: account_receivables_invoice_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_receivables_invoice_id_idx ON template.account_receivables USING btree (invoice_id);


--
-- Name: account_receivables_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_receivables_patient_id_idx ON template.account_receivables USING btree (patient_id);


--
-- Name: account_receivables_payer_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_receivables_payer_id_idx ON template.account_receivables USING btree (payer_id);


--
-- Name: account_receivables_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_receivables_status_idx ON template.account_receivables USING btree (status);


--
-- Name: account_reconciliation_items_is_cleared_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_reconciliation_items_is_cleared_idx ON template.account_reconciliation_items USING btree (is_cleared);


--
-- Name: account_reconciliation_items_reconciliation_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_reconciliation_items_reconciliation_id_idx ON template.account_reconciliation_items USING btree (reconciliation_id);


--
-- Name: account_reconciliations_account_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_reconciliations_account_id_idx ON template.account_reconciliations USING btree (account_id);


--
-- Name: account_reconciliations_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_reconciliations_status_idx ON template.account_reconciliations USING btree (status);


--
-- Name: account_role_permissions_resource_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_role_permissions_resource_idx ON template.account_role_permissions USING btree (resource);


--
-- Name: account_role_permissions_role_name_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_role_permissions_role_name_idx ON template.account_role_permissions USING btree (role_name);


--
-- Name: account_statement_items_statement_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_statement_items_statement_id_idx ON template.account_statement_items USING btree (statement_id);


--
-- Name: account_statements_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_statements_patient_id_idx ON template.account_statements USING btree (patient_id);


--
-- Name: account_statements_payer_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_statements_payer_id_idx ON template.account_statements USING btree (payer_id);


--
-- Name: account_statements_statement_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_statements_statement_date_idx ON template.account_statements USING btree (statement_date);


--
-- Name: account_statements_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX account_statements_status_idx ON template.account_statements USING btree (status);


--
-- Name: accounts_account_number_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX accounts_account_number_idx ON template.accounts USING btree (account_number);


--
-- Name: accounts_account_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX accounts_account_type_idx ON template.accounts USING btree (account_type);


--
-- Name: accounts_is_active_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX accounts_is_active_idx ON template.accounts USING btree (is_active);


--
-- Name: accounts_parent_account_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX accounts_parent_account_id_idx ON template.accounts USING btree (parent_account_id);


--
-- Name: appointment_reminders_appointment_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_reminders_appointment_id_idx ON template.appointment_reminders USING btree (appointment_id);


--
-- Name: appointment_reminders_delivery_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_reminders_delivery_status_idx ON template.appointment_reminders USING btree (delivery_status);


--
-- Name: appointment_reminders_scheduled_for_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_reminders_scheduled_for_idx ON template.appointment_reminders USING btree (scheduled_for);


--
-- Name: appointment_type_config_is_active_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_type_config_is_active_idx ON template.appointment_type_config USING btree (is_active);


--
-- Name: appointment_type_config_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_type_config_provider_id_idx ON template.appointment_type_config USING btree (provider_id);


--
-- Name: appointment_types_display_order_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_types_display_order_idx ON template.appointment_types USING btree (display_order);


--
-- Name: appointment_types_is_active_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_types_is_active_idx ON template.appointment_types USING btree (is_active);


--
-- Name: appointment_waitlist_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_waitlist_patient_id_idx ON template.appointment_waitlist USING btree (patient_id);


--
-- Name: appointment_waitlist_preferred_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_waitlist_preferred_date_idx ON template.appointment_waitlist USING btree (preferred_date);


--
-- Name: appointment_waitlist_priority_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_waitlist_priority_idx ON template.appointment_waitlist USING btree (priority DESC);


--
-- Name: appointment_waitlist_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_waitlist_provider_id_idx ON template.appointment_waitlist USING btree (provider_id);


--
-- Name: appointment_waitlist_provider_id_preferred_date_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_waitlist_provider_id_preferred_date_status_idx ON template.appointment_waitlist USING btree (provider_id, preferred_date, status) WHERE ((status)::text = 'active'::text);


--
-- Name: appointment_waitlist_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointment_waitlist_status_idx ON template.appointment_waitlist USING btree (status);


--
-- Name: appointments_appointment_type_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointments_appointment_type_id_idx ON template.appointments USING btree (appointment_type_id);


--
-- Name: appointments_booking_source_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointments_booking_source_idx ON template.appointments USING btree (booking_source);


--
-- Name: appointments_cancelled_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointments_cancelled_at_idx ON template.appointments USING btree (cancelled_at);


--
-- Name: appointments_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointments_patient_id_idx ON template.appointments USING btree (patient_id);


--
-- Name: appointments_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointments_provider_id_idx ON template.appointments USING btree (provider_id);


--
-- Name: appointments_recurring_appointment_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointments_recurring_appointment_id_idx ON template.appointments USING btree (recurring_appointment_id);


--
-- Name: appointments_start_time_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointments_start_time_idx ON template.appointments USING btree (start_time);


--
-- Name: appointments_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX appointments_status_idx ON template.appointments USING btree (status);


--
-- Name: archive_rules_enabled_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX archive_rules_enabled_idx ON template.archive_rules USING btree (enabled);


--
-- Name: archive_rules_next_run_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX archive_rules_next_run_at_idx ON template.archive_rules USING btree (next_run_at) WHERE (enabled = true);


--
-- Name: archive_rules_schedule_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX archive_rules_schedule_type_idx ON template.archive_rules USING btree (schedule_type);


--
-- Name: archives_created_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX archives_created_at_idx ON template.archives USING btree (created_at);


--
-- Name: archives_created_by_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX archives_created_by_idx ON template.archives USING btree (created_by);


--
-- Name: archives_modules_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX archives_modules_idx ON template.archives USING gin (modules);


--
-- Name: archives_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX archives_status_idx ON template.archives USING btree (status);


--
-- Name: audit_logs_action_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_action_type_idx ON template.audit_logs USING btree (action_type);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_created_at_idx ON template.audit_logs USING btree (created_at DESC);


--
-- Name: audit_logs_module_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_module_idx ON template.audit_logs USING btree (module);


--
-- Name: audit_logs_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_patient_id_idx ON template.audit_logs USING btree (patient_id);


--
-- Name: audit_logs_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_provider_id_idx ON template.audit_logs USING btree (provider_id);


--
-- Name: audit_logs_resource_name_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_resource_name_idx ON template.audit_logs USING btree (resource_name);


--
-- Name: audit_logs_resource_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_resource_type_idx ON template.audit_logs USING btree (resource_type);


--
-- Name: audit_logs_resource_type_resource_name_created_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_resource_type_resource_name_created_at_idx ON template.audit_logs USING btree (resource_type, resource_name, created_at DESC);


--
-- Name: audit_logs_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_status_idx ON template.audit_logs USING btree (status);


--
-- Name: audit_logs_user_email_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_user_email_idx ON template.audit_logs USING btree (user_email);


--
-- Name: audit_logs_user_id_created_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_user_id_created_at_idx ON template.audit_logs USING btree (user_id, created_at DESC);


--
-- Name: audit_logs_user_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX audit_logs_user_id_idx ON template.audit_logs USING btree (user_id);


--
-- Name: booking_analytics_created_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX booking_analytics_created_at_idx ON template.booking_analytics USING btree (created_at);


--
-- Name: booking_analytics_event_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX booking_analytics_event_type_idx ON template.booking_analytics USING btree (event_type);


--
-- Name: booking_analytics_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX booking_analytics_provider_id_idx ON template.booking_analytics USING btree (provider_id);


--
-- Name: claim_submissions_claim_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX claim_submissions_claim_id_idx ON template.claim_submissions USING btree (claim_id);


--
-- Name: claim_submissions_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX claim_submissions_status_idx ON template.claim_submissions USING btree (status);


--
-- Name: claim_submissions_submission_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX claim_submissions_submission_date_idx ON template.claim_submissions USING btree (submission_date);


--
-- Name: claim_submissions_submission_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX claim_submissions_submission_id_idx ON template.claim_submissions USING btree (submission_id);


--
-- Name: claims_preapproval_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX claims_preapproval_id_idx ON template.claims USING btree (preapproval_id);


--
-- Name: denials_appeal_deadline_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX denials_appeal_deadline_idx ON template.denials USING btree (appeal_deadline);


--
-- Name: denials_appeal_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX denials_appeal_status_idx ON template.denials USING btree (appeal_status);


--
-- Name: denials_assigned_to_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX denials_assigned_to_idx ON template.denials USING btree (assigned_to);


--
-- Name: denials_claim_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX denials_claim_id_idx ON template.denials USING btree (claim_id);


--
-- Name: denials_denial_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX denials_denial_date_idx ON template.denials USING btree (denial_date);


--
-- Name: denials_insurance_payer_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX denials_insurance_payer_id_idx ON template.denials USING btree (insurance_payer_id);


--
-- Name: denials_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX denials_patient_id_idx ON template.denials USING btree (patient_id);


--
-- Name: denials_priority_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX denials_priority_idx ON template.denials USING btree (priority);


--
-- Name: denials_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX denials_status_idx ON template.denials USING btree (status);


--
-- Name: diagnosis_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX diagnosis_patient_id_idx ON template.diagnosis USING btree (patient_id);


--
-- Name: diagnosis_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX diagnosis_provider_id_idx ON template.diagnosis USING btree (provider_id);


--
-- Name: diagnosis_to_tsvector_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX diagnosis_to_tsvector_idx ON template.diagnosis USING gin (to_tsvector('english'::regconfig, COALESCE(soap_notes, ''::text)));


--
-- Name: doctor_availability_day_of_week_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX doctor_availability_day_of_week_idx ON template.doctor_availability USING btree (day_of_week);


--
-- Name: doctor_availability_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX doctor_availability_provider_id_idx ON template.doctor_availability USING btree (provider_id);


--
-- Name: doctor_time_off_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX doctor_time_off_provider_id_idx ON template.doctor_time_off USING btree (provider_id);


--
-- Name: doctor_time_off_start_date_end_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX doctor_time_off_start_date_end_date_idx ON template.doctor_time_off USING btree (start_date, end_date);


--
-- Name: erx_message_queue_message_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX erx_message_queue_message_status_idx ON template.erx_message_queue USING btree (message_status);


--
-- Name: erx_message_queue_pharmacy_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX erx_message_queue_pharmacy_id_idx ON template.erx_message_queue USING btree (pharmacy_id);


--
-- Name: fhir_error_actions_error_code_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_error_actions_error_code_idx ON template.fhir_error_actions USING btree (error_code);


--
-- Name: fhir_error_actions_resource_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_error_actions_resource_type_idx ON template.fhir_error_actions USING btree (resource_type);


--
-- Name: fhir_error_actions_vendor_name_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_error_actions_vendor_name_idx ON template.fhir_error_actions USING btree (vendor_name);


--
-- Name: fhir_resources_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_resources_patient_id_idx ON template.fhir_resources USING btree (patient_id);


--
-- Name: fhir_tracking_created_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_tracking_created_at_idx ON template.fhir_tracking USING btree (created_at);


--
-- Name: fhir_tracking_current_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_tracking_current_status_idx ON template.fhir_tracking USING btree (current_status);


--
-- Name: fhir_tracking_events_created_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_tracking_events_created_at_idx ON template.fhir_tracking_events USING btree (created_at);


--
-- Name: fhir_tracking_events_event_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_tracking_events_event_type_idx ON template.fhir_tracking_events USING btree (event_type);


--
-- Name: fhir_tracking_events_fhir_tracking_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_tracking_events_fhir_tracking_id_idx ON template.fhir_tracking_events USING btree (fhir_tracking_id);


--
-- Name: fhir_tracking_events_is_error_error_severity_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_tracking_events_is_error_error_severity_idx ON template.fhir_tracking_events USING btree (is_error, error_severity);


--
-- Name: fhir_tracking_fhir_resource_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_tracking_fhir_resource_id_idx ON template.fhir_tracking USING btree (fhir_resource_id);


--
-- Name: fhir_tracking_has_errors_action_required_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_tracking_has_errors_action_required_idx ON template.fhir_tracking USING btree (has_errors, action_required);


--
-- Name: fhir_tracking_resource_type_resource_reference_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_tracking_resource_type_resource_reference_idx ON template.fhir_tracking USING btree (resource_type, resource_reference);


--
-- Name: fhir_tracking_tracking_number_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_tracking_tracking_number_idx ON template.fhir_tracking USING btree (tracking_number);


--
-- Name: fhir_tracking_vendor_name_vendor_tracking_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX fhir_tracking_vendor_name_vendor_tracking_id_idx ON template.fhir_tracking USING btree (vendor_name, vendor_tracking_id);


--
-- Name: form_audit_logs_actor_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_audit_logs_actor_id_idx ON template.form_audit_logs USING btree (actor_id);


--
-- Name: form_audit_logs_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_audit_logs_patient_id_idx ON template.form_audit_logs USING btree (patient_id);


--
-- Name: form_audit_logs_resource_type_resource_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_audit_logs_resource_type_resource_id_idx ON template.form_audit_logs USING btree (resource_type, resource_id);


--
-- Name: form_signatures_submission_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_signatures_submission_id_idx ON template.form_signatures USING btree (submission_id);


--
-- Name: form_submissions_appointment_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_submissions_appointment_id_idx ON template.form_submissions USING btree (appointment_id);


--
-- Name: form_submissions_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_submissions_patient_id_idx ON template.form_submissions USING btree (patient_id);


--
-- Name: form_submissions_source_message_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_submissions_source_message_id_idx ON template.form_submissions USING btree (source_message_id);


--
-- Name: form_submissions_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_submissions_status_idx ON template.form_submissions USING btree (status);


--
-- Name: form_submissions_template_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_submissions_template_id_idx ON template.form_submissions USING btree (template_id);


--
-- Name: form_template_versions_template_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_template_versions_template_id_idx ON template.form_template_versions USING btree (template_id);


--
-- Name: form_templates_category_slug_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_templates_category_slug_idx ON template.form_templates USING btree (category_slug);


--
-- Name: form_templates_is_active_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_templates_is_active_idx ON template.form_templates USING btree (is_active);


--
-- Name: form_templates_specialty_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_templates_specialty_idx ON template.form_templates USING btree (specialty);


--
-- Name: form_templates_template_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX form_templates_template_type_idx ON template.form_templates USING btree (template_type);


--
-- Name: healthcare_offerings_category_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX healthcare_offerings_category_id_idx ON template.healthcare_offerings USING btree (category_id);


--
-- Name: healthcare_offerings_consent_form_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX healthcare_offerings_consent_form_id_idx ON template.healthcare_offerings USING btree (consent_form_id);


--
-- Name: idx_ai_phi_token_map_request; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_ai_phi_token_map_request ON template.ai_phi_token_map USING btree (request_id);


--
-- Name: idx_ai_requests_feature_month; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_ai_requests_feature_month ON template.ai_requests USING btree (feature_key, created_at);


--
-- Name: idx_ai_requests_patient; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_ai_requests_patient ON template.ai_requests USING btree (patient_id);


--
-- Name: idx_ai_suggestions_entity; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_ai_suggestions_entity ON template.ai_suggestions USING btree (entity_type, entity_id);


--
-- Name: idx_ai_suggestions_patient; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_ai_suggestions_patient ON template.ai_suggestions USING btree (patient_id);


--
-- Name: idx_ai_suggestions_status; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_ai_suggestions_status ON template.ai_suggestions USING btree (status, feature_key);


--
-- Name: idx_appointment_types_pack; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_appointment_types_pack ON template.appointment_types USING btree (source_pack) WHERE (source_pack IS NOT NULL);


--
-- Name: idx_appointments_camp; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_appointments_camp ON template.appointments USING btree (camp_id);


--
-- Name: idx_appointments_location; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_appointments_location ON template.appointments USING btree (location_id);


--
-- Name: idx_audit_logs_patient_id; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_audit_logs_patient_id ON template.audit_logs USING btree (patient_id);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON template.audit_logs USING btree (user_id);


--
-- Name: idx_camp_alloc_camp; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camp_alloc_camp ON template.camp_inventory_allocations USING btree (camp_id);


--
-- Name: idx_camp_reg_camp; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camp_reg_camp ON template.camp_registrations USING btree (camp_id, token_no);


--
-- Name: idx_camp_reg_patient; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camp_reg_patient ON template.camp_registrations USING btree (patient_id);


--
-- Name: idx_camp_reg_phone; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camp_reg_phone ON template.camp_registrations USING btree (phone);


--
-- Name: idx_camp_reg_status; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camp_reg_status ON template.camp_registrations USING btree (camp_id, status);


--
-- Name: idx_camp_services_camp; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camp_services_camp ON template.camp_services USING btree (camp_id);


--
-- Name: idx_camp_staff_camp; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camp_staff_camp ON template.camp_staff USING btree (camp_id);


--
-- Name: idx_camp_staff_user; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camp_staff_user ON template.camp_staff USING btree (user_id);


--
-- Name: idx_camp_stations_camp; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camp_stations_camp ON template.camp_stations USING btree (camp_id, step_order);


--
-- Name: idx_camp_visit_reg; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camp_visit_reg ON template.camp_station_visits USING btree (registration_id);


--
-- Name: idx_camp_visit_station; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camp_visit_station ON template.camp_station_visits USING btree (station_id, status);


--
-- Name: idx_campaigns_camp; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_campaigns_camp ON template.campaigns USING btree (camp_id);


--
-- Name: idx_camps_location; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camps_location ON template.camps USING btree (location_id);


--
-- Name: idx_camps_starts; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camps_starts ON template.camps USING btree (starts_at);


--
-- Name: idx_camps_status; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_camps_status ON template.camps USING btree (status);


--
-- Name: idx_clinic_working_hours_location; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_clinic_working_hours_location ON template.clinic_working_hours USING btree (location_id);


--
-- Name: idx_diagnosis_camp; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_diagnosis_camp ON template.diagnosis USING btree (camp_id);


--
-- Name: idx_doctor_availability_location; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_doctor_availability_location ON template.doctor_availability USING btree (location_id);


--
-- Name: idx_eligibility_checks_patient; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_eligibility_checks_patient ON template.eligibility_checks USING btree (patient_id, checked_at DESC);


--
-- Name: idx_form_templates_pack; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_form_templates_pack ON template.form_templates USING btree (source_pack) WHERE (source_pack IS NOT NULL);


--
-- Name: idx_healthcare_offerings_pack; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_healthcare_offerings_pack ON template.healthcare_offerings USING btree (source_pack) WHERE (source_pack IS NOT NULL);


--
-- Name: idx_inv_movements_location; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_inv_movements_location ON template.inventory_stock_movements USING btree (location_id);


--
-- Name: idx_inventory_categories_pack; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_inventory_categories_pack ON template.inventory_categories USING btree (source_pack) WHERE (source_pack IS NOT NULL);


--
-- Name: idx_lab_orders_camp; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_lab_orders_camp ON template.lab_orders USING btree (camp_id);


--
-- Name: idx_locations_active; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_locations_active ON template.locations USING btree (is_active);


--
-- Name: idx_locations_type; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_locations_type ON template.locations USING btree (location_type);


--
-- Name: idx_medical_records_camp; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_medical_records_camp ON template.medical_records USING btree (camp_id);


--
-- Name: idx_module_perms_role; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_module_perms_role ON template.module_permissions USING btree (role_name);


--
-- Name: idx_portal_invites_patient; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_portal_invites_patient ON template.portal_invites USING btree (patient_id, created_at DESC);


--
-- Name: idx_prescriptions_camp; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_prescriptions_camp ON template.prescriptions USING btree (camp_id);


--
-- Name: idx_service_categories_pack; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_service_categories_pack ON template.service_categories USING btree (source_pack) WHERE (source_pack IS NOT NULL);


--
-- Name: idx_sick_note_requests_patient; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_sick_note_requests_patient ON template.sick_note_requests USING btree (patient_id, created_at DESC);


--
-- Name: idx_sick_note_requests_pending; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_sick_note_requests_pending ON template.sick_note_requests USING btree (created_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_sick_notes_patient; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX idx_sick_notes_patient ON template.sick_notes USING btree (patient_id, created_at DESC);


--
-- Name: insurance_payers_is_active_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX insurance_payers_is_active_idx ON template.insurance_payers USING btree (is_active);


--
-- Name: insurance_payers_name_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX insurance_payers_name_idx ON template.insurance_payers USING btree (name);


--
-- Name: insurance_payers_payer_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX insurance_payers_payer_id_idx ON template.insurance_payers USING btree (payer_id);


--
-- Name: inventory_categories_code_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_categories_code_idx ON template.inventory_categories USING btree (code);


--
-- Name: inventory_categories_is_active_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_categories_is_active_idx ON template.inventory_categories USING btree (is_active);


--
-- Name: inventory_categories_parent_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_categories_parent_id_idx ON template.inventory_categories USING btree (parent_id);


--
-- Name: inventory_items_barcode_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_items_barcode_idx ON template.inventory_items USING btree (barcode);


--
-- Name: inventory_items_category_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_items_category_id_idx ON template.inventory_items USING btree (category_id);


--
-- Name: inventory_items_expiry_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_items_expiry_date_idx ON template.inventory_items USING btree (expiry_date);


--
-- Name: inventory_items_item_number_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_items_item_number_idx ON template.inventory_items USING btree (item_number);


--
-- Name: inventory_items_item_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_items_item_type_idx ON template.inventory_items USING btree (item_type);


--
-- Name: inventory_items_sku_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_items_sku_idx ON template.inventory_items USING btree (sku);


--
-- Name: inventory_items_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_items_status_idx ON template.inventory_items USING btree (status);


--
-- Name: inventory_items_supplier_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_items_supplier_id_idx ON template.inventory_items USING btree (supplier_id);


--
-- Name: inventory_purchase_orders_approved_by_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_purchase_orders_approved_by_idx ON template.inventory_purchase_orders USING btree (approved_by);


--
-- Name: inventory_purchase_orders_order_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_purchase_orders_order_date_idx ON template.inventory_purchase_orders USING btree (order_date);


--
-- Name: inventory_purchase_orders_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_purchase_orders_status_idx ON template.inventory_purchase_orders USING btree (status);


--
-- Name: inventory_purchase_orders_supplier_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_purchase_orders_supplier_id_idx ON template.inventory_purchase_orders USING btree (supplier_id);


--
-- Name: inventory_role_permissions_resource_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_role_permissions_resource_idx ON template.inventory_role_permissions USING btree (resource);


--
-- Name: inventory_role_permissions_role_name_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_role_permissions_role_name_idx ON template.inventory_role_permissions USING btree (role_name);


--
-- Name: inventory_stock_movements_item_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_stock_movements_item_id_idx ON template.inventory_stock_movements USING btree (item_id);


--
-- Name: inventory_stock_movements_movement_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_stock_movements_movement_date_idx ON template.inventory_stock_movements USING btree (movement_date);


--
-- Name: inventory_stock_movements_movement_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_stock_movements_movement_type_idx ON template.inventory_stock_movements USING btree (movement_type);


--
-- Name: inventory_stock_movements_performed_by_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_stock_movements_performed_by_idx ON template.inventory_stock_movements USING btree (performed_by);


--
-- Name: inventory_stock_movements_reference_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_stock_movements_reference_id_idx ON template.inventory_stock_movements USING btree (reference_id);


--
-- Name: inventory_stock_movements_reference_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_stock_movements_reference_type_idx ON template.inventory_stock_movements USING btree (reference_type);


--
-- Name: inventory_suppliers_name_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_suppliers_name_idx ON template.inventory_suppliers USING btree (name);


--
-- Name: inventory_suppliers_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_suppliers_status_idx ON template.inventory_suppliers USING btree (status);


--
-- Name: inventory_suppliers_supplier_number_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX inventory_suppliers_supplier_number_idx ON template.inventory_suppliers USING btree (supplier_number);


--
-- Name: lab_orders_created_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX lab_orders_created_at_idx ON template.lab_orders USING btree (created_at);


--
-- Name: lab_orders_fhir_tracking_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX lab_orders_fhir_tracking_id_idx ON template.lab_orders USING btree (fhir_tracking_id);


--
-- Name: lab_orders_order_number_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX lab_orders_order_number_idx ON template.lab_orders USING btree (order_number);


--
-- Name: lab_orders_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX lab_orders_patient_id_idx ON template.lab_orders USING btree (patient_id);


--
-- Name: lab_orders_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX lab_orders_provider_id_idx ON template.lab_orders USING btree (provider_id);


--
-- Name: lab_orders_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX lab_orders_status_idx ON template.lab_orders USING btree (status);


--
-- Name: lab_orders_vendor_order_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX lab_orders_vendor_order_id_idx ON template.lab_orders USING btree (vendor_order_id);


--
-- Name: medical_records_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX medical_records_patient_id_idx ON template.medical_records USING btree (patient_id);


--
-- Name: medical_records_review_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX medical_records_review_status_idx ON template.medical_records USING btree (review_status) WHERE ((review_status)::text = 'pending_review'::text);


--
-- Name: medical_records_source_message_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX medical_records_source_message_id_idx ON template.medical_records USING btree (source_message_id);


--
-- Name: notification_preferences_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX notification_preferences_patient_id_idx ON template.notification_preferences USING btree (patient_id);


--
-- Name: notifications_user_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX notifications_user_id_idx ON template.notifications USING btree (user_id);


--
-- Name: offering_insurance_mappings_offering_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX offering_insurance_mappings_offering_id_idx ON template.offering_insurance_mappings USING btree (offering_id);


--
-- Name: offering_pricing_offering_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX offering_pricing_offering_id_idx ON template.offering_pricing USING btree (offering_id);


--
-- Name: offering_reviews_offering_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX offering_reviews_offering_id_idx ON template.offering_reviews USING btree (offering_id);


--
-- Name: offering_reviews_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX offering_reviews_patient_id_idx ON template.offering_reviews USING btree (patient_id);


--
-- Name: package_offerings_offering_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX package_offerings_offering_id_idx ON template.package_offerings USING btree (offering_id);


--
-- Name: package_offerings_package_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX package_offerings_package_id_idx ON template.package_offerings USING btree (package_id);


--
-- Name: patient_allergies_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_allergies_patient_id_idx ON template.patient_allergies USING btree (patient_id);


--
-- Name: patient_consent_forms_consent_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_consent_forms_consent_type_idx ON template.patient_consent_forms USING btree (consent_type);


--
-- Name: patient_consent_forms_expires_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_consent_forms_expires_at_idx ON template.patient_consent_forms USING btree (expires_at);


--
-- Name: patient_consent_forms_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_consent_forms_patient_id_idx ON template.patient_consent_forms USING btree (patient_id);


--
-- Name: patient_consent_forms_signed_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_consent_forms_signed_at_idx ON template.patient_consent_forms USING btree (signed_at DESC);


--
-- Name: patient_consent_forms_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_consent_forms_status_idx ON template.patient_consent_forms USING btree (status);


--
-- Name: patient_intake_flows_created_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_intake_flows_created_at_idx ON template.patient_intake_flows USING btree (created_at DESC);


--
-- Name: patient_intake_flows_flow_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_intake_flows_flow_type_idx ON template.patient_intake_flows USING btree (flow_type);


--
-- Name: patient_intake_flows_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_intake_flows_patient_id_idx ON template.patient_intake_flows USING btree (patient_id);


--
-- Name: patient_intake_flows_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_intake_flows_status_idx ON template.patient_intake_flows USING btree (status);


--
-- Name: patient_intake_forms_created_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_intake_forms_created_at_idx ON template.patient_intake_forms USING btree (created_at DESC);


--
-- Name: patient_intake_forms_form_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_intake_forms_form_type_idx ON template.patient_intake_forms USING btree (form_type);


--
-- Name: patient_intake_forms_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_intake_forms_patient_id_idx ON template.patient_intake_forms USING btree (patient_id);


--
-- Name: patient_intake_forms_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_intake_forms_status_idx ON template.patient_intake_forms USING btree (status);


--
-- Name: patient_offering_enrollments_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_offering_enrollments_patient_id_idx ON template.patient_offering_enrollments USING btree (patient_id);


--
-- Name: patient_pharmacies_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_pharmacies_patient_id_idx ON template.patient_pharmacies USING btree (patient_id);


--
-- Name: patient_pharmacies_pharmacy_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_pharmacies_pharmacy_id_idx ON template.patient_pharmacies USING btree (pharmacy_id);


--
-- Name: patient_portal_sessions_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patient_portal_sessions_patient_id_idx ON template.patient_portal_sessions USING btree (patient_id);


--
-- Name: patients_country_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patients_country_idx ON template.patients USING btree (country);


--
-- Name: patients_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patients_id_idx ON template.patients USING btree (id);


--
-- Name: patients_insurance_payer_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patients_insurance_payer_id_idx ON template.patients USING btree (insurance_payer_id);


--
-- Name: patients_timezone_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX patients_timezone_idx ON template.patients USING btree (timezone);


--
-- Name: payment_postings_check_number_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX payment_postings_check_number_idx ON template.payment_postings USING btree (check_number);


--
-- Name: payment_postings_claim_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX payment_postings_claim_id_idx ON template.payment_postings USING btree (claim_id);


--
-- Name: payment_postings_insurance_payer_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX payment_postings_insurance_payer_id_idx ON template.payment_postings USING btree (insurance_payer_id);


--
-- Name: payment_postings_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX payment_postings_patient_id_idx ON template.payment_postings USING btree (patient_id);


--
-- Name: payment_postings_posting_date_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX payment_postings_posting_date_idx ON template.payment_postings USING btree (posting_date);


--
-- Name: payment_postings_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX payment_postings_status_idx ON template.payment_postings USING btree (status);


--
-- Name: payments_claim_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX payments_claim_id_idx ON template.payments USING btree (claim_id);


--
-- Name: payments_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX payments_patient_id_idx ON template.payments USING btree (patient_id);


--
-- Name: pharmacies_city_state_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX pharmacies_city_state_idx ON template.pharmacies USING btree (city, state);


--
-- Name: pharmacies_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX pharmacies_id_idx ON template.pharmacies USING btree (id);


--
-- Name: pharmacies_ncpdp_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX pharmacies_ncpdp_id_idx ON template.pharmacies USING btree (ncpdp_id);


--
-- Name: pharmacies_zip_code_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX pharmacies_zip_code_idx ON template.pharmacies USING btree (zip_code);


--
-- Name: preapprovals_insurance_payer_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX preapprovals_insurance_payer_id_idx ON template.preapprovals USING btree (insurance_payer_id);


--
-- Name: preapprovals_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX preapprovals_patient_id_idx ON template.preapprovals USING btree (patient_id);


--
-- Name: preapprovals_preapproval_number_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX preapprovals_preapproval_number_idx ON template.preapprovals USING btree (preapproval_number);


--
-- Name: preapprovals_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX preapprovals_status_idx ON template.preapprovals USING btree (status);


--
-- Name: prescription_history_pharmacy_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX prescription_history_pharmacy_id_idx ON template.prescription_history USING btree (pharmacy_id);


--
-- Name: prescription_history_prescription_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX prescription_history_prescription_id_idx ON template.prescription_history USING btree (prescription_id);


--
-- Name: prescriptions_erx_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX prescriptions_erx_status_idx ON template.prescriptions USING btree (erx_status);


--
-- Name: prescriptions_fhir_tracking_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX prescriptions_fhir_tracking_id_idx ON template.prescriptions USING btree (fhir_tracking_id);


--
-- Name: prescriptions_ndc_code_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX prescriptions_ndc_code_idx ON template.prescriptions USING btree (ndc_code);


--
-- Name: prescriptions_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX prescriptions_patient_id_idx ON template.prescriptions USING btree (patient_id);


--
-- Name: prescriptions_pharmacy_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX prescriptions_pharmacy_id_idx ON template.prescriptions USING btree (pharmacy_id);


--
-- Name: prescriptions_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX prescriptions_provider_id_idx ON template.prescriptions USING btree (provider_id);


--
-- Name: provider_booking_config_booking_url_slug_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX provider_booking_config_booking_url_slug_idx ON template.provider_booking_config USING btree (booking_url_slug);


--
-- Name: provider_booking_config_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX provider_booking_config_provider_id_idx ON template.provider_booking_config USING btree (provider_id);


--
-- Name: recurring_appointments_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX recurring_appointments_patient_id_idx ON template.recurring_appointments USING btree (patient_id);


--
-- Name: recurring_appointments_provider_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX recurring_appointments_provider_id_idx ON template.recurring_appointments USING btree (provider_id);


--
-- Name: recurring_appointments_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX recurring_appointments_status_idx ON template.recurring_appointments USING btree (status);


--
-- Name: telehealth_sessions_appointment_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX telehealth_sessions_appointment_id_idx ON template.telehealth_sessions USING btree (appointment_id);


--
-- Name: uq_camp_services_offering; Type: INDEX; Schema: template; Owner: -
--

CREATE UNIQUE INDEX uq_camp_services_offering ON template.camp_services USING btree (camp_id, offering_id) WHERE (offering_id IS NOT NULL);


--
-- Name: uq_locations_single_primary; Type: INDEX; Schema: template; Owner: -
--

CREATE UNIQUE INDEX uq_locations_single_primary ON template.locations USING btree (is_primary) WHERE is_primary;


--
-- Name: vendor_integration_settings_is_enabled_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX vendor_integration_settings_is_enabled_idx ON template.vendor_integration_settings USING btree (is_enabled);


--
-- Name: vendor_integration_settings_vendor_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX vendor_integration_settings_vendor_type_idx ON template.vendor_integration_settings USING btree (vendor_type);


--
-- Name: vendor_transaction_log_created_at_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX vendor_transaction_log_created_at_idx ON template.vendor_transaction_log USING btree (created_at);


--
-- Name: vendor_transaction_log_internal_reference_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX vendor_transaction_log_internal_reference_id_idx ON template.vendor_transaction_log USING btree (internal_reference_id);


--
-- Name: vendor_transaction_log_patient_id_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX vendor_transaction_log_patient_id_idx ON template.vendor_transaction_log USING btree (patient_id);


--
-- Name: vendor_transaction_log_status_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX vendor_transaction_log_status_idx ON template.vendor_transaction_log USING btree (status);


--
-- Name: vendor_transaction_log_vendor_type_idx; Type: INDEX; Schema: template; Owner: -
--

CREATE INDEX vendor_transaction_log_vendor_type_idx ON template.vendor_transaction_log USING btree (vendor_type);


--
-- Name: idx_accounts_active; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_accounts_active ON tenant_default.accounts USING btree (is_active);


--
-- Name: idx_accounts_number; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_accounts_number ON tenant_default.accounts USING btree (account_number);


--
-- Name: idx_accounts_parent; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_accounts_parent ON tenant_default.accounts USING btree (parent_account_id);


--
-- Name: idx_accounts_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_accounts_type ON tenant_default.accounts USING btree (account_type);


--
-- Name: idx_aging_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_aging_date ON tenant_default.account_ar_aging_snapshots USING btree (snapshot_date);


--
-- Name: idx_aging_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_aging_type ON tenant_default.account_ar_aging_snapshots USING btree (snapshot_type);


--
-- Name: idx_ai_phi_token_map_request; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ai_phi_token_map_request ON tenant_default.ai_phi_token_map USING btree (request_id);


--
-- Name: idx_ai_requests_feature_month; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ai_requests_feature_month ON tenant_default.ai_requests USING btree (feature_key, created_at);


--
-- Name: idx_ai_requests_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ai_requests_patient ON tenant_default.ai_requests USING btree (patient_id);


--
-- Name: idx_ai_suggestions_entity; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ai_suggestions_entity ON tenant_default.ai_suggestions USING btree (entity_type, entity_id);


--
-- Name: idx_ai_suggestions_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ai_suggestions_patient ON tenant_default.ai_suggestions USING btree (patient_id);


--
-- Name: idx_ai_suggestions_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ai_suggestions_status ON tenant_default.ai_suggestions USING btree (status, feature_key);


--
-- Name: idx_aje_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_aje_date ON tenant_default.account_journal_entries USING btree (entry_date);


--
-- Name: idx_aje_entry_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_aje_entry_type ON tenant_default.account_journal_entries USING btree (entry_type);


--
-- Name: idx_aje_ref_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_aje_ref_id ON tenant_default.account_journal_entries USING btree (reference_id);


--
-- Name: idx_aje_ref_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_aje_ref_type ON tenant_default.account_journal_entries USING btree (reference_type);


--
-- Name: idx_aje_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_aje_status ON tenant_default.account_journal_entries USING btree (status);


--
-- Name: idx_ajl_account_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ajl_account_id ON tenant_default.account_journal_lines USING btree (account_id);


--
-- Name: idx_ajl_journal_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ajl_journal_id ON tenant_default.account_journal_lines USING btree (journal_entry_id);


--
-- Name: idx_ajl_patient_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ajl_patient_id ON tenant_default.account_journal_lines USING btree (patient_id);


--
-- Name: idx_analytics_created; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_analytics_created ON tenant_default.booking_analytics USING btree (created_at);


--
-- Name: idx_analytics_event; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_analytics_event ON tenant_default.booking_analytics USING btree (event_type);


--
-- Name: idx_analytics_provider; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_analytics_provider ON tenant_default.booking_analytics USING btree (provider_id);


--
-- Name: idx_ap_due_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ap_due_date ON tenant_default.account_payables USING btree (due_date);


--
-- Name: idx_ap_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ap_status ON tenant_default.account_payables USING btree (status);


--
-- Name: idx_ap_vendor; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ap_vendor ON tenant_default.account_payables USING btree (vendor_name);


--
-- Name: idx_appointment_type_active; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointment_type_active ON tenant_default.appointment_type_config USING btree (is_active);


--
-- Name: idx_appointment_type_provider; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointment_type_provider ON tenant_default.appointment_type_config USING btree (provider_id);


--
-- Name: idx_appointment_types_active; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointment_types_active ON tenant_default.appointment_types USING btree (is_active);


--
-- Name: idx_appointment_types_order; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointment_types_order ON tenant_default.appointment_types USING btree (display_order);


--
-- Name: idx_appointment_types_pack; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointment_types_pack ON tenant_default.appointment_types USING btree (source_pack) WHERE (source_pack IS NOT NULL);


--
-- Name: idx_appointments_booking_source; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointments_booking_source ON tenant_default.appointments USING btree (booking_source);


--
-- Name: idx_appointments_camp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointments_camp ON tenant_default.appointments USING btree (camp_id);


--
-- Name: idx_appointments_cancelled; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointments_cancelled ON tenant_default.appointments USING btree (cancelled_at);


--
-- Name: idx_appointments_location; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointments_location ON tenant_default.appointments USING btree (location_id);


--
-- Name: idx_appointments_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointments_patient ON tenant_default.appointments USING btree (patient_id);


--
-- Name: idx_appointments_provider; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointments_provider ON tenant_default.appointments USING btree (provider_id);


--
-- Name: idx_appointments_recurring; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointments_recurring ON tenant_default.appointments USING btree (recurring_appointment_id);


--
-- Name: idx_appointments_start_time; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointments_start_time ON tenant_default.appointments USING btree (start_time);


--
-- Name: idx_appointments_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointments_status ON tenant_default.appointments USING btree (status);


--
-- Name: idx_appointments_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_appointments_type ON tenant_default.appointments USING btree (appointment_type_id);


--
-- Name: idx_ar_aging; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ar_aging ON tenant_default.account_receivables USING btree (aging_bucket);


--
-- Name: idx_ar_due_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ar_due_date ON tenant_default.account_receivables USING btree (due_date);


--
-- Name: idx_ar_invoice; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ar_invoice ON tenant_default.account_receivables USING btree (invoice_id);


--
-- Name: idx_ar_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ar_patient ON tenant_default.account_receivables USING btree (patient_id);


--
-- Name: idx_ar_payer; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ar_payer ON tenant_default.account_receivables USING btree (payer_id);


--
-- Name: idx_ar_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_ar_status ON tenant_default.account_receivables USING btree (status);


--
-- Name: idx_archive_rules_enabled; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_archive_rules_enabled ON tenant_default.archive_rules USING btree (enabled);


--
-- Name: idx_archive_rules_next_run; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_archive_rules_next_run ON tenant_default.archive_rules USING btree (next_run_at) WHERE (enabled = true);


--
-- Name: idx_archive_rules_schedule_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_archive_rules_schedule_type ON tenant_default.archive_rules USING btree (schedule_type);


--
-- Name: idx_archives_created_at; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_archives_created_at ON tenant_default.archives USING btree (created_at);


--
-- Name: idx_archives_created_by; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_archives_created_by ON tenant_default.archives USING btree (created_by);


--
-- Name: idx_archives_modules; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_archives_modules ON tenant_default.archives USING gin (modules);


--
-- Name: idx_archives_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_archives_status ON tenant_default.archives USING btree (status);


--
-- Name: idx_arp_resource; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_arp_resource ON tenant_default.account_role_permissions USING btree (resource);


--
-- Name: idx_arp_role; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_arp_role ON tenant_default.account_role_permissions USING btree (role_name);


--
-- Name: idx_audit_logs_action_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_action_type ON tenant_default.audit_logs USING btree (action_type);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON tenant_default.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_module; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_module ON tenant_default.audit_logs USING btree (module);


--
-- Name: idx_audit_logs_patient_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_patient_id ON tenant_default.audit_logs USING btree (patient_id);


--
-- Name: idx_audit_logs_provider_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_provider_id ON tenant_default.audit_logs USING btree (provider_id);


--
-- Name: idx_audit_logs_resource_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_resource_date ON tenant_default.audit_logs USING btree (resource_type, resource_name, created_at DESC);


--
-- Name: idx_audit_logs_resource_name; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_resource_name ON tenant_default.audit_logs USING btree (resource_name);


--
-- Name: idx_audit_logs_resource_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_resource_type ON tenant_default.audit_logs USING btree (resource_type);


--
-- Name: idx_audit_logs_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_status ON tenant_default.audit_logs USING btree (status);


--
-- Name: idx_audit_logs_user_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_user_date ON tenant_default.audit_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_audit_logs_user_email; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_user_email ON tenant_default.audit_logs USING btree (user_email);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON tenant_default.audit_logs USING btree (user_id);


--
-- Name: idx_booking_config_provider; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_booking_config_provider ON tenant_default.provider_booking_config USING btree (provider_id);


--
-- Name: idx_booking_config_url; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_booking_config_url ON tenant_default.provider_booking_config USING btree (booking_url_slug);


--
-- Name: idx_camp_alloc_camp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camp_alloc_camp ON tenant_default.camp_inventory_allocations USING btree (camp_id);


--
-- Name: idx_camp_reg_camp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camp_reg_camp ON tenant_default.camp_registrations USING btree (camp_id, token_no);


--
-- Name: idx_camp_reg_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camp_reg_patient ON tenant_default.camp_registrations USING btree (patient_id);


--
-- Name: idx_camp_reg_phone; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camp_reg_phone ON tenant_default.camp_registrations USING btree (phone);


--
-- Name: idx_camp_reg_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camp_reg_status ON tenant_default.camp_registrations USING btree (camp_id, status);


--
-- Name: idx_camp_services_camp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camp_services_camp ON tenant_default.camp_services USING btree (camp_id);


--
-- Name: idx_camp_staff_camp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camp_staff_camp ON tenant_default.camp_staff USING btree (camp_id);


--
-- Name: idx_camp_staff_user; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camp_staff_user ON tenant_default.camp_staff USING btree (user_id);


--
-- Name: idx_camp_stations_camp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camp_stations_camp ON tenant_default.camp_stations USING btree (camp_id, step_order);


--
-- Name: idx_camp_visit_reg; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camp_visit_reg ON tenant_default.camp_station_visits USING btree (registration_id);


--
-- Name: idx_camp_visit_station; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camp_visit_station ON tenant_default.camp_station_visits USING btree (station_id, status);


--
-- Name: idx_campaigns_camp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_campaigns_camp ON tenant_default.campaigns USING btree (camp_id);


--
-- Name: idx_camps_location; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camps_location ON tenant_default.camps USING btree (location_id);


--
-- Name: idx_camps_starts; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camps_starts ON tenant_default.camps USING btree (starts_at);


--
-- Name: idx_camps_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_camps_status ON tenant_default.camps USING btree (status);


--
-- Name: idx_claim_submissions_claim_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_claim_submissions_claim_id ON tenant_default.claim_submissions USING btree (claim_id);


--
-- Name: idx_claim_submissions_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_claim_submissions_status ON tenant_default.claim_submissions USING btree (status);


--
-- Name: idx_claim_submissions_submission_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_claim_submissions_submission_date ON tenant_default.claim_submissions USING btree (submission_date);


--
-- Name: idx_claim_submissions_submission_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_claim_submissions_submission_id ON tenant_default.claim_submissions USING btree (submission_id);


--
-- Name: idx_claims_preapproval_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_claims_preapproval_id ON tenant_default.claims USING btree (preapproval_id);


--
-- Name: idx_clinic_working_hours_location; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_clinic_working_hours_location ON tenant_default.clinic_working_hours USING btree (location_id);


--
-- Name: idx_consent_forms_consent_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_consent_forms_consent_type ON tenant_default.patient_consent_forms USING btree (consent_type);


--
-- Name: idx_consent_forms_expires_at; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_consent_forms_expires_at ON tenant_default.patient_consent_forms USING btree (expires_at);


--
-- Name: idx_consent_forms_patient_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_consent_forms_patient_id ON tenant_default.patient_consent_forms USING btree (patient_id);


--
-- Name: idx_consent_forms_signed_at; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_consent_forms_signed_at ON tenant_default.patient_consent_forms USING btree (signed_at DESC);


--
-- Name: idx_consent_forms_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_consent_forms_status ON tenant_default.patient_consent_forms USING btree (status);


--
-- Name: idx_denials_appeal_deadline; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_denials_appeal_deadline ON tenant_default.denials USING btree (appeal_deadline);


--
-- Name: idx_denials_appeal_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_denials_appeal_status ON tenant_default.denials USING btree (appeal_status);


--
-- Name: idx_denials_assigned_to; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_denials_assigned_to ON tenant_default.denials USING btree (assigned_to);


--
-- Name: idx_denials_claim_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_denials_claim_id ON tenant_default.denials USING btree (claim_id);


--
-- Name: idx_denials_denial_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_denials_denial_date ON tenant_default.denials USING btree (denial_date);


--
-- Name: idx_denials_insurance_payer_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_denials_insurance_payer_id ON tenant_default.denials USING btree (insurance_payer_id);


--
-- Name: idx_denials_patient_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_denials_patient_id ON tenant_default.denials USING btree (patient_id);


--
-- Name: idx_denials_priority; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_denials_priority ON tenant_default.denials USING btree (priority);


--
-- Name: idx_denials_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_denials_status ON tenant_default.denials USING btree (status);


--
-- Name: idx_diagnosis_camp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_diagnosis_camp ON tenant_default.diagnosis USING btree (camp_id);


--
-- Name: idx_diagnosis_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_diagnosis_patient ON tenant_default.diagnosis USING btree (patient_id);


--
-- Name: idx_diagnosis_provider; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_diagnosis_provider ON tenant_default.diagnosis USING btree (provider_id);


--
-- Name: idx_diagnosis_soap_notes; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_diagnosis_soap_notes ON tenant_default.diagnosis USING gin (to_tsvector('english'::regconfig, COALESCE(soap_notes, ''::text)));


--
-- Name: idx_doctor_availability_day; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_doctor_availability_day ON tenant_default.doctor_availability USING btree (day_of_week);


--
-- Name: idx_doctor_availability_location; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_doctor_availability_location ON tenant_default.doctor_availability USING btree (location_id);


--
-- Name: idx_doctor_availability_provider; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_doctor_availability_provider ON tenant_default.doctor_availability USING btree (provider_id);


--
-- Name: idx_doctor_time_off_dates; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_doctor_time_off_dates ON tenant_default.doctor_time_off USING btree (start_date, end_date);


--
-- Name: idx_doctor_time_off_provider; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_doctor_time_off_provider ON tenant_default.doctor_time_off USING btree (provider_id);


--
-- Name: idx_eligibility_checks_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_eligibility_checks_patient ON tenant_default.eligibility_checks USING btree (patient_id, checked_at DESC);


--
-- Name: idx_enrollments_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_enrollments_patient ON tenant_default.patient_offering_enrollments USING btree (patient_id);


--
-- Name: idx_erx_queue_pharmacy; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_erx_queue_pharmacy ON tenant_default.erx_message_queue USING btree (pharmacy_id);


--
-- Name: idx_erx_queue_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_erx_queue_status ON tenant_default.erx_message_queue USING btree (message_status);


--
-- Name: idx_fhir_error_actions_code; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_error_actions_code ON tenant_default.fhir_error_actions USING btree (error_code);


--
-- Name: idx_fhir_error_actions_resource; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_error_actions_resource ON tenant_default.fhir_error_actions USING btree (resource_type);


--
-- Name: idx_fhir_error_actions_vendor; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_error_actions_vendor ON tenant_default.fhir_error_actions USING btree (vendor_name);


--
-- Name: idx_fhir_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_patient ON tenant_default.fhir_resources USING btree (patient_id);


--
-- Name: idx_fhir_tracking_created_at; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_tracking_created_at ON tenant_default.fhir_tracking USING btree (created_at);


--
-- Name: idx_fhir_tracking_errors; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_tracking_errors ON tenant_default.fhir_tracking USING btree (has_errors, action_required);


--
-- Name: idx_fhir_tracking_events_created_at; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_tracking_events_created_at ON tenant_default.fhir_tracking_events USING btree (created_at);


--
-- Name: idx_fhir_tracking_events_errors; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_tracking_events_errors ON tenant_default.fhir_tracking_events USING btree (is_error, error_severity);


--
-- Name: idx_fhir_tracking_events_tracking_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_tracking_events_tracking_id ON tenant_default.fhir_tracking_events USING btree (fhir_tracking_id);


--
-- Name: idx_fhir_tracking_events_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_tracking_events_type ON tenant_default.fhir_tracking_events USING btree (event_type);


--
-- Name: idx_fhir_tracking_number; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_tracking_number ON tenant_default.fhir_tracking USING btree (tracking_number);


--
-- Name: idx_fhir_tracking_reference; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_tracking_reference ON tenant_default.fhir_tracking USING btree (resource_type, resource_reference);


--
-- Name: idx_fhir_tracking_resource; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_tracking_resource ON tenant_default.fhir_tracking USING btree (fhir_resource_id);


--
-- Name: idx_fhir_tracking_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_tracking_status ON tenant_default.fhir_tracking USING btree (current_status);


--
-- Name: idx_fhir_tracking_vendor; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_fhir_tracking_vendor ON tenant_default.fhir_tracking USING btree (vendor_name, vendor_tracking_id);


--
-- Name: idx_form_audit_actor; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_audit_actor ON tenant_default.form_audit_logs USING btree (actor_id);


--
-- Name: idx_form_audit_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_audit_patient ON tenant_default.form_audit_logs USING btree (patient_id);


--
-- Name: idx_form_audit_resource; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_audit_resource ON tenant_default.form_audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_form_signatures_submission; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_signatures_submission ON tenant_default.form_signatures USING btree (submission_id);


--
-- Name: idx_form_submissions_appointment; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_submissions_appointment ON tenant_default.form_submissions USING btree (appointment_id);


--
-- Name: idx_form_submissions_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_submissions_patient ON tenant_default.form_submissions USING btree (patient_id);


--
-- Name: idx_form_submissions_source_message; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_submissions_source_message ON tenant_default.form_submissions USING btree (source_message_id);


--
-- Name: idx_form_submissions_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_submissions_status ON tenant_default.form_submissions USING btree (status);


--
-- Name: idx_form_submissions_template; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_submissions_template ON tenant_default.form_submissions USING btree (template_id);


--
-- Name: idx_form_templates_active; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_templates_active ON tenant_default.form_templates USING btree (is_active);


--
-- Name: idx_form_templates_category; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_templates_category ON tenant_default.form_templates USING btree (category_slug);


--
-- Name: idx_form_templates_pack; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_templates_pack ON tenant_default.form_templates USING btree (source_pack) WHERE (source_pack IS NOT NULL);


--
-- Name: idx_form_templates_specialty; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_templates_specialty ON tenant_default.form_templates USING btree (specialty);


--
-- Name: idx_form_templates_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_templates_type ON tenant_default.form_templates USING btree (template_type);


--
-- Name: idx_form_versions_template; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_form_versions_template ON tenant_default.form_template_versions USING btree (template_id);


--
-- Name: idx_healthcare_offerings_pack; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_healthcare_offerings_pack ON tenant_default.healthcare_offerings USING btree (source_pack) WHERE (source_pack IS NOT NULL);


--
-- Name: idx_insurance_mappings_offering; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_insurance_mappings_offering ON tenant_default.offering_insurance_mappings USING btree (offering_id);


--
-- Name: idx_insurance_payers_active; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_insurance_payers_active ON tenant_default.insurance_payers USING btree (is_active);


--
-- Name: idx_insurance_payers_name; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_insurance_payers_name ON tenant_default.insurance_payers USING btree (name);


--
-- Name: idx_insurance_payers_payer_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_insurance_payers_payer_id ON tenant_default.insurance_payers USING btree (payer_id);


--
-- Name: idx_intake_flows_created_at; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_intake_flows_created_at ON tenant_default.patient_intake_flows USING btree (created_at DESC);


--
-- Name: idx_intake_flows_flow_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_intake_flows_flow_type ON tenant_default.patient_intake_flows USING btree (flow_type);


--
-- Name: idx_intake_flows_patient_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_intake_flows_patient_id ON tenant_default.patient_intake_flows USING btree (patient_id);


--
-- Name: idx_intake_flows_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_intake_flows_status ON tenant_default.patient_intake_flows USING btree (status);


--
-- Name: idx_intake_forms_created_at; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_intake_forms_created_at ON tenant_default.patient_intake_forms USING btree (created_at DESC);


--
-- Name: idx_intake_forms_form_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_intake_forms_form_type ON tenant_default.patient_intake_forms USING btree (form_type);


--
-- Name: idx_intake_forms_patient_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_intake_forms_patient_id ON tenant_default.patient_intake_forms USING btree (patient_id);


--
-- Name: idx_intake_forms_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_intake_forms_status ON tenant_default.patient_intake_forms USING btree (status);


--
-- Name: idx_inv_cat_active; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_cat_active ON tenant_default.inventory_categories USING btree (is_active);


--
-- Name: idx_inv_cat_code; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_cat_code ON tenant_default.inventory_categories USING btree (code);


--
-- Name: idx_inv_cat_parent; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_cat_parent ON tenant_default.inventory_categories USING btree (parent_id);


--
-- Name: idx_inv_item_barcode; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_item_barcode ON tenant_default.inventory_items USING btree (barcode);


--
-- Name: idx_inv_item_category; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_item_category ON tenant_default.inventory_items USING btree (category_id);


--
-- Name: idx_inv_item_expiry; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_item_expiry ON tenant_default.inventory_items USING btree (expiry_date);


--
-- Name: idx_inv_item_number; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_item_number ON tenant_default.inventory_items USING btree (item_number);


--
-- Name: idx_inv_item_sku; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_item_sku ON tenant_default.inventory_items USING btree (sku);


--
-- Name: idx_inv_item_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_item_status ON tenant_default.inventory_items USING btree (status);


--
-- Name: idx_inv_item_supplier; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_item_supplier ON tenant_default.inventory_items USING btree (supplier_id);


--
-- Name: idx_inv_item_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_item_type ON tenant_default.inventory_items USING btree (item_type);


--
-- Name: idx_inv_mov_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_mov_date ON tenant_default.inventory_stock_movements USING btree (movement_date);


--
-- Name: idx_inv_mov_item; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_mov_item ON tenant_default.inventory_stock_movements USING btree (item_id);


--
-- Name: idx_inv_mov_performed_by; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_mov_performed_by ON tenant_default.inventory_stock_movements USING btree (performed_by);


--
-- Name: idx_inv_mov_ref_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_mov_ref_id ON tenant_default.inventory_stock_movements USING btree (reference_id);


--
-- Name: idx_inv_mov_ref_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_mov_ref_type ON tenant_default.inventory_stock_movements USING btree (reference_type);


--
-- Name: idx_inv_mov_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_mov_type ON tenant_default.inventory_stock_movements USING btree (movement_type);


--
-- Name: idx_inv_movements_location; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_movements_location ON tenant_default.inventory_stock_movements USING btree (location_id);


--
-- Name: idx_inv_po_approved_by; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_po_approved_by ON tenant_default.inventory_purchase_orders USING btree (approved_by);


--
-- Name: idx_inv_po_order_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_po_order_date ON tenant_default.inventory_purchase_orders USING btree (order_date);


--
-- Name: idx_inv_po_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_po_status ON tenant_default.inventory_purchase_orders USING btree (status);


--
-- Name: idx_inv_po_supplier; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_po_supplier ON tenant_default.inventory_purchase_orders USING btree (supplier_id);


--
-- Name: idx_inv_rp_resource; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_rp_resource ON tenant_default.inventory_role_permissions USING btree (resource);


--
-- Name: idx_inv_rp_role; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_rp_role ON tenant_default.inventory_role_permissions USING btree (role_name);


--
-- Name: idx_inv_sup_name; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_sup_name ON tenant_default.inventory_suppliers USING btree (name);


--
-- Name: idx_inv_sup_number; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_sup_number ON tenant_default.inventory_suppliers USING btree (supplier_number);


--
-- Name: idx_inv_sup_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inv_sup_status ON tenant_default.inventory_suppliers USING btree (status);


--
-- Name: idx_inventory_categories_pack; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_inventory_categories_pack ON tenant_default.inventory_categories USING btree (source_pack) WHERE (source_pack IS NOT NULL);


--
-- Name: idx_lab_orders_camp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_lab_orders_camp ON tenant_default.lab_orders USING btree (camp_id);


--
-- Name: idx_lab_orders_created; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_lab_orders_created ON tenant_default.lab_orders USING btree (created_at);


--
-- Name: idx_lab_orders_fhir_tracking; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_lab_orders_fhir_tracking ON tenant_default.lab_orders USING btree (fhir_tracking_id);


--
-- Name: idx_lab_orders_order_number; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_lab_orders_order_number ON tenant_default.lab_orders USING btree (order_number);


--
-- Name: idx_lab_orders_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_lab_orders_patient ON tenant_default.lab_orders USING btree (patient_id);


--
-- Name: idx_lab_orders_provider; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_lab_orders_provider ON tenant_default.lab_orders USING btree (provider_id);


--
-- Name: idx_lab_orders_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_lab_orders_status ON tenant_default.lab_orders USING btree (status);


--
-- Name: idx_lab_orders_vendor_order; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_lab_orders_vendor_order ON tenant_default.lab_orders USING btree (vendor_order_id);


--
-- Name: idx_locations_active; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_locations_active ON tenant_default.locations USING btree (is_active);


--
-- Name: idx_locations_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_locations_type ON tenant_default.locations USING btree (location_type);


--
-- Name: idx_medical_records_camp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_medical_records_camp ON tenant_default.medical_records USING btree (camp_id);


--
-- Name: idx_medical_records_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_medical_records_patient ON tenant_default.medical_records USING btree (patient_id);


--
-- Name: idx_medical_records_review_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_medical_records_review_status ON tenant_default.medical_records USING btree (review_status) WHERE ((review_status)::text = 'pending_review'::text);


--
-- Name: idx_medical_records_source_message; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_medical_records_source_message ON tenant_default.medical_records USING btree (source_message_id);


--
-- Name: idx_module_perms_role; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_module_perms_role ON tenant_default.module_permissions USING btree (role_name);


--
-- Name: idx_notification_preferences_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_notification_preferences_patient ON tenant_default.notification_preferences USING btree (patient_id);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_notifications_user ON tenant_default.notifications USING btree (user_id);


--
-- Name: idx_offerings_category; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_offerings_category ON tenant_default.healthcare_offerings USING btree (category_id);


--
-- Name: idx_offerings_consent_form_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_offerings_consent_form_id ON tenant_default.healthcare_offerings USING btree (consent_form_id);


--
-- Name: idx_package_offerings_offering; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_package_offerings_offering ON tenant_default.package_offerings USING btree (offering_id);


--
-- Name: idx_package_offerings_package; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_package_offerings_package ON tenant_default.package_offerings USING btree (package_id);


--
-- Name: idx_patient_allergies_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_patient_allergies_patient ON tenant_default.patient_allergies USING btree (patient_id);


--
-- Name: idx_patient_pharmacies_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_patient_pharmacies_patient ON tenant_default.patient_pharmacies USING btree (patient_id);


--
-- Name: idx_patient_pharmacies_pharmacy; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_patient_pharmacies_pharmacy ON tenant_default.patient_pharmacies USING btree (pharmacy_id);


--
-- Name: idx_patients_country; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_patients_country ON tenant_default.patients USING btree (country);


--
-- Name: idx_patients_insurance_payer_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_patients_insurance_payer_id ON tenant_default.patients USING btree (insurance_payer_id);


--
-- Name: idx_patients_timezone; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_patients_timezone ON tenant_default.patients USING btree (timezone);


--
-- Name: idx_patients_user_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_patients_user_id ON tenant_default.patients USING btree (id);


--
-- Name: idx_payment_postings_check_number; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_payment_postings_check_number ON tenant_default.payment_postings USING btree (check_number);


--
-- Name: idx_payment_postings_claim_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_payment_postings_claim_id ON tenant_default.payment_postings USING btree (claim_id);


--
-- Name: idx_payment_postings_insurance_payer_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_payment_postings_insurance_payer_id ON tenant_default.payment_postings USING btree (insurance_payer_id);


--
-- Name: idx_payment_postings_patient_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_payment_postings_patient_id ON tenant_default.payment_postings USING btree (patient_id);


--
-- Name: idx_payment_postings_posting_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_payment_postings_posting_date ON tenant_default.payment_postings USING btree (posting_date);


--
-- Name: idx_payment_postings_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_payment_postings_status ON tenant_default.payment_postings USING btree (status);


--
-- Name: idx_payments_claim_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_payments_claim_id ON tenant_default.payments USING btree (claim_id);


--
-- Name: idx_payments_patient_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_payments_patient_id ON tenant_default.payments USING btree (patient_id);


--
-- Name: idx_pharmacies_city_state; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_pharmacies_city_state ON tenant_default.pharmacies USING btree (city, state);


--
-- Name: idx_pharmacies_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_pharmacies_id ON tenant_default.pharmacies USING btree (id);


--
-- Name: idx_pharmacies_ncpdp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_pharmacies_ncpdp ON tenant_default.pharmacies USING btree (ncpdp_id);


--
-- Name: idx_pharmacies_zip; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_pharmacies_zip ON tenant_default.pharmacies USING btree (zip_code);


--
-- Name: idx_portal_invites_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_portal_invites_patient ON tenant_default.portal_invites USING btree (patient_id, created_at DESC);


--
-- Name: idx_portal_sessions_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_portal_sessions_patient ON tenant_default.patient_portal_sessions USING btree (patient_id);


--
-- Name: idx_preapprovals_insurance_payer_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_preapprovals_insurance_payer_id ON tenant_default.preapprovals USING btree (insurance_payer_id);


--
-- Name: idx_preapprovals_patient_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_preapprovals_patient_id ON tenant_default.preapprovals USING btree (patient_id);


--
-- Name: idx_preapprovals_preapproval_number; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_preapprovals_preapproval_number ON tenant_default.preapprovals USING btree (preapproval_number);


--
-- Name: idx_preapprovals_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_preapprovals_status ON tenant_default.preapprovals USING btree (status);


--
-- Name: idx_prescription_history_pharmacy; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_prescription_history_pharmacy ON tenant_default.prescription_history USING btree (pharmacy_id);


--
-- Name: idx_prescription_history_prescription; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_prescription_history_prescription ON tenant_default.prescription_history USING btree (prescription_id);


--
-- Name: idx_prescriptions_camp; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_prescriptions_camp ON tenant_default.prescriptions USING btree (camp_id);


--
-- Name: idx_prescriptions_erx_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_prescriptions_erx_status ON tenant_default.prescriptions USING btree (erx_status);


--
-- Name: idx_prescriptions_fhir_tracking; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_prescriptions_fhir_tracking ON tenant_default.prescriptions USING btree (fhir_tracking_id);


--
-- Name: idx_prescriptions_ndc; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_prescriptions_ndc ON tenant_default.prescriptions USING btree (ndc_code);


--
-- Name: idx_prescriptions_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_prescriptions_patient ON tenant_default.prescriptions USING btree (patient_id);


--
-- Name: idx_prescriptions_pharmacy; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_prescriptions_pharmacy ON tenant_default.prescriptions USING btree (pharmacy_id);


--
-- Name: idx_prescriptions_provider; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_prescriptions_provider ON tenant_default.prescriptions USING btree (provider_id);


--
-- Name: idx_pricing_offering; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_pricing_offering ON tenant_default.offering_pricing USING btree (offering_id);


--
-- Name: idx_rec_account; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_rec_account ON tenant_default.account_reconciliations USING btree (account_id);


--
-- Name: idx_rec_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_rec_status ON tenant_default.account_reconciliations USING btree (status);


--
-- Name: idx_reci_cleared; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_reci_cleared ON tenant_default.account_reconciliation_items USING btree (is_cleared);


--
-- Name: idx_reci_rec_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_reci_rec_id ON tenant_default.account_reconciliation_items USING btree (reconciliation_id);


--
-- Name: idx_recurring_appointments_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_recurring_appointments_patient ON tenant_default.recurring_appointments USING btree (patient_id);


--
-- Name: idx_recurring_appointments_provider; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_recurring_appointments_provider ON tenant_default.recurring_appointments USING btree (provider_id);


--
-- Name: idx_recurring_appointments_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_recurring_appointments_status ON tenant_default.recurring_appointments USING btree (status);


--
-- Name: idx_reminders_appointment; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_reminders_appointment ON tenant_default.appointment_reminders USING btree (appointment_id);


--
-- Name: idx_reminders_scheduled; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_reminders_scheduled ON tenant_default.appointment_reminders USING btree (scheduled_for);


--
-- Name: idx_reminders_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_reminders_status ON tenant_default.appointment_reminders USING btree (delivery_status);


--
-- Name: idx_reviews_offering; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_reviews_offering ON tenant_default.offering_reviews USING btree (offering_id);


--
-- Name: idx_reviews_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_reviews_patient ON tenant_default.offering_reviews USING btree (patient_id);


--
-- Name: idx_service_categories_pack; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_service_categories_pack ON tenant_default.service_categories USING btree (source_pack) WHERE (source_pack IS NOT NULL);


--
-- Name: idx_sick_note_requests_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_sick_note_requests_patient ON tenant_default.sick_note_requests USING btree (patient_id, created_at DESC);


--
-- Name: idx_sick_note_requests_pending; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_sick_note_requests_pending ON tenant_default.sick_note_requests USING btree (created_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_sick_notes_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_sick_notes_patient ON tenant_default.sick_notes USING btree (patient_id, created_at DESC);


--
-- Name: idx_stm_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_stm_date ON tenant_default.account_statements USING btree (statement_date);


--
-- Name: idx_stm_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_stm_patient ON tenant_default.account_statements USING btree (patient_id);


--
-- Name: idx_stm_payer; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_stm_payer ON tenant_default.account_statements USING btree (payer_id);


--
-- Name: idx_stm_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_stm_status ON tenant_default.account_statements USING btree (status);


--
-- Name: idx_stmi_stmt_id; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_stmi_stmt_id ON tenant_default.account_statement_items USING btree (statement_id);


--
-- Name: idx_telehealth_appointment; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_telehealth_appointment ON tenant_default.telehealth_sessions USING btree (appointment_id);


--
-- Name: idx_vendor_integration_enabled; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_vendor_integration_enabled ON tenant_default.vendor_integration_settings USING btree (is_enabled);


--
-- Name: idx_vendor_integration_vendor_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_vendor_integration_vendor_type ON tenant_default.vendor_integration_settings USING btree (vendor_type);


--
-- Name: idx_vendor_transaction_created; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_vendor_transaction_created ON tenant_default.vendor_transaction_log USING btree (created_at);


--
-- Name: idx_vendor_transaction_internal_ref; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_vendor_transaction_internal_ref ON tenant_default.vendor_transaction_log USING btree (internal_reference_id);


--
-- Name: idx_vendor_transaction_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_vendor_transaction_patient ON tenant_default.vendor_transaction_log USING btree (patient_id);


--
-- Name: idx_vendor_transaction_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_vendor_transaction_status ON tenant_default.vendor_transaction_log USING btree (status);


--
-- Name: idx_vendor_transaction_vendor_type; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_vendor_transaction_vendor_type ON tenant_default.vendor_transaction_log USING btree (vendor_type);


--
-- Name: idx_waitlist_active_lookup; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_waitlist_active_lookup ON tenant_default.appointment_waitlist USING btree (provider_id, preferred_date, status) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_waitlist_date; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_waitlist_date ON tenant_default.appointment_waitlist USING btree (preferred_date);


--
-- Name: idx_waitlist_patient; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_waitlist_patient ON tenant_default.appointment_waitlist USING btree (patient_id);


--
-- Name: idx_waitlist_priority; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_waitlist_priority ON tenant_default.appointment_waitlist USING btree (priority DESC);


--
-- Name: idx_waitlist_provider; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_waitlist_provider ON tenant_default.appointment_waitlist USING btree (provider_id);


--
-- Name: idx_waitlist_status; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE INDEX idx_waitlist_status ON tenant_default.appointment_waitlist USING btree (status);


--
-- Name: uq_camp_services_offering; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE UNIQUE INDEX uq_camp_services_offering ON tenant_default.camp_services USING btree (camp_id, offering_id) WHERE (offering_id IS NOT NULL);


--
-- Name: uq_locations_single_primary; Type: INDEX; Schema: tenant_default; Owner: -
--

CREATE UNIQUE INDEX uq_locations_single_primary ON tenant_default.locations USING btree (is_primary) WHERE is_primary;


--
-- Name: audit_log audit_log_no_mutate; Type: TRIGGER; Schema: control; Owner: -
--

CREATE TRIGGER audit_log_no_mutate BEFORE DELETE OR UPDATE ON control.audit_log FOR EACH ROW EXECUTE FUNCTION control.audit_log_append_only();


--
-- Name: billing_events billing_events_no_mutate; Type: TRIGGER; Schema: control; Owner: -
--

CREATE TRIGGER billing_events_no_mutate BEFORE DELETE OR UPDATE ON control.billing_events FOR EACH ROW EXECUTE FUNCTION control.billing_events_append_only();


--
-- Name: users trg_sync_membership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_membership AFTER INSERT OR UPDATE OF practice_id, role ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_membership_from_user();


--
-- Name: messages trg_touch_message_thread; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_message_thread AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.touch_message_thread();


--
-- Name: providers update_providers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: audit_logs audit_logs_no_mutate; Type: TRIGGER; Schema: template; Owner: -
--

CREATE TRIGGER audit_logs_no_mutate BEFORE DELETE OR UPDATE ON template.audit_logs FOR EACH ROW EXECUTE FUNCTION template.audit_logs_append_only();


--
-- Name: archive_rules archive_rules_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER archive_rules_updated_at BEFORE UPDATE ON tenant_default.archive_rules FOR EACH ROW EXECUTE FUNCTION public.update_archive_rules_updated_at();


--
-- Name: audit_logs audit_logs_no_mutate; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER audit_logs_no_mutate BEFORE DELETE OR UPDATE ON tenant_default.audit_logs FOR EACH ROW EXECUTE FUNCTION tenant_default.audit_logs_append_only();


--
-- Name: fhir_tracking fhir_tracking_status_change_trigger; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER fhir_tracking_status_change_trigger AFTER UPDATE ON tenant_default.fhir_tracking FOR EACH ROW EXECUTE FUNCTION public.trigger_log_fhir_tracking_status_change();


--
-- Name: insurance_payers insurance_payers_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER insurance_payers_updated_at BEFORE UPDATE ON tenant_default.insurance_payers FOR EACH ROW EXECUTE FUNCTION public.update_insurance_payers_updated_at();


--
-- Name: accounts trg_accounts_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON tenant_default.accounts FOR EACH ROW EXECUTE FUNCTION public.update_accounts_updated_at();


--
-- Name: account_journal_entries trg_aje_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trg_aje_updated_at BEFORE UPDATE ON tenant_default.account_journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_accounts_updated_at();


--
-- Name: account_payables trg_ap_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trg_ap_updated_at BEFORE UPDATE ON tenant_default.account_payables FOR EACH ROW EXECUTE FUNCTION public.update_accounts_updated_at();


--
-- Name: account_receivables trg_ar_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trg_ar_updated_at BEFORE UPDATE ON tenant_default.account_receivables FOR EACH ROW EXECUTE FUNCTION public.update_accounts_updated_at();


--
-- Name: inventory_categories trg_inv_cat_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trg_inv_cat_updated_at BEFORE UPDATE ON tenant_default.inventory_categories FOR EACH ROW EXECUTE FUNCTION public.update_inventory_updated_at();


--
-- Name: inventory_items trg_inv_item_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trg_inv_item_updated_at BEFORE UPDATE ON tenant_default.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_inventory_updated_at();


--
-- Name: inventory_purchase_orders trg_inv_po_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trg_inv_po_updated_at BEFORE UPDATE ON tenant_default.inventory_purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_inventory_updated_at();


--
-- Name: inventory_suppliers trg_inv_sup_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trg_inv_sup_updated_at BEFORE UPDATE ON tenant_default.inventory_suppliers FOR EACH ROW EXECUTE FUNCTION public.update_inventory_updated_at();


--
-- Name: account_reconciliations trg_rec_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trg_rec_updated_at BEFORE UPDATE ON tenant_default.account_reconciliations FOR EACH ROW EXECUTE FUNCTION public.update_accounts_updated_at();


--
-- Name: account_statements trg_stm_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trg_stm_updated_at BEFORE UPDATE ON tenant_default.account_statements FOR EACH ROW EXECUTE FUNCTION public.update_accounts_updated_at();


--
-- Name: denials trigger_set_appeal_deadline; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trigger_set_appeal_deadline BEFORE INSERT ON tenant_default.denials FOR EACH ROW EXECUTE FUNCTION public.set_appeal_deadline();


--
-- Name: denials trigger_set_denial_number; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trigger_set_denial_number BEFORE INSERT ON tenant_default.denials FOR EACH ROW EXECUTE FUNCTION public.set_denial_number();


--
-- Name: payment_postings trigger_set_posting_number; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trigger_set_posting_number BEFORE INSERT ON tenant_default.payment_postings FOR EACH ROW EXECUTE FUNCTION public.set_posting_number();


--
-- Name: claim_submissions trigger_update_claim_submissions_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trigger_update_claim_submissions_updated_at BEFORE UPDATE ON tenant_default.claim_submissions FOR EACH ROW EXECUTE FUNCTION public.update_claim_submissions_updated_at();


--
-- Name: denials trigger_update_denials_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trigger_update_denials_updated_at BEFORE UPDATE ON tenant_default.denials FOR EACH ROW EXECUTE FUNCTION public.update_denials_updated_at();


--
-- Name: payment_postings trigger_update_payment_postings_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trigger_update_payment_postings_updated_at BEFORE UPDATE ON tenant_default.payment_postings FOR EACH ROW EXECUTE FUNCTION public.update_payment_postings_updated_at();


--
-- Name: preapprovals trigger_update_preapprovals_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER trigger_update_preapprovals_updated_at BEFORE UPDATE ON tenant_default.preapprovals FOR EACH ROW EXECUTE FUNCTION public.update_preapprovals_updated_at();


--
-- Name: appointment_reminders update_appointment_reminders_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER update_appointment_reminders_updated_at BEFORE UPDATE ON tenant_default.appointment_reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: appointment_type_config update_appointment_type_config_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER update_appointment_type_config_updated_at BEFORE UPDATE ON tenant_default.appointment_type_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_availability update_doctor_availability_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER update_doctor_availability_updated_at BEFORE UPDATE ON tenant_default.doctor_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_time_off update_doctor_time_off_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER update_doctor_time_off_updated_at BEFORE UPDATE ON tenant_default.doctor_time_off FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: provider_booking_config update_provider_booking_config_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER update_provider_booking_config_updated_at BEFORE UPDATE ON tenant_default.provider_booking_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: recurring_appointments update_recurring_appointments_updated_at; Type: TRIGGER; Schema: tenant_default; Owner: -
--

CREATE TRIGGER update_recurring_appointments_updated_at BEFORE UPDATE ON tenant_default.recurring_appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: audit_log audit_log_operator_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.audit_log
    ADD CONSTRAINT audit_log_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES control.operators(id);


--
-- Name: billing_events billing_events_operator_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.billing_events
    ADD CONSTRAINT billing_events_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES control.operators(id);


--
-- Name: billing_events billing_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.billing_events
    ADD CONSTRAINT billing_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES control.tenants(id);


--
-- Name: booking_slug_route booking_slug_route_tenant_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.booking_slug_route
    ADD CONSTRAINT booking_slug_route_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES control.tenants(id) ON DELETE CASCADE;


--
-- Name: break_glass_sessions break_glass_sessions_operator_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.break_glass_sessions
    ADD CONSTRAINT break_glass_sessions_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES control.operators(id);


--
-- Name: break_glass_sessions break_glass_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.break_glass_sessions
    ADD CONSTRAINT break_glass_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES control.tenants(id);


--
-- Name: platform_notifications platform_notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.platform_notifications
    ADD CONSTRAINT platform_notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES control.operators(id);


--
-- Name: portal_identity_route portal_identity_route_tenant_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.portal_identity_route
    ADD CONSTRAINT portal_identity_route_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES control.tenants(id) ON DELETE CASCADE;


--
-- Name: portal_invite_route portal_invite_route_tenant_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.portal_invite_route
    ADD CONSTRAINT portal_invite_route_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES control.tenants(id) ON DELETE CASCADE;


--
-- Name: portal_session_route portal_session_route_tenant_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.portal_session_route
    ADD CONSTRAINT portal_session_route_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES control.tenants(id) ON DELETE CASCADE;


--
-- Name: signup_intents signup_intents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.signup_intents
    ADD CONSTRAINT signup_intents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES control.tenants(id);


--
-- Name: subscription_grants subscription_grants_operator_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.subscription_grants
    ADD CONSTRAINT subscription_grants_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES control.operators(id);


--
-- Name: subscription_grants subscription_grants_tenant_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.subscription_grants
    ADD CONSTRAINT subscription_grants_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES control.tenants(id);


--
-- Name: subscriptions subscriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: control; Owner: -
--

ALTER TABLE ONLY control.subscriptions
    ADD CONSTRAINT subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES control.tenants(id);


--
-- Name: account_backups account_backups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_backups
    ADD CONSTRAINT account_backups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: billing_invoice_items billing_invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoice_items
    ADD CONSTRAINT billing_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.billing_invoices(id) ON DELETE CASCADE;


--
-- Name: billing_invoices billing_invoices_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE SET NULL;


--
-- Name: billing_invoices billing_invoices_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: billing_invoices billing_invoices_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.billing_quotes(id) ON DELETE SET NULL;


--
-- Name: billing_payments billing_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_payments
    ADD CONSTRAINT billing_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.billing_invoices(id) ON DELETE SET NULL;


--
-- Name: billing_payments billing_payments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_payments
    ADD CONSTRAINT billing_payments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE SET NULL;


--
-- Name: billing_quote_items billing_quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_quote_items
    ADD CONSTRAINT billing_quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.billing_quotes(id) ON DELETE CASCADE;


--
-- Name: billing_quotes billing_quotes_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_quotes
    ADD CONSTRAINT billing_quotes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE SET NULL;


--
-- Name: billing_quotes billing_quotes_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_quotes
    ADD CONSTRAINT billing_quotes_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_purchase_order_lines inventory_purchase_order_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_order_lines
    ADD CONSTRAINT inventory_purchase_order_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES tenant_default.inventory_items(id);


--
-- Name: inventory_purchase_order_lines inventory_purchase_order_lines_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_order_lines
    ADD CONSTRAINT inventory_purchase_order_lines_po_id_fkey FOREIGN KEY (po_id) REFERENCES tenant_default.inventory_purchase_orders(id) ON DELETE CASCADE;


--
-- Name: join_requests join_requests_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.join_requests
    ADD CONSTRAINT join_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: join_requests join_requests_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.join_requests
    ADD CONSTRAINT join_requests_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE;


--
-- Name: join_requests join_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.join_requests
    ADD CONSTRAINT join_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: license_keys license_keys_plan_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_keys
    ADD CONSTRAINT license_keys_plan_name_fkey FOREIGN KEY (plan_name) REFERENCES public.subscription_plans(name);


--
-- Name: medication_alternatives medication_alternatives_alternative_ndc_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_alternatives
    ADD CONSTRAINT medication_alternatives_alternative_ndc_fkey FOREIGN KEY (alternative_ndc) REFERENCES public.medications(ndc_code);


--
-- Name: medication_alternatives medication_alternatives_original_ndc_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_alternatives
    ADD CONSTRAINT medication_alternatives_original_ndc_fkey FOREIGN KEY (original_ndc) REFERENCES public.medications(ndc_code);


--
-- Name: memberships memberships_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE;


--
-- Name: memberships memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: message_attachments message_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_read_receipts message_read_receipts_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_thread_participants message_thread_participants_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_thread_participants
    ADD CONSTRAINT message_thread_participants_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE CASCADE;


--
-- Name: message_threads message_threads_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE SET NULL;


--
-- Name: messages messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE CASCADE;


--
-- Name: organization_settings organization_settings_current_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_current_plan_id_fkey FOREIGN KEY (current_plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: practice_domains practice_domains_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_domains
    ADD CONSTRAINT practice_domains_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: practice_domains practice_domains_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_domains
    ADD CONSTRAINT practice_domains_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE;


--
-- Name: practice_profile_photos practice_profile_photos_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_profile_photos
    ADD CONSTRAINT practice_profile_photos_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE;


--
-- Name: practice_profiles practice_profiles_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practice_profiles
    ADD CONSTRAINT practice_profiles_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE;


--
-- Name: provider_listing_consents provider_listing_consents_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_listing_consents
    ADD CONSTRAINT provider_listing_consents_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE;


--
-- Name: providers providers_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: social_auth social_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_auth
    ADD CONSTRAINT social_auth_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: specialties specialties_parent_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialties
    ADD CONSTRAINT specialties_parent_code_fkey FOREIGN KEY (parent_code) REFERENCES public.specialties(code);


--
-- Name: staff_invites staff_invites_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invites
    ADD CONSTRAINT staff_invites_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: staff_invites staff_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invites
    ADD CONSTRAINT staff_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: staff_invites staff_invites_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invites
    ADD CONSTRAINT staff_invites_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: account_journal_entries account_journal_entries_reversal_of_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_journal_entries
    ADD CONSTRAINT account_journal_entries_reversal_of_fkey FOREIGN KEY (reversal_of) REFERENCES template.account_journal_entries(id);


--
-- Name: account_journal_lines account_journal_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_journal_lines
    ADD CONSTRAINT account_journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES template.accounts(id);


--
-- Name: account_journal_lines account_journal_lines_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_journal_lines
    ADD CONSTRAINT account_journal_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES template.account_journal_entries(id) ON DELETE CASCADE;


--
-- Name: account_journal_lines account_journal_lines_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_journal_lines
    ADD CONSTRAINT account_journal_lines_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id);


--
-- Name: account_payables account_payables_account_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_payables
    ADD CONSTRAINT account_payables_account_id_fkey FOREIGN KEY (account_id) REFERENCES template.accounts(id);


--
-- Name: account_receivables account_receivables_account_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_receivables
    ADD CONSTRAINT account_receivables_account_id_fkey FOREIGN KEY (account_id) REFERENCES template.accounts(id);


--
-- Name: account_receivables account_receivables_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_receivables
    ADD CONSTRAINT account_receivables_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id);


--
-- Name: account_receivables account_receivables_payer_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_receivables
    ADD CONSTRAINT account_receivables_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES template.insurance_payers(id);


--
-- Name: account_reconciliation_items account_reconciliation_items_journal_line_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_reconciliation_items
    ADD CONSTRAINT account_reconciliation_items_journal_line_id_fkey FOREIGN KEY (journal_line_id) REFERENCES template.account_journal_lines(id);


--
-- Name: account_reconciliation_items account_reconciliation_items_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_reconciliation_items
    ADD CONSTRAINT account_reconciliation_items_reconciliation_id_fkey FOREIGN KEY (reconciliation_id) REFERENCES template.account_reconciliations(id) ON DELETE CASCADE;


--
-- Name: account_reconciliations account_reconciliations_account_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_reconciliations
    ADD CONSTRAINT account_reconciliations_account_id_fkey FOREIGN KEY (account_id) REFERENCES template.accounts(id);


--
-- Name: account_statement_items account_statement_items_statement_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_statement_items
    ADD CONSTRAINT account_statement_items_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES template.account_statements(id) ON DELETE CASCADE;


--
-- Name: account_statements account_statements_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_statements
    ADD CONSTRAINT account_statements_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id);


--
-- Name: account_statements account_statements_payer_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.account_statements
    ADD CONSTRAINT account_statements_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES template.insurance_payers(id);


--
-- Name: accounts accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.accounts
    ADD CONSTRAINT accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id) REFERENCES template.accounts(id);


--
-- Name: ai_phi_token_map ai_phi_token_map_request_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.ai_phi_token_map
    ADD CONSTRAINT ai_phi_token_map_request_id_fkey FOREIGN KEY (request_id) REFERENCES template.ai_requests(id) ON DELETE CASCADE;


--
-- Name: ai_suggestions ai_suggestions_request_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.ai_suggestions
    ADD CONSTRAINT ai_suggestions_request_id_fkey FOREIGN KEY (request_id) REFERENCES template.ai_requests(id) ON DELETE RESTRICT;


--
-- Name: appointment_reminders appointment_reminders_appointment_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointment_reminders
    ADD CONSTRAINT appointment_reminders_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES template.appointments(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_camp_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointments
    ADD CONSTRAINT appointments_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES template.camps(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_location_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointments
    ADD CONSTRAINT appointments_location_id_fkey FOREIGN KEY (location_id) REFERENCES template.locations(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: booking_analytics booking_analytics_appointment_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.booking_analytics
    ADD CONSTRAINT booking_analytics_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES template.appointments(id) ON DELETE SET NULL;


--
-- Name: booking_analytics booking_analytics_appointment_type_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.booking_analytics
    ADD CONSTRAINT booking_analytics_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES template.appointment_type_config(id) ON DELETE SET NULL;


--
-- Name: booking_analytics booking_analytics_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.booking_analytics
    ADD CONSTRAINT booking_analytics_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE SET NULL;


--
-- Name: camp_inventory_allocations camp_inventory_allocations_camp_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_inventory_allocations
    ADD CONSTRAINT camp_inventory_allocations_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES template.camps(id) ON DELETE CASCADE;


--
-- Name: camp_inventory_allocations camp_inventory_allocations_issue_movement_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_inventory_allocations
    ADD CONSTRAINT camp_inventory_allocations_issue_movement_id_fkey FOREIGN KEY (issue_movement_id) REFERENCES template.inventory_stock_movements(id) ON DELETE SET NULL;


--
-- Name: camp_inventory_allocations camp_inventory_allocations_item_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_inventory_allocations
    ADD CONSTRAINT camp_inventory_allocations_item_id_fkey FOREIGN KEY (item_id) REFERENCES template.inventory_items(id) ON DELETE RESTRICT;


--
-- Name: camp_inventory_allocations camp_inventory_allocations_return_movement_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_inventory_allocations
    ADD CONSTRAINT camp_inventory_allocations_return_movement_id_fkey FOREIGN KEY (return_movement_id) REFERENCES template.inventory_stock_movements(id) ON DELETE SET NULL;


--
-- Name: camp_registrations camp_registrations_camp_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_registrations
    ADD CONSTRAINT camp_registrations_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES template.camps(id) ON DELETE CASCADE;


--
-- Name: camp_registrations camp_registrations_consent_form_submission_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_registrations
    ADD CONSTRAINT camp_registrations_consent_form_submission_id_fkey FOREIGN KEY (consent_form_submission_id) REFERENCES template.form_submissions(id) ON DELETE SET NULL;


--
-- Name: camp_registrations camp_registrations_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_registrations
    ADD CONSTRAINT camp_registrations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE SET NULL;


--
-- Name: camp_services camp_services_camp_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_services
    ADD CONSTRAINT camp_services_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES template.camps(id) ON DELETE CASCADE;


--
-- Name: camp_services camp_services_offering_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_services
    ADD CONSTRAINT camp_services_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES template.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: camp_staff camp_staff_camp_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_staff
    ADD CONSTRAINT camp_staff_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES template.camps(id) ON DELETE CASCADE;


--
-- Name: camp_station_visits camp_station_visits_registration_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_station_visits
    ADD CONSTRAINT camp_station_visits_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES template.camp_registrations(id) ON DELETE CASCADE;


--
-- Name: camp_station_visits camp_station_visits_station_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_station_visits
    ADD CONSTRAINT camp_station_visits_station_id_fkey FOREIGN KEY (station_id) REFERENCES template.camp_stations(id) ON DELETE CASCADE;


--
-- Name: camp_stations camp_stations_camp_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_stations
    ADD CONSTRAINT camp_stations_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES template.camps(id) ON DELETE CASCADE;


--
-- Name: camp_stations camp_stations_form_template_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_stations
    ADD CONSTRAINT camp_stations_form_template_id_fkey FOREIGN KEY (form_template_id) REFERENCES template.form_templates(id) ON DELETE SET NULL;


--
-- Name: camp_stations camp_stations_offering_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camp_stations
    ADD CONSTRAINT camp_stations_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES template.healthcare_offerings(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_camp_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.campaigns
    ADD CONSTRAINT campaigns_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES template.camps(id) ON DELETE SET NULL;


--
-- Name: camps camps_location_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.camps
    ADD CONSTRAINT camps_location_id_fkey FOREIGN KEY (location_id) REFERENCES template.locations(id) ON DELETE SET NULL;


--
-- Name: claim_submissions claim_submissions_claim_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.claim_submissions
    ADD CONSTRAINT claim_submissions_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES template.claims(id) ON DELETE CASCADE;


--
-- Name: claims claims_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.claims
    ADD CONSTRAINT claims_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: claims claims_preapproval_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.claims
    ADD CONSTRAINT claims_preapproval_id_fkey FOREIGN KEY (preapproval_id) REFERENCES template.preapprovals(id) ON DELETE SET NULL;


--
-- Name: clinic_working_hours clinic_working_hours_location_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.clinic_working_hours
    ADD CONSTRAINT clinic_working_hours_location_id_fkey FOREIGN KEY (location_id) REFERENCES template.locations(id) ON DELETE SET NULL;


--
-- Name: denials denials_claim_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.denials
    ADD CONSTRAINT denials_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES template.claims(id) ON DELETE SET NULL;


--
-- Name: denials denials_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.denials
    ADD CONSTRAINT denials_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES template.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: denials denials_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.denials
    ADD CONSTRAINT denials_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: diagnosis diagnosis_camp_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.diagnosis
    ADD CONSTRAINT diagnosis_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES template.camps(id) ON DELETE SET NULL;


--
-- Name: diagnosis diagnosis_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.diagnosis
    ADD CONSTRAINT diagnosis_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: doctor_availability doctor_availability_location_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.doctor_availability
    ADD CONSTRAINT doctor_availability_location_id_fkey FOREIGN KEY (location_id) REFERENCES template.locations(id) ON DELETE SET NULL;


--
-- Name: eligibility_checks eligibility_checks_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.eligibility_checks
    ADD CONSTRAINT eligibility_checks_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: erx_message_queue erx_message_queue_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.erx_message_queue
    ADD CONSTRAINT erx_message_queue_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES template.pharmacies(id);


--
-- Name: erx_message_queue erx_message_queue_prescription_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.erx_message_queue
    ADD CONSTRAINT erx_message_queue_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES template.prescriptions(id) ON DELETE CASCADE;


--
-- Name: fhir_tracking_events fhir_tracking_events_fhir_tracking_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.fhir_tracking_events
    ADD CONSTRAINT fhir_tracking_events_fhir_tracking_id_fkey FOREIGN KEY (fhir_tracking_id) REFERENCES template.fhir_tracking(id) ON DELETE CASCADE;


--
-- Name: fhir_tracking fhir_tracking_fhir_resource_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.fhir_tracking
    ADD CONSTRAINT fhir_tracking_fhir_resource_id_fkey FOREIGN KEY (fhir_resource_id) REFERENCES template.fhir_resources(id) ON DELETE CASCADE;


--
-- Name: appointments fk_appointments_recurring; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointments
    ADD CONSTRAINT fk_appointments_recurring FOREIGN KEY (recurring_appointment_id) REFERENCES template.recurring_appointments(id) ON DELETE SET NULL;


--
-- Name: appointments fk_appointments_rescheduled_from; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointments
    ADD CONSTRAINT fk_appointments_rescheduled_from FOREIGN KEY (rescheduled_from) REFERENCES template.appointments(id) ON DELETE SET NULL;


--
-- Name: appointments fk_appointments_type; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.appointments
    ADD CONSTRAINT fk_appointments_type FOREIGN KEY (appointment_type_id) REFERENCES template.appointment_type_config(id) ON DELETE SET NULL;


--
-- Name: form_categories form_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_categories
    ADD CONSTRAINT form_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES template.form_categories(id);


--
-- Name: form_signatures form_signatures_submission_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_signatures
    ADD CONSTRAINT form_signatures_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES template.form_submissions(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_template_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_submissions
    ADD CONSTRAINT form_submissions_template_id_fkey FOREIGN KEY (template_id) REFERENCES template.form_templates(id);


--
-- Name: form_template_versions form_template_versions_template_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_template_versions
    ADD CONSTRAINT form_template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES template.form_templates(id) ON DELETE CASCADE;


--
-- Name: form_templates form_templates_category_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.form_templates
    ADD CONSTRAINT form_templates_category_id_fkey FOREIGN KEY (category_id) REFERENCES template.form_categories(id);


--
-- Name: healthcare_offerings healthcare_offerings_category_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.healthcare_offerings
    ADD CONSTRAINT healthcare_offerings_category_id_fkey FOREIGN KEY (category_id) REFERENCES template.service_categories(id) ON DELETE SET NULL;


--
-- Name: healthcare_offerings healthcare_offerings_consent_form_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.healthcare_offerings
    ADD CONSTRAINT healthcare_offerings_consent_form_id_fkey FOREIGN KEY (consent_form_id) REFERENCES template.form_templates(id) ON DELETE SET NULL;


--
-- Name: intake_flow_templates intake_flow_templates_template_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.intake_flow_templates
    ADD CONSTRAINT intake_flow_templates_template_id_fkey FOREIGN KEY (template_id) REFERENCES template.form_templates(id);


--
-- Name: inventory_categories inventory_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_categories
    ADD CONSTRAINT inventory_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES template.inventory_categories(id);


--
-- Name: inventory_items inventory_items_category_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_items
    ADD CONSTRAINT inventory_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES template.inventory_categories(id);


--
-- Name: inventory_items inventory_items_linked_account_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_items
    ADD CONSTRAINT inventory_items_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES template.accounts(id);


--
-- Name: inventory_items inventory_items_supplier_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_items
    ADD CONSTRAINT inventory_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES template.inventory_suppliers(id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_linked_account_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES template.accounts(id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES template.inventory_suppliers(id);


--
-- Name: inventory_stock_movements inventory_stock_movements_item_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES template.inventory_items(id);


--
-- Name: inventory_stock_movements inventory_stock_movements_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES template.account_journal_entries(id);


--
-- Name: inventory_stock_movements inventory_stock_movements_location_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_location_id_fkey FOREIGN KEY (location_id) REFERENCES template.locations(id) ON DELETE SET NULL;


--
-- Name: inventory_suppliers inventory_suppliers_linked_account_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES template.accounts(id);


--
-- Name: lab_orders lab_orders_camp_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.lab_orders
    ADD CONSTRAINT lab_orders_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES template.camps(id) ON DELETE SET NULL;


--
-- Name: lab_orders lab_orders_fhir_tracking_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.lab_orders
    ADD CONSTRAINT lab_orders_fhir_tracking_id_fkey FOREIGN KEY (fhir_tracking_id) REFERENCES template.fhir_tracking(id);


--
-- Name: lab_orders lab_orders_laboratory_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.lab_orders
    ADD CONSTRAINT lab_orders_laboratory_id_fkey FOREIGN KEY (laboratory_id) REFERENCES template.laboratories(id);


--
-- Name: lab_orders lab_orders_linked_diagnosis_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.lab_orders
    ADD CONSTRAINT lab_orders_linked_diagnosis_id_fkey FOREIGN KEY (linked_diagnosis_id) REFERENCES template.diagnoses(id) ON DELETE SET NULL;


--
-- Name: medical_records medical_records_camp_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.medical_records
    ADD CONSTRAINT medical_records_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES template.camps(id) ON DELETE SET NULL;


--
-- Name: medical_records medical_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.medical_records
    ADD CONSTRAINT medical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: module_permissions module_permissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.module_permissions
    ADD CONSTRAINT module_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: notification_preferences notification_preferences_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.notification_preferences
    ADD CONSTRAINT notification_preferences_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: offering_form_links offering_form_links_offering_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_form_links
    ADD CONSTRAINT offering_form_links_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES template.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: offering_insurance_mappings offering_insurance_mappings_offering_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_insurance_mappings
    ADD CONSTRAINT offering_insurance_mappings_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES template.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: offering_packages offering_packages_category_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_packages
    ADD CONSTRAINT offering_packages_category_id_fkey FOREIGN KEY (category_id) REFERENCES template.service_categories(id) ON DELETE SET NULL;


--
-- Name: offering_pricing offering_pricing_offering_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_pricing
    ADD CONSTRAINT offering_pricing_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES template.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: offering_reviews offering_reviews_offering_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.offering_reviews
    ADD CONSTRAINT offering_reviews_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES template.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: package_offerings package_offerings_offering_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.package_offerings
    ADD CONSTRAINT package_offerings_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES template.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: package_offerings package_offerings_package_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.package_offerings
    ADD CONSTRAINT package_offerings_package_id_fkey FOREIGN KEY (package_id) REFERENCES template.offering_packages(id) ON DELETE CASCADE;


--
-- Name: patient_allergies patient_allergies_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_allergies
    ADD CONSTRAINT patient_allergies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: patient_consent_forms patient_consent_forms_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_consent_forms
    ADD CONSTRAINT patient_consent_forms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: patient_intake_flows patient_intake_flows_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_intake_flows
    ADD CONSTRAINT patient_intake_flows_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: patient_intake_forms patient_intake_forms_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_intake_forms
    ADD CONSTRAINT patient_intake_forms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: patient_offering_enrollments patient_offering_enrollments_offering_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES template.healthcare_offerings(id) ON DELETE SET NULL;


--
-- Name: patient_offering_enrollments patient_offering_enrollments_package_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_package_id_fkey FOREIGN KEY (package_id) REFERENCES template.offering_packages(id) ON DELETE SET NULL;


--
-- Name: patient_pharmacies patient_pharmacies_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: patient_pharmacies patient_pharmacies_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES template.pharmacies(id) ON DELETE CASCADE;


--
-- Name: patients patients_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.patients
    ADD CONSTRAINT patients_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES template.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: payment_postings payment_postings_claim_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.payment_postings
    ADD CONSTRAINT payment_postings_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES template.claims(id) ON DELETE SET NULL;


--
-- Name: payment_postings payment_postings_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.payment_postings
    ADD CONSTRAINT payment_postings_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES template.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: payment_postings payment_postings_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.payment_postings
    ADD CONSTRAINT payment_postings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: payments payments_claim_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.payments
    ADD CONSTRAINT payments_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES template.claims(id) ON DELETE SET NULL;


--
-- Name: payments payments_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.payments
    ADD CONSTRAINT payments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: portal_invites portal_invites_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.portal_invites
    ADD CONSTRAINT portal_invites_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: preapprovals preapprovals_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.preapprovals
    ADD CONSTRAINT preapprovals_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES template.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: preapprovals preapprovals_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.preapprovals
    ADD CONSTRAINT preapprovals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: prescription_history prescription_history_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.prescription_history
    ADD CONSTRAINT prescription_history_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES template.pharmacies(id);


--
-- Name: prescription_history prescription_history_prescription_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.prescription_history
    ADD CONSTRAINT prescription_history_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES template.prescriptions(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_camp_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.prescriptions
    ADD CONSTRAINT prescriptions_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES template.camps(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_diagnosis_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.prescriptions
    ADD CONSTRAINT prescriptions_diagnosis_id_fkey FOREIGN KEY (diagnosis_id) REFERENCES template.diagnosis(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_fhir_tracking_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.prescriptions
    ADD CONSTRAINT prescriptions_fhir_tracking_id_fkey FOREIGN KEY (fhir_tracking_id) REFERENCES template.fhir_tracking(id);


--
-- Name: prescriptions prescriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.prescriptions
    ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: recurring_appointments recurring_appointments_appointment_type_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.recurring_appointments
    ADD CONSTRAINT recurring_appointments_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES template.appointment_type_config(id) ON DELETE SET NULL;


--
-- Name: recurring_appointments recurring_appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.recurring_appointments
    ADD CONSTRAINT recurring_appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: sick_note_requests sick_note_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.sick_note_requests
    ADD CONSTRAINT sick_note_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: sick_notes sick_notes_patient_id_fkey; Type: FK CONSTRAINT; Schema: template; Owner: -
--

ALTER TABLE ONLY template.sick_notes
    ADD CONSTRAINT sick_notes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES template.patients(id) ON DELETE CASCADE;


--
-- Name: account_ar_aging_snapshots account_ar_aging_snapshots_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_ar_aging_snapshots
    ADD CONSTRAINT account_ar_aging_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: account_journal_entries account_journal_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_entries
    ADD CONSTRAINT account_journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: account_journal_entries account_journal_entries_posted_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_entries
    ADD CONSTRAINT account_journal_entries_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id);


--
-- Name: account_journal_entries account_journal_entries_reversal_of_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_entries
    ADD CONSTRAINT account_journal_entries_reversal_of_fkey FOREIGN KEY (reversal_of) REFERENCES tenant_default.account_journal_entries(id);


--
-- Name: account_journal_entries account_journal_entries_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_entries
    ADD CONSTRAINT account_journal_entries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: account_journal_entries account_journal_entries_voided_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_entries
    ADD CONSTRAINT account_journal_entries_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.users(id);


--
-- Name: account_journal_lines account_journal_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_lines
    ADD CONSTRAINT account_journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES tenant_default.accounts(id);


--
-- Name: account_journal_lines account_journal_lines_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_lines
    ADD CONSTRAINT account_journal_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES tenant_default.account_journal_entries(id) ON DELETE CASCADE;


--
-- Name: account_journal_lines account_journal_lines_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_lines
    ADD CONSTRAINT account_journal_lines_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id);


--
-- Name: account_journal_lines account_journal_lines_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_journal_lines
    ADD CONSTRAINT account_journal_lines_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.users(id);


--
-- Name: account_payables account_payables_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_payables
    ADD CONSTRAINT account_payables_account_id_fkey FOREIGN KEY (account_id) REFERENCES tenant_default.accounts(id);


--
-- Name: account_payables account_payables_approved_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_payables
    ADD CONSTRAINT account_payables_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: account_payables account_payables_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_payables
    ADD CONSTRAINT account_payables_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: account_payables account_payables_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_payables
    ADD CONSTRAINT account_payables_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: account_receivables account_receivables_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_receivables
    ADD CONSTRAINT account_receivables_account_id_fkey FOREIGN KEY (account_id) REFERENCES tenant_default.accounts(id);


--
-- Name: account_receivables account_receivables_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_receivables
    ADD CONSTRAINT account_receivables_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: account_receivables account_receivables_invoice_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_receivables
    ADD CONSTRAINT account_receivables_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.billing_invoices(id);


--
-- Name: account_receivables account_receivables_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_receivables
    ADD CONSTRAINT account_receivables_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id);


--
-- Name: account_receivables account_receivables_payer_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_receivables
    ADD CONSTRAINT account_receivables_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES tenant_default.insurance_payers(id);


--
-- Name: account_receivables account_receivables_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_receivables
    ADD CONSTRAINT account_receivables_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: account_reconciliation_items account_reconciliation_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_reconciliation_items
    ADD CONSTRAINT account_reconciliation_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.billing_invoices(id);


--
-- Name: account_reconciliation_items account_reconciliation_items_journal_line_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_reconciliation_items
    ADD CONSTRAINT account_reconciliation_items_journal_line_id_fkey FOREIGN KEY (journal_line_id) REFERENCES tenant_default.account_journal_lines(id);


--
-- Name: account_reconciliation_items account_reconciliation_items_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_reconciliation_items
    ADD CONSTRAINT account_reconciliation_items_reconciliation_id_fkey FOREIGN KEY (reconciliation_id) REFERENCES tenant_default.account_reconciliations(id) ON DELETE CASCADE;


--
-- Name: account_reconciliations account_reconciliations_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_reconciliations
    ADD CONSTRAINT account_reconciliations_account_id_fkey FOREIGN KEY (account_id) REFERENCES tenant_default.accounts(id);


--
-- Name: account_reconciliations account_reconciliations_completed_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_reconciliations
    ADD CONSTRAINT account_reconciliations_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: account_reconciliations account_reconciliations_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_reconciliations
    ADD CONSTRAINT account_reconciliations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: account_role_permissions account_role_permissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_role_permissions
    ADD CONSTRAINT account_role_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: account_statement_items account_statement_items_statement_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_statement_items
    ADD CONSTRAINT account_statement_items_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES tenant_default.account_statements(id) ON DELETE CASCADE;


--
-- Name: account_statements account_statements_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_statements
    ADD CONSTRAINT account_statements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: account_statements account_statements_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_statements
    ADD CONSTRAINT account_statements_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id);


--
-- Name: account_statements account_statements_payer_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.account_statements
    ADD CONSTRAINT account_statements_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES tenant_default.insurance_payers(id);


--
-- Name: accounts accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.accounts
    ADD CONSTRAINT accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: accounts accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.accounts
    ADD CONSTRAINT accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id) REFERENCES tenant_default.accounts(id);


--
-- Name: accounts accounts_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.accounts
    ADD CONSTRAINT accounts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: ai_phi_token_map ai_phi_token_map_request_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.ai_phi_token_map
    ADD CONSTRAINT ai_phi_token_map_request_id_fkey FOREIGN KEY (request_id) REFERENCES tenant_default.ai_requests(id) ON DELETE CASCADE;


--
-- Name: ai_suggestions ai_suggestions_request_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.ai_suggestions
    ADD CONSTRAINT ai_suggestions_request_id_fkey FOREIGN KEY (request_id) REFERENCES tenant_default.ai_requests(id) ON DELETE RESTRICT;


--
-- Name: appointment_reminders appointment_reminders_appointment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointment_reminders
    ADD CONSTRAINT appointment_reminders_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES tenant_default.appointments(id) ON DELETE CASCADE;


--
-- Name: appointment_type_config appointment_type_config_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointment_type_config
    ADD CONSTRAINT appointment_type_config_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: appointment_waitlist appointment_waitlist_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: appointment_waitlist appointment_waitlist_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointment_waitlist
    ADD CONSTRAINT appointment_waitlist_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_camp_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointments
    ADD CONSTRAINT appointments_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES tenant_default.camps(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_location_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointments
    ADD CONSTRAINT appointments_location_id_fkey FOREIGN KEY (location_id) REFERENCES tenant_default.locations(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointments
    ADD CONSTRAINT appointments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- Name: archives archives_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.archives
    ADD CONSTRAINT archives_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: booking_analytics booking_analytics_appointment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.booking_analytics
    ADD CONSTRAINT booking_analytics_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES tenant_default.appointments(id) ON DELETE SET NULL;


--
-- Name: booking_analytics booking_analytics_appointment_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.booking_analytics
    ADD CONSTRAINT booking_analytics_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES tenant_default.appointment_type_config(id) ON DELETE SET NULL;


--
-- Name: booking_analytics booking_analytics_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.booking_analytics
    ADD CONSTRAINT booking_analytics_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE SET NULL;


--
-- Name: booking_analytics booking_analytics_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.booking_analytics
    ADD CONSTRAINT booking_analytics_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: camp_inventory_allocations camp_inventory_allocations_camp_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_inventory_allocations
    ADD CONSTRAINT camp_inventory_allocations_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES tenant_default.camps(id) ON DELETE CASCADE;


--
-- Name: camp_inventory_allocations camp_inventory_allocations_issue_movement_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_inventory_allocations
    ADD CONSTRAINT camp_inventory_allocations_issue_movement_id_fkey FOREIGN KEY (issue_movement_id) REFERENCES tenant_default.inventory_stock_movements(id) ON DELETE SET NULL;


--
-- Name: camp_inventory_allocations camp_inventory_allocations_item_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_inventory_allocations
    ADD CONSTRAINT camp_inventory_allocations_item_id_fkey FOREIGN KEY (item_id) REFERENCES tenant_default.inventory_items(id) ON DELETE RESTRICT;


--
-- Name: camp_inventory_allocations camp_inventory_allocations_return_movement_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_inventory_allocations
    ADD CONSTRAINT camp_inventory_allocations_return_movement_id_fkey FOREIGN KEY (return_movement_id) REFERENCES tenant_default.inventory_stock_movements(id) ON DELETE SET NULL;


--
-- Name: camp_registrations camp_registrations_camp_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_registrations
    ADD CONSTRAINT camp_registrations_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES tenant_default.camps(id) ON DELETE CASCADE;


--
-- Name: camp_registrations camp_registrations_consent_form_submission_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_registrations
    ADD CONSTRAINT camp_registrations_consent_form_submission_id_fkey FOREIGN KEY (consent_form_submission_id) REFERENCES tenant_default.form_submissions(id) ON DELETE SET NULL;


--
-- Name: camp_registrations camp_registrations_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_registrations
    ADD CONSTRAINT camp_registrations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE SET NULL;


--
-- Name: camp_services camp_services_camp_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_services
    ADD CONSTRAINT camp_services_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES tenant_default.camps(id) ON DELETE CASCADE;


--
-- Name: camp_services camp_services_offering_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_services
    ADD CONSTRAINT camp_services_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES tenant_default.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: camp_staff camp_staff_camp_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_staff
    ADD CONSTRAINT camp_staff_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES tenant_default.camps(id) ON DELETE CASCADE;


--
-- Name: camp_station_visits camp_station_visits_registration_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_station_visits
    ADD CONSTRAINT camp_station_visits_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES tenant_default.camp_registrations(id) ON DELETE CASCADE;


--
-- Name: camp_station_visits camp_station_visits_station_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_station_visits
    ADD CONSTRAINT camp_station_visits_station_id_fkey FOREIGN KEY (station_id) REFERENCES tenant_default.camp_stations(id) ON DELETE CASCADE;


--
-- Name: camp_stations camp_stations_camp_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_stations
    ADD CONSTRAINT camp_stations_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES tenant_default.camps(id) ON DELETE CASCADE;


--
-- Name: camp_stations camp_stations_form_template_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_stations
    ADD CONSTRAINT camp_stations_form_template_id_fkey FOREIGN KEY (form_template_id) REFERENCES tenant_default.form_templates(id) ON DELETE SET NULL;


--
-- Name: camp_stations camp_stations_offering_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camp_stations
    ADD CONSTRAINT camp_stations_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES tenant_default.healthcare_offerings(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_camp_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.campaigns
    ADD CONSTRAINT campaigns_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES tenant_default.camps(id) ON DELETE SET NULL;


--
-- Name: camps camps_location_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.camps
    ADD CONSTRAINT camps_location_id_fkey FOREIGN KEY (location_id) REFERENCES tenant_default.locations(id) ON DELETE SET NULL;


--
-- Name: claim_submissions claim_submissions_claim_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.claim_submissions
    ADD CONSTRAINT claim_submissions_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES tenant_default.claims(id) ON DELETE CASCADE;


--
-- Name: claims claims_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.claims
    ADD CONSTRAINT claims_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: claims claims_practice_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.claims
    ADD CONSTRAINT claims_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: claims claims_preapproval_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.claims
    ADD CONSTRAINT claims_preapproval_id_fkey FOREIGN KEY (preapproval_id) REFERENCES tenant_default.preapprovals(id) ON DELETE SET NULL;


--
-- Name: clinic_working_hours clinic_working_hours_location_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.clinic_working_hours
    ADD CONSTRAINT clinic_working_hours_location_id_fkey FOREIGN KEY (location_id) REFERENCES tenant_default.locations(id) ON DELETE SET NULL;


--
-- Name: denials denials_claim_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.denials
    ADD CONSTRAINT denials_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES tenant_default.claims(id) ON DELETE SET NULL;


--
-- Name: denials denials_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.denials
    ADD CONSTRAINT denials_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES tenant_default.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: denials denials_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.denials
    ADD CONSTRAINT denials_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: diagnosis diagnosis_camp_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.diagnosis
    ADD CONSTRAINT diagnosis_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES tenant_default.camps(id) ON DELETE SET NULL;


--
-- Name: diagnosis diagnosis_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.diagnosis
    ADD CONSTRAINT diagnosis_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: doctor_availability doctor_availability_location_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.doctor_availability
    ADD CONSTRAINT doctor_availability_location_id_fkey FOREIGN KEY (location_id) REFERENCES tenant_default.locations(id) ON DELETE SET NULL;


--
-- Name: doctor_availability doctor_availability_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.doctor_availability
    ADD CONSTRAINT doctor_availability_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: doctor_time_off doctor_time_off_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.doctor_time_off
    ADD CONSTRAINT doctor_time_off_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: eligibility_checks eligibility_checks_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.eligibility_checks
    ADD CONSTRAINT eligibility_checks_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: erx_message_queue erx_message_queue_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.erx_message_queue
    ADD CONSTRAINT erx_message_queue_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES tenant_default.pharmacies(id);


--
-- Name: erx_message_queue erx_message_queue_prescription_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.erx_message_queue
    ADD CONSTRAINT erx_message_queue_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES tenant_default.prescriptions(id) ON DELETE CASCADE;


--
-- Name: fhir_tracking fhir_tracking_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_tracking
    ADD CONSTRAINT fhir_tracking_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: fhir_tracking_events fhir_tracking_events_fhir_tracking_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_tracking_events
    ADD CONSTRAINT fhir_tracking_events_fhir_tracking_id_fkey FOREIGN KEY (fhir_tracking_id) REFERENCES tenant_default.fhir_tracking(id) ON DELETE CASCADE;


--
-- Name: fhir_tracking_events fhir_tracking_events_triggered_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_tracking_events
    ADD CONSTRAINT fhir_tracking_events_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES public.users(id);


--
-- Name: fhir_tracking fhir_tracking_fhir_resource_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_tracking
    ADD CONSTRAINT fhir_tracking_fhir_resource_id_fkey FOREIGN KEY (fhir_resource_id) REFERENCES tenant_default.fhir_resources(id) ON DELETE CASCADE;


--
-- Name: fhir_tracking fhir_tracking_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.fhir_tracking
    ADD CONSTRAINT fhir_tracking_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: appointments fk_appointments_recurring; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointments
    ADD CONSTRAINT fk_appointments_recurring FOREIGN KEY (recurring_appointment_id) REFERENCES tenant_default.recurring_appointments(id) ON DELETE SET NULL;


--
-- Name: appointments fk_appointments_rescheduled_from; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointments
    ADD CONSTRAINT fk_appointments_rescheduled_from FOREIGN KEY (rescheduled_from) REFERENCES tenant_default.appointments(id) ON DELETE SET NULL;


--
-- Name: appointments fk_appointments_type; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.appointments
    ADD CONSTRAINT fk_appointments_type FOREIGN KEY (appointment_type_id) REFERENCES tenant_default.appointment_type_config(id) ON DELETE SET NULL;


--
-- Name: form_categories form_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_categories
    ADD CONSTRAINT form_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES tenant_default.form_categories(id);


--
-- Name: form_signatures form_signatures_submission_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_signatures
    ADD CONSTRAINT form_signatures_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES tenant_default.form_submissions(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_document_attachment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_submissions
    ADD CONSTRAINT form_submissions_document_attachment_id_fkey FOREIGN KEY (document_attachment_id) REFERENCES public.message_attachments(id) ON DELETE SET NULL;


--
-- Name: form_submissions form_submissions_source_message_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_submissions
    ADD CONSTRAINT form_submissions_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: form_submissions form_submissions_template_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_submissions
    ADD CONSTRAINT form_submissions_template_id_fkey FOREIGN KEY (template_id) REFERENCES tenant_default.form_templates(id);


--
-- Name: form_template_versions form_template_versions_template_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_template_versions
    ADD CONSTRAINT form_template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES tenant_default.form_templates(id) ON DELETE CASCADE;


--
-- Name: form_templates form_templates_category_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.form_templates
    ADD CONSTRAINT form_templates_category_id_fkey FOREIGN KEY (category_id) REFERENCES tenant_default.form_categories(id);


--
-- Name: healthcare_offerings healthcare_offerings_category_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.healthcare_offerings
    ADD CONSTRAINT healthcare_offerings_category_id_fkey FOREIGN KEY (category_id) REFERENCES tenant_default.service_categories(id) ON DELETE SET NULL;


--
-- Name: healthcare_offerings healthcare_offerings_consent_form_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.healthcare_offerings
    ADD CONSTRAINT healthcare_offerings_consent_form_id_fkey FOREIGN KEY (consent_form_id) REFERENCES tenant_default.form_templates(id) ON DELETE SET NULL;


--
-- Name: intake_flow_templates intake_flow_templates_template_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.intake_flow_templates
    ADD CONSTRAINT intake_flow_templates_template_id_fkey FOREIGN KEY (template_id) REFERENCES tenant_default.form_templates(id);


--
-- Name: inventory_categories inventory_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_categories
    ADD CONSTRAINT inventory_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: inventory_categories inventory_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_categories
    ADD CONSTRAINT inventory_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES tenant_default.inventory_categories(id);


--
-- Name: inventory_items inventory_items_category_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_items
    ADD CONSTRAINT inventory_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES tenant_default.inventory_categories(id);


--
-- Name: inventory_items inventory_items_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_items
    ADD CONSTRAINT inventory_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: inventory_items inventory_items_linked_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_items
    ADD CONSTRAINT inventory_items_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES tenant_default.accounts(id);


--
-- Name: inventory_items inventory_items_supplier_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_items
    ADD CONSTRAINT inventory_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES tenant_default.inventory_suppliers(id);


--
-- Name: inventory_items inventory_items_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_items
    ADD CONSTRAINT inventory_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_linked_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES tenant_default.accounts(id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES tenant_default.inventory_suppliers(id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: inventory_role_permissions inventory_role_permissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_role_permissions
    ADD CONSTRAINT inventory_role_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: inventory_stock_movements inventory_stock_movements_item_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES tenant_default.inventory_items(id);


--
-- Name: inventory_stock_movements inventory_stock_movements_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES tenant_default.account_journal_entries(id);


--
-- Name: inventory_stock_movements inventory_stock_movements_location_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_location_id_fkey FOREIGN KEY (location_id) REFERENCES tenant_default.locations(id) ON DELETE SET NULL;


--
-- Name: inventory_stock_movements inventory_stock_movements_performed_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: inventory_suppliers inventory_suppliers_created_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: inventory_suppliers inventory_suppliers_linked_account_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES tenant_default.accounts(id);


--
-- Name: inventory_suppliers inventory_suppliers_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: lab_orders lab_orders_camp_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.lab_orders
    ADD CONSTRAINT lab_orders_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES tenant_default.camps(id) ON DELETE SET NULL;


--
-- Name: lab_orders lab_orders_fhir_tracking_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.lab_orders
    ADD CONSTRAINT lab_orders_fhir_tracking_id_fkey FOREIGN KEY (fhir_tracking_id) REFERENCES tenant_default.fhir_tracking(id);


--
-- Name: lab_orders lab_orders_laboratory_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.lab_orders
    ADD CONSTRAINT lab_orders_laboratory_id_fkey FOREIGN KEY (laboratory_id) REFERENCES tenant_default.laboratories(id);


--
-- Name: lab_orders lab_orders_linked_diagnosis_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.lab_orders
    ADD CONSTRAINT lab_orders_linked_diagnosis_id_fkey FOREIGN KEY (linked_diagnosis_id) REFERENCES tenant_default.diagnoses(id) ON DELETE SET NULL;


--
-- Name: lab_orders lab_orders_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.lab_orders
    ADD CONSTRAINT lab_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lab_orders lab_orders_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.lab_orders
    ADD CONSTRAINT lab_orders_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.users(id);


--
-- Name: lab_orders lab_orders_results_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.lab_orders
    ADD CONSTRAINT lab_orders_results_reviewed_by_fkey FOREIGN KEY (results_reviewed_by) REFERENCES public.users(id);


--
-- Name: medical_records medical_records_camp_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.medical_records
    ADD CONSTRAINT medical_records_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES tenant_default.camps(id) ON DELETE SET NULL;


--
-- Name: medical_records medical_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.medical_records
    ADD CONSTRAINT medical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: medical_records medical_records_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.medical_records
    ADD CONSTRAINT medical_records_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: medical_records medical_records_source_message_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.medical_records
    ADD CONSTRAINT medical_records_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: module_permissions module_permissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.module_permissions
    ADD CONSTRAINT module_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: notification_preferences notification_preferences_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.notification_preferences
    ADD CONSTRAINT notification_preferences_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: offering_form_links offering_form_links_offering_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_form_links
    ADD CONSTRAINT offering_form_links_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES tenant_default.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: offering_insurance_mappings offering_insurance_mappings_offering_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_insurance_mappings
    ADD CONSTRAINT offering_insurance_mappings_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES tenant_default.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: offering_packages offering_packages_category_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_packages
    ADD CONSTRAINT offering_packages_category_id_fkey FOREIGN KEY (category_id) REFERENCES tenant_default.service_categories(id) ON DELETE SET NULL;


--
-- Name: offering_pricing offering_pricing_offering_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_pricing
    ADD CONSTRAINT offering_pricing_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES tenant_default.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: offering_reviews offering_reviews_offering_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.offering_reviews
    ADD CONSTRAINT offering_reviews_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES tenant_default.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: package_offerings package_offerings_offering_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.package_offerings
    ADD CONSTRAINT package_offerings_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES tenant_default.healthcare_offerings(id) ON DELETE CASCADE;


--
-- Name: package_offerings package_offerings_package_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.package_offerings
    ADD CONSTRAINT package_offerings_package_id_fkey FOREIGN KEY (package_id) REFERENCES tenant_default.offering_packages(id) ON DELETE CASCADE;


--
-- Name: patient_allergies patient_allergies_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_allergies
    ADD CONSTRAINT patient_allergies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: patient_allergies patient_allergies_reported_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_allergies
    ADD CONSTRAINT patient_allergies_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: patient_allergies patient_allergies_verified_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_allergies
    ADD CONSTRAINT patient_allergies_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: patient_consent_forms patient_consent_forms_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_consent_forms
    ADD CONSTRAINT patient_consent_forms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: patient_intake_flows patient_intake_flows_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_intake_flows
    ADD CONSTRAINT patient_intake_flows_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: patient_intake_forms patient_intake_forms_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_intake_forms
    ADD CONSTRAINT patient_intake_forms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: patient_intake_forms patient_intake_forms_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_intake_forms
    ADD CONSTRAINT patient_intake_forms_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: patient_offering_enrollments patient_offering_enrollments_offering_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES tenant_default.healthcare_offerings(id) ON DELETE SET NULL;


--
-- Name: patient_offering_enrollments patient_offering_enrollments_package_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_package_id_fkey FOREIGN KEY (package_id) REFERENCES tenant_default.offering_packages(id) ON DELETE SET NULL;


--
-- Name: patient_pharmacies patient_pharmacies_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: patient_pharmacies patient_pharmacies_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES tenant_default.pharmacies(id) ON DELETE CASCADE;


--
-- Name: patients patients_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patients
    ADD CONSTRAINT patients_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patients patients_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patients
    ADD CONSTRAINT patients_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES tenant_default.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: patients patients_practice_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patients
    ADD CONSTRAINT patients_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id);


--
-- Name: patients patients_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.patients
    ADD CONSTRAINT patients_user_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_postings payment_postings_claim_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.payment_postings
    ADD CONSTRAINT payment_postings_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES tenant_default.claims(id) ON DELETE SET NULL;


--
-- Name: payment_postings payment_postings_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.payment_postings
    ADD CONSTRAINT payment_postings_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES tenant_default.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: payment_postings payment_postings_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.payment_postings
    ADD CONSTRAINT payment_postings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: payments payments_claim_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.payments
    ADD CONSTRAINT payments_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES tenant_default.claims(id) ON DELETE SET NULL;


--
-- Name: payments payments_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.payments
    ADD CONSTRAINT payments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: portal_invites portal_invites_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.portal_invites
    ADD CONSTRAINT portal_invites_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: preapprovals preapprovals_insurance_payer_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.preapprovals
    ADD CONSTRAINT preapprovals_insurance_payer_id_fkey FOREIGN KEY (insurance_payer_id) REFERENCES tenant_default.insurance_payers(id) ON DELETE SET NULL;


--
-- Name: preapprovals preapprovals_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.preapprovals
    ADD CONSTRAINT preapprovals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: prescription_history prescription_history_action_by_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.prescription_history
    ADD CONSTRAINT prescription_history_action_by_fkey FOREIGN KEY (action_by) REFERENCES public.users(id);


--
-- Name: prescription_history prescription_history_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.prescription_history
    ADD CONSTRAINT prescription_history_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES tenant_default.pharmacies(id);


--
-- Name: prescription_history prescription_history_prescription_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.prescription_history
    ADD CONSTRAINT prescription_history_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES tenant_default.prescriptions(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_camp_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.prescriptions
    ADD CONSTRAINT prescriptions_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES tenant_default.camps(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_diagnosis_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.prescriptions
    ADD CONSTRAINT prescriptions_diagnosis_id_fkey FOREIGN KEY (diagnosis_id) REFERENCES tenant_default.diagnosis(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_fhir_tracking_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.prescriptions
    ADD CONSTRAINT prescriptions_fhir_tracking_id_fkey FOREIGN KEY (fhir_tracking_id) REFERENCES tenant_default.fhir_tracking(id);


--
-- Name: prescriptions prescriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.prescriptions
    ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: provider_booking_config provider_booking_config_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.provider_booking_config
    ADD CONSTRAINT provider_booking_config_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: recurring_appointments recurring_appointments_appointment_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.recurring_appointments
    ADD CONSTRAINT recurring_appointments_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES tenant_default.appointment_type_config(id) ON DELETE SET NULL;


--
-- Name: recurring_appointments recurring_appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.recurring_appointments
    ADD CONSTRAINT recurring_appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: recurring_appointments recurring_appointments_provider_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.recurring_appointments
    ADD CONSTRAINT recurring_appointments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;


--
-- Name: sick_note_requests sick_note_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.sick_note_requests
    ADD CONSTRAINT sick_note_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: sick_notes sick_notes_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.sick_notes
    ADD CONSTRAINT sick_notes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES tenant_default.patients(id) ON DELETE CASCADE;


--
-- Name: vendor_transaction_log vendor_transaction_log_patient_id_fkey; Type: FK CONSTRAINT; Schema: tenant_default; Owner: -
--

ALTER TABLE ONLY tenant_default.vendor_transaction_log
    ADD CONSTRAINT vendor_transaction_log_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id);


--
-- Name: SCHEMA control; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA control TO aureoncare_app;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO aureoncare_app;


--
-- Name: SCHEMA template; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA template TO aureoncare_app;


--
-- Name: SCHEMA tenant_default; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA tenant_default TO aureoncare_app;


--
-- Name: FUNCTION forget_booking_slug(p_slug character varying, p_tenant_id uuid); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.forget_booking_slug(p_slug character varying, p_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION control.forget_booking_slug(p_slug character varying, p_tenant_id uuid) TO aureoncare_app;


--
-- Name: FUNCTION forget_portal_identity(p_email_hmac character, p_tenant_id uuid); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.forget_portal_identity(p_email_hmac character, p_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION control.forget_portal_identity(p_email_hmac character, p_tenant_id uuid) TO aureoncare_app;


--
-- Name: FUNCTION forget_portal_invite(p_token_hash character); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.forget_portal_invite(p_token_hash character) FROM PUBLIC;
GRANT ALL ON FUNCTION control.forget_portal_invite(p_token_hash character) TO aureoncare_app;


--
-- Name: FUNCTION forget_portal_session(p_token_hash character); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.forget_portal_session(p_token_hash character) FROM PUBLIC;
GRANT ALL ON FUNCTION control.forget_portal_session(p_token_hash character) TO aureoncare_app;


--
-- Name: FUNCTION grant_tenant_access(p_schema text); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.grant_tenant_access(p_schema text) FROM PUBLIC;
GRANT ALL ON FUNCTION control.grant_tenant_access(p_schema text) TO aureoncare_app;


--
-- Name: FUNCTION provision_schema(p_dst text); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.provision_schema(p_dst text) FROM PUBLIC;
GRANT ALL ON FUNCTION control.provision_schema(p_dst text) TO aureoncare_app;


--
-- Name: FUNCTION purge_expired_portal_sessions(); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.purge_expired_portal_sessions() FROM PUBLIC;
GRANT ALL ON FUNCTION control.purge_expired_portal_sessions() TO aureoncare_app;


--
-- Name: FUNCTION register_booking_slug(p_slug character varying, p_tenant_id uuid, p_provider_id uuid); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.register_booking_slug(p_slug character varying, p_tenant_id uuid, p_provider_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION control.register_booking_slug(p_slug character varying, p_tenant_id uuid, p_provider_id uuid) TO aureoncare_app;


--
-- Name: FUNCTION register_portal_identity(p_email_hmac character, p_tenant_id uuid, p_key_version smallint); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.register_portal_identity(p_email_hmac character, p_tenant_id uuid, p_key_version smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION control.register_portal_identity(p_email_hmac character, p_tenant_id uuid, p_key_version smallint) TO aureoncare_app;


--
-- Name: FUNCTION register_portal_invite(p_token_hash character, p_tenant_id uuid, p_expires_at timestamp with time zone); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.register_portal_invite(p_token_hash character, p_tenant_id uuid, p_expires_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION control.register_portal_invite(p_token_hash character, p_tenant_id uuid, p_expires_at timestamp with time zone) TO aureoncare_app;


--
-- Name: FUNCTION register_portal_session(p_token_hash character, p_tenant_id uuid, p_expires_at timestamp with time zone); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.register_portal_session(p_token_hash character, p_tenant_id uuid, p_expires_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION control.register_portal_session(p_token_hash character, p_tenant_id uuid, p_expires_at timestamp with time zone) TO aureoncare_app;


--
-- Name: FUNCTION resolve_booking_slug(p_slug character varying); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.resolve_booking_slug(p_slug character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION control.resolve_booking_slug(p_slug character varying) TO aureoncare_app;


--
-- Name: FUNCTION resolve_portal_invite(p_token_hash character); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.resolve_portal_invite(p_token_hash character) FROM PUBLIC;
GRANT ALL ON FUNCTION control.resolve_portal_invite(p_token_hash character) TO aureoncare_app;


--
-- Name: FUNCTION resolve_portal_session(p_token_hash character); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.resolve_portal_session(p_token_hash character) FROM PUBLIC;
GRANT ALL ON FUNCTION control.resolve_portal_session(p_token_hash character) TO aureoncare_app;


--
-- Name: FUNCTION resolve_portal_tenants(p_email_hmac character); Type: ACL; Schema: control; Owner: -
--

REVOKE ALL ON FUNCTION control.resolve_portal_tenants(p_email_hmac character) FROM PUBLIC;
GRANT ALL ON FUNCTION control.resolve_portal_tenants(p_email_hmac character) TO aureoncare_app;


--
-- Name: TABLE audit_log; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,INSERT ON TABLE control.audit_log TO aureoncare_app;


--
-- Name: SEQUENCE audit_log_id_seq; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE control.audit_log_id_seq TO aureoncare_app;


--
-- Name: TABLE billing_events; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE control.billing_events TO aureoncare_app;


--
-- Name: SEQUENCE billing_events_id_seq; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE control.billing_events_id_seq TO aureoncare_app;


--
-- Name: TABLE break_glass_sessions; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE control.break_glass_sessions TO aureoncare_app;


--
-- Name: TABLE config_baseline; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE control.config_baseline TO aureoncare_app;


--
-- Name: TABLE operators; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT ON TABLE control.operators TO aureoncare_app;


--
-- Name: COLUMN operators.last_login; Type: ACL; Schema: control; Owner: -
--

GRANT UPDATE(last_login) ON TABLE control.operators TO aureoncare_app;


--
-- Name: TABLE platform_notifications; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE control.platform_notifications TO aureoncare_app;


--
-- Name: SEQUENCE platform_notifications_id_seq; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE control.platform_notifications_id_seq TO aureoncare_app;


--
-- Name: TABLE signup_intents; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE control.signup_intents TO aureoncare_app;


--
-- Name: TABLE subscription_grants; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE control.subscription_grants TO aureoncare_app;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE control.subscriptions TO aureoncare_app;


--
-- Name: TABLE tenant_tables; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE control.tenant_tables TO aureoncare_app;


--
-- Name: TABLE tenants; Type: ACL; Schema: control; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE control.tenants TO aureoncare_app;


--
-- Name: SEQUENCE account_ap_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.account_ap_seq TO aureoncare_app;


--
-- Name: SEQUENCE account_ar_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.account_ar_seq TO aureoncare_app;


--
-- Name: TABLE account_backups; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_backups TO aureoncare_app;


--
-- Name: SEQUENCE account_je_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.account_je_seq TO aureoncare_app;


--
-- Name: SEQUENCE account_rec_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.account_rec_seq TO aureoncare_app;


--
-- Name: SEQUENCE account_stm_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.account_stm_seq TO aureoncare_app;


--
-- Name: SEQUENCE accounts_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.accounts_seq TO aureoncare_app;


--
-- Name: TABLE archive_metadata; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.archive_metadata TO aureoncare_app;


--
-- Name: TABLE billing_coupons; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_coupons TO aureoncare_app;


--
-- Name: TABLE billing_invoice_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_invoice_items TO aureoncare_app;


--
-- Name: TABLE billing_invoices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_invoices TO aureoncare_app;


--
-- Name: TABLE billing_payments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_payments TO aureoncare_app;


--
-- Name: TABLE billing_quote_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_quote_items TO aureoncare_app;


--
-- Name: TABLE billing_quotes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_quotes TO aureoncare_app;


--
-- Name: TABLE directory_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.directory_events TO aureoncare_app;


--
-- Name: SEQUENCE directory_events_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.directory_events_id_seq TO aureoncare_app;


--
-- Name: TABLE drug_interactions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.drug_interactions TO aureoncare_app;


--
-- Name: SEQUENCE inventory_item_number_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.inventory_item_number_seq TO aureoncare_app;


--
-- Name: SEQUENCE inventory_movement_number_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.inventory_movement_number_seq TO aureoncare_app;


--
-- Name: SEQUENCE inventory_po_number_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.inventory_po_number_seq TO aureoncare_app;


--
-- Name: TABLE inventory_purchase_order_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_purchase_order_lines TO aureoncare_app;


--
-- Name: SEQUENCE inventory_supplier_number_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.inventory_supplier_number_seq TO aureoncare_app;


--
-- Name: TABLE join_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.join_requests TO aureoncare_app;


--
-- Name: TABLE license_keys; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.license_keys TO aureoncare_app;


--
-- Name: TABLE login_lockouts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.login_lockouts TO aureoncare_app;


--
-- Name: TABLE medical_codes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.medical_codes TO aureoncare_app;


--
-- Name: TABLE medication_alternatives; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.medication_alternatives TO aureoncare_app;


--
-- Name: TABLE medications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.medications TO aureoncare_app;


--
-- Name: TABLE memberships; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.memberships TO aureoncare_app;


--
-- Name: TABLE message_attachments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.message_attachments TO aureoncare_app;


--
-- Name: TABLE message_read_receipts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.message_read_receipts TO aureoncare_app;


--
-- Name: TABLE message_thread_participants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.message_thread_participants TO aureoncare_app;


--
-- Name: TABLE message_threads; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.message_threads TO aureoncare_app;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.messages TO aureoncare_app;


--
-- Name: TABLE mobile_oauth_flows; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.mobile_oauth_flows TO aureoncare_app;


--
-- Name: TABLE organization_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization_settings TO aureoncare_app;


--
-- Name: SEQUENCE organization_settings_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.organization_settings_id_seq TO aureoncare_app;


--
-- Name: TABLE permissions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.permissions TO aureoncare_app;


--
-- Name: SEQUENCE permissions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.permissions_id_seq TO aureoncare_app;


--
-- Name: TABLE practice_domains; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.practice_domains TO aureoncare_app;


--
-- Name: TABLE practice_profile_photos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.practice_profile_photos TO aureoncare_app;


--
-- Name: TABLE practice_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.practice_profiles TO aureoncare_app;


--
-- Name: TABLE practices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.practices TO aureoncare_app;


--
-- Name: TABLE provider_listing_consents; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.provider_listing_consents TO aureoncare_app;


--
-- Name: TABLE providers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.providers TO aureoncare_app;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.role_permissions TO aureoncare_app;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.roles TO aureoncare_app;


--
-- Name: SEQUENCE roles_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.roles_id_seq TO aureoncare_app;



--
-- Name: TABLE short_links; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.short_links TO aureoncare_app;


--
-- Name: TABLE social_auth; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.social_auth TO aureoncare_app;


--
-- Name: TABLE specialties; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.specialties TO aureoncare_app;


--
-- Name: TABLE specialty_packs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.specialty_packs TO aureoncare_app;


--
-- Name: TABLE staff_invites; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.staff_invites TO aureoncare_app;


--
-- Name: TABLE stripe_integration_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stripe_integration_settings TO aureoncare_app;


--
-- Name: TABLE subscription_plans; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.subscription_plans TO aureoncare_app;


--
-- Name: SEQUENCE subscription_plans_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.subscription_plans_id_seq TO aureoncare_app;


--
-- Name: TABLE user_role_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_role_history TO aureoncare_app;


--
-- Name: SEQUENCE user_role_history_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.user_role_history_id_seq TO aureoncare_app;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_roles TO aureoncare_app;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO aureoncare_app;


--
-- Name: TABLE fhir_error_actions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.fhir_error_actions TO aureoncare_app;


--
-- Name: TABLE fhir_tracking; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.fhir_tracking TO aureoncare_app;


--
-- Name: TABLE v_fhir_tracking_errors; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_fhir_tracking_errors TO aureoncare_app;


--
-- Name: TABLE fhir_tracking_events; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.fhir_tracking_events TO aureoncare_app;


--
-- Name: TABLE v_fhir_tracking_timeline; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_fhir_tracking_timeline TO aureoncare_app;


--
-- Name: TABLE lab_orders; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.lab_orders TO aureoncare_app;


--
-- Name: TABLE v_lab_order_tracking; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_lab_order_tracking TO aureoncare_app;


--
-- Name: TABLE prescriptions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.prescriptions TO aureoncare_app;


--
-- Name: TABLE v_prescription_tracking; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_prescription_tracking TO aureoncare_app;


--
-- Name: TABLE account_ar_aging_snapshots; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.account_ar_aging_snapshots TO aureoncare_app;


--
-- Name: TABLE account_journal_entries; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.account_journal_entries TO aureoncare_app;


--
-- Name: TABLE account_journal_lines; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.account_journal_lines TO aureoncare_app;


--
-- Name: TABLE account_payables; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.account_payables TO aureoncare_app;


--
-- Name: TABLE account_receivables; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.account_receivables TO aureoncare_app;


--
-- Name: TABLE account_reconciliation_items; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.account_reconciliation_items TO aureoncare_app;


--
-- Name: TABLE account_reconciliations; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.account_reconciliations TO aureoncare_app;


--
-- Name: TABLE account_role_permissions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.account_role_permissions TO aureoncare_app;


--
-- Name: TABLE account_statement_items; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.account_statement_items TO aureoncare_app;


--
-- Name: TABLE account_statements; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.account_statements TO aureoncare_app;


--
-- Name: TABLE accounts; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.accounts TO aureoncare_app;


--
-- Name: TABLE ai_feature_settings; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.ai_feature_settings TO aureoncare_app;


--
-- Name: TABLE ai_phi_token_map; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.ai_phi_token_map TO aureoncare_app;


--
-- Name: TABLE ai_provider_credentials; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.ai_provider_credentials TO aureoncare_app;


--
-- Name: TABLE ai_requests; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.ai_requests TO aureoncare_app;


--
-- Name: TABLE ai_suggestions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.ai_suggestions TO aureoncare_app;


--
-- Name: TABLE appointment_reminders; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.appointment_reminders TO aureoncare_app;


--
-- Name: TABLE appointment_type_config; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.appointment_type_config TO aureoncare_app;


--
-- Name: TABLE appointment_types; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.appointment_types TO aureoncare_app;


--
-- Name: SEQUENCE appointment_types_id_seq; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE tenant_default.appointment_types_id_seq TO aureoncare_app;


--
-- Name: TABLE appointment_types; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.appointment_types TO aureoncare_app;


--
-- Name: TABLE appointment_waitlist; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.appointment_waitlist TO aureoncare_app;


--
-- Name: TABLE appointments; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.appointments TO aureoncare_app;


--
-- Name: TABLE archive_rules; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.archive_rules TO aureoncare_app;


--
-- Name: TABLE archives; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.archives TO aureoncare_app;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.audit_logs TO aureoncare_app;


--
-- Name: TABLE backup_provider_settings; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.backup_provider_settings TO aureoncare_app;


--
-- Name: SEQUENCE backup_provider_settings_id_seq; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE tenant_default.backup_provider_settings_id_seq TO aureoncare_app;


--
-- Name: TABLE backup_provider_settings; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.backup_provider_settings TO aureoncare_app;


--
-- Name: TABLE booking_analytics; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.booking_analytics TO aureoncare_app;


--
-- Name: TABLE camp_inventory_allocations; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.camp_inventory_allocations TO aureoncare_app;


--
-- Name: TABLE camp_registrations; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.camp_registrations TO aureoncare_app;


--
-- Name: TABLE camp_services; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.camp_services TO aureoncare_app;


--
-- Name: TABLE camp_staff; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.camp_staff TO aureoncare_app;


--
-- Name: TABLE camp_station_visits; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.camp_station_visits TO aureoncare_app;


--
-- Name: TABLE camp_stations; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.camp_stations TO aureoncare_app;


--
-- Name: TABLE campaigns; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.campaigns TO aureoncare_app;


--
-- Name: SEQUENCE campaigns_id_seq; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE tenant_default.campaigns_id_seq TO aureoncare_app;


--
-- Name: TABLE campaigns; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.campaigns TO aureoncare_app;


--
-- Name: TABLE camps; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.camps TO aureoncare_app;


--
-- Name: TABLE claim_submissions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.claim_submissions TO aureoncare_app;


--
-- Name: TABLE claims; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.claims TO aureoncare_app;


--
-- Name: TABLE clinic_appointment_settings; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.clinic_appointment_settings TO aureoncare_app;


--
-- Name: SEQUENCE clinic_appointment_settings_id_seq; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE tenant_default.clinic_appointment_settings_id_seq TO aureoncare_app;


--
-- Name: TABLE clinic_appointment_settings; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.clinic_appointment_settings TO aureoncare_app;


--
-- Name: TABLE clinic_info; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.clinic_info TO aureoncare_app;


--
-- Name: SEQUENCE clinic_info_id_seq; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE tenant_default.clinic_info_id_seq TO aureoncare_app;


--
-- Name: TABLE clinic_info; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.clinic_info TO aureoncare_app;


--
-- Name: TABLE clinic_working_hours; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.clinic_working_hours TO aureoncare_app;


--
-- Name: SEQUENCE clinic_working_hours_id_seq; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE tenant_default.clinic_working_hours_id_seq TO aureoncare_app;


--
-- Name: TABLE clinic_working_hours; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.clinic_working_hours TO aureoncare_app;


--
-- Name: TABLE denials; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.denials TO aureoncare_app;


--
-- Name: TABLE diagnoses; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.diagnoses TO aureoncare_app;


--
-- Name: TABLE diagnosis; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.diagnosis TO aureoncare_app;


--
-- Name: TABLE doctor_availability; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.doctor_availability TO aureoncare_app;


--
-- Name: TABLE doctor_time_off; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.doctor_time_off TO aureoncare_app;


--
-- Name: TABLE eligibility_checks; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.eligibility_checks TO aureoncare_app;


--
-- Name: TABLE erx_message_queue; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.erx_message_queue TO aureoncare_app;


--
-- Name: TABLE fhir_error_actions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.fhir_error_actions TO aureoncare_app;


--
-- Name: TABLE fhir_resources; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.fhir_resources TO aureoncare_app;


--
-- Name: TABLE fhir_tracking; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.fhir_tracking TO aureoncare_app;


--
-- Name: TABLE fhir_tracking_events; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.fhir_tracking_events TO aureoncare_app;


--
-- Name: TABLE form_audit_logs; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.form_audit_logs TO aureoncare_app;


--
-- Name: TABLE form_categories; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.form_categories TO aureoncare_app;


--
-- Name: TABLE form_signatures; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.form_signatures TO aureoncare_app;


--
-- Name: TABLE form_submissions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.form_submissions TO aureoncare_app;


--
-- Name: TABLE form_template_versions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.form_template_versions TO aureoncare_app;


--
-- Name: TABLE form_templates; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.form_templates TO aureoncare_app;


--
-- Name: TABLE healthcare_offerings; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.healthcare_offerings TO aureoncare_app;


--
-- Name: TABLE insurance_payers; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.insurance_payers TO aureoncare_app;


--
-- Name: TABLE intake_flow_templates; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.intake_flow_templates TO aureoncare_app;


--
-- Name: TABLE inventory_categories; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.inventory_categories TO aureoncare_app;


--
-- Name: TABLE inventory_items; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.inventory_items TO aureoncare_app;


--
-- Name: TABLE inventory_purchase_orders; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.inventory_purchase_orders TO aureoncare_app;


--
-- Name: TABLE inventory_role_permissions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.inventory_role_permissions TO aureoncare_app;


--
-- Name: TABLE inventory_stock_movements; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.inventory_stock_movements TO aureoncare_app;


--
-- Name: TABLE inventory_suppliers; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.inventory_suppliers TO aureoncare_app;


--
-- Name: TABLE lab_orders; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.lab_orders TO aureoncare_app;


--
-- Name: TABLE laboratories; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.laboratories TO aureoncare_app;


--
-- Name: TABLE locations; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.locations TO aureoncare_app;


--
-- Name: TABLE medical_records; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.medical_records TO aureoncare_app;


--
-- Name: TABLE module_permissions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.module_permissions TO aureoncare_app;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.notification_preferences TO aureoncare_app;


--
-- Name: SEQUENCE notification_preferences_id_seq; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE tenant_default.notification_preferences_id_seq TO aureoncare_app;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.notification_preferences TO aureoncare_app;


--
-- Name: TABLE notifications; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.notifications TO aureoncare_app;


--
-- Name: SEQUENCE notifications_id_seq; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE tenant_default.notifications_id_seq TO aureoncare_app;


--
-- Name: TABLE notifications; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.notifications TO aureoncare_app;


--
-- Name: TABLE offering_form_links; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.offering_form_links TO aureoncare_app;


--
-- Name: TABLE offering_insurance_mappings; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.offering_insurance_mappings TO aureoncare_app;


--
-- Name: TABLE offering_packages; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.offering_packages TO aureoncare_app;


--
-- Name: TABLE offering_pricing; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.offering_pricing TO aureoncare_app;


--
-- Name: TABLE offering_promotions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.offering_promotions TO aureoncare_app;


--
-- Name: TABLE offering_reviews; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.offering_reviews TO aureoncare_app;


--
-- Name: TABLE package_offerings; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.package_offerings TO aureoncare_app;


--
-- Name: TABLE patient_allergies; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.patient_allergies TO aureoncare_app;


--
-- Name: TABLE patient_consent_forms; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.patient_consent_forms TO aureoncare_app;


--
-- Name: TABLE patient_intake_flows; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.patient_intake_flows TO aureoncare_app;


--
-- Name: TABLE patient_intake_forms; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.patient_intake_forms TO aureoncare_app;


--
-- Name: TABLE patient_offering_enrollments; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.patient_offering_enrollments TO aureoncare_app;


--
-- Name: TABLE patient_pharmacies; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.patient_pharmacies TO aureoncare_app;


--
-- Name: TABLE patient_portal_sessions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.patient_portal_sessions TO aureoncare_app;


--
-- Name: TABLE patients; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.patients TO aureoncare_app;


--
-- Name: TABLE payment_postings; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.payment_postings TO aureoncare_app;


--
-- Name: TABLE payments; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.payments TO aureoncare_app;


--
-- Name: TABLE pharmacies; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.pharmacies TO aureoncare_app;


--
-- Name: TABLE portal_invites; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.portal_invites TO aureoncare_app;


--
-- Name: TABLE preapprovals; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.preapprovals TO aureoncare_app;


--
-- Name: TABLE prescription_history; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.prescription_history TO aureoncare_app;


--
-- Name: TABLE prescriptions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.prescriptions TO aureoncare_app;


--
-- Name: TABLE provider_booking_config; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.provider_booking_config TO aureoncare_app;


--
-- Name: TABLE recurring_appointments; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.recurring_appointments TO aureoncare_app;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.schema_migrations TO aureoncare_app;


--
-- Name: TABLE service_categories; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.service_categories TO aureoncare_app;


--
-- Name: TABLE sick_note_requests; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.sick_note_requests TO aureoncare_app;


--
-- Name: TABLE sick_notes; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.sick_notes TO aureoncare_app;


--
-- Name: TABLE staff_notification_preferences; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.staff_notification_preferences TO aureoncare_app;


--
-- Name: TABLE tasks; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.tasks TO aureoncare_app;


--
-- Name: SEQUENCE tasks_id_seq; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE tenant_default.tasks_id_seq TO aureoncare_app;


--
-- Name: TABLE tasks; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.tasks TO aureoncare_app;


--
-- Name: TABLE telehealth_provider_settings; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.telehealth_provider_settings TO aureoncare_app;


--
-- Name: SEQUENCE telehealth_provider_settings_id_seq; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE tenant_default.telehealth_provider_settings_id_seq TO aureoncare_app;


--
-- Name: TABLE telehealth_provider_settings; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.telehealth_provider_settings TO aureoncare_app;


--
-- Name: TABLE telehealth_sessions; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.telehealth_sessions TO aureoncare_app;


--
-- Name: TABLE vendor_integration_settings; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.vendor_integration_settings TO aureoncare_app;


--
-- Name: TABLE vendor_transaction_log; Type: ACL; Schema: template; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE template.vendor_transaction_log TO aureoncare_app;


--
-- Name: TABLE account_ar_aging_snapshots; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.account_ar_aging_snapshots TO aureoncare_app;


--
-- Name: TABLE account_journal_entries; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.account_journal_entries TO aureoncare_app;


--
-- Name: TABLE account_journal_lines; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.account_journal_lines TO aureoncare_app;


--
-- Name: TABLE account_payables; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.account_payables TO aureoncare_app;


--
-- Name: TABLE account_receivables; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.account_receivables TO aureoncare_app;


--
-- Name: TABLE account_reconciliation_items; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.account_reconciliation_items TO aureoncare_app;


--
-- Name: TABLE account_reconciliations; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.account_reconciliations TO aureoncare_app;


--
-- Name: TABLE account_role_permissions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.account_role_permissions TO aureoncare_app;


--
-- Name: TABLE account_statement_items; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.account_statement_items TO aureoncare_app;


--
-- Name: TABLE account_statements; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.account_statements TO aureoncare_app;


--
-- Name: TABLE accounts; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.accounts TO aureoncare_app;


--
-- Name: TABLE ai_feature_settings; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.ai_feature_settings TO aureoncare_app;


--
-- Name: TABLE ai_phi_token_map; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.ai_phi_token_map TO aureoncare_app;


--
-- Name: TABLE ai_provider_credentials; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.ai_provider_credentials TO aureoncare_app;


--
-- Name: TABLE ai_requests; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.ai_requests TO aureoncare_app;


--
-- Name: TABLE ai_suggestions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.ai_suggestions TO aureoncare_app;


--
-- Name: TABLE appointment_reminders; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.appointment_reminders TO aureoncare_app;


--
-- Name: TABLE appointment_type_config; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.appointment_type_config TO aureoncare_app;


--
-- Name: TABLE appointment_waitlist; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.appointment_waitlist TO aureoncare_app;


--
-- Name: TABLE appointments; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.appointments TO aureoncare_app;


--
-- Name: TABLE archive_rules; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.archive_rules TO aureoncare_app;


--
-- Name: TABLE archives; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.archives TO aureoncare_app;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.audit_logs TO aureoncare_app;


--
-- Name: TABLE booking_analytics; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.booking_analytics TO aureoncare_app;


--
-- Name: TABLE camp_inventory_allocations; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.camp_inventory_allocations TO aureoncare_app;


--
-- Name: TABLE camp_registrations; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.camp_registrations TO aureoncare_app;


--
-- Name: TABLE camp_services; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.camp_services TO aureoncare_app;


--
-- Name: TABLE camp_staff; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.camp_staff TO aureoncare_app;


--
-- Name: TABLE camp_station_visits; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.camp_station_visits TO aureoncare_app;


--
-- Name: TABLE camp_stations; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.camp_stations TO aureoncare_app;


--
-- Name: TABLE camps; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.camps TO aureoncare_app;


--
-- Name: TABLE claim_submissions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.claim_submissions TO aureoncare_app;


--
-- Name: TABLE claims; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.claims TO aureoncare_app;


--
-- Name: TABLE denials; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.denials TO aureoncare_app;


--
-- Name: TABLE diagnoses; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.diagnoses TO aureoncare_app;


--
-- Name: TABLE diagnosis; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.diagnosis TO aureoncare_app;


--
-- Name: TABLE doctor_availability; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.doctor_availability TO aureoncare_app;


--
-- Name: TABLE doctor_time_off; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.doctor_time_off TO aureoncare_app;


--
-- Name: TABLE eligibility_checks; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.eligibility_checks TO aureoncare_app;


--
-- Name: TABLE erx_message_queue; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.erx_message_queue TO aureoncare_app;


--
-- Name: TABLE fhir_resources; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.fhir_resources TO aureoncare_app;


--
-- Name: TABLE form_audit_logs; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.form_audit_logs TO aureoncare_app;


--
-- Name: TABLE form_categories; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.form_categories TO aureoncare_app;


--
-- Name: TABLE form_signatures; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.form_signatures TO aureoncare_app;


--
-- Name: TABLE form_submissions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.form_submissions TO aureoncare_app;


--
-- Name: TABLE form_template_versions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.form_template_versions TO aureoncare_app;


--
-- Name: TABLE form_templates; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.form_templates TO aureoncare_app;


--
-- Name: TABLE healthcare_offerings; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.healthcare_offerings TO aureoncare_app;


--
-- Name: TABLE insurance_payers; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.insurance_payers TO aureoncare_app;


--
-- Name: TABLE intake_flow_templates; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.intake_flow_templates TO aureoncare_app;


--
-- Name: TABLE inventory_categories; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.inventory_categories TO aureoncare_app;


--
-- Name: TABLE inventory_items; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.inventory_items TO aureoncare_app;


--
-- Name: TABLE inventory_purchase_orders; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.inventory_purchase_orders TO aureoncare_app;


--
-- Name: TABLE inventory_role_permissions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.inventory_role_permissions TO aureoncare_app;


--
-- Name: TABLE inventory_stock_movements; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.inventory_stock_movements TO aureoncare_app;


--
-- Name: TABLE inventory_suppliers; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.inventory_suppliers TO aureoncare_app;


--
-- Name: TABLE laboratories; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.laboratories TO aureoncare_app;


--
-- Name: TABLE locations; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.locations TO aureoncare_app;


--
-- Name: TABLE medical_records; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.medical_records TO aureoncare_app;


--
-- Name: TABLE module_permissions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.module_permissions TO aureoncare_app;


--
-- Name: TABLE offering_form_links; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.offering_form_links TO aureoncare_app;


--
-- Name: TABLE offering_insurance_mappings; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.offering_insurance_mappings TO aureoncare_app;


--
-- Name: TABLE offering_packages; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.offering_packages TO aureoncare_app;


--
-- Name: TABLE offering_pricing; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.offering_pricing TO aureoncare_app;


--
-- Name: TABLE offering_promotions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.offering_promotions TO aureoncare_app;


--
-- Name: TABLE offering_reviews; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.offering_reviews TO aureoncare_app;


--
-- Name: TABLE package_offerings; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.package_offerings TO aureoncare_app;


--
-- Name: TABLE patient_allergies; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.patient_allergies TO aureoncare_app;


--
-- Name: TABLE patient_consent_forms; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.patient_consent_forms TO aureoncare_app;


--
-- Name: TABLE patient_intake_flows; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.patient_intake_flows TO aureoncare_app;


--
-- Name: TABLE patient_intake_forms; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.patient_intake_forms TO aureoncare_app;


--
-- Name: TABLE patient_offering_enrollments; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.patient_offering_enrollments TO aureoncare_app;


--
-- Name: TABLE patient_pharmacies; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.patient_pharmacies TO aureoncare_app;


--
-- Name: TABLE patient_portal_sessions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.patient_portal_sessions TO aureoncare_app;


--
-- Name: TABLE patients; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.patients TO aureoncare_app;


--
-- Name: TABLE payment_postings; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.payment_postings TO aureoncare_app;


--
-- Name: TABLE payments; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.payments TO aureoncare_app;


--
-- Name: TABLE pharmacies; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.pharmacies TO aureoncare_app;


--
-- Name: TABLE portal_invites; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.portal_invites TO aureoncare_app;


--
-- Name: TABLE preapprovals; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.preapprovals TO aureoncare_app;


--
-- Name: TABLE prescription_history; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.prescription_history TO aureoncare_app;


--
-- Name: TABLE provider_booking_config; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.provider_booking_config TO aureoncare_app;


--
-- Name: TABLE recurring_appointments; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.recurring_appointments TO aureoncare_app;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.schema_migrations TO aureoncare_app;


--
-- Name: TABLE service_categories; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.service_categories TO aureoncare_app;


--
-- Name: TABLE sick_note_requests; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.sick_note_requests TO aureoncare_app;


--
-- Name: TABLE sick_notes; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.sick_notes TO aureoncare_app;


--
-- Name: TABLE staff_notification_preferences; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.staff_notification_preferences TO aureoncare_app;


--
-- Name: TABLE telehealth_sessions; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.telehealth_sessions TO aureoncare_app;


--
-- Name: TABLE vendor_integration_settings; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.vendor_integration_settings TO aureoncare_app;


--
-- Name: TABLE vendor_transaction_log; Type: ACL; Schema: tenant_default; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE tenant_default.vendor_transaction_log TO aureoncare_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: control; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE ci_pg IN SCHEMA control GRANT SELECT,USAGE ON SEQUENCES TO aureoncare_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: control; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE ci_pg IN SCHEMA control GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO aureoncare_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE ci_pg IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO aureoncare_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE ci_pg IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO aureoncare_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: template; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE ci_pg IN SCHEMA template GRANT SELECT,USAGE ON SEQUENCES TO aureoncare_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: template; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE ci_pg IN SCHEMA template GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO aureoncare_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: tenant_default; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE ci_pg IN SCHEMA tenant_default GRANT SELECT,USAGE ON SEQUENCES TO aureoncare_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: tenant_default; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE ci_pg IN SCHEMA tenant_default GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO aureoncare_app;


--
-- PostgreSQL database dump complete
--



-- The ledger is created by the runner; give the application role the access 073 gave it.
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.schema_migrations TO aureoncare_app;
