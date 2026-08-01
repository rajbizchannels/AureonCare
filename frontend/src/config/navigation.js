import {
  LayoutDashboard,
  CalendarDays,
  Calendar,
  List,
  Clock,
  Stethoscope,
  CalendarClock,
  SlidersHorizontal,
  Users,
  FileText,
  Activity,
  ClipboardList,
  ClipboardCheck,
  History,
  UserCircle,
  HeartPulse,
  Video,
  Pill,
  Microscope,
  Database,
  Radar,
  DollarSign,
  FileCheck,
  CreditCard,
  TrendingUp,
  AlertCircle,
  Shield,
  Receipt,
  Wallet,
  BookOpen,
  ArrowLeftRight,
  TrendingDown,
  Package,
  ArrowUpDown,
  ShoppingCart,
  Truck,
  Tag,
  Megaphone,
  Send,
  Sparkles,
  BarChart3,
  Settings,
  Building2,
  UserCog,
  KeyRound,
  Plug,
  HardDrive,
  Archive,
  ScrollText,
  CheckSquare,
} from 'lucide-react';

import { ADMIN_TABS } from '../constants/adminConstants';
import { REPORT_CATEGORIES } from '../views/ReportsView';

/**
 * ── AureonCare navigation model ──────────────────────────────────────────────
 *
 * The platform is framed as a three-pane app shell:
 *
 *   pane 1  PrimaryNav    workspace groups (Home, Scheduling, Patients, …)
 *   pane 2  SecondaryNav  the modules / sub-modules inside the active group
 *   pane 3  content       the module view itself
 *
 * A nav item is one of:
 *   { module, tab }  → renders `module` and selects its `tab` (sub-module)
 *   { action }       → opens a quick-view drawer instead of switching modules
 *
 * `access` is the id used for the plan + role gate (see planFeatures.hasAccess).
 * It defaults to `module`, and is set explicitly when a sub-module lives inside
 * a different licensed module (e.g. Campaigns is gated by CRM).
 *
 * No module was dropped in the redesign — every previously reachable module id
 * appears exactly once below.
 */
