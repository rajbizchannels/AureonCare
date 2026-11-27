-- Migration 110: billing per practice, and card payments through each practice's own Stripe account.
--
-- 1. Quotes, invoices, payments and coupons move into each practice's schema (and the template).
--    They were in the shared public schema with no practice column — so every practice's Billing
--    screens would have seen every other practice's records — and their patient foreign keys pointed
--    at tenant_default.patients, so invoicing any other practice's patient failed. The accounting
--    tables' links to invoices are re-pointed at the practice's own invoices. The shared copies are
--    dropped when they are empty (production had no rows); otherwise they are left and reported.
-- 2. Stripe Connect: public.practices records the practice's connected Stripe account and whether
--    it can take card payments; invoices carry their pay link; payments their Stripe references.
-- 3. The invoice, quote and payment number functions are fixed (the second number of a year failed).
--
-- Safe to paste into the Supabase SQL editor as postgres, and to re-run. The tenant runner's
-- equivalent is tenant/020_billing_per_practice.sql.

SET search_path TO public;

ALTER TABLE public.practices
  ADD COLUMN IF NOT EXISTS stripe_account_id varchar(255),
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_account_updated_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS practices_stripe_account ON public.practices (stripe_account_id) WHERE stripe_account_id IS NOT NULL;

INSERT INTO control.tenant_tables (table_name, sort_order) VALUES
  ('billing_coupons', 580), ('billing_quotes', 581), ('billing_quote_items', 582),
  ('billing_invoices', 583), ('billing_invoice_items', 584), ('billing_payments', 585)
ON CONFLICT (table_name) DO NOTHING;

DO $fan$
DECLARE s text; c record; done int := 0; skipped int := 0;
BEGIN
  FOR s IN SELECT 'template'::text UNION ALL SELECT schema_name FROM control.tenants ORDER BY 1 LOOP
    IF to_regclass(format('%I.patients', s)) IS NULL THEN skipped := skipped + 1; CONTINUE; END IF;
    EXECUTE format('SET search_path TO %I, public', s);
    EXECUTE $ddl$
