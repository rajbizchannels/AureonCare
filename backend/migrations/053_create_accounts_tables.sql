-- Migration 053: Comprehensive Accounts Management System
-- Integrates with RCM (claims, payments, denials) and Billing (invoices, quotes) modules
-- All primary keys use UUID, fields have CHECK constraints for validation

-- ─────────────────────────────────────────
-- CHART OF ACCOUNTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number      VARCHAR(20) NOT NULL UNIQUE,
  account_name        VARCHAR(255) NOT NULL,
  account_type        VARCHAR(30) NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense','contra_asset','contra_liability','contra_revenue')),
  account_subtype     VARCHAR(50),                   -- e.g. 'current_asset', 'fixed_asset', 'accounts_receivable'
  parent_account_id   UUID REFERENCES accounts(id),
  description         TEXT,
  normal_balance      VARCHAR(6) NOT NULL CHECK (normal_balance IN ('debit','credit')),
  currency            VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_system           BOOLEAN NOT NULL DEFAULT FALSE,  -- system accounts cannot be deleted
  allow_journal_entries BOOLEAN NOT NULL DEFAULT TRUE,
  opening_balance     NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  current_balance     NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  -- RCM/Billing integration flags
  linked_to_ar        BOOLEAN NOT NULL DEFAULT FALSE,  -- links to accounts receivable module
  linked_to_ap        BOOLEAN NOT NULL DEFAULT FALSE,  -- links to accounts payable module
  linked_to_billing   BOOLEAN NOT NULL DEFAULT FALSE,  -- links to billing module
  linked_to_claims    BOOLEAN NOT NULL DEFAULT FALSE,  -- links to claims/RCM module
  -- Metadata
  tags                TEXT[],
  created_by          UUID REFERENCES users(id),
  updated_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_account_name_nonempty CHECK (LENGTH(TRIM(account_name)) > 0),
  CONSTRAINT chk_account_number_format CHECK (account_number ~ '^[0-9A-Z\-]+$')
);

CREATE INDEX IF NOT EXISTS idx_accounts_type      ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent    ON accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_active    ON accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_number    ON accounts(account_number);

-- ─────────────────────────────────────────
-- JOURNAL ENTRIES (double-entry bookkeeping)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_journal_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number        VARCHAR(30) NOT NULL UNIQUE,    -- JE-2025-000001
  entry_date          DATE NOT NULL,
  post_date           DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','voided','reversed')),
  entry_type          VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK (entry_type IN ('manual','adjusting','closing','reversing','auto_billing','auto_rcm','auto_payment','auto_ar','auto_ap')),
  description         TEXT NOT NULL,
  reference_type      VARCHAR(30) CHECK (reference_type IN ('invoice','claim','payment','denial','preapproval','payment_posting','quote',NULL)),
  reference_id        UUID,                          -- links to billing_invoices, claims, payments, etc.
  reference_number    VARCHAR(50),                   -- human-readable reference
  total_debit         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_credit        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_recurring        BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_frequency VARCHAR(20) CHECK (recurring_frequency IN ('daily','weekly','monthly','quarterly','yearly',NULL)),
  next_recurrence     DATE,
  reversal_of         UUID REFERENCES account_journal_entries(id),
  notes               TEXT,
  attachments         JSONB DEFAULT '[]',
  created_by          UUID REFERENCES users(id),
  updated_by          UUID REFERENCES users(id),
  posted_by           UUID REFERENCES users(id),
  voided_by           UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_je_description_nonempty CHECK (LENGTH(TRIM(description)) > 0),
  CONSTRAINT chk_je_date_valid CHECK (entry_date <= CURRENT_DATE + INTERVAL '1 year')
);

CREATE INDEX IF NOT EXISTS idx_aje_status      ON account_journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_aje_date        ON account_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_aje_ref_type    ON account_journal_entries(reference_type);
CREATE INDEX IF NOT EXISTS idx_aje_ref_id      ON account_journal_entries(reference_id);
CREATE INDEX IF NOT EXISTS idx_aje_entry_type  ON account_journal_entries(entry_type);

