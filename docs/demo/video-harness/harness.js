/**
 * Shared recording harness for the AureonCare training-video library.
 *
 * A video script is a module that exports metadata plus an async `run(d, page)`.
 * This file supplies everything else: a mocked API backed by the shared
 * fixtures, the on-screen caption / cursor / title-card layer, timed caption and
 * chapter capture, and a YouTube-ready encode.
 *
 * Each run produces, in the output directory:
 *   <slug>.mp4            1920x1080 · H.264 high · 30fps · faststart · silent AAC
 *   <slug>.srt            subtitles built from the on-screen captions
 *   <slug>.chapters.txt   YouTube chapter list (first entry always 0:00)
 *   <slug>.metadata.md    title, description, tags, upload checklist
 *   <slug>.thumbnail.png  1280x720 thumbnail
 *
 * Run one:   NODE_PATH=$(npm root -g) node docs/demo/video-harness/record.js v01
 * Run all:   NODE_PATH=$(npm root -g) node docs/demo/video-harness/record.js all
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const F = require('./fixtures');
const voice = require('./voice');
const W3 = require('./fixtures-wave3');
const W4 = require('./fixtures-wave4');

/** Brand kit. Colours are sampled from the logo, not invented. */
const BRAND = {
  amber: '#f0b000',
  amberLight: '#ffd24a',
  teal: '#00b0a0',
  tealLight: '#2dd4bf',
  ink: '#041016',
  logo: 'data:image/png;base64,' + fs.readFileSync(
    path.join(__dirname, 'brand', 'aureoncare-logo-wide.png')
  ).toString('base64'),
};

/** Playlist each wave uploads into. Named here so metadata cannot drift. */
const PLAYLISTS = {
  1: 'AureonCare — Getting Started (Wave 1)',
  2: 'AureonCare — Revenue and Clinical (Wave 2)',
  3: 'AureonCare — Patient Engagement and Growth (Wave 3)',
  4: 'AureonCare — Administration and Back Office (Wave 4)',
};

const MARKETING_PLAYLIST = 'AureonCare — See It Work';

const BASE_URL = process.env.DEMO_BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.DEMO_API_URL || 'http://localhost:3001/api';
/**
 * Where a recording lands. Each wave gets its own directory, taken from the
 * spec's `wave` field so a script cannot be filed under the wrong one; OUT_DIR
 * overrides for one-off runs.
 */
const outDirFor = (spec) => process.env.OUT_DIR
  || path.join(
    __dirname, '..', 'video-library',
    spec.marketing ? 'marketing' : `wave${spec.wave || 1}`
  );
const VIEWPORT = { width: 1920, height: 1080 };
const FPS = 30;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return require(name);
    } catch (_) { /* keep looking */ }
  }
  throw new Error('Playwright not found. npm i -g playwright, then run with NODE_PATH=$(npm root -g).');
}

/* ─────────────────────────────── mock API ───────────────────────────────── */

/** Deep copy so a run can mutate freely without leaking into the next one. */
const clone = (v) => JSON.parse(JSON.stringify(v));

function createStore() {
  return {
    patients: clone(F.patients),
    appointments: clone(F.appointments),
    users: clone(F.users),
    providers: clone(F.providers),
    'appointment-types': clone(F.appointmentTypes),
    claims: clone(F.claims),
    payments: clone(F.payments),
    tasks: clone(F.tasks),
    notifications: clone(F.notifications),
    'insurance-payers': clone(F.insurancePayers),
    'medical-records': clone(F.medicalRecords),
    vitals: clone(F.vitals),
    allergies: clone(F.allergies),
    diagnosis: clone(F.diagnoses),
    prescriptions: clone(F.prescriptions),
    telehealth: clone(F.telehealthSessions),
    'telehealth-settings': clone(F.telehealthProviders),
    offerings: clone(F.offerings),
    'form-templates': clone(F.formTemplates),
    preapprovals: clone(F.preapprovals),
    denials: clone(F.denials),
    'payment-postings': clone(F.paymentPostings),
    quotes: clone(F.quotes),
    invoices: clone(F.invoices),
    pharmacies: clone(F.pharmacies),
    laboratories: clone(F.laboratories),
    'lab-orders': clone(F.labOrders),
    waitlist: clone(W3.waitlist),
    campaigns: [],
    // Wave 3 screens
    'intake-forms': clone(W3.intakeForms),
    _intakeFlows: clone(W3.intakeFlows),
    _consentForms: clone(W3.consentForms),
    _formTemplates: clone(W3.formTemplates),
    _formSubmissions: clone(W3.formSubmissions),
    _offerings: clone(W3.offerings),
    _packages: clone(W3.offeringPackages),
    _promotions: clone(W3.offeringPromotions),
    _categories: clone(W3.serviceCategories),
    // Wave 4 screens — administration, back office and interoperability.
    _auditLogs: clone(W4.auditLogs),
    _archives: clone(W4.archiveRecords),
    _archiveRules: clone(W4.archiveRules),
    _invItems: clone(W4.inventoryItems),
    _invCategories: clone(W4.inventoryCategories),
    _invSuppliers: clone(W4.inventorySuppliers),
    _invMovements: clone(W4.inventoryMovements),
    _invOrders: clone(W4.inventoryOrders),
    _accounts: clone(W4.accounts),
    _journalEntries: clone(W4.journalEntries),
    _receivables: clone(W4.receivables),
    _payables: clone(W4.payables),
    _reconciliations: clone(W4.reconciliations),
    _statements: clone(W4.statements),
    _fhirResources: clone(W4.fhirResources),
    _fhirErrors: clone(W4.fhirTrackingErrors),
    _vendors: clone(W4.vendorIntegrations),
    _acctPermissions: clone(W4.accountPermissions),
    _invPermissions: clone(W4.inventoryPermissions),
    _nextId: 90000,
    _user: clone(F.demoUser),
  };
}

/**
 * The two RBAC matrices send the whole permission row back on a toggle, so the
 * mock replaces the matching row rather than patching a single flag.
 */
function upsertPermission(rows, body) {
  const idx = rows.findIndex((r) => r.roleName === body.roleName && r.resource === body.resource);
  const updated = { ...(idx >= 0 ? rows[idx] : {}), ...body };
  if (idx >= 0) rows[idx] = updated; else rows.push(updated);
  return updated;
}

const PATIENT_KEYS = ['patient_id', 'patientId', 'patient'];

function filterByQuery(rows, url) {
  let out = rows;
  for (const key of PATIENT_KEYS) {
    const v = url.searchParams.get(key);
    if (v) out = out.filter((r) => String(r.patient_id) === String(v));
  }
  const status = url.searchParams.get('status');
  if (status) out = out.filter((r) => String(r.status) === status);
  return out;
}

