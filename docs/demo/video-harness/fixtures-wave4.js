/**
 * Wave 4 fixtures: audit, backup, archive, inventory, accounting and FHIR.
 *
 * The administration and back-office screens are the last ones the library
 * reaches, and like Wave 3's they render empty against the earlier datasets.
 *
 * Field names here are not a guess: each collection is written in the exact
 * shape its view reads. That differs by module — InventoryView is snake_case,
 * AccountsView is camelCase, AuditLogsTab wants a `{ data, pagination }`
 * envelope and ArchiveManagementTab wants `{ archives }` / `{ modules }` /
 * `{ stats }` / `{ rules }`. Wave 3 taught the lesson: a plausible-looking
 * fixture in the wrong case renders "Unknown / Invalid Date" on camera.
 */

const F = require('./fixtures');

const { at, day } = F;

/* ── audit ───────────────────────────────────────────────────────────────── */

/** AuditLogsTab reads created_at / user_name / user_email / action_type /
 *  resource_name / resource_type / action_description / status / module. */
const auditLogs = [
  {
    id: 9101, created_at: at(0, 9, 12),
    user_id: 2, user_name: 'Dr. Michael Anderson', user_email: 'michael.anderson@demo-clinic.example',
    action_type: 'view', resource_type: 'view', resource_name: 'PatientHistoryView',
    module: 'ehr', status: 'success', ip_address: '10.4.2.19',
    action_description: 'Opened the chart for Sarah Williams (MRN-2025-001)',
  },
  {
    id: 9102, created_at: at(0, 9, 26),
    user_id: 2, user_name: 'Dr. Michael Anderson', user_email: 'michael.anderson@demo-clinic.example',
    action_type: 'update', resource_type: 'form', resource_name: 'DiagnosisForm',
    module: 'ehr', status: 'success', ip_address: '10.4.2.19',
    action_description: 'Updated diagnosis E11.9 for Sarah Williams',
    changed_fields: ['status', 'severity', 'clinical_notes'],
  },
  {
    id: 9103, created_at: at(0, 10, 3),
    user_id: 5, user_name: 'Robin Castellanos', user_email: 'robin.castellanos@demo-clinic.example',
    action_type: 'create', resource_type: 'form', resource_name: 'NewPatientForm',
    module: 'practiceManagement', status: 'success', ip_address: '10.4.2.31',
    action_description: 'Registered new patient Elena Marchetti',
  },
  {
    id: 9104, created_at: at(0, 8, 55),
    user_id: 5, user_name: 'Robin Castellanos', user_email: 'robin.castellanos@demo-clinic.example',
    action_type: 'submit', resource_type: 'form', resource_name: 'ConsentForm',
    module: 'patientPortal', status: 'success', ip_address: '10.4.2.31',
    action_description: 'Recorded telehealth consent for Marcus Boone',
  },
  {
    id: 9105, created_at: at(-1, 16, 40),
    user_id: 1, user_name: 'Alex Rivera', user_email: 'alex.rivera@demo-clinic.example',
    action_type: 'view', resource_type: 'view', resource_name: 'ReportsView',
    module: 'reports', status: 'success', ip_address: '10.4.2.8',
    action_description: 'Exported the daily appointment report',
  },
  {
    id: 9106, created_at: at(-1, 8, 2),
    user_id: 3, user_name: 'Dana Okafor', user_email: 'dana.okafor@demo-clinic.example',
    action_type: 'open', resource_type: 'modal', resource_name: 'BillingExportModal',
    module: 'billing', status: 'error', ip_address: '10.4.2.44',
    action_description: 'Attempted to export billing data',
    error_message: 'Permission denied: role "Receptionist" cannot export billing data',
  },
  {
    id: 9107, created_at: at(-2, 11, 15),
    user_id: 1, user_name: 'Alex Rivera', user_email: 'alex.rivera@demo-clinic.example',
    action_type: 'update', resource_type: 'view', resource_name: 'AdminPanelView',
    module: 'admin', status: 'success', ip_address: '10.4.2.8',
    action_description: 'Changed role permissions for Receptionist',
    changed_fields: ['billing.export', 'reports.view'],
  },
  {
    id: 9108, created_at: at(-2, 9, 41),
    user_id: 4, user_name: 'Sam Whitfield', user_email: 'sam.whitfield@demo-clinic.example',
    action_type: 'delete', resource_type: 'form', resource_name: 'AppointmentForm',
    module: 'practiceManagement', status: 'warning', ip_address: '10.4.2.22',
    action_description: 'Cancelled appointment APT-2026-0188 (patient request)',
  },
];