-- ─────────────────────────────────────────
-- JOURNAL ENTRY LINES (debit/credit sides)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_journal_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id    UUID NOT NULL REFERENCES account_journal_entries(id) ON DELETE CASCADE,
  account_id          UUID NOT NULL REFERENCES accounts(id),
  line_number         INTEGER NOT NULL,
  entry_type          VARCHAR(6) NOT NULL CHECK (entry_type IN ('debit','credit')),
  amount              NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  description         TEXT,
  -- Dimensional tracking for analytics
  patient_id          UUID REFERENCES patients(id),
  provider_id         UUID REFERENCES users(id),
  department          VARCHAR(100),
  cost_center         VARCHAR(50),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ajl_line_number CHECK (line_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_ajl_journal_id  ON account_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_ajl_account_id  ON account_journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_ajl_patient_id  ON account_journal_lines(patient_id);

-- ─────────────────────────────────────────
-- ACCOUNTS RECEIVABLE RECORDS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_receivables (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ar_number           VARCHAR(30) NOT NULL UNIQUE,   -- AR-2025-000001
  ar_type             VARCHAR(20) NOT NULL CHECK (ar_type IN ('patient','insurance','other')),
  status              VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','paid','written_off','disputed','collections')),
  patient_id          UUID REFERENCES patients(id),
  payer_id            UUID REFERENCES insurance_payers(id),  -- insurance payer
  account_id          UUID REFERENCES accounts(id),          -- GL account
  -- Links to billing/RCM
  invoice_id          UUID REFERENCES billing_invoices(id),
  claim_id            UUID,                          -- references claims table
  -- Amounts
  original_amount     NUMERIC(15,2) NOT NULL CHECK (original_amount >= 0),
  paid_amount         NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
  adjusted_amount     NUMERIC(15,2) NOT NULL DEFAULT 0.00,  -- contractual adjustments
  written_off_amount  NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (written_off_amount >= 0),
  balance_due         NUMERIC(15,2) GENERATED ALWAYS AS (original_amount - paid_amount - adjusted_amount - written_off_amount) STORED,
  -- Dates
  due_date            DATE NOT NULL,
  service_date        DATE,
  last_payment_date   DATE,
  -- Aging buckets (days overdue at last calculation)
  aging_bucket        VARCHAR(20) CHECK (aging_bucket IN ('current','1_30','31_60','61_90','91_120','120_plus',NULL)),
  aging_days          INTEGER DEFAULT 0 CHECK (aging_days >= 0),
  -- Collection tracking
  collection_stage    VARCHAR(30) DEFAULT 'statement' CHECK (collection_stage IN ('statement','reminder_1','reminder_2','final_notice','collections','legal',NULL)),
  last_contact_date   DATE,
  notes               TEXT,
  created_by          UUID REFERENCES users(id),
  updated_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_status      ON account_receivables(status);
CREATE INDEX IF NOT EXISTS idx_ar_patient     ON account_receivables(patient_id);
CREATE INDEX IF NOT EXISTS idx_ar_payer       ON account_receivables(payer_id);
CREATE INDEX IF NOT EXISTS idx_ar_due_date    ON account_receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_ar_aging       ON account_receivables(aging_bucket);
CREATE INDEX IF NOT EXISTS idx_ar_invoice     ON account_receivables(invoice_id);

-- ─────────────────────────────────────────
-- ACCOUNTS PAYABLE RECORDS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_payables (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ap_number           VARCHAR(30) NOT NULL UNIQUE,   -- AP-2025-000001
  ap_type             VARCHAR(20) NOT NULL CHECK (ap_type IN ('vendor','refund','employee','other')),
  status              VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','partial','paid','voided','disputed')),
  vendor_name         VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(vendor_name)) > 0),
  vendor_reference    VARCHAR(100),                  -- vendor invoice number
  account_id          UUID REFERENCES accounts(id),
  -- Amounts
  invoice_amount      NUMERIC(15,2) NOT NULL CHECK (invoice_amount > 0),
  paid_amount         NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
  discount_amount     NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  balance_due         NUMERIC(15,2) GENERATED ALWAYS AS (invoice_amount - paid_amount - discount_amount) STORED,
  -- Dates
  invoice_date        DATE NOT NULL,
  due_date            DATE NOT NULL,
  payment_date        DATE,
  -- Payment details
  payment_method      VARCHAR(20) CHECK (payment_method IN ('check','ach','wire','card','cash',NULL)),
  payment_reference   VARCHAR(100),
  bank_account        VARCHAR(50),
  -- Categorization
  expense_category    VARCHAR(100),
  department          VARCHAR(100),
  notes               TEXT,
  attachments         JSONB DEFAULT '[]',
  approved_by         UUID REFERENCES users(id),
  created_by          UUID REFERENCES users(id),
  updated_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ap_status      ON account_payables(status);
CREATE INDEX IF NOT EXISTS idx_ap_due_date    ON account_payables(due_date);
CREATE INDEX IF NOT EXISTS idx_ap_vendor      ON account_payables(vendor_name);

-- ─────────────────────────────────────────
-- BANK / PAYER RECONCILIATIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_reconciliations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_number VARCHAR(30) NOT NULL UNIQUE,  -- REC-2025-000001
  account_id          UUID NOT NULL REFERENCES accounts(id),
  reconciliation_type VARCHAR(20) NOT NULL CHECK (reconciliation_type IN ('bank','insurance','patient','vendor')),
  status              VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','discrepancy','cancelled')),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  statement_balance   NUMERIC(15,2) NOT NULL,         -- balance per bank/payer statement
  system_balance      NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  cleared_balance     NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  outstanding_deposits NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  outstanding_checks  NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  discrepancy_amount  NUMERIC(15,2) GENERATED ALWAYS AS (statement_balance - cleared_balance - outstanding_deposits + outstanding_checks) STORED,
  notes               TEXT,
  completed_at        TIMESTAMPTZ,
  created_by          UUID REFERENCES users(id),
  completed_by        UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_rec_period CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_rec_account ON account_reconciliations(account_id);
CREATE INDEX IF NOT EXISTS idx_rec_status  ON account_reconciliations(status);

-- Reconciliation line items
CREATE TABLE IF NOT EXISTS account_reconciliation_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id     UUID NOT NULL REFERENCES account_reconciliations(id) ON DELETE CASCADE,
  item_type             VARCHAR(20) NOT NULL CHECK (item_type IN ('deposit','check','payment','adjustment','fee','other')),
  transaction_date      DATE NOT NULL,
  description           TEXT NOT NULL,
  reference_number      VARCHAR(100),
  amount                NUMERIC(15,2) NOT NULL,
  is_cleared            BOOLEAN NOT NULL DEFAULT FALSE,
  cleared_date          DATE,
  -- Matching to system records
  journal_line_id       UUID REFERENCES account_journal_lines(id),
  payment_id            UUID,                          -- references payments table
  invoice_id            UUID REFERENCES billing_invoices(id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reci_rec_id  ON account_reconciliation_items(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_reci_cleared ON account_reconciliation_items(is_cleared);

-- ─────────────────────────────────────────
-- ACCOUNT STATEMENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_statements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_number    VARCHAR(30) NOT NULL UNIQUE,   -- STM-2025-000001
  statement_type      VARCHAR(20) NOT NULL CHECK (statement_type IN ('patient','insurance','vendor','internal')),
  status              VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','paid','disputed')),
  -- Recipient
  patient_id          UUID REFERENCES patients(id),
  payer_id            UUID REFERENCES insurance_payers(id),
  recipient_name      VARCHAR(255),
  recipient_email     VARCHAR(255),
  recipient_address   JSONB,
  -- Period
  statement_date      DATE NOT NULL,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  due_date            DATE,
  -- Amounts
  previous_balance    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  charges             NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  payments            NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  adjustments         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  current_balance     NUMERIC(15,2) GENERATED ALWAYS AS (previous_balance + charges - payments - adjustments) STORED,
  -- Delivery
  sent_at             TIMESTAMPTZ,
  viewed_at           TIMESTAMPTZ,
  payment_url         TEXT,
  notes               TEXT,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_stm_period CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_stm_patient   ON account_statements(patient_id);
CREATE INDEX IF NOT EXISTS idx_stm_payer     ON account_statements(payer_id);
CREATE INDEX IF NOT EXISTS idx_stm_status    ON account_statements(status);
CREATE INDEX IF NOT EXISTS idx_stm_date      ON account_statements(statement_date);

-- Statement line items
CREATE TABLE IF NOT EXISTS account_statement_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id        UUID NOT NULL REFERENCES account_statements(id) ON DELETE CASCADE,
  item_date           DATE NOT NULL,
  description         TEXT NOT NULL,
  item_type           VARCHAR(20) NOT NULL CHECK (item_type IN ('charge','payment','adjustment','credit','balance_forward')),
  reference_type      VARCHAR(30),
  reference_id        UUID,
  reference_number    VARCHAR(50),
  amount              NUMERIC(15,2) NOT NULL,
  running_balance     NUMERIC(15,2),
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stmi_stmt_id ON account_statement_items(statement_id);

-- ─────────────────────────────────────────
-- AR AGING SNAPSHOTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_ar_aging_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date       DATE NOT NULL,
  snapshot_type       VARCHAR(20) NOT NULL DEFAULT 'patient' CHECK (snapshot_type IN ('patient','insurance','combined')),
  total_ar            NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  current_amount      NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  days_1_30           NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  days_31_60          NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  days_61_90          NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  days_91_120         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  days_120_plus       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  -- Counts
  total_accounts      INTEGER NOT NULL DEFAULT 0,
  current_count       INTEGER NOT NULL DEFAULT 0,
  days_1_30_count     INTEGER NOT NULL DEFAULT 0,
  days_31_60_count    INTEGER NOT NULL DEFAULT 0,
  days_61_90_count    INTEGER NOT NULL DEFAULT 0,
  days_91_120_count   INTEGER NOT NULL DEFAULT 0,
  days_120_plus_count INTEGER NOT NULL DEFAULT 0,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aging_date ON account_ar_aging_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_aging_type ON account_ar_aging_snapshots(snapshot_type);

-- ─────────────────────────────────────────
-- ACCOUNT BACKUPS TRACKING
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_backups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type         VARCHAR(30) NOT NULL CHECK (backup_type IN ('full','accounts','journal','ar','ap','reconciliation','statements')),
  status              VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  file_name           VARCHAR(255),
  file_size_bytes     BIGINT CHECK (file_size_bytes >= 0),
  record_count        INTEGER CHECK (record_count >= 0),
  period_start        DATE,
  period_end          DATE,
  checksum            VARCHAR(64),                   -- SHA-256 of backup file
  storage_location    TEXT,
  error_message       TEXT,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_type   ON account_backups(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_status ON account_backups(status);
CREATE INDEX IF NOT EXISTS idx_backup_date   ON account_backups(created_at);

-- ─────────────────────────────────────────
-- ACCOUNT ROLE PERMISSIONS (module-level RBAC)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_role_permissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name           VARCHAR(50) NOT NULL,           -- references roles.name or system roles
  resource            VARCHAR(50) NOT NULL CHECK (resource IN ('chart_of_accounts','journal_entries','accounts_receivable','accounts_payable','reconciliation','statements','reports','backup','archive','rbac_settings')),
  can_view            BOOLEAN NOT NULL DEFAULT FALSE,
  can_create          BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit            BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete          BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve         BOOLEAN NOT NULL DEFAULT FALSE,
  can_export          BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_name, resource)
);

CREATE INDEX IF NOT EXISTS idx_arp_role     ON account_role_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_arp_resource ON account_role_permissions(resource);

-- ─────────────────────────────────────────
-- SEQUENCE GENERATORS
-- ─────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS accounts_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS account_je_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS account_ar_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS account_ap_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS account_rec_seq START 1;
CREATE SEQUENCE IF NOT EXISTS account_stm_seq START 1;

CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS VARCHAR AS $$
BEGIN
  RETURN LPAD(nextval('accounts_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_je_number()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'JE-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('account_je_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_ar_number()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'AR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('account_ar_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_ap_number()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'AP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('account_ap_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_rec_number()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'REC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('account_rec_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_stm_number()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'STM-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('account_stm_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────
-- TRIGGER: auto-update updated_at
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_accounts_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_aje_updated_at
    BEFORE UPDATE ON account_journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_accounts_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_ar_updated_at
    BEFORE UPDATE ON account_receivables
    FOR EACH ROW EXECUTE FUNCTION update_accounts_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_ap_updated_at
    BEFORE UPDATE ON account_payables
    FOR EACH ROW EXECUTE FUNCTION update_accounts_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_rec_updated_at
    BEFORE UPDATE ON account_reconciliations
    FOR EACH ROW EXECUTE FUNCTION update_accounts_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_stm_updated_at
    BEFORE UPDATE ON account_statements
    FOR EACH ROW EXECUTE FUNCTION update_accounts_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────
-- SEED: default chart of accounts
-- ─────────────────────────────────────────
INSERT INTO accounts (account_number, account_name, account_type, account_subtype, normal_balance, is_system, linked_to_ar, linked_to_billing, linked_to_claims, description) VALUES
-- Assets
('1000', 'Cash and Cash Equivalents',  'asset', 'current_asset',         'debit',  TRUE, FALSE, FALSE, FALSE, 'Primary cash accounts'),
('1100', 'Accounts Receivable - Patient','asset','accounts_receivable',   'debit',  TRUE, TRUE,  TRUE,  FALSE, 'Patient AR linked to billing invoices'),
('1110', 'Accounts Receivable - Insurance','asset','accounts_receivable', 'debit',  TRUE, TRUE,  FALSE, TRUE,  'Insurance AR linked to claims'),
('1200', 'Prepaid Expenses',           'asset', 'current_asset',          'debit',  FALSE, FALSE, FALSE, FALSE, 'Prepaid insurance, rent, etc.'),
('1500', 'Property and Equipment',     'asset', 'fixed_asset',            'debit',  FALSE, FALSE, FALSE, FALSE, 'Medical equipment, furniture'),
('1510', 'Accumulated Depreciation',   'contra_asset', 'fixed_asset',     'credit', FALSE, FALSE, FALSE, FALSE, 'Contra account for fixed assets'),
-- Liabilities
('2000', 'Accounts Payable',           'liability', 'current_liability',  'credit', TRUE, FALSE, FALSE, FALSE, 'Vendor AP linked to AP module'),
('2100', 'Accrued Liabilities',        'liability', 'current_liability',  'credit', FALSE, FALSE, FALSE, FALSE, 'Accrued wages, interest'),
('2200', 'Patient Deposits',           'liability', 'current_liability',  'credit', FALSE, FALSE, TRUE,  FALSE, 'Patient prepayments held in trust'),
('2500', 'Long-Term Debt',             'liability', 'long_term_liability', 'credit', FALSE, FALSE, FALSE, FALSE, 'Loans, mortgages'),
-- Equity
('3000', 'Owner Equity',               'equity', 'equity',                'credit', TRUE, FALSE, FALSE, FALSE, 'Owner capital accounts'),
('3100', 'Retained Earnings',          'equity', 'equity',                'credit', TRUE, FALSE, FALSE, FALSE, 'Accumulated earnings'),
('3200', 'Current Year Earnings',      'equity', 'equity',                'credit', TRUE, FALSE, FALSE, FALSE, 'Current period net income'),
-- Revenue
('4000', 'Patient Service Revenue',    'revenue', 'operating_revenue',    'credit', TRUE, FALSE, TRUE,  TRUE,  'Revenue from clinical services'),
('4100', 'Insurance Reimbursements',   'revenue', 'operating_revenue',    'credit', TRUE, FALSE, FALSE, TRUE,  'Insurance claim payments'),
('4200', 'Telehealth Revenue',         'revenue', 'operating_revenue',    'credit', FALSE, FALSE, TRUE,  FALSE, 'Revenue from telehealth services'),
('4300', 'Ancillary Revenue',          'revenue', 'operating_revenue',    'credit', FALSE, FALSE, TRUE,  FALSE, 'Lab, pharmacy, ancillary services'),
('4900', 'Other Revenue',              'revenue', 'non_operating_revenue', 'credit',FALSE, FALSE, FALSE, FALSE, 'Miscellaneous revenue'),
-- Expense
('5000', 'Cost of Services',           'expense', 'cost_of_goods_sold',   'debit',  FALSE, FALSE, FALSE, FALSE, 'Direct cost of patient services'),
('5100', 'Salaries and Wages',         'expense', 'operating_expense',    'debit',  FALSE, FALSE, FALSE, FALSE, 'Staff compensation'),
('5200', 'Medical Supplies',           'expense', 'operating_expense',    'debit',  FALSE, FALSE, FALSE, FALSE, 'Clinical supplies'),
('5300', 'Occupancy Expenses',         'expense', 'operating_expense',    'debit',  FALSE, FALSE, FALSE, FALSE, 'Rent, utilities'),
('5400', 'Insurance Expense',          'expense', 'operating_expense',    'debit',  FALSE, FALSE, FALSE, FALSE, 'Malpractice and general insurance'),
('5500', 'Technology and Software',    'expense', 'operating_expense',    'debit',  FALSE, FALSE, FALSE, FALSE, 'EMR, billing software'),
('5600', 'Billing and Collections',    'expense', 'operating_expense',    'debit',  FALSE, FALSE, FALSE, FALSE, 'RCM, clearinghouse fees'),
('5700', 'Marketing and CRM',          'expense', 'operating_expense',    'debit',  FALSE, FALSE, FALSE, FALSE, 'Advertising, patient outreach'),
('5800', 'Depreciation Expense',       'expense', 'operating_expense',    'debit',  FALSE, FALSE, FALSE, FALSE, 'Equipment depreciation'),
('5900', 'Other Operating Expenses',   'expense', 'operating_expense',    'debit',  FALSE, FALSE, FALSE, FALSE, 'Miscellaneous expenses'),
('6000', 'Bad Debt Expense',           'expense', 'operating_expense',    'debit',  FALSE, FALSE, FALSE, FALSE, 'Write-offs from uncollectible AR'),
('6100', 'Contractual Adjustments',    'contra_revenue', 'revenue_adjustment','debit', FALSE, FALSE, FALSE, TRUE, 'Insurance contractual write-downs')
ON CONFLICT (account_number) DO NOTHING;

-- ─────────────────────────────────────────
-- SEED: default role permissions
-- ─────────────────────────────────────────
INSERT INTO account_role_permissions (role_name, resource, can_view, can_create, can_edit, can_delete, can_approve, can_export) VALUES
-- Admin: full access
('admin', 'chart_of_accounts',   TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'journal_entries',     TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'accounts_receivable', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'accounts_payable',    TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'reconciliation',      TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'statements',          TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'reports',             TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'backup',              TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'archive',             TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'rbac_settings',       TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
-- Billing Manager: billing-focused
('billing_manager', 'chart_of_accounts',   TRUE,  FALSE, FALSE, FALSE, FALSE, TRUE),
('billing_manager', 'journal_entries',     TRUE,  TRUE,  FALSE, FALSE, FALSE, TRUE),
('billing_manager', 'accounts_receivable', TRUE,  TRUE,  TRUE,  FALSE, TRUE,  TRUE),
('billing_manager', 'accounts_payable',    TRUE,  TRUE,  TRUE,  FALSE, TRUE,  TRUE),
('billing_manager', 'reconciliation',      TRUE,  TRUE,  TRUE,  FALSE, FALSE, TRUE),
('billing_manager', 'statements',          TRUE,  TRUE,  TRUE,  FALSE, FALSE, TRUE),
('billing_manager', 'reports',             TRUE,  TRUE,  FALSE, FALSE, FALSE, TRUE),
('billing_manager', 'backup',              FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('billing_manager', 'archive',             FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('billing_manager', 'rbac_settings',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
-- Doctor: read-only reports
('doctor', 'chart_of_accounts',   FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('doctor', 'journal_entries',     FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('doctor', 'accounts_receivable', TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
('doctor', 'accounts_payable',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('doctor', 'reconciliation',      FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('doctor', 'statements',          TRUE,  FALSE, FALSE, FALSE, FALSE, TRUE),
('doctor', 'reports',             TRUE,  FALSE, FALSE, FALSE, FALSE, TRUE),
('doctor', 'backup',              FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('doctor', 'archive',             FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('doctor', 'rbac_settings',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
-- Receptionist: statements only
('receptionist', 'chart_of_accounts',   FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'journal_entries',     FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'accounts_receivable', TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'accounts_payable',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'reconciliation',      FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'statements',          TRUE,  TRUE,  FALSE, FALSE, FALSE, TRUE),
('receptionist', 'reports',             FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'backup',              FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'archive',             FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'rbac_settings',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role_name, resource) DO NOTHING;