async function handleApi(route, store) {
  const request = route.request();
  const url = new URL(request.url());
  // DEBUG_API=1 prints every call the app makes. Worth reaching for when a
  // screen renders empty: it distinguishes "the mock returned nothing" from
  // "the app never asked", which are very different bugs.
  if (process.env.DEBUG_API) console.log('[api]', request.method(), url.pathname + url.search);
  const method = request.method();
  const p = url.pathname.replace(/^.*\/api/, '') || '/';
  const body = (() => {
    try { return request.postDataJSON() || {}; } catch (_) { return {}; }
  })();
  const json = (data, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

  // ── auth, telemetry, settings ─────────────────────────────────────────
  if (p === '/auth/login') return json({ token: 'demo.jwt.token', user: store._user });
  if (p.startsWith('/audit') && method === 'POST') return json({ id: 1 });
  if (p === '/clinic-settings' || p === '/clinic-settings/info') return json(F.clinic);
  // The admin panel keys working hours by day name and reads open/close/enabled;
  // an array of day_of_week rows renders as "0 1 2 …" with empty times.
  if (p === '/clinic-settings/working-hours') {
    if (method !== 'GET') return json({ success: true });
    return json({
      monday: { open: '08:00', close: '17:00', enabled: true },
      tuesday: { open: '08:00', close: '17:00', enabled: true },
      wednesday: { open: '08:00', close: '17:00', enabled: true },
      thursday: { open: '08:00', close: '19:00', enabled: true },
      friday: { open: '08:00', close: '16:00', enabled: true },
      saturday: { open: '09:00', close: '13:00', enabled: true },
      sunday: { open: '09:00', close: '13:00', enabled: false },
    });
  }
  if (p === '/clinic-settings/appointment-settings') {
    if (method !== 'GET') return json({ success: true });
    return json({
      defaultDuration: 30,
      slotInterval: 15,
      maxAdvanceBooking: 60,
      cancellationDeadline: 24,
    });
  }
  if (p === '/stripe-settings') return json(W4.stripeSettings);
  if (p === '/vendor-integration-settings') return json(store._vendors);
  const vendorToggle = p.match(/^\/vendor-integration-settings\/([^/]+)\/toggle$/);
  if (vendorToggle) {
    const row = store._vendors.find((v) => v.vendor_type === vendorToggle[1]);
    if (row) row.is_enabled = body.isEnabled ?? body.is_enabled ?? !row.is_enabled;
    return json(row || {});
  }
  const vendorSave = p.match(/^\/vendor-integration-settings\/([^/]+)$/);
  if (vendorSave && method === 'POST') {
    let row = store._vendors.find((v) => v.vendor_type === vendorSave[1]);
    if (!row) {
      row = { id: store._nextId++, vendor_type: vendorSave[1], is_enabled: false };
      store._vendors.push(row);
    }
    Object.assign(row, body);
    return json(row);
  }

  // ── universal search ──────────────────────────────────────────────────
  if (/^\/users\/\d+$/.test(p) && method === 'GET') {
    const id = p.split('/').pop();
    if (String(store._user.id) === id) return json(store._user);
  }

  if (p === '/search') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    if (q.length < 2) return json([]);
    const hits = [];
    for (const pt of store.patients) {
      if (`${pt.first_name} ${pt.last_name} ${pt.mrn}`.toLowerCase().includes(q)) {
        hits.push({
          id: pt.id, result_type: 'patient',
          display_name: `${pt.first_name} ${pt.last_name}`,
          display_subtitle: `${pt.mrn} · ${pt.phone}`,
        });
      }
    }
    for (const ap of store.appointments) {
      const pt = store.patients.find((x) => x.id === ap.patient_id);
      if (pt && `${pt.first_name} ${pt.last_name} ${ap.appointment_type}`.toLowerCase().includes(q)) {
        hits.push({
          id: ap.id, result_type: 'appointment',
          display_name: `${ap.appointment_type} — ${pt.first_name} ${pt.last_name}`,
          display_subtitle: new Date(ap.start_time).toLocaleString(),
        });
      }
    }
    for (const cl of store.claims) {
      if (`${cl.claim_number} ${cl.insurance_provider}`.toLowerCase().includes(q)) {
        hits.push({
          id: cl.id, result_type: 'claim',
          display_name: cl.claim_number,
          display_subtitle: `${cl.insurance_provider} · ${cl.status}`,
        });
      }
    }
    return json(hits.slice(0, Number(url.searchParams.get('limit') || 20)));
  }

  // ── lookups the forms need ────────────────────────────────────────────
  if (p === '/medical-codes/search') {
    const q = (url.searchParams.get('query') || '').toLowerCase();
    const type = url.searchParams.get('type') || 'all';
    const pool = type === 'icd' ? F.medicalCodes.icd
      : type === 'cpt' ? F.medicalCodes.cpt
        : [...F.medicalCodes.icd, ...F.medicalCodes.cpt];
    return json(pool.filter((c) =>
      c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)));
  }
  // ── prescribing: the catalogue and the safety checks ──────────────────
  if (p === '/medications/search') {
    const q = (url.searchParams.get('query') || '').toLowerCase();
    if (q.length < 2) return json([]);
    return json(F.medications.filter((m) =>
      `${m.name} ${m.generic_name} ${m.brand_name} ${m.ndc_code}`.toLowerCase().includes(q)));
  }
  if (p === '/diagnosis/patient' || /^\/diagnosis\/patient\/\d+$/.test(p)) {
    const id = p.split('/').pop();
    return json(store.diagnosis.filter((d) => String(d.patient_id) === id));
  }
  if (/^\/prescriptions\/diagnosis\/\d+$/.test(p)) return json([]);

  // ── telehealth specifics ──────────────────────────────────────────────
  const toggle = p.match(/^\/telehealth-settings\/([^/]+)\/toggle$/);
  if (toggle) {
    const row = store['telehealth-settings'].find((r) => r.provider_type === toggle[1]);
    if (row) row.is_enabled = body.isEnabled ?? body.is_enabled ?? !row.is_enabled;
    return json(row || {});
  }
  const instant = p.match(/^\/telehealth-settings\/([^/]+)\/instant-meeting$/);
  if (instant) {
    const link = F.MEET_LINKS[0];
    return json({ joinUrl: link, join_url: link, meetingUrl: link });
  }
  if (p === '/telehealth' && method === 'POST') {
    const appt = store.appointments.find((a) => a.id === body.appointmentId) || {};
    const link = F.MEET_LINKS[store.telehealth.length % F.MEET_LINKS.length];
    const session = {
      id: store._nextId++,
      appointment_id: body.appointmentId,
      patient_id: body.patientId ?? appt.patient_id,
      provider_id: body.providerId ?? appt.provider_id,
      provider_type: 'google_meet',
      session_status: 'scheduled',
      start_time: body.startTime || appt.start_time,
      duration_minutes: body.duration || appt.duration_minutes || 30,
      meeting_url: link, join_url: link,
      calendar_event_id: `demo_evt_${store._nextId}`,
    };
    store.telehealth.unshift(session);
    return json(session);
  }

  // ── claim submission ──────────────────────────────────────────────────
  const submit = p.match(/^\/claims\/(\d+)\/submit$/) || p.match(/^\/edi\/837\/submit\/(\d+)$/);
  if (submit) {
    const claim = store.claims.find((c) => String(c.id) === submit[1]);
    if (claim) {
      claim.status = 'submitted';
      claim.submitted_at = new Date().toISOString();
    }
    return json({ success: true, claim, message: 'Claim accepted by clearinghouse' });
  }

  // ── patient billing lives under /billing/* rather than at the top level ──
  const billing = p.match(/^\/billing\/(quotes|invoices|coupons|payments)(\/.*)?$/);
  if (billing) {
    const map = { quotes: 'quotes', invoices: 'invoices', coupons: null, payments: 'payments' };
    const key = map[billing[1]];
    const rows = key ? store[key] : [];
    if (method === 'GET' && !billing[2]) return json(filterByQuery(rows, url));
    if (method === 'POST' && key) {
      const numberField = billing[1] === 'quotes' ? 'quote_number' : 'invoice_number';
      const prefix = billing[1] === 'quotes' ? 'QT' : 'INV';
      const created = {
        id: store._nextId++, created_at: new Date().toISOString(), ...body,
        [numberField]: body[numberField] || `${prefix}-2026-0${store._nextId % 1000}`,
        status: body.status || 'draft',
      };
      rows.unshift(created);
      return json(created);
    }
  }

  // ── Wave 3: waitlist, intake, forms, catalogue, reports, booking ──────
  if (p === '/waitlist/admin/all') return json(store.waitlist);
  const wlNotify = p.match(/^\/waitlist\/admin\/notify-next/) || p.match(/^\/waitlist\/(\d+)\/notify$/);
  if (wlNotify && method === 'POST') {
    const next = store.waitlist.find((w) => w.status === 'active');
    if (next) { next.status = 'notified'; next.notified_at = new Date().toISOString(); }
    return json({ success: true, entry: next || null, message: 'Patient notified' });
  }
  const wlSched = p.match(/^\/waitlist\/(\d+)\/scheduled$/);
  if (wlSched) {
    const entry = store.waitlist.find((w) => String(w.id) === wlSched[1]);
    if (entry) entry.status = 'scheduled';
    return json(entry || { success: true });
  }

  if (p === '/intake-forms') return json(store['intake-forms']);
  if (p === '/intake-forms/flows') return json(store._intakeFlows);
  if (p === '/intake-forms/consents') return json(store._consentForms);

  if (p === '/form-management/stats') return json(W3.formStats);
  if (p === '/form-management/templates') {
    if (method === 'POST') {
      const created = { id: store._nextId++, version: 1, status: 'draft', submissions_count: 0, ...body };
      store._formTemplates.unshift(created);
      return json(created);
    }
    return json(store._formTemplates);
  }
  if (p === '/form-management/submissions') {
    if (method === 'POST') return json({ id: store._nextId++, ...body });
    return json(store._formSubmissions);
  }
  if (p.startsWith('/form-management/audit')) return json(W3.formAuditLogs);
  if (/^\/form-management\/templates\/\d+\/versions$/.test(p)) return json([]);

  if (p === '/offerings' && method === 'GET') return json(store._offerings);
  if (p === '/offerings') {
    if (method === 'POST') {
      const created = { id: store._nextId++, is_active: true, ...body };
      store._offerings.unshift(created);
      return json(created);
    }
    return json(store._offerings);
  }
  if (p === '/offerings/categories') return json(store._categories);
  if (p === '/offerings/packages/all') return json(store._packages);
  if (p === '/offerings/promotions/all') return json(store._promotions);
  if (p === '/offerings/statistics/overview') return json(W3.offeringStatistics);
  if (p === '/offerings/packages' && method === 'POST') {
    const created = { id: store._nextId++, is_active: true, ...body };
    store._packages.unshift(created);
    return json(created);
  }
  if (p === '/offerings/promotions' && method === 'POST') {
    const created = { id: store._nextId++, is_active: true, status: 'active', usage_count: 0, ...body };
    store._promotions.unshift(created);
    return json(created);
  }
  if (/^\/offerings\/\d+\/forms$/.test(p)) return json([]);

  if (p === '/reports/operational/no-shows') return json(W3.noShowReport);
  if (p === '/reports/operational/daily-appointments') return json(W3.dailyAppointmentsReport);
  if (p === '/reports/custom' && method === 'POST') return json(W3.customReportResult);
  if (p.startsWith('/reports/')) return json({ summary: [], details: [] });

  // Public booking: reached at /book/<slug>, before the auth gate.
  if (p.startsWith('/scheduling/booking-config/slug/')) return json(W3.bookingConfig);
  if (p.startsWith('/scheduling/appointment-types/')) return json(W3.bookingTypes);
  // The page maps the dates array directly, and reads slot.start, so both come
  // back as bare arrays rather than wrapped objects.
  if (p.startsWith('/scheduling/available-dates/')) return json(W3.bookingDates);
  if (p.startsWith('/scheduling/slots/')) {
    const date = url.searchParams.get('date') || W3.bookingDates[0];
    return json(W3.slotsForDate(date));
  }
  if (p === '/scheduling/book' && method === 'POST') {
    return json({
      success: true,
      confirmationNumber: 'BK-2026-0413',
      confirmation_number: 'BK-2026-0413',
      appointment: { id: store._nextId++, ...body },
      message: 'Appointment booked',
    });
  }

  // ── Wave 4: audit, archive, backup, inventory, accounting, FHIR ───────

  // Audit. The tab expects a { data, pagination } envelope, and filters
  // server-side — so the mock filters too, otherwise the video shows a
  // filter being applied and nothing changing.
  if (p === '/audit' && method === 'GET') {
    let rows = store._auditLogs;
    const eq = (field, param) => {
      const v = url.searchParams.get(param || field);
      if (v) rows = rows.filter((r) => String(r[field] || '').toLowerCase() === v.toLowerCase());
    };
    eq('action_type'); eq('resource_type'); eq('module'); eq('status');
    const email = url.searchParams.get('user_email');
    if (email) rows = rows.filter((r) => (r.user_email || '').toLowerCase().includes(email.toLowerCase()));
    const name = url.searchParams.get('resource_name');
    if (name) rows = rows.filter((r) => (r.resource_name || '').toLowerCase().includes(name.toLowerCase()));
    return json({ data: rows, pagination: { ...W4.auditPagination, total: rows.length } });
  }
  if (p === '/audit/stats/summary') return json(W4.auditStats);
  if (p === '/audit/stats/top-users') return json([]);
  if (p === '/audit/export/csv') {
    return route.fulfill({ status: 200, contentType: 'text/csv', body: 'timestamp,user,action\n' });
  }

  // Archive. Every response is wrapped in its own key.
  if (p === '/archive/list') return json({ archives: store._archives });
  if (p === '/archive/modules') return json({ modules: W4.archiveModules });
  if (p === '/archive/stats/summary') return json({ stats: W4.archiveStats });
  if (p === '/archive-rules' && method === 'GET') return json({ rules: store._archiveRules });
  if (p === '/archive/create' && method === 'POST') {
    const created = {
      id: store._nextId++,
      archive_name: body.archiveName || body.archive_name || 'New archive',
      description: body.description || '',
      status: 'active',
      archive_date: new Date().toISOString(),
      record_count: 1840,
      size_bytes: 24117248,
      modules: body.modules || body.selectedModules || [],
      metadata: { recordCounts: { appointments: 1840 } },
    };
    store._archives.unshift(created);
    return json({ success: true, archive: created });
  }
  if (/^\/archive\/\d+\/browse$/.test(p)) {
    const table = url.searchParams.get('table');
    if (!table) {
      return json({
        tables: [
          { name: 'appointments', count: 4120 },
          { name: 'claims', count: 2310 },
        ],
      });
    }
    return json({
      table,
      data: store.appointments.slice(0, 5).map((a) => ({
        id: a.id, patient_id: a.patient_id, appointment_type: a.appointment_type, status: a.status,
      })),
    });
  }

  // Backup.
  if (p === '/backup/config') return json(W4.backupConfig);
  // The Backup tab loads /backup/config first and then overwrites it with
  // /backup-providers/config/status, so the second one is what shows on screen.
  if (p === '/backup-providers/config/status') {
    return json({
      googleDrive: { configured: true, connected: true, account: W4.backupConfig.googleDrive.account },
      oneDrive: { configured: false, connected: false },
    });
  }
  if (p === '/backup/generate') return json({ backup: { generated_at: new Date().toISOString(), tables: 42 } });
  if (p === '/backup/google-drive' && method === 'POST') {
    return json({ success: true, fileId: 'demo-drive-file', message: 'Backup uploaded to Google Drive' });
  }
  if (p === '/accounts/backup') return json(W4.backupHistory);
  if (p === '/inventory/backup') return json(W4.backupHistory);

  // Inventory.
  if (p === '/inventory/reports/summary') return json(W4.inventorySummary);
  if (p === '/inventory/rbac/permissions') {
    if (method === 'PUT') return json(upsertPermission(store._invPermissions, body));
    return json(store._invPermissions);
  }
  if (p === '/inventory/categories') {
    if (method === 'POST') {
      const created = { id: store._nextId++, is_active: true, ...body };
      store._invCategories.push(created);
      return json(created);
    }
    return json(store._invCategories);
  }
  if (p === '/inventory/suppliers') {
    if (method === 'POST') {
      const created = { id: store._nextId++, status: 'active', supplier_number: `SUP-0${store._nextId % 100}`, ...body };
      store._invSuppliers.push(created);
      return json(created);
    }
    return json(store._invSuppliers);
  }
  if (p === '/inventory/items') {
    if (method === 'POST') {
      const created = {
        id: store._nextId++,
        item_number: `ITM-0${store._nextId % 1000}`,
        current_stock: Number(body.current_stock || body.opening_stock || 0),
        status: 'active',
        ...body,
      };
      store._invItems.unshift(created);
      return json(created);
    }
    return json(store._invItems);
  }
  const invItem = p.match(/^\/inventory\/items\/(\d+)$/);
  if (invItem) {
    const idx = store._invItems.findIndex((i) => String(i.id) === invItem[1]);
    if (method === 'GET') return json(store._invItems[idx] || {});
    if (method === 'PUT') {
      store._invItems[idx] = { ...store._invItems[idx], ...body };
      return json(store._invItems[idx]);
    }
    if (method === 'DELETE') {
      const [removed] = store._invItems.splice(idx, 1);
      return json({ success: true, item: removed });
    }
  }
  if (p === '/inventory/movements') {
    if (method === 'POST') {
      const item = store._invItems.find((i) => String(i.id) === String(body.item_id));
      const qty = Number(body.quantity || 0);
      if (item) {
        if (body.movement_type === 'out') item.current_stock -= qty;
        else if (body.movement_type === 'in') item.current_stock += qty;
        else item.current_stock = qty;
      }
      const created = {
        id: store._nextId++,
        movement_number: `MV-2026-0${store._nextId % 1000}`,
        item_name: item ? item.name : '',
        item_sku: item ? item.sku : '',
        unit_of_measure: item ? item.unit_of_measure : '',
        movement_date: new Date().toISOString(),
        performed_by_name: `${F.demoUser.first_name} ${F.demoUser.last_name}`,
        ...body,
      };
      store._invMovements.unshift(created);
      return json(created);
    }
    return json(store._invMovements);
  }
  const invReceive = p.match(/^\/inventory\/orders\/(\d+)\/receive$/);
  if (invReceive && method === 'POST') {
    const order = store._invOrders.find((o) => String(o.id) === invReceive[1]);
    if (order) {
      order.status = 'received';
      order.received_date = new Date().toISOString();
      // Receiving is what makes the stock number move — the whole point of
      // the purchase-order journey, so the mock has to actually do it.
      for (const line of order.items || []) {
        const item = store._invItems.find((i) => String(i.id) === String(line.item_id));
        if (item) item.current_stock += Number(line.quantity || 0);
      }
    }
    return json(order || { success: true });
  }
  const invOrder = p.match(/^\/inventory\/orders\/(\d+)$/);
  if (invOrder) {
    const idx = store._invOrders.findIndex((o) => String(o.id) === invOrder[1]);
    if (method === 'GET') return json(store._invOrders[idx] || {});
    if (method === 'PUT') {
      store._invOrders[idx] = { ...store._invOrders[idx], ...body };
      return json(store._invOrders[idx]);
    }
    if (method === 'DELETE') {
      const [removed] = store._invOrders.splice(idx, 1);
      return json({ success: true, order: removed });
    }
  }
  if (p === '/inventory/orders') {
    if (method === 'POST') {
      const supplier = store._invSuppliers.find((s) => String(s.id) === String(body.supplier_id));
      const lines = (body.items || []).map((line) => {
        const item = store._invItems.find((i) => String(i.id) === String(line.item_id));
        const unitCost = Number(line.unit_cost ?? (item ? item.unit_cost : 0));
        return {
          ...line,
          item_name: item ? item.name : line.item_name,
          unit_cost: unitCost,
          line_total: unitCost * Number(line.quantity || 0),
        };
      });
      const created = {
        id: store._nextId++,
        po_number: `PO-2026-0${store._nextId % 1000}`,
        supplier_name: supplier ? supplier.name : '',
        status: 'pending',
        order_date: new Date().toISOString(),
        total_amount: lines.reduce((s, l) => s + l.line_total, 0),
        ...body,
        items: lines,
      };
      store._invOrders.unshift(created);
      return json(created);
    }
    return json(store._invOrders);
  }
  if (p.startsWith('/inventory/reports/')) return json([]);

  // Accounting. Note the order: the more specific /accounts/* paths have to
  // be matched before the bare /accounts collection.
  if (p === '/accounts/reports/dashboard') return json(W4.accountsDashboard);
  if (p === '/accounts/rbac/permissions') {
    if (method === 'PUT') return json(upsertPermission(store._acctPermissions, body));
    return json(store._acctPermissions);
  }
  const jePost = p.match(/^\/accounts\/journal\/entries\/(\d+)\/(post|void)$/);
  if (jePost && method === 'POST') {
    const entry = store._journalEntries.find((e) => String(e.id) === jePost[1]);
    if (entry) entry.status = jePost[2] === 'post' ? 'posted' : 'voided';
    return json(entry || { success: true });
  }
  if (p === '/accounts/journal/entries') {
    if (method === 'POST') {
      const created = {
        id: store._nextId++,
        entryNumber: `JE-2026-0${store._nextId % 1000}`,
        entryDate: new Date().toISOString().slice(0, 10),
        entryType: 'manual',
        status: 'draft',
        totalDebit: Number(body.totalDebit || 0),
        totalCredit: Number(body.totalCredit || 0),
        ...body,
      };
      store._journalEntries.unshift(created);
      return json(created);
    }
    return json(store._journalEntries);
  }
  const stmtSend = p.match(/^\/accounts\/statements\/(\d+)\/send$/);
  if (stmtSend) {
    const stmt = store._statements.find((s) => String(s.id) === stmtSend[1]);
    if (stmt) { stmt.status = 'sent'; stmt.sent_at = new Date().toISOString(); }
    return json(stmt || { success: true });
  }
  const ACCOUNT_SUBS = {
    receivables: ['_receivables', 'arNumber', 'AR'],
    payables: ['_payables', 'apNumber', 'AP'],
    reconciliations: ['_reconciliations', 'reconciliationNumber', 'REC'],
    statements: ['_statements', 'statementNumber', 'ST'],
  };
  const acctSub = p.match(/^\/accounts\/(receivables|payables|reconciliations|statements)(?:\/(\d+))?$/);
  if (acctSub) {
    const [key, numberField, prefix] = ACCOUNT_SUBS[acctSub[1]];
    const rows = store[key];
    if (method === 'GET' && !acctSub[2]) return json(rows);
    if (method === 'POST') {
      const created = {
        id: store._nextId++,
        [numberField]: `${prefix}-2026-0${store._nextId % 1000}`,
        status: body.status || (acctSub[1] === 'statements' ? 'draft' : 'open'),
        ...body,
      };
      rows.unshift(created);
      return json(created);
    }
    if (method === 'PUT' && acctSub[2]) {
      const row = rows.find((r) => String(r.id) === acctSub[2]);
      Object.assign(row || {}, body);
      return json(row || { success: true });
    }
  }
  const acctOne = p.match(/^\/accounts\/(\d+)$/);
  if (acctOne) {
    const acct = store._accounts.find((a) => String(a.id) === acctOne[1]);
    if (method === 'PUT') { Object.assign(acct || {}, body); return json(acct || {}); }
    if (method === 'DELETE') {
      store._accounts = store._accounts.filter((a) => String(a.id) !== acctOne[1]);
      return json({ success: true });
    }
    return json(acct || {});
  }
  if (p === '/accounts') {
    if (method === 'POST') {
      const created = { id: store._nextId++, isActive: true, currentBalance: 0, ...body };
      store._accounts.push(created);
      return json(created);
    }
    return json(store._accounts);
  }
  if (p.startsWith('/accounts/reports/')) return json({});

  // FHIR.
  if (p === '/fhir/resources' && method === 'GET') {
    const type = url.searchParams.get('resourceType');
    const patientId = url.searchParams.get('patientId');
    let rows = store._fhirResources;
    if (type) rows = rows.filter((r) => r.resource_type === type);
    if (patientId) rows = rows.filter((r) => String(r.patient_id) === patientId);
    return json(rows);
  }
  const fhirSync = p.match(/^\/fhir\/sync\/patient\/(\d+)$/);
  if (fhirSync && method === 'POST') {
    const patientId = Number(fhirSync[1]);
    const existing = store._fhirResources.find(
      (r) => r.resource_type === 'Patient' && r.patient_id === patientId
    );
    if (existing) existing.last_updated = new Date().toISOString();
    else {
      store._fhirResources.unshift({
        id: store._nextId++, resource_type: 'Patient', resource_id: `Patient/${patientId}`,
        patient_id: patientId, last_updated: new Date().toISOString(), fhir_version: 'R4',
        resource_data: { resourceType: 'Patient', id: String(patientId) },
      });
    }
    return json({ success: true, message: 'Patient synced' });
  }
  const fhirBundle = p.match(/^\/fhir\/bundle\/(\d+)$/);
  if (fhirBundle) {
    const patientId = Number(fhirBundle[1]);
    return json({
      resourceType: 'Bundle',
      type: 'collection',
      entry: store._fhirResources
        .filter((r) => r.patient_id === patientId)
        .map((r) => ({ resource: r.resource_data })),
    });
  }
  if (p === '/fhir-tracking/errors/action-required') return json({ errors: store._fhirErrors });
  const fhirResolve = p.match(/^\/fhir-tracking\/(\d+)\/resolve-error$/);
  if (fhirResolve && method === 'POST') {
    store._fhirErrors = store._fhirErrors.filter((e) => String(e.id) !== fhirResolve[1]);
    return json({ success: true, message: 'Error resolved' });
  }
  const fhirTrack = p.match(/^\/fhir-tracking\/([^/]+)$/);
  if (fhirTrack) {
    return json({ tracking: W4.fhirTrackingRecords[decodeURIComponent(fhirTrack[1])] || null });
  }

  // ── generic REST over the store ───────────────────────────────────────
  const segments = p.split('/').filter(Boolean);
  const resource = segments[0];
  if (store[resource]) {
    const rows = store[resource];

    if (segments.length === 1) {
      if (method === 'GET') return json(filterByQuery(rows, url));
      if (method === 'POST') {
        const created = { id: store._nextId++, created_at: new Date().toISOString(), ...body };
        if (resource === 'patients') {
          created.mrn = created.mrn || `MRN-2026-${String(store._nextId).slice(-3)}`;
          created.status = created.status || 'active';
        }
        if (resource === 'claims') {
          created.claim_number = created.claim_number || `CLM-2026-0${store._nextId % 1000}`;
          created.status = created.status || 'draft';
        }
        // Wave 2 resources are identified on screen by their number, so a record
        // created during a recording has to get one or the video shows a blank.
        const NUMBERED = {
          preapprovals: ['preapproval_number', 'PA', 'pending'],
          denials: ['denial_number', 'DN', 'open'],
          'payment-postings': ['posting_number', 'PP', 'posted'],
          quotes: ['quote_number', 'QT', 'draft'],
          invoices: ['invoice_number', 'INV', 'draft'],
          'lab-orders': ['order_number', 'LAB', 'ordered'],
        };
        if (NUMBERED[resource]) {
          const [field, prefix, fallbackStatus] = NUMBERED[resource];
          created[field] = created[field] || `${prefix}-2026-0${store._nextId % 1000}`;
          created.status = created.status || fallbackStatus;
        }
        // Tables render joined display names, which a real backend returns and a
        // form only ever posts ids for. Without these the row a recording just
        // created reads "N/A" in every column but the amount.
        if (resource === 'payment-postings') {
          const pt = store.patients.find((p) => String(p.id) === String(created.patient_id));
          const cl = store.claims.find((c) => String(c.id) === String(created.claim_id));
          if (pt) created.patient_name = `${pt.first_name} ${pt.last_name}`;
          if (cl) {
            created.claim_number = cl.claim_number;
            // A claim carries its payer as insurance_provider when it came from
            // the fixtures and as payer_id when a recording just created it.
            const payer = (store['insurance-payers'] || [])
              .find((ip) => String(ip.id) === String(cl.payer_id));
            created.insurance_payer_name = created.insurance_payer_name
              || cl.insurance_provider || (payer && payer.name);
          }
        }
        rows.unshift(created);
        return json(created);
      }
    }

    if (segments.length === 2) {
      const id = segments[1];
      const idx = rows.findIndex((r) => String(r.id) === id);
      if (method === 'GET') return json(idx >= 0 ? rows[idx] : {});
      if (method === 'PUT' || method === 'PATCH') {
        if (idx >= 0) Object.assign(rows[idx], body);
        return json(idx >= 0 ? rows[idx] : {});
      }
      if (method === 'DELETE') {
        if (idx >= 0) rows.splice(idx, 1);
        return json({ success: true });
      }
    }

    if (segments.length === 3 && segments[2] === 'status' && method === 'PUT') {
      const row = rows.find((r) => String(r.id) === segments[1]);
      if (row) row.status = body.status;
      return json(row || {});
    }
  }

  if (method === 'GET') return json([]);
  return json({ success: true });
}