/** AuditLogsTab's four stat cards. */
const auditStats = {
  total_actions: 4821,
  unique_users: 6,
  form_actions: 1284,
  errors: 3,
};

const auditPagination = {
  total: auditLogs.length,
  limit: 50,
  offset: 0,
  pages: 1,
  currentPage: 1,
};

/* ── backup ──────────────────────────────────────────────────────────────── */

const backupConfig = {
  googleDrive: { configured: true, connected: true, account: 'ops@demo-clinic.example' },
  oneDrive: { configured: false, connected: false },
  schedule: 'Daily at 02:00',
  retention_days: 90,
};

/** Both the accounts and the inventory backup panels list history rows. */
const backupHistory = [
  { id: 9201, backup_type: 'full', type: 'full', destination: 'Google Drive', size_bytes: 432013312, size_mb: 412, status: 'completed', created_at: at(0, 2, 0), record_count: 128940 },
  { id: 9202, backup_type: 'full', type: 'full', destination: 'Google Drive', size_bytes: 428867584, size_mb: 409, status: 'completed', created_at: at(-1, 2, 0), record_count: 128110 },
  { id: 9203, backup_type: 'full', type: 'full', destination: 'Google Drive', size_bytes: 424722432, size_mb: 405, status: 'completed', created_at: at(-2, 2, 0), record_count: 127402 },
];

/* ── archive ─────────────────────────────────────────────────────────────── */

/** ArchiveManagementTab: /archive/modules → { modules: [{ key, name }] }. */
const archiveModules = [
  { key: 'appointments', name: 'Appointments', description: 'Appointments and appointment types', tables: ['appointments'] },
  { key: 'claims', name: 'Claims', description: 'Claims, denials and payments', tables: ['claims', 'denials'] },
  { key: 'audit', name: 'Audit Logs', description: 'Access and change history', tables: ['audit_logs'] },
  { key: 'messages', name: 'Messages', description: 'Patient and staff messages', tables: ['messages'] },
  { key: 'forms', name: 'Forms', description: 'Form templates and submissions', tables: ['form_submissions'] },
];

/** /archive/list → { archives: [...] }. */
const archiveRecords = [
  {
    id: 9301, archive_name: 'FY2024 appointments and claims', status: 'active',
    description: 'Closed financial year — retained for audit, out of the working tables',
    archive_date: at(-40, 3), record_count: 6430, size_bytes: 115343360,
    modules: ['appointments', 'claims'],
    metadata: { recordCounts: { appointments: 4120, claims: 2310 } },
  },
  {
    id: 9302, archive_name: 'FY2023 audit logs', status: 'active',
    description: 'Audit history older than 24 months',
    archive_date: at(-70, 3), record_count: 91200, size_bytes: 188743680,
    modules: ['audit'],
    metadata: { recordCounts: { audit_logs: 91200 } },
  },
  {
    id: 9303, archive_name: 'FY2022 messages', status: 'restored',
    description: 'Restored last month for a subject access request',
    archive_date: at(-400, 3), record_count: 18740, size_bytes: 41943040,
    modules: ['messages'],
    metadata: { recordCounts: { messages: 18740 } },
  },
];

/** /archive/stats/summary → { stats: {...} }. */
const archiveStats = {
  total_archives: archiveRecords.length,
  total_records: 116370,
  total_size_bytes: 346030080,
  active_archives: 2,
  restored_archives: 1,
};

