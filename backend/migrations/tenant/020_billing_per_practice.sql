-- DO NOT PASTE INTO THE SQL EDITOR. Tenant-runner file (npm run migrate:tenants): it runs inside each
-- practice schema with unqualified names. For production, paste the matching global migration instead.
-- Billing (quotes, invoices, payments, coupons) per practice, with Stripe Connect pay-link columns.
-- Global migration 110 does the same everywhere (and re-points accounting links, drops the old
-- shared tables); this file is for the tenant runner.

DO $$
BEGIN
  IF to_regclass('patients') IS NULL THEN
    RAISE NOTICE '020_billing_per_practice: no patients table in schema %, skipped', current_schema();
    RETURN;
  END IF;
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
END $$;
