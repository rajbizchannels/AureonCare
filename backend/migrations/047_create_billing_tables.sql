-- Migration 047: Create Billing Module Tables
-- Adds quotes, invoices, invoice_items, coupons, and billing_payments tables

-- ============================================
-- QUOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS billing_quotes (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    quote_number VARCHAR(50) NOT NULL UNIQUE,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted')),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    subtotal NUMERIC(12,2) DEFAULT 0,
    discount_amount NUMERIC(12,2) DEFAULT 0,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    total_amount NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    terms TEXT,
    diagnosis_ids UUID[] DEFAULT '{}',
    offering_ids UUID[] DEFAULT '{}',
    coupon_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- QUOTE LINE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS billing_quote_items (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    quote_id UUID NOT NULL REFERENCES billing_quotes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL,
    discount_percent NUMERIC(5,2) DEFAULT 0,
    total NUMERIC(12,2) NOT NULL,
    offering_id UUID,
    diagnosis_id UUID,
    cpt_code VARCHAR(20),
    icd_code VARCHAR(20),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS billing_invoices (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    quote_id UUID REFERENCES billing_quotes(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded')),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    subtotal NUMERIC(12,2) DEFAULT 0,
    discount_amount NUMERIC(12,2) DEFAULT 0,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    total_amount NUMERIC(12,2) DEFAULT 0,
    amount_paid NUMERIC(12,2) DEFAULT 0,
    balance_due NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    terms TEXT,
    diagnosis_ids UUID[] DEFAULT '{}',
    offering_ids UUID[] DEFAULT '{}',
    coupon_id UUID,
    reminder_task_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INVOICE LINE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS billing_invoice_items (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL,
    discount_percent NUMERIC(5,2) DEFAULT 0,
    total NUMERIC(12,2) NOT NULL,
    offering_id UUID,
    diagnosis_id UUID,
    cpt_code VARCHAR(20),
    icd_code VARCHAR(20),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- COUPONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS billing_coupons (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(12,2) NOT NULL,
    min_amount NUMERIC(12,2) DEFAULT 0,
    max_discount NUMERIC(12,2),
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    applicable_offerings UUID[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- BILLING PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS billing_payments (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    payment_number VARCHAR(50) NOT NULL UNIQUE,
    invoice_id UUID REFERENCES billing_invoices(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'credit_card', 'debit_card', 'check', 'ach', 'wire', 'insurance', 'other')),
    payment_date TIMESTAMP DEFAULT NOW(),
    status VARCHAR(30) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partially_refunded')),
    transaction_id VARCHAR(200),
    reference_number VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- NUMBER GENERATION FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.generate_quote_number() RETURNS VARCHAR AS $$
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_invoice_number() RETURNS VARCHAR AS $$
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_billing_payment_number() RETURNS VARCHAR AS $$
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
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_billing_quotes_patient ON billing_quotes(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_quotes_status ON billing_quotes(status);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_patient ON billing_invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON billing_invoices(status);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_due_date ON billing_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_items_invoice ON billing_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_quote_items_quote ON billing_quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_billing_coupons_code ON billing_coupons(code);
CREATE INDEX IF NOT EXISTS idx_billing_coupons_active ON billing_coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice ON billing_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_patient ON billing_payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_status ON billing_payments(status);