/** /archive-rules → { rules: [...] }. */
const archiveRules = [
  {
    id: 9401, rule_name: 'Archive closed claims after 24 months', enabled: true,
    description: 'Keeps the working tables small without losing the history',
    schedule_type: 'monthly', schedule_day_of_month: 1, schedule_time: '02:00',
    retention_days: 730, selected_modules: ['claims'],
    last_run_at: at(-11, 2), last_run_status: 'success', next_run_at: at(19, 2),
  },
  {
    id: 9402, rule_name: 'Archive audit logs after 24 months', enabled: true,
    description: 'Retains the HIPAA trail in cold storage, still searchable',
    schedule_type: 'monthly', schedule_day_of_month: 1, schedule_time: '02:30',
    retention_days: 730, selected_modules: ['audit'],
    last_run_at: at(-11, 2), last_run_status: 'success', next_run_at: at(19, 2),
  },
];

/* ── integrations ────────────────────────────────────────────────────────── */

/**
 * IntegrationsView decides "Configured" purely from whether any credential
 * field is non-empty, and only then lets the toggle enable it. Labcorp and
 * Optum ship configured so the screen has both states on it; Surescripts is
 * deliberately left blank — that is the one the video configures on camera.
 */
const vendorIntegrations = [
  {
    id: 8401, vendor_type: 'labcorp', api_key: 'lc_live_8f2a41c9', api_secret: '••••••••',
    username: 'demo-clinic', base_url: 'https://api.labcorp.example/v2',
    sandbox_mode: false, is_enabled: true,
  },
  {
    id: 8402, vendor_type: 'optum', api_key: 'opt_test_5512ab', client_id: 'aureoncare-demo',
    base_url: 'https://sandbox.optum.example/claims',
    sandbox_mode: true, is_enabled: false,
  },
];

const stripeSettings = {
  publishable_key: 'pk_test_51N8QdemoAureonCare0000',
  sandbox_mode: true,
  is_enabled: true,
  use_platform_integration: false,
};

/* ── inventory ───────────────────────────────────────────────────────────── */
/* InventoryView is snake_case throughout, and reads current_stock /
 * reorder_level, not quantity_on_hand. */

const inventoryCategories = [
  { id: 8801, code: 'VAC', name: 'Vaccines', description: 'Refrigerated stock', parent_id: null, is_active: true },
  { id: 8802, code: 'CON', name: 'Consumables', description: 'Everyday clinical supplies', parent_id: null, is_active: true },
  { id: 8803, code: 'DRG', name: 'Medications', description: 'In-clinic administration', parent_id: null, is_active: true },
];

const inventorySuppliers = [
  { id: 8901, supplier_number: 'SUP-001', name: 'Cascade Medical Supply', contact_name: 'Dale Whitcombe', email: 'orders@cascade-medical.example', phone: '555-0301', city: 'Portland', country: 'USA', payment_terms: 'Net 30', lead_time_days: 3, status: 'active' },
  { id: 8902, supplier_number: 'SUP-002', name: 'Northwest Vaccines', contact_name: 'Ruth Ellery', email: 'sales@nw-vaccines.example', phone: '555-0302', city: 'Seattle', country: 'USA', payment_terms: 'Net 45', lead_time_days: 7, status: 'active' },
];