/* ────────────────────────── on-screen overlay ───────────────────────────── */

const OVERLAY_SCRIPT = `
window.__demoBrand = ${JSON.stringify(BRAND)};
window.__demo = (() => {
  const B = window.__demoBrand;
  const ensure = () => {
    if (document.getElementById('demo-overlay-style')) return;
    const style = document.createElement('style');
    style.id = 'demo-overlay-style';
    style.textContent = \`
      #demo-caption {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483646;
        display: flex; align-items: center; gap: 26px;
        padding: 20px 44px 24px; font: 500 26px/1.4 system-ui, -apple-system, Segoe UI, sans-serif;
        color: #f8fafc; background: linear-gradient(to top, rgba(4,16,22,.97), rgba(4,16,22,.86));
        border-top: 3px solid \${B.teal}; opacity: 0; transition: opacity .3s ease; pointer-events: none;
      }
      #demo-caption.on { opacity: 1; }
      #demo-caption .mark { height: 40px; flex: 0 0 auto; opacity: .95; }
      #demo-caption .txt { flex: 1 1 auto; }
      #demo-caption b { color: \${B.amberLight}; font-weight: 600; }
      #demo-step {
        position: fixed; left: 44px; top: 88px; z-index: 2147483646;
        font: 700 15px/1 system-ui, sans-serif; letter-spacing: .09em; text-transform: uppercase;
        color: #1a1200; background: \${B.amber}; border-radius: 999px; padding: 10px 20px;
        box-shadow: 0 6px 20px rgba(0,0,0,.35);
        opacity: 0; transition: opacity .3s ease; pointer-events: none;
      }
      #demo-step.on { opacity: 1; }
      #demo-brandbar {
        position: fixed; left: 0; right: 0; top: 0; height: 6px; z-index: 2147483647;
        background: linear-gradient(90deg, \${B.amber} 0%, \${B.amber} 22%, \${B.teal} 62%, \${B.tealLight} 100%);
        pointer-events: none;
      }
      /* The mark rides in the always-on chip as well as the caption bar, so it
         is on screen even while nobody is being told anything. */
      #demo-watermark {
        position: fixed; bottom: 116px; right: 24px; z-index: 2147483646;
        display: flex; align-items: center; gap: 12px;
        font: 500 13px/1 system-ui, sans-serif; color: #94a3b8;
        background: rgba(4,16,22,.82); border: 1px solid rgba(148,163,184,.3);
        border-radius: 999px; padding: 9px 18px 9px 12px; pointer-events: none;
        transition: opacity .3s ease;
      }
      #demo-watermark img { height: 26px; }
      #demo-watermark .sep { width: 1px; height: 18px; background: rgba(148,163,184,.35); }
      #demo-cursor {
        position: fixed; z-index: 2147483647; width: 30px; height: 30px; margin: -15px 0 0 -15px;
        border-radius: 50%; border: 3px solid \${B.tealLight}; background: rgba(45,212,191,.26);
        box-shadow: 0 0 0 6px rgba(45,212,191,.10); pointer-events: none;
        transition: left .5s cubic-bezier(.4,0,.2,1), top .5s cubic-bezier(.4,0,.2,1), transform .18s ease;
        left: -200px; top: -200px;
      }
      #demo-cursor.press { transform: scale(.55); background: rgba(45,212,191,.62); }
      #demo-card {
        position: fixed; inset: 0; z-index: 2147483645; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 24px; text-align: center; padding: 0 11%;
        background: radial-gradient(circle at 50% 34%, #06222b, \${B.ink} 72%);
        color: #e2e8f0; font-family: system-ui, -apple-system, Segoe UI, sans-serif;
        opacity: 0; transition: opacity .45s ease; pointer-events: none;
      }
      #demo-card.on { opacity: 1; }
      #demo-card .logo { height: 92px; margin-bottom: 10px; }
      #demo-card .logo.big { height: 150px; }
      #demo-card .kicker {
        font: 700 17px/1 system-ui, sans-serif; letter-spacing: .18em;
        text-transform: uppercase; color: \${B.teal};
      }
      #demo-card h1 { font-size: 60px; font-weight: 700; color: #f8fafc; margin: 0; line-height: 1.08; }
      #demo-card h2 { font-size: 29px; font-weight: 500; color: \${B.amberLight}; margin: 0; }
      #demo-card p { font-size: 22px; color: #94a3b8; margin: 0; max-width: 1080px; line-height: 1.6; }
      #demo-card ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px; }
      #demo-card li { font-size: 24px; color: #cbd5e1; }
      #demo-card li::before { content: '—'; color: \${B.teal}; margin-right: 14px; }
      #demo-card .rule {
        width: 190px; height: 4px; border-radius: 99px;
        background: linear-gradient(90deg, \${B.amber}, \${B.teal});
      }
      #demo-card .tagline { font-size: 21px; color: #64748b; letter-spacing: .04em; }
      @keyframes demoBumperIn {
        from { opacity: 0; transform: scale(.92); }
        to { opacity: 1; transform: scale(1); }
      }
      #demo-card.bumper .logo { animation: demoBumperIn 1.1s cubic-bezier(.2,.7,.3,1) both; }
    \`;
    document.head.appendChild(style);
    const add = (id) => {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
      return el;
    };
    const cap = add('demo-caption');
    cap.innerHTML = '<img class="mark" src="' + B.logo + '" alt="AureonCare"><span class="txt"></span>';
    add('demo-brandbar');
    const mark = add('demo-watermark');
    mark.innerHTML = '<img src="' + B.logo + '" alt="AureonCare">'
      + '<span class="sep"></span>'
      + '<span>demo environment · synthetic data, no real patients</span>';
    add('demo-step');
    add('demo-cursor');
  };

  return {
    ensure,
    caption(html) {
      ensure();
      const el = document.getElementById('demo-caption');
      el.querySelector('.txt').innerHTML = html || '';
      el.classList.toggle('on', Boolean(html));
    },
    step(text) {
      ensure();
      const el = document.getElementById('demo-step');
      el.textContent = text || '';
      el.classList.toggle('on', Boolean(text));
    },
    card(html, variant) {
      ensure();
      const mark = document.getElementById('demo-watermark');
      if (mark) mark.style.opacity = html ? '0' : '1';
      let el = document.getElementById('demo-card');
      if (!el) {
        el = document.createElement('div');
        el.id = 'demo-card';
        document.body.appendChild(el);
      }
      el.className = variant ? variant : '';
      el.innerHTML = html || '';
      el.classList.toggle('on', Boolean(html));
    },
    logo() { return window.__demoBrand.logo; },
    moveCursor(x, y) {
      ensure();
      const c = document.getElementById('demo-cursor');
      c.style.left = x + 'px';
      c.style.top = y + 'px';
    },
    pressCursor() {
      const c = document.getElementById('demo-cursor');
      if (!c) return;
      c.classList.add('press');
      setTimeout(() => c.classList.remove('press'), 220);
    },
  };
})();
window.__demo.ensure();
`;