CREATE TABLE IF NOT EXISTS billing_coupons (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  description text,
  discount_type varchar(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(12,2) NOT NULL,
  min_amount numeric(12,2) DEFAULT 0,
  max_discount numeric(12,2),
  usage_limit integer,
  used_count integer DEFAULT 0,
  start_date date,
  end_date date,
  is_active boolean DEFAULT true,
  applicable_offerings uuid[] DEFAULT '{}'::uuid[],
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS billing_quotes (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  quote_number varchar(50) NOT NULL UNIQUE,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status varchar(30) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted')),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
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
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS billing_quote_items (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  quote_id uuid NOT NULL REFERENCES billing_quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  discount_percent numeric(5,2) DEFAULT 0,
  total numeric(12,2) NOT NULL,
  offering_id uuid,
  diagnosis_id uuid,
  cpt_code varchar(20),
  icd_code varchar(20),
  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS billing_invoices (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  invoice_number varchar(50) NOT NULL UNIQUE,
  quote_id uuid REFERENCES billing_quotes(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status varchar(30) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded')),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
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
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS billing_invoice_items (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  invoice_id uuid NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  discount_percent numeric(5,2) DEFAULT 0,
  total numeric(12,2) NOT NULL,
  offering_id uuid,
  diagnosis_id uuid,
  cpt_code varchar(20),
  icd_code varchar(20),
  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS billing_payments (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  payment_number varchar(50) NOT NULL UNIQUE,
  invoice_id uuid REFERENCES billing_invoices(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  payment_method varchar(50) CHECK (payment_method IN ('cash', 'credit_card', 'debit_card', 'check', 'ach', 'wire', 'insurance', 'other')),
  payment_date timestamp DEFAULT now(),
  status varchar(30) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partially_refunded')),
  transaction_id varchar(200),
  reference_number varchar(200),
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_coupons_active ON billing_coupons (is_active);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_items_invoice ON billing_invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_due_date ON billing_invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_patient ON billing_invoices (patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON billing_invoices (status);
CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice ON billing_payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_patient ON billing_payments (patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_status ON billing_payments (status);
CREATE INDEX IF NOT EXISTS idx_billing_quote_items_quote ON billing_quote_items (quote_id);
CREATE INDEX IF NOT EXISTS idx_billing_quotes_patient ON billing_quotes (patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_quotes_status ON billing_quotes (status);
-- Card payments through the practice's own Stripe account (Stripe Connect, direct charges).
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS pay_link_url text;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS pay_link_session_id varchar(255);
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS pay_link_expires_at timestamptz;
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id varchar(255);
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS stripe_checkout_session_id varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS billing_payments_stripe_session ON billing_payments (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
$ddl$;
    -- Accounting rows point at this practice's own invoices.
    FOR c IN SELECT con.conname, rel.relname FROM pg_constraint con
               JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
              WHERE n.nspname = s AND rel.relname IN ('account_receivables', 'account_reconciliation_items')
                AND con.contype = 'f' AND con.confrelid = to_regclass('public.billing_invoices') LOOP
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', s, c.relname, c.conname);
      EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (invoice_id) REFERENCES %I.billing_invoices(id)', s, c.relname, c.conname, s);
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.billing_coupons, %I.billing_quotes, %I.billing_quote_items, %I.billing_invoices, %I.billing_invoice_items, %I.billing_payments TO aureoncare_app', s, s, s, s, s, s);
    END IF;
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', s);
    EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (20, %L) ON CONFLICT (version) DO NOTHING', s, '020_billing_per_practice.sql');
    done := done + 1;
  END LOOP;
  SET search_path TO public;
  RAISE NOTICE '110 billing per practice: applied in % schema(s); % skipped (no patients table)', done, skipped;
END $fan$;

-- The shared copies: dropped when empty, so nothing can write to them again.
DO $drop$
DECLARE n bigint := 0; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['billing_payments', 'billing_invoice_items', 'billing_invoices', 'billing_quote_items', 'billing_quotes', 'billing_coupons'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        RAISE NOTICE 'public.% has % row(s): left in place — move them into the right practice schemas by hand, then drop it.', t, n;
        RETURN;
      END IF;
    END IF;
  END LOOP;
  DROP TABLE IF EXISTS public.billing_payments, public.billing_invoice_items, public.billing_invoices,
                       public.billing_quote_items, public.billing_quotes, public.billing_coupons CASCADE;
  RAISE NOTICE '110: the shared billing tables were empty and have been dropped.';
END $drop$;

-- Invoice, quote and payment numbers (INV-2026-000001 …), counted within the practice's own schema
-- (these functions read whichever billing tables the session's search_path names). They read the
-- counter from character 8, which is inside the year, so the second number in a year failed with
-- "invalid input syntax for type integer". Now: the digits after the second dash.
CREATE OR REPLACE FUNCTION public.generate_invoice_number() RETURNS varchar LANGUAGE plpgsql AS $fn$
DECLARE y text := to_char(CURRENT_DATE, 'YYYY'); n integer;
BEGIN
  SELECT COALESCE(MAX(split_part(invoice_number, '-', 3)::integer), 0) + 1 INTO n
    FROM billing_invoices WHERE invoice_number ~ ('^INV-' || y || '-[0-9]+$');
  RETURN 'INV-' || y || '-' || lpad(n::text, 6, '0');
END $fn$;
CREATE OR REPLACE FUNCTION public.generate_quote_number() RETURNS varchar LANGUAGE plpgsql AS $fn$
DECLARE y text := to_char(CURRENT_DATE, 'YYYY'); n integer;
BEGIN
  SELECT COALESCE(MAX(split_part(quote_number, '-', 3)::integer), 0) + 1 INTO n
    FROM billing_quotes WHERE quote_number ~ ('^QTE-' || y || '-[0-9]+$');
  RETURN 'QTE-' || y || '-' || lpad(n::text, 6, '0');
END $fn$;
CREATE OR REPLACE FUNCTION public.generate_billing_payment_number() RETURNS varchar LANGUAGE plpgsql AS $fn$
DECLARE y text := to_char(CURRENT_DATE, 'YYYY'); n integer;
BEGIN
  SELECT COALESCE(MAX(split_part(payment_number, '-', 3)::integer), 0) + 1 INTO n
    FROM billing_payments WHERE payment_number ~ ('^BPY-' || y || '-[0-9]+$');
  RETURN 'BPY-' || y || '-' || lpad(n::text, 6, '0');
END $fn$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('110_billing_per_practice.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