const inventoryItems = [
  {
    id: 8701, item_number: 'ITM-0101', name: 'Influenza vaccine (quadrivalent)', sku: 'VAC-FLU-Q',
    category_id: 8801, item_type: 'vaccine', unit_of_measure: 'dose', barcode: '8901234500011',
    current_stock: 24, reorder_level: 40, reorder_quantity: 100, unit_cost: 14.5, selling_price: 32,
    supplier_id: 8902, status: 'active', is_lot_tracked: true, is_expiry_tracked: true,
    requires_refrigeration: true, lot_number: 'FLU-2609', next_expiry_date: day(120),
  },
  {
    id: 8702, item_number: 'ITM-0102', name: 'Tetanus vaccine', sku: 'VAC-TET',
    category_id: 8801, item_type: 'vaccine', unit_of_measure: 'dose', barcode: '8901234500028',
    current_stock: 86, reorder_level: 30, reorder_quantity: 60, unit_cost: 22, selling_price: 44,
    supplier_id: 8902, status: 'active', is_lot_tracked: true, is_expiry_tracked: true,
    requires_refrigeration: true, lot_number: 'TET-2551', next_expiry_date: day(300),
  },
  {
    id: 8703, item_number: 'ITM-0201', name: 'Examination gloves, medium', sku: 'CON-GLV-M',
    category_id: 8802, item_type: 'supply', unit_of_measure: 'box', barcode: '8901234500035',
    current_stock: 12, reorder_level: 20, reorder_quantity: 40, unit_cost: 6.2, selling_price: 0,
    supplier_id: 8901, status: 'active', is_lot_tracked: false, is_expiry_tracked: false,
    requires_refrigeration: false,
  },
  {
    id: 8704, item_number: 'ITM-0202', name: 'Alcohol swabs', sku: 'CON-SWB',
    category_id: 8802, item_type: 'supply', unit_of_measure: 'box', barcode: '8901234500042',
    current_stock: 64, reorder_level: 25, reorder_quantity: 50, unit_cost: 3.1, selling_price: 0,
    supplier_id: 8901, status: 'active', is_lot_tracked: false, is_expiry_tracked: false,
    requires_refrigeration: false,
  },
  {
    id: 8705, item_number: 'ITM-0301', name: 'Lidocaine 1% (10 mL vial)', sku: 'DRG-LID-1',
    category_id: 8803, item_type: 'medication', unit_of_measure: 'vial', barcode: '8901234500059',
    current_stock: 31, reorder_level: 15, reorder_quantity: 30, unit_cost: 4.8, selling_price: 12,
    supplier_id: 8901, status: 'active', is_lot_tracked: true, is_expiry_tracked: true,
    requires_refrigeration: false, lot_number: 'LID-4412', next_expiry_date: day(45),
  },
];

const inventoryMovements = [
  { id: 8601, movement_number: 'MV-2026-0311', item_id: 8701, item_name: 'Influenza vaccine (quadrivalent)', item_sku: 'VAC-FLU-Q', movement_type: 'out', quantity: 6, unit_of_measure: 'dose', unit_cost: 14.5, lot_number: 'FLU-2609', movement_date: at(0, 11, 20), performed_by_name: 'Sam Whitfield', notes: 'Administered — morning clinic' },
  { id: 8602, movement_number: 'MV-2026-0310', item_id: 8703, item_name: 'Examination gloves, medium', item_sku: 'CON-GLV-M', movement_type: 'out', quantity: 4, unit_of_measure: 'box', unit_cost: 6.2, movement_date: at(-1, 9, 5), performed_by_name: 'Robin Castellanos', notes: 'Room 2 restock' },
  { id: 8603, movement_number: 'MV-2026-0309', item_id: 8704, item_name: 'Alcohol swabs', item_sku: 'CON-SWB', movement_type: 'in', quantity: 40, unit_of_measure: 'box', unit_cost: 3.1, movement_date: at(-3, 14, 30), performed_by_name: 'Robin Castellanos', notes: 'PO-2026-0041 received' },
  { id: 8604, movement_number: 'MV-2026-0308', item_id: 8705, item_name: 'Lidocaine 1% (10 mL vial)', item_sku: 'DRG-LID-1', movement_type: 'adjustment', quantity: 2, unit_of_measure: 'vial', unit_cost: 4.8, lot_number: 'LID-4412', movement_date: at(-4, 16, 10), performed_by_name: 'Sam Whitfield', notes: 'Cycle count correction' },
];