const STUB_WINDOW_OPEN = `
window.__demoOpenedUrls = [];
window.open = function (url) {
  window.__demoOpenedUrls.push(url);
  return { closed: false, close() { this.closed = true; }, focus() {}, postMessage() {} };
};
window.print = function () {};
`;

/* ──────────────────────────────── director ──────────────────────────────── */

class Director {
  constructor(page, t0, spec = {}) {
    this.page = page;
    this.t0 = t0;
    this.spec = spec;
    this.captions = [];   // { start, end, text }
    this.chapters = [];   // { start, title }
    this.narration = [];  // { start, file, duration, text }
    this._open = null;
    this._line = 0;
    // Multiplies the mechanical dwell — cursor travel and post-action pauses —
    // without touching narration, which is floored by its own audio length. A
    // training viewer is following along and needs the beat; a marketing viewer
    // is deciding whether to keep watching.
    this.pace = spec.pace || 1;
  }

  /** Mechanical dwell, scaled by the spec's pace. */
  _dwell(ms) {
    return sleep(Math.round(ms * this.pace));
  }

  /**
   * Synthesise a narration line and return how long the picture must wait.
   *
   * The caption is held for the length of its own audio plus a breath, so the
   * spoken track never runs past the frame it is describing.
   */
  _narrate(html, holdMs) {
    const clip = voice.synthesise(html, { slug: this.spec.slug, index: this._line++ });
    if (!clip) return holdMs;
    this.narration.push({ ...clip, start: this.now() });
    return Math.max(holdMs, Math.round(clip.duration * 1000) + 450);
  }

