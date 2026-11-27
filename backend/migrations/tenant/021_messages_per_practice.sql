-- DO NOT PASTE INTO THE SQL EDITOR. Tenant-runner file (npm run migrate:tenants): it runs inside each
-- practice schema with unqualified names. For production, paste the matching global migration instead.
-- Secure messages and purchase-order lines per practice. Global migration 111 does the same everywhere
-- (and copies the rows out of the old shared tables, re-points the chart's links, drops the shared
-- tables); this file is for the tenant runner.

DO $$
BEGIN
  IF to_regclass('patients') IS NULL THEN
    RAISE NOTICE '021_messages_per_practice: no patients table in schema %, skipped', current_schema();
    RETURN;
  END IF;
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
DROP TRIGGER IF EXISTS trg_touch_message_thread ON messages;
CREATE TRIGGER trg_touch_message_thread AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION public.touch_message_thread();
$ddl$;
  IF to_regclass('inventory_purchase_orders') IS NOT NULL AND to_regclass('inventory_items') IS NOT NULL THEN
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
END $$;