const inventoryOrders = [
  {
    id: 8501, po_number: 'PO-2026-0042', supplier_id: 8902, supplier_name: 'Northwest Vaccines',
    status: 'pending', order_date: at(-2, 10), expected_date: day(4), total_amount: 1450,
    items: [{ item_id: 8701, item_name: 'Influenza vaccine (quadrivalent)', quantity: 100, unit_cost: 14.5, line_total: 1450 }],
  },
  {
    id: 8502, po_number: 'PO-2026-0041', supplier_id: 8901, supplier_name: 'Cascade Medical Supply',
    status: 'received', order_date: at(-9, 10), expected_date: day(-3), received_date: at(-3, 14), total_amount: 372,
    items: [
      { item_id: 8704, item_name: 'Alcohol swabs', quantity: 40, unit_cost: 3.1, line_total: 124 },
      { item_id: 8703, item_name: 'Examination gloves, medium', quantity: 40, unit_cost: 6.2, line_total: 248 },
    ],
  },
  {
    id: 8503, po_number: 'PO-2026-0040', supplier_id: 8901, supplier_name: 'Cascade Medical Supply',
    status: 'approved', order_date: at(-1, 15), expected_date: day(6), total_amount: 248,
    items: [{ item_id: 8703, item_name: 'Examination gloves, medium', quantity: 40, unit_cost: 6.2, line_total: 248 }],
  },
];

/** InventoryView overview cards: totalItems / totalValue / lowStockCount / expiringSoonCount. */
const inventorySummary = {
  totalItems: inventoryItems.length,
  totalValue: 3043,
  lowStockCount: 2,
  expiringSoonCount: 1,
};

/**
 * The Roles & Permissions matrix looks up a row per (roleName, resource) and
 * reads canView / canCreate / canEdit / canDelete / canApprove / canExport, so
 * the fixture has to be the full grid — a partial list renders as an empty
 * matrix of unticked boxes.
 */
const permissionGrid = (roles, resources, grants) =>
  roles.flatMap((roleName) => resources.map((resource) => {
    const allowed = roleName === 'admin' ? ['view', 'create', 'edit', 'delete', 'approve', 'export']
      : (grants[roleName] || {})[resource] || [];
    return {
      roleName, resource,
      canView: allowed.includes('view'),
      canCreate: allowed.includes('create'),
      canEdit: allowed.includes('edit'),
      canDelete: allowed.includes('delete'),
      canApprove: allowed.includes('approve'),
      canExport: allowed.includes('export'),
    };
  }));

const RBAC_ROLES = ['admin', 'billing_manager', 'doctor', 'nurse', 'receptionist', 'crm_manager'];

const inventoryPermissions = permissionGrid(
  RBAC_ROLES,
  ['items', 'categories', 'suppliers', 'stock_movements', 'purchase_orders'],
  {
    billing_manager: { items: ['view'], purchase_orders: ['view', 'create', 'approve', 'export'], suppliers: ['view'] },
    doctor: { items: ['view'], categories: ['view'], stock_movements: ['view'] },
    nurse: { items: ['view', 'edit'], categories: ['view'], stock_movements: ['view', 'create'] },
    receptionist: { items: ['view'], categories: ['view'] },
    crm_manager: { items: ['view'] },
  }
);

/* ── accounting ──────────────────────────────────────────────────────────── */
/* AccountsView is camelCase throughout. */

const accounts = [
  { id: 7701, accountNumber: '1000', accountName: 'Cash at bank', accountType: 'asset', accountSubtype: 'current_asset', currentBalance: 84210, isActive: true, isSystem: true, linkedToBilling: true },
  { id: 7702, accountNumber: '1100', accountName: 'Accounts receivable', accountType: 'asset', accountSubtype: 'current_asset', currentBalance: 31480, isActive: true, isSystem: true, linkedToAr: true, linkedToClaims: true },
  { id: 7703, accountNumber: '2000', accountName: 'Accounts payable', accountType: 'liability', accountSubtype: 'current_liability', currentBalance: 12640, isActive: true, isSystem: true, linkedToAp: true },
  { id: 7704, accountNumber: '3000', accountName: 'Retained earnings', accountType: 'equity', accountSubtype: 'equity', currentBalance: 46200, isActive: true, isSystem: true },
  { id: 7705, accountNumber: '4000', accountName: 'Patient service revenue', accountType: 'revenue', accountSubtype: 'operating_revenue', currentBalance: 218400, isActive: true, isSystem: false, linkedToBilling: true, linkedToClaims: true },
  { id: 7706, accountNumber: '4100', accountName: 'Telehealth revenue', accountType: 'revenue', accountSubtype: 'operating_revenue', currentBalance: 18900, isActive: true, isSystem: false, linkedToBilling: true },
  { id: 7707, accountNumber: '5000', accountName: 'Clinical supplies', accountType: 'expense', accountSubtype: 'operating_expense', currentBalance: 18920, isActive: true, isSystem: false },
  { id: 7708, accountNumber: '6000', accountName: 'Salaries and wages', accountType: 'expense', accountSubtype: 'operating_expense', currentBalance: 142300, isActive: true, isSystem: false },
];