  now() {
    return (Date.now() - this.t0) / 1000;
  }

  async ensure() {
    await this.page.evaluate(OVERLAY_SCRIPT).catch(() => {});
  }

  /** Marks a YouTube chapter boundary. The first one is forced to 0:00 later. */
  chapter(title) {
    this.chapters.push({ start: this.now(), title });
  }

  async step(text) {
    await this.ensure();
    await this.page.evaluate((t) => window.__demo.step(t), text || '');
  }

  async say(html, holdMs = 2800) {
    await this.ensure();
    await this._closeCaption();
    this._open = { start: this.now(), text: html };
    await this.page.evaluate((t) => window.__demo.caption(t), html);
    await sleep(this._narrate(html, holdMs));
  }

  async _closeCaption() {
    if (!this._open) return;
    this.captions.push({ ...this._open, end: this.now() });
    this._open = null;
  }

  async clearCaption() {
    await this._closeCaption();
    await this.page.evaluate(() => window.__demo.caption('')).catch(() => {});
  }

  /** Full-screen branded card. `bullets` renders a recap list. */
  async card({ kicker, heading, sub, body, bullets = [], holdMs = 4200, logo = true, variant = '' }) {
    await this.ensure();
    await this.clearCaption();
    const logoTag = logo
      ? `<img class="logo" src="${BRAND.logo}" alt="AureonCare">`
      : '';
    const html = [
      logoTag,
      kicker ? `<div class="kicker">${kicker}</div>` : '',
      heading ? `<h1>${heading}</h1>` : '',
      sub ? `<h2>${sub}</h2>` : '',
      body ? `<p>${body}</p>` : '',
      bullets.length ? `<ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : '',
    ].join('');
    await this.page.evaluate(([h, v]) => window.__demo.card(h, v), [html, variant]);

    // Cards are narrated too, so the spoken track never goes silent over them.
    const spoken = [heading, sub, body, ...bullets].filter(Boolean).join('. ');
    const hold = this._narrate(spoken, holdMs);
    this.captions.push({
      start: this.now(),
      end: this.now() + hold / 1000,
      text: [heading, sub, body].filter(Boolean).join(' — ') || bullets.join('. '),
    });
    await sleep(hold);
    await this.page.evaluate(() => window.__demo.card(''));
    await sleep(500);
  }

  /** Silent brand bumper: the logo alone, opening and closing the video. */
  async bumper({ tagline = 'Getting Started series', holdMs = 2600 } = {}) {
    await this.ensure();
    // The logo is a data URI; showing the card before it decodes yields a
    // bumper with a hole where the mark should be.
    await this.page.evaluate(() => new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = window.__demoBrand.logo;
      setTimeout(resolve, 3000);
    })).catch(() => {});
    await this.page.evaluate(
      ([logo, tag]) => window.__demo.card(
        `<img class="logo big" src="${logo}" alt="AureonCare">`
        + '<div class="rule"></div>'
        + `<div class="tagline">${tag}</div>`,
        'bumper'
      ),
      [BRAND.logo, tagline]
    );
    await sleep(holdMs);
    await this.page.evaluate(() => window.__demo.card(''));
    await sleep(400);
  }

  async click(locator, { pause = 900 } = {}) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await this._dwell(320);
    const box = await locator.boundingBox();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await this.page.evaluate(([px, py]) => window.__demo.moveCursor(px, py), [x, y]);
      await this._dwell(560);
      await this.page.mouse.move(x, y);
      await this.page.evaluate(() => window.__demo.pressCursor());
    }
    await locator.click({ timeout: 15000 });
    await this._dwell(pause);
  }

  async type(locator, text, { delay = 45, pause = 400 } = {}) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    if (box) {
      await this.page.evaluate(
        ([px, py]) => window.__demo.moveCursor(px, py),
        [box.x + box.width / 2, box.y + box.height / 2]
      );
      await this._dwell(380);
    }
    await locator.click();
    await locator.fill('');
    await locator.type(text, { delay });
    await this._dwell(pause);
  }

  /**
   * True when the locator actually becomes visible within `timeout`.
   *
   * `locator.count()` is not a usable guard: an element that is in the DOM but
   * hidden (an inactive tab panel, a collapsed section) counts as present, and
   * the click that follows then blocks until it times out. Every optional step
   * in a script should gate on this instead.
   */
  async exists(locator, timeout = 3500) {
    try {
      await locator.first().waitFor({ state: 'visible', timeout });
      return true;
    } catch (_) {
      return false;
    }
  }

  /** Click if the target shows up; returns false and moves on if it does not. */
  async maybeClick(locator, opts = {}) {
    if (!(await this.exists(locator, opts.timeout || 3500))) return false;
    await this.click(locator.first(), opts);
    return true;
  }

  /** Date, time and number inputs: set the value directly, never keystroke it. */
  async fill(locator, value, { pause = 700 } = {}) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    if (box) {
      await this.page.evaluate(
        ([px, py]) => window.__demo.moveCursor(px, py),
        [box.x + box.width / 2, box.y + box.height / 2]
      );
      await this._dwell(380);
    }
    await locator.click();
    await locator.fill(value);
    await this._dwell(pause);
  }

  async select(locator, value, { pause = 700 } = {}) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    if (box) {
      await this.page.evaluate(
        ([px, py]) => window.__demo.moveCursor(px, py),
        [box.x + box.width / 2, box.y + box.height / 2]
      );
      await this._dwell(380);
    }
    await locator.selectOption(value);
    await this._dwell(pause);
  }

  /**
   * Scroll the content pane. The wheel alone is not enough: the app scrolls an
   * inner `overflow-y-auto` container, so a wheel event lands wherever the
   * cursor happens to be — and an open native select swallows it entirely. Roll
   * the wheel for the look of it, then make sure the container actually moved.
   */
  async scrollBy(pixels, steps = 14) {
    const step = Math.round(pixels / steps);
    for (let i = 0; i < steps; i += 1) {
      await this.page.mouse.wheel(0, step);
      await sleep(85);
    }
    await this.page.evaluate((wanted) => {
      const panes = Array.from(document.querySelectorAll('div'))
        .filter((el) => el.scrollHeight > el.clientHeight + 40 && el.clientHeight > 200);
      const pane = panes[panes.length - 1];
      if (!pane) return;
      const target = Math.min(pane.scrollTop + wanted, pane.scrollHeight - pane.clientHeight);
      if (target > pane.scrollTop + 8) pane.scrollTo({ top: target, behavior: 'smooth' });
    }, pixels).catch(() => {});
    await this._dwell(650);
  }

  /** The input that follows a label containing `text` (forms have no htmlFor). */
  field(text, tag = 'input') {
    return this.page.locator(
      `xpath=//label[contains(normalize-space(.), ${xpathLiteral(text)})]/following::${tag}[1]`
    );
  }

