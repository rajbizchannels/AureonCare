-- Migration 068: SEC-05 Model D — Step 1 of the full sweep: expand the tenant set
--
-- Grows control.tenant_tables from the 15 core PHI tables to the full 78-table tenant
-- set from the resolved triage (SEC-05_Table_Triage.xlsx), rebuilds the golden
-- template with the added tables, and cuts their existing data over into tenant_default
-- (reusing the S2/S4 machinery). Identity tables (users/providers/social_auth/user_roles)
-- and shared master data (medical_codes/medications/roles/permissions/...) intentionally
-- stay in public.
--
-- NOTE (integration settings): backup_provider_settings / vendor_integration_settings /
-- telehealth_provider_settings move to the tenant schema for the per-practice account +
-- tokens. Their client_id/client_secret columns come along but are superseded by the
-- GLOBAL OAuth CID/CSK (env/control) per the design decision; a later migration should
-- deprecate those per-tenant credential columns.
--
-- Additive + idempotent: clone is CREATE TABLE IF NOT EXISTS; a table is moved only if
-- still present in public; tables absent from this DB (e.g. an unrun feature migration)
-- are skipped. Safe to re-run.

-- 1) Expand the tenant table catalog.
INSERT INTO control.tenant_tables (table_name, sort_order) VALUES
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
  ('inventory_role_permissions', 262)
ON CONFLICT (table_name) DO NOTHING;

-- 2) For every tenant table: clone its structure into the template from public (the 15
--    already-moved tables are gone from public and skipped — they already exist in
--    template), then move it from public into tenant_default (the 15 are skipped; the
--    newly-added tables relocate with their data, indexes, and FKs).
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT table_name FROM control.tenant_tables ORDER BY sort_order, table_name LOOP
    PERFORM control.clone_table('public', t, 'template');
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA tenant_default', t);
      RAISE NOTICE '068: moved public.% -> tenant_default', t;
    END IF;
  END LOOP;
END $$;

-- 3) Replicate the full intra-tenant FK graph into the template, sourced from
--    tenant_default (which now holds all 78 tables with their FKs). Existing template
--    FKs are skipped, so this just fills in the newly-added tables' relationships.
SELECT control.replicate_intra_fks(
  'tenant_default', 'template',
  ARRAY(SELECT table_name FROM control.tenant_tables)
);