const journalEntries = [
  { id: 7601, entryNumber: 'JE-2026-0311', entryDate: day(-1), entryType: 'automatic', description: 'Insurance payments posted — Blue Cross remittance', referenceNumber: 'ERA-88214', totalDebit: 4820, totalCredit: 4820, status: 'posted' },
  { id: 7602, entryNumber: 'JE-2026-0312', entryDate: day(0), entryType: 'automatic', description: 'Supplier invoice — Cascade Medical Supply', referenceNumber: 'BILL-2026-0067', totalDebit: 372, totalCredit: 372, status: 'draft' },
  { id: 7603, entryNumber: 'JE-2026-0310', entryDate: day(-3), entryType: 'manual', description: 'Payroll accrual — first half of the month', referenceNumber: 'PAY-2026-06A', totalDebit: 18640, totalCredit: 18640, status: 'posted' },
  { id: 7604, entryNumber: 'JE-2026-0309', entryDate: day(-5), entryType: 'automatic', description: 'Patient card payments — daily settlement', referenceNumber: 'STRIPE-0605', totalDebit: 2140, totalCredit: 2140, status: 'posted' },
];

const receivables = [
  { id: 7501, arNumber: 'AR-2026-0188', arType: 'insurance', payerName: 'Blue Cross Blue Shield', patientName: 'Sarah Williams', originalAmount: 18400, paidAmount: 5800, balanceDue: 12600, dueDate: day(9), agingBucket: 'current', status: 'partial' },
  { id: 7502, arNumber: 'AR-2026-0174', arType: 'insurance', payerName: 'Aetna', patientName: 'Marcus Boone', originalAmount: 9800, paidAmount: 0, balanceDue: 9800, dueDate: day(-12), agingBucket: '1-30', status: 'overdue' },
  { id: 7503, arNumber: 'AR-2026-0190', arType: 'patient', patientName: 'Priya Nandakumar', originalAmount: 180, paidAmount: 0, balanceDue: 180, dueDate: day(14), agingBucket: 'current', status: 'open' },
  { id: 7504, arNumber: 'AR-2026-0151', arType: 'insurance', payerName: 'United Healthcare', patientName: 'James Okonjo', originalAmount: 6400, paidAmount: 0, balanceDue: 6400, dueDate: day(-48), agingBucket: '31-60', status: 'overdue' },
];

const payables = [
  { id: 7401, apNumber: 'AP-2026-0067', apType: 'supplier', vendorName: 'Cascade Medical Supply', invoiceDate: day(-4), invoiceAmount: 372, balanceDue: 372, dueDate: day(11), status: 'open' },
  { id: 7402, apNumber: 'AP-2026-0065', apType: 'supplier', vendorName: 'Northwest Vaccines', invoiceDate: day(-19), invoiceAmount: 1450, balanceDue: 1450, dueDate: day(-4), status: 'overdue' },
  { id: 7403, apNumber: 'AP-2026-0068', apType: 'service', vendorName: 'Cascadia Building Services', invoiceDate: day(-2), invoiceAmount: 900, balanceDue: 900, dueDate: day(13), status: 'pending' },
];

const reconciliations = [
  { id: 7301, reconciliationNumber: 'REC-2026-0044', reconciliationType: 'bank', accountName: 'Cash at bank', periodStart: day(-31), periodEnd: day(-1), statementBalance: 84210, systemBalance: 84210, discrepancyAmount: 0, status: 'completed' },
  { id: 7302, reconciliationNumber: 'REC-2026-0043', reconciliationType: 'bank', accountName: 'Cash at bank', periodStart: day(-61), periodEnd: day(-32), statementBalance: 79420, systemBalance: 79420, discrepancyAmount: 0, status: 'completed' },
  { id: 7303, reconciliationNumber: 'REC-2026-0045', reconciliationType: 'merchant', accountName: 'Cash at bank', periodStart: day(-7), periodEnd: day(0), statementBalance: 2140, systemBalance: 2098, discrepancyAmount: 42, status: 'in_progress' },
];

