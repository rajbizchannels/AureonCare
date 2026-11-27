-- Migration 111: secure messages and purchase-order lines per practice.
--
-- message_threads, messages, message_attachments, message_thread_participants and
-- message_read_receipts, and inventory_purchase_order_lines, were shared tables in public with no
-- practice column (the same flaw migration 110 fixed for billing): every practice's inbox would have
-- listed every other practice's threads, and patient threads / order lines pointed at
-- tenant_default's patients, purchase orders and items, so any other practice's messages and
-- purchase orders failed.
--
-- This creates them in every practice schema and the template, COPIES the existing rows (same ids)
-- into the practice they belong to — a thread by its patient, otherwise by the practice of the staff
-- member who started it, or, with a single practice, that practice; messages, attachments,
-- participants and receipts follow their thread; order lines follow their purchase order — then
-- re-points the chart's links to messages (form_submissions, medical_records) at the practice's own
-- tables. The shared tables are dropped only when every row has been copied; otherwise they stay and
-- a NOTICE says how many rows are left.
--
-- Also: billing_payments.refunded_amount, for refunds made in a practice's Stripe dashboard (the
-- Connect webhook's charge.refunded).
--
-- Safe to paste into the Supabase SQL editor as postgres, and to re-run. The tenant runner's
-- equivalent is tenant/021_messages_per_practice.sql.

SET search_path TO public;

INSERT INTO control.tenant_tables (table_name, sort_order) VALUES
  ('message_threads', 590), ('messages', 591), ('message_attachments', 592),
  ('message_thread_participants', 593), ('message_read_receipts', 594), ('inventory_purchase_order_lines', 595)
ON CONFLICT (table_name) DO NOTHING;

DO $fan$
DECLARE s text; c record; done int := 0; skipped int := 0;
  single text := (SELECT CASE WHEN count(*) = 1 THEN min(schema_name) END FROM control.tenants);
BEGIN
  FOR s IN SELECT 'template'::text UNION ALL SELECT schema_name FROM control.tenants ORDER BY 1 LOOP
    IF to_regclass(format('%I.patients', s)) IS NULL THEN skipped := skipped + 1; CONTINUE; END IF;
    EXECUTE format('SET search_path TO %I, public', s);
    EXECUTE $ddl$