export const getNavigation = (t = {}) => [
  // ── Home ──────────────────────────────────────────────────────────────────
  {
    id: 'home',
    label: t.home || 'Home',
    icon: LayoutDashboard,
    color: 'from-cyan-500 to-blue-500',
    sections: [
      {
        id: 'home.overview',
        label: null,
        items: [
          {
            // Home → Dashboard. The dashboard is the same view as before the
            // shell, laid out for the content pane; its drill-downs hang off
            // it as a nested branch instead of sitting beside it, so pane 2
            // mirrors the fact that they open *from* the dashboard.
            id: 'home.dashboard',
            label: t.dashboard || 'Dashboard',
            description: t.dashboardDescription || 'Today at a glance',
            icon: LayoutDashboard,
            module: 'dashboard',
            access: 'dashboard',
            children: [
              {
                id: 'home.tasks',
                label: t.myTasks || 'My Tasks',
                icon: CheckSquare,
                action: 'tasks',
                access: 'dashboard',
              },
              {
                id: 'home.patientsSnapshot',
                label: t.patientsSnapshot || 'Patient Snapshot',
                icon: Users,
                action: 'patients',
                access: 'ehr',
              },
              {
                id: 'home.revenueSnapshot',
                label: t.revenueSnapshot || 'Revenue Snapshot',
                icon: DollarSign,
                action: 'revenue',
                access: 'rcm',
              },
              {
                id: 'home.appointmentsSnapshot',
                label: t.appointmentsSnapshot || 'Appointment Snapshot',
                icon: Calendar,
                action: 'appointments',
                access: 'practiceManagement',
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Scheduling ────────────────────────────────────────────────────────────
  {
    id: 'scheduling',
    label: t.scheduling || 'Scheduling',
    icon: CalendarDays,
    color: 'from-blue-500 to-cyan-500',
    sections: [
      {
        id: 'scheduling.calendar',
        label: t.calendar || 'Calendar',
        items: [
          {
            id: 'scheduling.calendarView',
            label: t.calendar || 'Calendar',
            description: t.calendarDescription || 'Day, week and month schedule',
            icon: Calendar,
            module: 'practiceManagement',
            tab: 'calendar',
          },
          {
            id: 'scheduling.appointmentList',
            label: t.appointments || 'Appointments',
            description: t.appointmentListDescription || 'Searchable appointment list',
            icon: List,
            module: 'practiceManagement',
            tab: 'list',
          },
          {
            id: 'scheduling.waitlist',
            label: t.waitlist || 'Waitlist',
            description: t.waitlistDescription || 'Patients waiting for a slot',
            icon: Clock,
            module: 'waitlist',
            access: 'practiceManagement',
          },
        ],
      },
      {
        id: 'scheduling.providers',
        label: t.providers || 'Providers',
        items: [
          {
            id: 'scheduling.providerManagement',
            label: t.providerManagement || 'Provider Scheduling',
            description: t.providerManagementDescription || 'Availability and coverage',
            icon: Stethoscope,
            module: 'providerManagement',
          },
        ],
      },
      {
        id: 'scheduling.setup',
        label: t.setup || 'Setup',
        items: [
          {
            id: 'scheduling.appointmentTypes',
            label: t.appointmentTypes || 'Appointment Types',
            description: t.appointmentTypesDescription || 'Durations, colours and rules',
            icon: SlidersHorizontal,
            module: 'appointmentTypes',
            access: 'practiceManagement',
          },
        ],
      },
    ],
  },

  // ── Patients ──────────────────────────────────────────────────────────────
  {
    id: 'patients',
    label: t.patients || 'Patients',
    icon: Users,
    color: 'from-purple-500 to-pink-500',
    sections: [
      {
        id: 'patients.records',
        label: t.records || 'Records',
        items: [
          {
            id: 'patients.ehr',
            label: t.ehr || 'Patient Records',
            description: t.ehrDescription || 'Charts, demographics and history',
            icon: FileText,
            module: 'ehr',
          },
          {
            id: 'patients.diagnosis',
            label: t.diagnoses || 'Diagnoses',
            description: t.diagnosesDescription || 'Encounter diagnoses and coding',
            icon: Activity,
            module: 'patientDiagnosis',
            access: 'ehr',
          },
          {
            id: 'patients.history',
            label: t.patientHistory || 'Patient History',
            description: t.patientHistoryDescription || 'Longitudinal chart timeline',
            icon: History,
            module: 'patientHistory',
            access: 'ehr',
          },
        ],
      },
      {
        id: 'patients.forms',
        label: t.formsAndIntake || 'Forms & Intake',
        items: [
          {
            id: 'patients.intake',
            label: t.patientIntake || 'Patient Intake',
            description: t.patientIntakeDescription || 'Intake packets and status',
            icon: ClipboardCheck,
            module: 'intakeForms',
            access: 'ehr',
          },
          {
            id: 'patients.formTemplates',
            label: t.formTemplates || 'Form Templates',
            icon: ClipboardList,
            module: 'formManagement',
            tab: 'templates',
            access: 'formManagement',
          },
          {
            id: 'patients.formSubmissions',
            label: t.formSubmissions || 'Form Submissions',
            icon: FileCheck,
            module: 'formManagement',
            tab: 'submissions',
            access: 'formManagement',
          },
          {
            id: 'patients.formAudit',
            label: t.formAuditLog || 'Form Audit Log',
            icon: ScrollText,
            module: 'formManagement',
            tab: 'audit',
            access: 'formManagement',
          },
        ],
      },
      {
        id: 'patients.engagement',
        label: t.engagement || 'Engagement',
        items: [
          {
            id: 'patients.portal',
            label: t.patientPortal || 'Patient Portal',
            description: t.patientPortalNavDescription || 'What the patient sees',
            icon: UserCircle,
            module: 'patientPortal',
            tab: 'profile',
            children: [
              {
                id: 'patients.portalAppointments',
                label: t.appointmentsTab || 'Appointments',
                icon: Calendar,
                module: 'patientPortal',
                tab: 'appointments',
              },
              {
                id: 'patients.portalDiagnoses',
                label: t.diagnosesTab || 'Diagnoses',
                icon: Activity,
                module: 'patientPortal',
                tab: 'diagnoses',
              },
              {
                id: 'patients.portalPrescriptions',
                label: t.prescriptionsTab || 'Prescriptions',
                icon: Pill,
                module: 'patientPortal',
                tab: 'prescriptions',
              },
              {
                id: 'patients.portalRecords',
                label: t.recordsTab || 'Records',
                icon: FileText,
                module: 'patientPortal',
                tab: 'records',
              },
              {
                id: 'patients.portalForms',
                label: t.formsRequested || 'Forms Requested',
                icon: ClipboardList,
                module: 'patientPortal',
                tab: 'forms',
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Clinical ──────────────────────────────────────────────────────────────
  {
    id: 'clinical',
    label: t.clinical || 'Clinical',
    icon: HeartPulse,
    color: 'from-green-500 to-emerald-500',
    sections: [
      {
        id: 'clinical.care',
        label: t.careDelivery || 'Care Delivery',
        items: [
          {
            id: 'clinical.telehealth',
            label: t.telehealth || 'Telehealth',
            description: t.telehealthDescription || 'Virtual visits and sessions',
            icon: Video,
            module: 'telehealth',
          },
        ],
      },
      {
        id: 'clinical.network',
        label: t.clinicalServices || 'Clinical Services',
        items: [
          {
            id: 'clinical.services',
            label: t.servicesConsole || 'Services Console',
            description: t.servicesConsoleDescription || 'Pharmacies, labs and FHIR',
            icon: Activity,
            module: 'clinicalServices',
          },
          {
            id: 'clinical.pharmacies',
            label: t.pharmacies || 'Pharmacies',
            description: t.pharmaciesDescription || 'Pharmacy directory',
            icon: Pill,
            module: 'pharmacies',
            access: 'clinicalServices',
          },
          {
            id: 'clinical.laboratories',
            label: t.laboratories || 'Laboratories',
            description: t.laboratoriesDescription || 'Laboratory directory',
            icon: Microscope,
            module: 'laboratories',
            access: 'clinicalServices',
          },
          {
            id: 'clinical.fhir',
            label: t.fhirResources || 'FHIR Resources',
            description: t.fhirDescription || 'Interoperability sync and resources',
            icon: Database,
            module: 'fhir',
            tab: 'resources',
            access: 'clinicalServices',
          },
          {
            id: 'clinical.fhirTracking',
            label: t.fhirTracking || 'FHIR Tracking',
            description: t.fhirTrackingDescription || 'Prescription and lab order errors',
            icon: Radar,
            module: 'fhir',
            tab: 'tracking',
            access: 'clinicalServices',
          },
        ],
      },
    ],
  },

  // ── Billing ───────────────────────────────────────────────────────────────
  {
    id: 'billing',
    label: t.billing || 'Billing',
    icon: DollarSign,
    color: 'from-yellow-500 to-orange-500',
    sections: [
      {
        id: 'billing.revenueCycle',
        label: t.revenueCycle || 'Revenue Cycle',
        items: [
          {
            id: 'billing.claims',
            label: t.claims || 'Claims',
            description: t.claimsDescription || 'Submit and track claims',
            icon: DollarSign,
            module: 'rcm',
            tab: 'claims',
          },
          {
            id: 'billing.preapprovals',
            label: t.preAuthorizations || 'Pre-Authorizations',
            icon: FileCheck,
            module: 'rcm',
            tab: 'preapprovals',
          },
          {
            id: 'billing.payments',
            label: t.payments || 'Payments',
            icon: CreditCard,
            module: 'rcm',
            tab: 'payments',
          },
          {
            id: 'billing.paymentPostings',
            label: t.paymentPostings || 'Payment Postings',
            icon: TrendingUp,
            module: 'rcm',
            tab: 'payment-postings',
          },
          {
            id: 'billing.denials',
            label: t.denials || 'Denials',
            icon: AlertCircle,
            module: 'rcm',
            tab: 'denials',
          },
        ],
      },
      {
        id: 'billing.patientBilling',
        label: t.patientBilling || 'Patient Billing',
        items: [
          {
            id: 'billing.invoices',
            label: t.quotesAndInvoices || 'Quotes & Invoices',
            icon: Receipt,
            module: 'rcm',
            tab: 'billing',
          },
        ],
      },
      {
        id: 'billing.setup',
        label: t.setup || 'Setup',
        items: [
          {
            id: 'billing.payers',
            label: t.insurancePayers || 'Insurance Payers',
            icon: Shield,
            module: 'rcm',
            tab: 'payers',
          },
        ],
      },
    ],
  },

  // ── Operations (accounting + inventory) ───────────────────────────────────
  {
    id: 'operations',
    label: t.operations || 'Operations',
    icon: Wallet,
    color: 'from-emerald-500 to-teal-500',
    sections: [
      {
        id: 'operations.accounting',
        label: t.accounts || 'Accounting',
        items: [
          {
            id: 'operations.accountsOverview',
            label: t.accountingOverview || 'Accounting Overview',
            icon: LayoutDashboard,
            module: 'accounts',
            tab: 'overview',
          },
          {
            id: 'operations.chartOfAccounts',
            label: t.chartOfAccounts || 'Chart of Accounts',
            icon: BookOpen,
            module: 'accounts',
            tab: 'accounts',
          },
          {
            id: 'operations.journal',
            label: t.journal || 'Journal',
            icon: FileText,
            module: 'accounts',
            tab: 'journal',
          },
          {
            id: 'operations.receivables',
            label: t.receivables || 'Receivables',
            icon: TrendingUp,
            module: 'accounts',
            tab: 'ar',
          },
          {
            id: 'operations.payables',
            label: t.payables || 'Payables',
            icon: TrendingDown,
            module: 'accounts',
            tab: 'ap',
          },
          {
            id: 'operations.reconciliation',
            label: t.reconciliation || 'Reconciliation',
            icon: ArrowLeftRight,
            module: 'accounts',
            tab: 'reconcile',
          },
          {
            id: 'operations.statements',
            label: t.statements || 'Statements',
            icon: Receipt,
            module: 'accounts',
            tab: 'statements',
          },
        ],
      },
      {
        id: 'operations.inventory',
        label: t.inventory || 'Inventory',
        items: [
          {
            id: 'operations.inventoryOverview',
            label: t.inventoryOverview || 'Inventory Overview',
            icon: LayoutDashboard,
            module: 'inventory',
            tab: 'overview',
          },
          {
            id: 'operations.items',
            label: t.items || 'Items',
            icon: Package,
            module: 'inventory',
            tab: 'items',
          },
          {
            id: 'operations.stock',
            label: t.stock || 'Stock',
            icon: ArrowUpDown,
            module: 'inventory',
            tab: 'stock',
          },
          {
            id: 'operations.purchaseOrders',
            label: t.purchaseOrders || 'Purchase Orders',
            icon: ShoppingCart,
            module: 'inventory',
            tab: 'orders',
          },
          {
            id: 'operations.suppliers',
            label: t.suppliers || 'Suppliers',
            icon: Truck,
            module: 'inventory',
            tab: 'suppliers',
          },
          {
            id: 'operations.categories',
            label: t.categories || 'Categories',
            icon: Tag,
            module: 'inventory',
            tab: 'categories',
          },
        ],
      },
    ],
  },

  // ── Growth ────────────────────────────────────────────────────────────────
  {
    id: 'growth',
    label: t.growth || 'Growth',
    icon: Megaphone,
    color: 'from-red-500 to-rose-500',
    sections: [
      {
        id: 'growth.crm',
        label: t.crm || 'CRM',
        items: [
          {
            id: 'growth.crmOverview',
            label: t.crmOverview || 'CRM Overview',
            description: t.crmDescription || 'Pipeline and engagement',
            icon: Users,
            module: 'crm',
          },
          {
            id: 'growth.campaigns',
            label: t.campaigns || 'Campaigns',
            description: t.campaignsDescription || 'Outreach and reminders',
            icon: Send,
            module: 'campaigns',
            access: 'crm',
          },
        ],
      },
      {
        id: 'growth.catalog',
        label: t.catalog || 'Service Catalog',
        items: [
          {
            id: 'growth.offerings',
            label: t.services || 'Services',
            description: t.offeringsDescription || 'Bookable healthcare services',
            icon: Sparkles,
            module: 'offerings',
            tab: 'offerings',
          },
          {
            id: 'growth.packages',
            label: t.packages || 'Packages',
            icon: ShoppingCart,
            module: 'offerings',
            tab: 'packages',
          },
          {
            id: 'growth.serviceCategories',
            label: t.categories || 'Categories',
            icon: Tag,
            module: 'offerings',
            tab: 'categories',
          },
          {
            id: 'growth.promotions',
            label: t.promotions || 'Promotions',
            icon: Megaphone,
            module: 'offerings',
            tab: 'promotions',
          },
          {
            id: 'growth.catalogStats',
            label: t.statistics || 'Statistics',
            icon: BarChart3,
            module: 'offerings',
            tab: 'statistics',
          },
        ],
      },
    ],
  },

  // ── Insights ──────────────────────────────────────────────────────────────
  // The report catalogue is the sub-module tree: one branch per category, one
  // leaf per report. Built from the same REPORT_CATEGORIES the view uses, so
  // the two can never drift apart.
  {
    id: 'insights',
    label: t.insights || 'Insights',
    icon: BarChart3,
    color: 'from-cyan-500 to-blue-500',
    sections: [
      {
        id: 'insights.reports',
        label: t.reports || 'Reports',
        items: REPORT_CATEGORIES.map((category) => ({
          id: `insights.${category.id}`,
          label: category.name,
          icon: category.icon,
          access: 'reports',
          children: category.reports.map((report) => ({
            id: `insights.${category.id}.${report.id}`,
            label: report.name,
            icon: report.icon,
            module: 'reports',
            tab: `${category.id}:${report.id}`,
            access: 'reports',
          })),
        })),
      },
      {
        id: 'insights.custom',
        label: t.tools || 'Tools',
        items: [
          {
            id: 'insights.customReport',
            label: t.customReport || 'Custom Report',
            description: t.customReportDescription || 'Build a report from raw data',
            icon: SlidersHorizontal,
            module: 'reports',
            tab: 'custom',
            access: 'reports',
          },
        ],
      },
    ],
  },

  // ── Admin & Settings (anchored to the bottom of the rail) ─────────────────
  {
    id: 'settings',
    label: t.settings || 'Settings',
    icon: Settings,
    color: 'from-slate-500 to-slate-700',
    placement: 'bottom',
    sections: [
      {
        id: 'settings.practice',
        label: t.practice || 'Practice',
        items: [
          {
            id: 'settings.clinic',
            label: t.clinicSettings || 'Clinic Settings',
            icon: Building2,
            module: 'admin',
            tab: ADMIN_TABS.CLINIC,
            access: 'adminPanel',
          },
          {
            id: 'settings.hours',
            label: t.workingHours || 'Working Hours',
            icon: Clock,
            module: 'admin',
            tab: ADMIN_TABS.HOURS,
            access: 'adminPanel',
          },
          {
            id: 'settings.appointmentSettings',
            label: t.appointmentSettings || 'Appointment Settings',
            icon: CalendarClock,
            module: 'admin',
            tab: ADMIN_TABS.APPOINTMENTS,
            access: 'adminPanel',
          },
        ],
      },
      {
        id: 'settings.access',
        label: t.accessControl || 'Access Control',
        items: [
          {
            id: 'settings.users',
            label: t.userManagement || 'User Management',
            icon: UserCog,
            module: 'admin',
            tab: ADMIN_TABS.USERS,
            access: 'adminPanel',
          },
          {
            id: 'settings.roles',
            label: t.rolesPermissions || 'Roles & Permissions',
            icon: KeyRound,
            module: 'admin',
            tab: ADMIN_TABS.ROLES,
            access: 'adminPanel',
          },
          {
            id: 'settings.plans',
            label: t.subscriptionPlans || 'Subscription Plans',
            icon: CreditCard,
            module: 'admin',
            tab: ADMIN_TABS.PLANS,
            access: 'adminPanel',
          },
        ],
      },
      {
        id: 'settings.system',
        label: t.system || 'System',
        items: [
          {
            id: 'settings.integrations',
            label: t.integrations || 'Integrations',
            icon: Plug,
            module: 'integrations',
          },
          {
            id: 'settings.telehealthSetup',
            label: t.telehealthSetup || 'Telehealth Setup',
            icon: Video,
            module: 'admin',
            tab: ADMIN_TABS.TELEHEALTH,
            access: 'adminPanel',
          },
          {
            id: 'settings.backup',
            label: t.backupRestore || 'Backup & Restore',
            icon: HardDrive,
            module: 'admin',
            tab: ADMIN_TABS.BACKUP,
            access: 'adminPanel',
          },
          {
            id: 'settings.archive',
            label: t.archiveManagement || 'Archive Management',
            icon: Archive,
            module: 'admin',
            tab: ADMIN_TABS.ARCHIVE,
            access: 'adminPanel',
          },
          {
            id: 'settings.audit',
            label: t.auditLogs || 'Audit Logs',
            icon: ScrollText,
            module: 'admin',
            tab: ADMIN_TABS.AUDIT,
            access: 'adminPanel',
          },
        ],
      },
    ],
  },
];

/**
 * Navigation for a signed-in patient.
 *
 * A patient's whole app is their portal, so Home *is* the portal: appointments,
 * diagnoses, prescriptions, records and requested forms sit under it as the
 * portal's own tabs. The group holds a single destination, which makes the
 * shell drop its secondary pane — panes 2 and 3 merge into one surface — and
 * none of the practice-side modules are reachable from here.
 */
export const getPatientNavigation = (t = {}) => [
  {
    id: 'home',
    label: t.home || 'Home',
    icon: LayoutDashboard,
    color: 'from-cyan-500 to-blue-500',
    sections: [
      {
        id: 'home.portal',
        label: null,
        items: [
          {
            id: 'home.patientPortal',
            label: t.patientPortal || 'Patient Portal',
            description: t.patientPortalNavDescription || 'Your health at a glance',
            icon: UserCircle,
            module: 'patientPortal',
          },
        ],
      },
    ],
  },
];

/** The plan/role gate id for an item (falls back to its module id). */
export const accessIdFor = (item) => item.access || item.module;

/** Depth-first flatten of an item list, parents before their children. */
const flattenItems = (items = []) =>
  items.reduce((all, item) => all.concat(item, flattenItems(item.children)), []);

const filterItems = (items, canAccess) =>
  items
    .filter((item) => canAccess(accessIdFor(item)))
    .map((item) =>
      item.children ? { ...item, children: filterItems(item.children, canAccess) } : item
    );

/**
 * Drop every item the current user cannot reach, then drop the sections and
 * groups that end up empty. Returns a new tree — the source is never mutated.
 */
export const filterNavigation = (navigation, canAccess) =>
  navigation
    .map((group) => {
      const sections = group.sections
        .map((section) => ({ ...section, items: filterItems(section.items, canAccess) }))
        .filter((section) => section.items.length > 0);
      return { ...group, sections };
    })
    .filter((group) => group.sections.length > 0);

/** Flat list of every item in a group — nested children included, in display order. */
export const groupItems = (group) =>
  group ? flattenItems(group.sections.reduce((all, section) => all.concat(section.items), [])) : [];

/** The item a group navigates to when its rail entry is clicked. */
export const defaultItemFor = (group) => groupItems(group).find((item) => item.module) || groupItems(group)[0];

/**
 * Locate the group + item matching the module/tab currently on screen.
 * `tab` is compared loosely: an item without a tab matches any tab, so a module
 * still highlights its first entry when the shell has no sub-module selected.
 */
export const findNavLocation = (navigation, moduleId, tab) => {
  let looseMatch = null;

  for (const group of navigation) {
    for (const item of groupItems(group)) {
      if (item.module !== moduleId) continue;
      if (item.tab && tab && item.tab === tab) return { group, item };
      if (!item.tab && !tab) return { group, item };
      if (!looseMatch) looseMatch = { group, item };
    }
  }

  return looseMatch;
};