const statements = [
  { id: 7201, statementNumber: 'ST-2026-0044', statementType: 'patient', patientName: 'Sarah Williams', periodStart: day(-30), periodEnd: day(0), previousBalance: 60, charges: 240, payments: 240, currentBalance: 60, status: 'sent' },
  { id: 7202, statementNumber: 'ST-2026-0045', statementType: 'patient', patientName: 'Marcus Boone', periodStart: day(-30), periodEnd: day(0), previousBalance: 0, charges: 120, payments: 120, currentBalance: 0, status: 'paid' },
  { id: 7203, statementNumber: 'ST-2026-0046', statementType: 'payer', payerName: 'Aetna', periodStart: day(-30), periodEnd: day(0), previousBalance: 4200, charges: 9800, payments: 4200, currentBalance: 9800, status: 'draft' },
];

/** AccountsView overview cards. */
const accountsDashboard = {
  totalAR: 28980, arCount: 4,
  totalAP: 2722, apCount: 3,
  cashBalance: 84210,
  draftJournalEntries: 1,
};

const accountPermissions = permissionGrid(
  RBAC_ROLES,
  ['chart_of_accounts', 'journal_entries', 'accounts_receivable', 'accounts_payable', 'reconciliation', 'statements'],
  {
    billing_manager: {
      chart_of_accounts: ['view'],
      journal_entries: ['view', 'create'],
      accounts_receivable: ['view', 'create', 'edit', 'export'],
      accounts_payable: ['view', 'create', 'edit', 'approve'],
      reconciliation: ['view', 'create'],
      statements: ['view', 'create', 'export'],
    },
    doctor: { chart_of_accounts: ['view'], journal_entries: ['view'] },
    nurse: {},
    receptionist: { accounts_receivable: ['view'], statements: ['view'] },
    crm_manager: { statements: ['view'] },
  }
);

/* ── FHIR ────────────────────────────────────────────────────────────────── */
/* FHIRView reads resource_type / resource_id / patient_id / last_updated /
 * fhir_version, and resolves the patient name from the patients list, so
 * patient_id must match a fixture patient. */

const fhirResources = [
  { id: 6001, resource_type: 'Patient', resource_id: 'Patient/101', patient_id: 101, last_updated: at(-1, 9), fhir_version: 'R4', resource_data: { resourceType: 'Patient', id: '101', name: [{ family: 'Williams', given: ['Sarah'] }], gender: 'female', birthDate: '1985-03-14' } },
  { id: 6002, resource_type: 'Observation', resource_id: 'Observation/6001', patient_id: 101, last_updated: at(-1, 9, 5), fhir_version: 'R4', resource_data: { resourceType: 'Observation', id: '6001', status: 'final', code: { text: 'Blood pressure' }, valueString: '128/82 mmHg' } },
  { id: 6003, resource_type: 'Condition', resource_id: 'Condition/8001', patient_id: 101, last_updated: at(-1, 9, 6), fhir_version: 'R4', resource_data: { resourceType: 'Condition', id: '8001', code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'E11.9' }], text: 'Type 2 diabetes mellitus without complications' } } },
  { id: 6004, resource_type: 'Medication', resource_id: 'MedicationRequest/8501', patient_id: 101, last_updated: at(-2, 15), fhir_version: 'R4', resource_data: { resourceType: 'MedicationRequest', id: '8501', status: 'active', medicationCodeableConcept: { text: 'Metformin 500 mg' } } },
  { id: 6005, resource_type: 'Procedure', resource_id: 'Procedure/9008', patient_id: 102, last_updated: at(-2, 10, 30), fhir_version: 'R4', resource_data: { resourceType: 'Procedure', id: '9008', status: 'completed', code: { text: 'Influenza vaccination' } } },
  { id: 6006, resource_type: 'Patient', resource_id: 'Patient/102', patient_id: 102, last_updated: at(-3, 12), fhir_version: 'R4', resource_data: { resourceType: 'Patient', id: '102', name: [{ family: 'Ellis', given: ['Jordan'] }], gender: 'other', birthDate: '1978-11-02' } },
];