CREATE TABLE IF NOT EXISTS message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject varchar(255) NOT NULL,
  thread_type varchar(20) NOT NULL DEFAULT 'care_team' CHECK (thread_type IN ('care_team', 'patient')),
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  priority varchar(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by_kind varchar(10) NOT NULL CHECK (created_by_kind IN ('user', 'patient')),
  created_by_id uuid NOT NULL,
  last_message_at timestamp DEFAULT CURRENT_TIMESTAMP,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_kind varchar(10) NOT NULL CHECK (sender_kind IN ('user', 'patient', 'system')),
  sender_id uuid,
  message_type varchar(20) NOT NULL DEFAULT 'message' CHECK (message_type IN ('message', 'system')),
  body_ciphertext text NOT NULL,
  body_iv varchar(32) NOT NULL,
  body_tag varchar(32) NOT NULL,
  key_version smallint NOT NULL DEFAULT 1,
  sent_at timestamp DEFAULT CURRENT_TIMESTAMP,
  edited_at timestamp,
  deleted_at timestamp,
  deleted_by_kind varchar(10) CHECK (deleted_by_kind IN ('user', 'patient')),
  deleted_by_id uuid
);
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name varchar(255) NOT NULL,
  mime_type varchar(127),
  size_bytes bigint NOT NULL,
  content_ciphertext text NOT NULL,
  content_iv varchar(32) NOT NULL,
  content_tag varchar(32) NOT NULL,
  key_version smallint NOT NULL DEFAULT 1,
  uploaded_at timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS message_thread_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  participant_kind varchar(10) NOT NULL CHECK (participant_kind IN ('user', 'patient')),
  participant_id uuid NOT NULL,
  participant_role varchar(20) NOT NULL DEFAULT 'member' CHECK (participant_role IN ('owner', 'member')),
  last_read_at timestamp,
  is_active boolean NOT NULL DEFAULT true,
  added_at timestamp DEFAULT CURRENT_TIMESTAMP,
  removed_at timestamp,
  UNIQUE (thread_id, participant_kind, participant_id)
);
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reader_kind varchar(10) NOT NULL CHECK (reader_kind IN ('user', 'patient')),
  reader_id uuid NOT NULL,
  read_at timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (message_id, reader_kind, reader_id)
);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message ON message_threads (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_threads_patient ON message_threads (patient_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_status ON message_threads (status);
CREATE INDEX IF NOT EXISTS idx_message_threads_type ON message_threads (thread_type);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_kind, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (thread_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments (message_id);
CREATE INDEX IF NOT EXISTS idx_thread_participants_lookup ON message_thread_participants (participant_kind, participant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_thread_participants_thread ON message_thread_participants (thread_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message ON message_read_receipts (message_id);

-- Refunds made in the practice's Stripe dashboard (Connect webhook charge.refunded).
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_billing_payments_stripe_intent ON billing_payments (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
$ddl$;
    IF to_regclass(format('%I.inventory_purchase_orders', s)) IS NOT NULL AND to_regclass(format('%I.inventory_items', s)) IS NOT NULL THEN
      EXECUTE $ddl$
CREATE TABLE IF NOT EXISTS inventory_purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id),
  line_number integer NOT NULL CHECK (line_number > 0),
  quantity_ordered numeric(12,3) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received numeric(12,3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost numeric(15,2) NOT NULL CHECK (unit_cost >= 0),
  line_total numeric(15,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
  lot_number varchar(50),
  expiry_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (po_id, line_number)
);
CREATE INDEX IF NOT EXISTS idx_inv_pol_item ON inventory_purchase_order_lines (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_pol_po_id ON inventory_purchase_order_lines (po_id);
$ddl$;
    END IF;

    IF s <> 'template' THEN
      -- Copy this practice's rows (same ids). The thread trigger is added after the copy, so copied
      -- messages are not counted twice.
      EXECUTE 'DROP TRIGGER IF EXISTS trg_touch_message_thread ON messages';
      IF to_regclass('public.message_threads') IS NOT NULL THEN
        EXECUTE format($q$INSERT INTO %1$I.message_threads (id, subject, thread_type, patient_id, priority, status, created_by_kind, created_by_id, last_message_at, message_count, created_at, updated_at) SELECT x.id, x.subject, x.thread_type, x.patient_id, x.priority, x.status, x.created_by_kind, x.created_by_id, x.last_message_at, x.message_count, x.created_at, x.updated_at FROM public.message_threads x
           WHERE (x.patient_id IS NOT NULL AND EXISTS (SELECT 1 FROM %1$I.patients p WHERE p.id = x.patient_id))
              OR (x.patient_id IS NULL AND x.created_by_kind = 'user' AND EXISTS (SELECT 1 FROM public.users u
                    JOIN control.tenants ct ON ct.practice_id = u.practice_id WHERE u.id = x.created_by_id AND ct.schema_name = %1$L))
              OR (%2$L IS NOT NULL AND %1$L = %2$L AND (x.patient_id IS NULL OR EXISTS (SELECT 1 FROM %1$I.patients p WHERE p.id = x.patient_id)))
           ON CONFLICT DO NOTHING$q$, s, single);
      END IF;
      IF to_regclass('public.messages') IS NOT NULL THEN
        EXECUTE format($q$INSERT INTO %1$I.messages (id, thread_id, sender_kind, sender_id, message_type, body_ciphertext, body_iv, body_tag, key_version, sent_at, edited_at, deleted_at, deleted_by_kind, deleted_by_id) SELECT x.id, x.thread_id, x.sender_kind, x.sender_id, x.message_type, x.body_ciphertext, x.body_iv, x.body_tag, x.key_version, x.sent_at, x.edited_at, x.deleted_at, x.deleted_by_kind, x.deleted_by_id FROM public.messages x
           WHERE x.thread_id IN (SELECT id FROM %1$I.message_threads) ON CONFLICT DO NOTHING$q$, s);
      END IF;
      IF to_regclass('public.message_attachments') IS NOT NULL THEN
        EXECUTE format($q$INSERT INTO %1$I.message_attachments (id, message_id, file_name, mime_type, size_bytes, content_ciphertext, content_iv, content_tag, key_version, uploaded_at) SELECT x.id, x.message_id, x.file_name, x.mime_type, x.size_bytes, x.content_ciphertext, x.content_iv, x.content_tag, x.key_version, x.uploaded_at FROM public.message_attachments x
           WHERE x.message_id IN (SELECT id FROM %1$I.messages) ON CONFLICT DO NOTHING$q$, s);
      END IF;
      IF to_regclass('public.message_thread_participants') IS NOT NULL THEN
        EXECUTE format($q$INSERT INTO %1$I.message_thread_participants (id, thread_id, participant_kind, participant_id, participant_role, last_read_at, is_active, added_at, removed_at) SELECT x.id, x.thread_id, x.participant_kind, x.participant_id, x.participant_role, x.last_read_at, x.is_active, x.added_at, x.removed_at FROM public.message_thread_participants x
           WHERE x.thread_id IN (SELECT id FROM %1$I.message_threads) ON CONFLICT DO NOTHING$q$, s);
      END IF;
      IF to_regclass('public.message_read_receipts') IS NOT NULL THEN
        EXECUTE format($q$INSERT INTO %1$I.message_read_receipts (id, message_id, reader_kind, reader_id, read_at) SELECT x.id, x.message_id, x.reader_kind, x.reader_id, x.read_at FROM public.message_read_receipts x
           WHERE x.message_id IN (SELECT id FROM %1$I.messages) ON CONFLICT DO NOTHING$q$, s);
      END IF;
      IF to_regclass('public.inventory_purchase_order_lines') IS NOT NULL AND to_regclass(format('%I.inventory_purchase_order_lines', s)) IS NOT NULL THEN
        EXECUTE format($q$INSERT INTO %1$I.inventory_purchase_order_lines (id, po_id, item_id, line_number, quantity_ordered, quantity_received, unit_cost, lot_number, expiry_date, notes, created_at) SELECT x.id, x.po_id, x.item_id, x.line_number, x.quantity_ordered, x.quantity_received, x.unit_cost, x.lot_number, x.expiry_date, x.notes, x.created_at FROM public.inventory_purchase_order_lines x
           WHERE x.po_id IN (SELECT id FROM %1$I.inventory_purchase_orders) AND x.item_id IN (SELECT id FROM %1$I.inventory_items)
           ON CONFLICT DO NOTHING$q$, s);
      END IF;
    END IF;
    EXECUTE $t$DROP TRIGGER IF EXISTS trg_touch_message_thread ON messages;
CREATE TRIGGER trg_touch_message_thread AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION public.touch_message_thread();
$t$;

    -- The chart's links to messages point at this practice's own messages.
    FOR c IN SELECT con.conname, rel.relname, pg_get_constraintdef(con.oid) AS def FROM pg_constraint con
               JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
              WHERE n.nspname = s AND con.contype = 'f'
                AND con.confrelid IN (to_regclass('public.messages'), to_regclass('public.message_attachments')) LOOP
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', s, c.relname, c.conname);
      EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I ', s, c.relname, c.conname)
        || regexp_replace(c.def, 'REFERENCES (public\.)?(\w+)\(', format('REFERENCES %I.\2(', s));
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.message_threads, %I.messages, %I.message_attachments, %I.message_thread_participants, %I.message_read_receipts TO aureoncare_app', s, s, s, s, s);
      IF to_regclass(format('%I.inventory_purchase_order_lines', s)) IS NOT NULL THEN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.inventory_purchase_order_lines TO aureoncare_app', s);
      END IF;
    END IF;
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', s);
    EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (21, %L) ON CONFLICT (version) DO NOTHING', s, '021_messages_per_practice.sql');
    done := done + 1;
  END LOOP;
  SET search_path TO public;
  RAISE NOTICE '111 messages per practice: applied in % schema(s); % skipped (no patients table)', done, skipped;
END $fan$;

-- The shared copies: dropped only when every row now exists in some practice.
DO $drop$
DECLARE t text; s text; u text; n bigint; total bigint := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['message_read_receipts', 'message_attachments', 'message_thread_participants', 'messages', 'message_threads', 'inventory_purchase_order_lines'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    u := NULL;
    FOR s IN SELECT schema_name FROM control.tenants LOOP
      IF to_regclass(format('%I.%I', s, t)) IS NOT NULL THEN
        u := coalesce(u || ' UNION ALL ', '') || format('SELECT id FROM %I.%I', s, t);
      END IF;
    END LOOP;
    EXECUTE format('SELECT count(*) FROM public.%I x', t) || CASE WHEN u IS NULL THEN '' ELSE format(' WHERE x.id NOT IN (%s)', u) END INTO n;
    IF n > 0 THEN
      RAISE NOTICE 'public.% has % row(s) not matched to a practice: left in place.', t, n;
      total := total + n;
    END IF;
  END LOOP;
  IF total > 0 THEN
    RAISE NOTICE '111: the shared tables were kept. Move the rows above into the right practice schema by hand, then re-run this migration.';
    RETURN;
  END IF;
  DROP TABLE IF EXISTS public.message_read_receipts, public.message_attachments, public.message_thread_participants,
                       public.messages, public.message_threads, public.inventory_purchase_order_lines CASCADE;
  RAISE NOTICE '111: every row is in its practice; the shared tables have been dropped.';
END $drop$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('111_messages_per_practice.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