  async nav(group, item) {
    await this.click(
      this.page.locator('nav[aria-label="Primary"]').getByRole('button', { name: group })
    );
    if (!item) return;
    // Groups with a single destination (Home) render no module pane at all.
    const target = this.page.getByRole('button', { name: item }).first();
    try {
      await target.waitFor({ state: 'visible', timeout: 4000 });
    } catch (_) {
      await sleep(800);
      return;
    }
    await this.click(target, { pause: 1600 });
  }
}

function xpathLiteral(s) {
  if (!s.includes("'")) return `'${s}'`;
  return `concat('${s.split("'").join("', \"'\", '")}')`;
}

/* ─────────────────────────── output generation ──────────────────────────── */

const ts = (seconds) => {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const srtTime = (seconds) => {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

const stripTags = (html) => html.replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '’')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function writeSrt(file, captions) {
  const lines = captions
    .filter((c) => c.end > c.start + 0.3)
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${stripTags(c.text)}\n`);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
}

/**
 * YouTube needs the first chapter at 0:00 and every chapter at least 10s long.
 * Merge anything shorter into its predecessor rather than shipping a list
 * YouTube will silently reject.
 */
function normaliseChapters(chapters, duration) {
  if (!chapters.length) return [];
  const sorted = [...chapters].sort((a, b) => a.start - b.start);
  sorted[0].start = 0;
  const out = [];
  for (const ch of sorted) {
    const prev = out[out.length - 1];
    if (prev && ch.start - prev.start < 10) continue;
    out.push({ ...ch });
  }
  if (duration && out.length > 1 && duration - out[out.length - 1].start < 10) out.pop();
  return out;
}

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  try {
    const bin = require('ffmpeg-static');
    if (bin && fs.existsSync(bin)) return bin;
  } catch (_) { /* fall through */ }
  return 'ffmpeg';
}

/**
 * Encode for YouTube: H.264 high profile, yuv420p, constant 30fps, faststart,
 * and a silent AAC track — YouTube's pipeline is happier with an audio stream
 * present, and a voiceover can be dropped onto it later without a re-encode.
 */
function encodeForYouTube(webm, mp4) {
  const ff = findFfmpeg();
  execFileSync(ff, [
    '-y',
    '-i', webm,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-shortest',
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1',
    '-preset', 'slow', '-crf', '20',
    '-r', String(FPS), '-g', String(FPS * 2),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    mp4,
  ], { stdio: 'ignore' });
}

function probeDuration(file) {
  const ff = findFfmpeg();
  try {
    const out = execFileSync(ff, ['-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    return parseDuration(out.toString());
  } catch (err) {
    return parseDuration(String(err.stderr || ''));
  }
}

function parseDuration(text) {
  const m = text.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const THUMBNAIL_HTML = (spec) => `
<div style="width:1280px;height:720px;box-sizing:border-box;display:flex;flex-direction:column;
  justify-content:space-between;padding:64px 76px;
  background:radial-gradient(circle at 20% 16%,#0a3540,${BRAND.ink} 70%);
  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#f8fafc;">
  <div style="display:flex;align-items:center;justify-content:space-between;">
    <img src="${BRAND.logo}" alt="AureonCare" style="height:76px;">
    <span style="font-size:17px;letter-spacing:.2em;text-transform:uppercase;color:${BRAND.teal};">
      ${spec.moduleLabel}
    </span>
  </div>
  <div>
    <div style="width:150px;height:6px;border-radius:99px;margin-bottom:28px;
      background:linear-gradient(90deg,${BRAND.amber},${BRAND.teal});"></div>
    <div style="font-size:${spec.headline.length > 26 ? 76 : 90}px;font-weight:800;line-height:1.03;max-width:1060px;">
      ${spec.headline}
    </div>
    <div style="margin-top:24px;font-size:30px;color:#94a3b8;max-width:900px;line-height:1.35;">${spec.sub}</div>
  </div>
  <div style="display:flex;align-items:center;gap:18px;">
    <span style="font-size:22px;font-weight:700;color:#1a1200;background:${BRAND.amber};border-radius:99px;padding:12px 26px;">
      ${spec.badge}
    </span>
    <span style="font-size:21px;color:#64748b;">${spec.audience}</span>
  </div>
</div>`;

/** Thumbnail copy: short headline, supporting line, badge — with sane fallbacks. */
function thumbnailSpec(spec) {
  return {
    moduleLabel: spec.moduleLabel,
    headline: spec.thumbHeadline || spec.title,
    sub: spec.thumbSub || spec.intro,
    badge: spec.badge || 'Getting started',
    audience: spec.audience,
  };
}

async function renderThumbnail(context, spec, file) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.setContent(`<body style="margin:0">${THUMBNAIL_HTML(thumbnailSpec(spec))}</body>`);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1280, height: 720 } });
  await page.close();
}

function writeMetadata(file, spec, chapters, durationSec) {
  const chapterLines = chapters.map((c) => `${ts(c.start)} ${c.title}`).join('\n');
  const md = `# ${spec.id} — ${spec.title}

## YouTube title (${spec.youtubeTitle.length} chars)

${spec.youtubeTitle}

## Description

${spec.description}

Chapters:
${chapterLines}

Subtitles: upload ${spec.slug}.srt as the English track — do not rely on auto-captions.
Narration: spoken track included (${voice.ENGINE} / ${voice.activeVoice()}).

This video uses a demo environment with synthetic data. No real patient
information appears in it.

## Tags

${spec.tags.join(', ')}

## Upload settings

| Field | Value |
| --- | --- |
| Visibility | Unlisted until the playlist is complete, then Public |
| Category | Science & Technology |
| Playlist | ${spec.marketing ? MARKETING_PLAYLIST : PLAYLISTS[spec.wave || 1]} |
| Language | English |
| Audience | Not made for kids |
| Thumbnail | ${spec.slug}.thumbnail.png |
| Subtitles | ${spec.slug}.srt |
| End screen | Link to the next video in the playlist |
| Duration | ${ts(durationSec)} |
| Resolution | 1920x1080, 30fps, H.264 |
| Audio | Narration, AAC 160k, normalised to -16 LUFS |

## Facts for the description box

- Module: ${spec.moduleLabel}
- Audience: ${spec.audience}
- Journey: ${spec.journey}
`;
  fs.writeFileSync(file, md, 'utf8');
}

/* ──────────────────────────────── runner ────────────────────────────────── */

/**
 * Records one video script.
 * @param {object} spec the module exported by a file in scripts/
 */
async function record(spec) {
  const { chromium } = loadPlaywright();
  const OUT_DIR = outDirFor(spec);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1',
      '--hide-scrollbars', '--disable-features=IsolateOrigins'],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
  });

  const store = createStore();
  if (spec.sessionUser) store._user = spec.sessionUser;
  await context.route('**/api/**', (route) => handleApi(route, store));
  await context.addInitScript(STUB_WINDOW_OPEN);
  await context.addInitScript(OVERLAY_SCRIPT);

  // Videos that do not show the sign-in screen start already authenticated.
  if (!spec.showsLogin) {
    // AppContext clears the stored session on every page load, treating a load
    // as a fresh start — except on the return leg of an OAuth round trip, which
    // it marks with this key. Setting it is how a seeded session survives.
    await context.addInitScript(([user]) => {
      try {
        sessionStorage.setItem('aureoncare.oauthDeparture', String(Date.now()));
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('user', JSON.stringify(user));
        sessionStorage.setItem('token', 'demo.jwt.token');
      } catch (_) { /* storage unavailable */ }
    }, [spec.sessionUser || F.demoUser]);
  }

  const page = await context.newPage();
  const t0 = Date.now();
  page.on('console', (m) => {
    if (m.type() === 'error') console.warn('   [page]', m.text().slice(0, 120));
  });
  // Some confirm-and-go actions (receiving a purchase order, restoring an
  // archive) gate on window.confirm, which Playwright dismisses by default and
  // would silently stall the journey mid-recording.
  page.on('dialog', (dialog) => dialog.accept().catch(() => {}));

  const d = new Director(page, t0, spec);
  // A spec may open somewhere other than the app root — the public booking
  // page, for instance, is served at /book/<slug> ahead of the auth gate.
  await page.goto(BASE_URL + (spec.startPath || ''), {
    waitUntil: 'domcontentloaded', timeout: 90000,
  });
  const readySelector = spec.readySelector
    || (spec.showsLogin ? 'input[type="email"]' : 'nav[aria-label="Primary"]');
  await page.waitForSelector(readySelector, { timeout: 90000 });
  await sleep(1200);

  let failure = null;
  try {
    if (spec.skipOutputs) {
      await spec.run(d, page, { store, fixtures: F, sleep });
      throw { __probeDone: true };
    }
    d.videoStart = d.now();
    if (spec.marketing) {
      // A marketing cut owns its own open and close. The training chrome — logo
      // bumper, title card, recap — costs about twenty seconds before anything
      // happens on screen, which is most of a short video's attention budget.
      await spec.run(d, page, { store, fixtures: F, sleep });
      await d.clearCaption();
      await d.step('');
      await sleep(700);
    } else {
      await d.bumper();
      await d.card({
        kicker: 'AureonCare training',
        heading: spec.title,
        sub: spec.moduleLabel,
        body: spec.intro,
        holdMs: 5000,
      });
      d.chapters.unshift({ start: 0, title: 'Introduction' });
      await spec.run(d, page, { store, fixtures: F, sleep });
      await d.clearCaption();
      await d.step('');
      await d.card({
        kicker: 'Recap',
        heading: 'What you just did',
        bullets: spec.recap,
        holdMs: 6000,
      });
      d.chapter('Recap');
      // Held long enough for a YouTube end screen, which needs at least 5 seconds
      // of still picture to sit on.
      await d.card({
        kicker: 'AureonCare',
        heading: 'Health | Efficiency | Growth',
        body: 'More in the Getting Started series — the next video is linked on screen.',
        holdMs: 9000,
      });
      await sleep(700);
    }
  } catch (err) {
    failure = err && err.__probeDone ? null : err;
    // A failed step is almost always a DOM guess gone stale, so capture what
    // was actually on screen rather than making the next guess blind.
    if (failure) {
      try {
        const debugDir = path.join(OUT_DIR, '_debug');
        fs.mkdirSync(debugDir, { recursive: true });
        await page.screenshot({ path: path.join(debugDir, `${spec.slug}.failure.png`) });
        const state = await page.evaluate(() => {
          const vis = (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0;
          };
          return {
            buttons: Array.from(document.querySelectorAll('button')).filter(vis)
              .map((el) => (el.innerText || el.title || '').replace(/\s+/g, ' ').trim())
              .filter(Boolean).slice(0, 40),
            modals: Array.from(document.querySelectorAll('.fixed.inset-0')).filter(vis)
              .map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90)),
          };
        });
        fs.writeFileSync(
          path.join(debugDir, `${spec.slug}.failure.txt`),
          `${String(failure.message).split('\n')[0]}\n\nMODALS:\n${state.modals.join('\n')}\n\nBUTTONS:\n${state.buttons.join('\n')}\n`,
          'utf8'
        );
      } catch (_) { /* best effort */ }
    }
  } finally {
    await d.clearCaption().catch(() => {});
    const video = page.video();
    await context.close();
    await browser.close();

    if (video && spec.skipOutputs) {
      const raw = await video.path();
      try { fs.unlinkSync(raw); } catch (_) { /* already gone */ }
    } else if (video) {
      const raw = await video.path();
      const webm = path.join(OUT_DIR, `${spec.slug}.webm`);
      fs.renameSync(raw, webm);
      const mp4 = path.join(OUT_DIR, `${spec.slug}.mp4`);
      const startAt = d.videoStart || 0;
      const spoken = voice.muxNarration(webm, d.narration, mp4, { fps: FPS, startAt });
      fs.unlinkSync(webm);
      if (spoken) console.log(`  ${spec.id} narration: ${spoken} lines (${voice.ENGINE}/${voice.activeVoice()})`);

      const duration = probeDuration(mp4);
      const shift = (rows) => rows.map((r) => ({
        ...r,
        start: Math.max(0, r.start - startAt),
        ...(r.end === undefined ? {} : { end: Math.max(0, r.end - startAt) }),
      }));
      const chapters = normaliseChapters(shift(d.chapters), duration);
      writeSrt(path.join(OUT_DIR, `${spec.slug}.srt`), shift(d.captions));
      fs.writeFileSync(
        path.join(OUT_DIR, `${spec.slug}.chapters.txt`),
        chapters.map((c) => `${ts(c.start)} ${c.title}`).join('\n') + '\n',
        'utf8'
      );
      writeMetadata(path.join(OUT_DIR, `${spec.slug}.metadata.md`), spec, chapters, duration);

      const tb = await chromium.launch({ args: ['--no-sandbox'] });
      const tctx = await tb.newContext({ viewport: { width: 1280, height: 720 } });
      await renderThumbnail(tctx, spec, path.join(OUT_DIR, `${spec.slug}.thumbnail.png`));
      await tctx.close();
      await tb.close();

      console.log(`  ${spec.id} ${ts(duration)}  →  ${path.basename(mp4)}`);
    }
  }

  if (failure) throw failure;
}

module.exports = { record, sleep, Director, outDirFor, BASE_URL, API_BASE, ts };