const fhirStats = {
  totalResources: fhirResources.length, total_resources: fhirResources.length,
  fhirVersion: 'R4', fhir_version: 'R4',
  status: 'Connected', lastSync: at(-1, 9, 6), last_sync: at(-1, 9, 6),
};

/**
 * FHIRTrackingDashboard's worklist. It only shows exchanges that need someone
 * to act, so every row here carries an error — that is the point of the screen.
 */
const fhirTrackingErrors = [
  {
    id: 6802, tracking_number: 'LAB-2026-0210', resource_type: 'ServiceRequest',
    current_status: 'rejected', vendor_name: 'Labcorp',
    last_error_code: 'MISSING_NPI', error_severity: 'error',
    error_title: 'Lab order rejected by the receiving system',
    last_error_message: 'ServiceRequest.requester is missing an NPI for the ordering provider.',
    error_description: 'Labcorp rejects orders whose ordering provider has no National Provider Identifier on file.',
    last_error_at: at(-1, 11, 2),
    suggested_actions: [
      { priority: 'high', action: 'Add the NPI to Dr. Anderson under Scheduling ▸ Providers', type: 'configuration' },
      { priority: 'medium', action: 'Resend the order once the NPI is saved', type: 'retry' },
    ],
    resolution_guide: 'Provider NPIs live on the provider record. Once saved, re-send from the lab order; no new order is needed.',
    requires_manual_intervention: true,
  },
  {
    id: 6804, tracking_number: 'RX-2026-0093', resource_type: 'MedicationRequest',
    current_status: 'error', vendor_name: 'Surescripts',
    last_error_code: 'PHARMACY_UNREACHABLE', error_severity: 'warning',
    error_title: 'Pharmacy did not acknowledge the prescription',
    last_error_message: 'No acknowledgement received from Northside Pharmacy within 30 minutes.',
    error_description: 'The message was accepted by the network but the destination pharmacy has not confirmed receipt.',
    last_error_at: at(0, 10, 12),
    suggested_actions: [
      { priority: 'medium', action: 'Retry the transmission', type: 'retry' },
      { priority: 'low', action: 'Phone the pharmacy if the retry also fails', type: 'manual' },
    ],
    resolution_guide: 'Transient network faults usually clear on a retry. Two failed retries means the pharmacy record needs checking.',
    requires_manual_intervention: false,
  },
];

/** Detail view for one tracking number, keyed by tracking_number. */
const fhirTrackingRecords = {
  'LAB-2026-0210': {
    id: 6802, tracking_number: 'LAB-2026-0210', resource_type: 'ServiceRequest', resource_id: '7702',
    current_status: 'rejected', vendor_name: 'Labcorp', patient_name: 'Priya Nandakumar',
    created_at: at(-1, 11), updated_at: at(-1, 11, 2),
    events: [
      { id: 1, status: 'created', occurred_at: at(-1, 11), message: 'Lab order created in AureonCare' },
      { id: 2, status: 'transmitted', occurred_at: at(-1, 11, 1), message: 'Sent to Labcorp' },
      { id: 3, status: 'rejected', occurred_at: at(-1, 11, 2), message: 'Rejected: missing ordering provider NPI' },
    ],
  },
};

module.exports = {
  auditLogs, auditStats, auditPagination,
  backupConfig, backupHistory,
  archiveModules, archiveRecords, archiveStats, archiveRules,
  inventoryCategories, inventorySuppliers, inventoryItems,
  inventoryMovements, inventoryOrders, inventorySummary, inventoryPermissions,
  accounts, journalEntries, receivables, payables,
  reconciliations, statements, accountsDashboard, accountPermissions,
  vendorIntegrations, stripeSettings,
  fhirResources, fhirStats, fhirTrackingErrors, fhirTrackingRecords,
};
