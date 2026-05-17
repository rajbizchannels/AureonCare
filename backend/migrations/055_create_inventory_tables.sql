-- Migration 055: Comprehensive Inventory Management System
-- Integrates with Accounts (COGS, AP) and supports medical supply/medication tracking
-- All primary keys use UUID, fields have CHECK constraints for validation

-- ─────────────────────────────────────────
-- SEQUENCES
-- ─────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS inventory_item_number_seq     START 1;
CREATE SEQUENCE IF NOT EXISTS inventory_movement_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS inventory_po_number_seq       START 1;
CREATE SEQUENCE IF NOT EXISTS inventory_supplier_number_seq START 1;

-- ─────────────────────────────────────────
-- SEQUENCE GENERATOR FUNCTIONS
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_item_number()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'INV-' || LPAD(nextval('inventory_item_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_movement_number()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'MOV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('inventory_movement_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'PO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('inventory_po_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_supplier_number()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'SUP-' || LPAD(nextval('inventory_supplier_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────
-- TRIGGER FUNCTION: auto-update updated_at
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────
-- INVENTORY CATEGORIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_categories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                VARCHAR(20) NOT NULL UNIQUE,
  name                VARCHAR(100) NOT NULL,
  description         TEXT,
  parent_id           UUID REFERENCES inventory_categories(id),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_inv_cat_code_nonempty CHECK (LENGTH(TRIM(code)) > 0),
  CONSTRAINT chk_inv_cat_name_nonempty CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_cat_parent ON inventory_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_inv_cat_active ON inventory_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_inv_cat_code   ON inventory_categories(code);

-- ─────────────────────────────────────────
-- INVENTORY SUPPLIERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_suppliers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_number     VARCHAR(20) UNIQUE,
  name                VARCHAR(255) NOT NULL,
  contact_name        VARCHAR(100),
  email               VARCHAR(255) CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
  phone               VARCHAR(30),
  address             TEXT,
  city                VARCHAR(100),
  country             VARCHAR(3),
  payment_terms       VARCHAR(30) CHECK (payment_terms IS NULL OR payment_terms IN ('net_30','net_60','net_90','immediate','custom')),
  status              VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','blacklisted')),
  tax_id              VARCHAR(50),
  notes               TEXT,
  linked_account_id   UUID REFERENCES accounts(id),   -- AP account link
  created_by          UUID REFERENCES users(id),
  updated_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_inv_sup_name_nonempty CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_sup_status ON inventory_suppliers(status);
CREATE INDEX IF NOT EXISTS idx_inv_sup_name   ON inventory_suppliers(name);
CREATE INDEX IF NOT EXISTS idx_inv_sup_number ON inventory_suppliers(supplier_number);

-- ─────────────────────────────────────────
-- INVENTORY ITEMS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_number             VARCHAR(20) NOT NULL UNIQUE,
  name                    VARCHAR(255) NOT NULL,
  description             TEXT,
  category_id             UUID REFERENCES inventory_categories(id),
  supplier_id             UUID REFERENCES inventory_suppliers(id),
  unit_of_measure         VARCHAR(20) NOT NULL CHECK (unit_of_measure IN ('unit','pack','box','kg','g','l','ml','each','dozen','case')),
  item_type               VARCHAR(30) NOT NULL CHECK (item_type IN ('medication','supply','equipment','consumable','reagent','implant','other')),
  sku                     VARCHAR(50),
  barcode                 VARCHAR(100),
  unit_cost               NUMERIC(15,2) NOT NULL CHECK (unit_cost >= 0),
  selling_price           NUMERIC(15,2)          CHECK (selling_price IS NULL OR selling_price >= 0),
  quantity_on_hand        NUMERIC(12,3) NOT NULL DEFAULT 0,
  quantity_reserved       NUMERIC(12,3) NOT NULL DEFAULT 0,
  quantity_on_order       NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_level           NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_quantity        NUMERIC(12,3) NOT NULL DEFAULT 0,
  expiry_date             DATE,
  lot_number              VARCHAR(50),
  is_lot_tracked          BOOLEAN NOT NULL DEFAULT FALSE,
  is_expiry_tracked       BOOLEAN NOT NULL DEFAULT FALSE,
  requires_refrigeration  BOOLEAN NOT NULL DEFAULT FALSE,
  status                  VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','discontinued','out_of_stock')),
  linked_account_id       UUID REFERENCES accounts(id),   -- COGS / expense account
  created_by              UUID REFERENCES users(id),
  updated_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_inv_item_name_nonempty  CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT chk_inv_item_number_format  CHECK (item_number ~ '^[A-Z0-9\-]+$'),
  CONSTRAINT chk_inv_item_qty_on_hand    CHECK (quantity_on_hand >= 0),
  CONSTRAINT chk_inv_item_qty_reserved   CHECK (quantity_reserved >= 0),
  CONSTRAINT chk_inv_item_qty_on_order   CHECK (quantity_on_order >= 0),
  CONSTRAINT chk_inv_item_reorder_level  CHECK (reorder_level >= 0),
  CONSTRAINT chk_inv_item_reorder_qty    CHECK (reorder_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_item_status   ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inv_item_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inv_item_supplier ON inventory_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inv_item_type     ON inventory_items(item_type);
CREATE INDEX IF NOT EXISTS idx_inv_item_number   ON inventory_items(item_number);
CREATE INDEX IF NOT EXISTS idx_inv_item_barcode  ON inventory_items(barcode);
CREATE INDEX IF NOT EXISTS idx_inv_item_sku      ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inv_item_expiry   ON inventory_items(expiry_date);

-- ─────────────────────────────────────────
-- INVENTORY STOCK MOVEMENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_stock_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number     VARCHAR(30) NOT NULL UNIQUE,
  item_id             UUID NOT NULL REFERENCES inventory_items(id),
  movement_type       VARCHAR(30) NOT NULL CHECK (movement_type IN ('receipt','issue','adjustment','transfer','return','write_off','opening')),
  reference_type      VARCHAR(30) CHECK (reference_type IS NULL OR reference_type IN ('purchase_order','patient','department','adjustment')),
  reference_id        UUID,
  quantity            NUMERIC(12,3) NOT NULL,   -- positive for receipts/returns, negative for issues/write-offs
  unit_cost           NUMERIC(15,2),
  lot_number          VARCHAR(50),
  expiry_date         DATE,
  movement_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  notes               TEXT,
  balance_after       NUMERIC(12,3),
  journal_entry_id    UUID REFERENCES account_journal_entries(id),
  performed_by        UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_inv_mov_quantity_nonzero CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_item         ON inventory_stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type         ON inventory_stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_date         ON inventory_stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_inv_mov_ref_type     ON inventory_stock_movements(reference_type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_ref_id       ON inventory_stock_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_performed_by ON inventory_stock_movements(performed_by);

-- ─────────────────────────────────────────
-- INVENTORY PURCHASE ORDERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number           VARCHAR(30) NOT NULL UNIQUE,
  supplier_id         UUID NOT NULL REFERENCES inventory_suppliers(id),
  status              VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','partially_received','received','cancelled')),
  order_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date       DATE,
  received_date       DATE,
  total_amount        NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  tax_amount          NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  shipping_amount     NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  notes               TEXT,
  linked_account_id   UUID REFERENCES accounts(id),   -- AP account link
  approved_by         UUID REFERENCES users(id),
  created_by          UUID REFERENCES users(id),
  updated_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_inv_po_expected_date CHECK (expected_date IS NULL OR expected_date >= order_date)
);

CREATE INDEX IF NOT EXISTS idx_inv_po_status      ON inventory_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_inv_po_supplier    ON inventory_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inv_po_order_date  ON inventory_purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_inv_po_approved_by ON inventory_purchase_orders(approved_by);

-- ─────────────────────────────────────────
-- INVENTORY PURCHASE ORDER LINES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_purchase_order_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id               UUID NOT NULL REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
  item_id             UUID NOT NULL REFERENCES inventory_items(id),
  line_number         INTEGER NOT NULL CHECK (line_number > 0),
  quantity_ordered    NUMERIC(12,3) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received   NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost           NUMERIC(15,2) NOT NULL CHECK (unit_cost >= 0),
  line_total          NUMERIC(15,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
  lot_number          VARCHAR(50),
  expiry_date         DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (po_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_inv_pol_po_id ON inventory_purchase_order_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_inv_pol_item  ON inventory_purchase_order_lines(item_id);

-- ─────────────────────────────────────────
-- INVENTORY ROLE PERMISSIONS (module-level RBAC)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_role_permissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name           VARCHAR(50) NOT NULL,
  resource            VARCHAR(50) NOT NULL CHECK (resource IN ('items','categories','suppliers','stock_movements','purchase_orders')),
  can_view            BOOLEAN NOT NULL DEFAULT FALSE,
  can_create          BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit            BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete          BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve         BOOLEAN NOT NULL DEFAULT FALSE,
  can_export          BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by          UUID REFERENCES users(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_name, resource)
);

CREATE INDEX IF NOT EXISTS idx_inv_rp_role     ON inventory_role_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_inv_rp_resource ON inventory_role_permissions(resource);

-- ─────────────────────────────────────────
-- TRIGGERS: apply updated_at to all tables
-- ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_inv_cat_updated_at
    BEFORE UPDATE ON inventory_categories
    FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_inv_sup_updated_at
    BEFORE UPDATE ON inventory_suppliers
    FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_inv_item_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_inv_po_updated_at
    BEFORE UPDATE ON inventory_purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────
-- SEED: default role permissions
-- ─────────────────────────────────────────
INSERT INTO inventory_role_permissions (role_name, resource, can_view, can_create, can_edit, can_delete, can_approve, can_export) VALUES
-- Admin: full access to all resources
('admin', 'items',            TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'categories',       TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'suppliers',        TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'stock_movements',  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'purchase_orders',  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),

-- Billing Manager: full access to orders; view/edit on suppliers; view-only on items/stock
('billing_manager', 'items',           TRUE,  FALSE, FALSE, FALSE, FALSE, TRUE),
('billing_manager', 'categories',      TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
('billing_manager', 'suppliers',       TRUE,  TRUE,  TRUE,  FALSE, FALSE, TRUE),
('billing_manager', 'stock_movements', TRUE,  FALSE, FALSE, FALSE, FALSE, TRUE),
('billing_manager', 'purchase_orders', TRUE,  TRUE,  TRUE,  FALSE, TRUE,  TRUE),

-- Doctor: read-only on items and stock movements
('doctor', 'items',            TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
('doctor', 'categories',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
('doctor', 'suppliers',        FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('doctor', 'stock_movements',  TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
('doctor', 'purchase_orders',  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

-- Nurse: view items/categories/movements; create movements (issue/return)
('nurse', 'items',            TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
('nurse', 'categories',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
('nurse', 'suppliers',        FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('nurse', 'stock_movements',  TRUE,  TRUE,  FALSE, FALSE, FALSE, FALSE),
('nurse', 'purchase_orders',  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

-- Receptionist: view items and categories only
('receptionist', 'items',            TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'categories',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'suppliers',        FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'stock_movements',  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('receptionist', 'purchase_orders',  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

-- CRM Manager: view items and categories for product knowledge; export items
('crm_manager', 'items',            TRUE,  FALSE, FALSE, FALSE, FALSE, TRUE),
('crm_manager', 'categories',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
('crm_manager', 'suppliers',        FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('crm_manager', 'stock_movements',  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
('crm_manager', 'purchase_orders',  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role_name, resource) DO NOTHING;
