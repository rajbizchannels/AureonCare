/**
 * AdminPanelView - Refactored and Secured
 *
 * MAJOR IMPROVEMENTS:
 * 1. SECURITY: Removed all credential storage from frontend state
 * 2. PERFORMANCE: Added useMemo and useCallback optimizations
 * 3. VALIDATION: Integrated comprehensive input validation
 * 4. CODE QUALITY: Added PropTypes, constants, better error handling
 * 5. MAINTAINABILITY: Better code organization and structure
 *
 * NEXT STEPS FOR FURTHER IMPROVEMENT:
 * - Split into separate tab components (ClinicSettingsTab, UserManagementTab, etc.)
 * - Extract to separate files in /views/AdminPanel/ directory
 * - Move to TypeScript for better type safety
 * - Add comprehensive unit tests
 * - Implement React Query for better API state management
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Settings,
  Users,
  Clock,
  Building2,
  Save,
  Edit,
  Trash2,
  UserPlus,
  Shield,
  Lock,
  Unlock,
  CheckCircle,
  ArrowLeft,
  CreditCard,
  Check,
  Video,
  Plus,
  HardDrive,
  Cloud,
  Download,
  Upload,
  RefreshCw,
  X,
  User,
  Mail,
  Phone,
  FileText,
  Stethoscope,
  Globe,
  Languages,
  MapPin,
  Archive,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import CredentialModal from '../components/modals/CredentialModal';
import { useAudit } from '../hooks/useAudit';
import IntegrationCard from '../components/IntegrationCard';
import AuditLogsTab from '../components/admin/AuditLogsTab';
import ArchiveManagementTab from '../components/admin/ArchiveManagementTab';
import { useClinicSettings } from '../hooks/useClinicSettings';
import {
  USER_ROLES,
  USER_STATUS,
  PLAN_IDS,
  DEFAULT_APPOINTMENT_SETTINGS,
  DEFAULT_WORKING_HOURS,
  DEFAULT_ROLE_PERMISSIONS,
  SUBSCRIPTION_PLANS,
  ADMIN_TABS,
  TELEHEALTH_PROVIDERS,
  VENDOR_TYPES,
} from '../constants/adminConstants';
import {
  validateAppointmentDuration,
  validateSlotInterval,
  validateMaxAdvanceBooking,
  validateCancellationDeadline,
  sanitizeString,
  safeJSONParse,
} from '../utils/validators';
import { hasPermission, isAdmin } from '../utils/rolePermissions';

/**
 * ZoomSetupGuide — admin-only collapsible guide for configuring
 * the Zoom OAuth App server-side (environment variables).
 *
 * The admin configures Zoom once and all providers can launch sessions.
 * End users (providers) never see or enter credentials — they just
 * click "New Session" or "Instant Zoom" in the Telehealth module.
 */
/**
 * PlatformSetupGuide — developer-only collapsible guide (all telehealth providers).
 * Clinic admins never need this: the platform developer registers ONE app per
 * provider (Zoom, Google, Webex, Teams) and sets env vars server-side.
 * After that, every clinic admin just clicks "Connect [Provider] Account".
 */
const PlatformSetupGuide = ({ theme }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [redirectUrls, setRedirectUrls] = React.useState({});
  const [copiedKey, setCopiedKey] = React.useState('');

  React.useEffect(() => {
    ['zoom', 'google_meet', 'webex', 'microsoft_teams'].forEach((p) => {
      fetch(`/api/integrations/oauth/${p}/redirect-url`)
        .then(r => r.json())
        .then(data => setRedirectUrls(prev => ({ ...prev, [p]: data.redirectUrl || '' })))
        .catch(() => {});
    });
  }, []);

  const handleCopy = (key, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    });
  };

  const code = (txt) => (
    <code className={`px-1 py-0.5 rounded text-xs ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>{txt}</code>
  );

  const renderRedirectUrl = (provider, label) => {
    const url = redirectUrls[provider];
    if (!url) return null;
    const key = `redirect-${provider}`;
    return (
      <div className="mt-1 flex items-center gap-2">
        <span className={`text-xs font-medium flex-shrink-0 w-24 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{label}:</span>
        <code className={`flex-1 text-xs px-2 py-1 rounded font-mono break-all ${
          theme === 'dark' ? 'bg-slate-800 text-blue-300' : 'bg-white border border-gray-200 text-blue-800'
        }`}>{url}</code>
        <button onClick={() => handleCopy(key, url)} className={`p-1.5 rounded flex-shrink-0 ${
          copiedKey === key ? 'text-green-500' : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'
        }`}>
          {copiedKey === key ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  return (
    <div className={`border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-6 py-3 flex items-center justify-between text-sm font-medium transition-colors ${
          theme === 'dark'
            ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/30'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className="flex items-center gap-2">
          <Settings className="w-3.5 h-3.5" />
          Platform Developer Setup (one-time, server-side)
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className={`px-6 pb-6 space-y-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
          <p className={`text-xs p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-800'}`}>
            <strong>Platform developers only.</strong> Do this once when deploying AureonCare.
            After these steps every clinic admin can connect their account with a single click — zero configuration required on their part.
          </p>

          <div className="space-y-5">
            {/* ── Zoom ── */}
            <div>
              <p className="font-semibold mb-1">Zoom</p>
              <ol className={`list-decimal list-inside space-y-1 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                <li>Create a <strong>General App → User-managed</strong> at{' '}
                  <a href="https://marketplace.zoom.us/develop/create" target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 hover:underline inline-flex items-center gap-1">
                    marketplace.zoom.us <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  (<em>User-managed</em> allows any Zoom account to connect; Admin-managed restricts to same org)
                </li>
                <li>Set the Redirect URL (copy below) and add to Allow List</li>
                <li>Add scopes: {code('meeting:write:meeting')} {code('meeting:read:meeting')} {code('user:read:user')} {code('user:read:zak')}</li>
                <li>Copy Client ID → {code('ZOOM_CLIENT_ID')}, Client Secret → {code('ZOOM_CLIENT_SECRET')}</li>
              </ol>
              {renderRedirectUrl('zoom', 'Redirect URL')}
            </div>

            {/* ── Google Meet ── */}
            <div>
              <p className="font-semibold mb-1">Google Meet</p>
              <ol className={`list-decimal list-inside space-y-1 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                <li>Create an OAuth 2.0 client in{' '}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 hover:underline inline-flex items-center gap-1">
                    Google Cloud Console <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Enable the <strong>Google Calendar API</strong> and <strong>Google Meet REST API</strong></li>
                <li>Set the Authorized Redirect URI (copy below)</li>
                <li>Copy Client ID → {code('GOOGLE_MEET_CLIENT_ID')}, Client Secret → {code('GOOGLE_MEET_CLIENT_SECRET')}</li>
              </ol>
              {renderRedirectUrl('google_meet', 'Redirect URI')}
            </div>

            {/* ── Webex ── */}
            <div>
              <p className="font-semibold mb-1">Cisco Webex</p>
              <ol className={`list-decimal list-inside space-y-1 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                <li>Create an Integration at{' '}
                  <a href="https://developer.webex.com/my-apps/new/integration" target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 hover:underline inline-flex items-center gap-1">
                    developer.webex.com <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Set the Redirect URI (copy below)</li>
                <li>Add scopes: {code('meeting:schedules_write')} {code('meeting:schedules_read')}</li>
                <li>Copy Client ID → {code('WEBEX_CLIENT_ID')}, Client Secret → {code('WEBEX_CLIENT_SECRET')}</li>
              </ol>
              {renderRedirectUrl('webex', 'Redirect URI')}
            </div>

            {/* ── Microsoft Teams ── */}
            <div>
              <p className="font-semibold mb-1">Microsoft Teams</p>
              <ol className={`list-decimal list-inside space-y-1 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                <li>Register an app at{' '}
                  <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 hover:underline inline-flex items-center gap-1">
                    Azure App Registrations <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Under <strong>Authentication</strong>, add a Web redirect URI (copy below)</li>
                <li>Under <strong>API Permissions</strong>, add: {code('OnlineMeetings.ReadWrite')} {code('User.Read')} {code('offline_access')}</li>
                <li>Under <strong>Certificates & secrets</strong>, create a Client Secret</li>
                <li>Copy Application (client) ID → {code('TEAMS_CLIENT_ID')}, Client Secret → {code('TEAMS_CLIENT_SECRET')}</li>
              </ol>
              {renderRedirectUrl('microsoft_teams', 'Redirect URI')}
            </div>

            {/* ── Env vars ── */}
            <div>
              <p className="font-semibold mb-1">Environment Variables</p>
              <div className={`p-3 rounded text-xs font-mono whitespace-pre ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-800'}`}>
{`# backend/.env
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=

GOOGLE_MEET_CLIENT_ID=
GOOGLE_MEET_CLIENT_SECRET=

WEBEX_CLIENT_ID=
WEBEX_CLIENT_SECRET=

TEAMS_CLIENT_ID=
TEAMS_CLIENT_SECRET=`}
              </div>
            </div>

            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
              Restart the server after updating <code>.env</code>.
              Clinic admins can then click <strong>Connect Account</strong> for any configured provider — no further setup on their side.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Main Admin Panel View Component
 *
 * @component
 * @param {Object} props
 * @param {'light'|'dark'} props.theme - Current UI theme
 * @param {Array<Object>} props.users - List of system users
 * @param {Function} props.setUsers - Update users list
 * @param {Function} props.setShowForm - Show/hide form modal
 * @param {Function} props.setEditingItem - Set item being edited
 * @param {Function} props.setCurrentView - Change current view
 * @param {Object} props.api - API service instance
 * @param {Function} props.addNotification - Show notification to user
 * @param {Function} props.setCurrentModule - Change current module
 * @param {Object} props.t - Translation object
 */
const AdminPanelView = ({
  theme,
  users,
  setUsers,
  setShowForm,
  setEditingItem,
  setCurrentView = () => {},
  api,
  addNotification,
  setCurrentModule = () => {},
  t = {},
}) => {
  // ==================== CONTEXT ====================
  const { setPlanTier, updateUserPreferences, planTier, user } = useApp();

  // ==================== STATE ====================
  const [activeTab, setActiveTab] = useState(ADMIN_TABS.CLINIC);

  // Use custom hook for clinic settings (with built-in validation)
  const {
    clinicSettings,
    updateClinicSetting,
    saveClinicSettings,
    validationErrors,
    isSaving,
  } = useClinicSettings(addNotification);

  const [workingHours, setWorkingHours] = useState(DEFAULT_WORKING_HOURS);

  // Backup & Restore states
  const [backupLoading, setBackupLoading] = useState({
    local: false,
    googleDrive: false,
    oneDrive: false,
  });
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupConfig, setBackupConfig] = useState({
    googleDrive: { configured: false },
    oneDrive: { configured: false },
  });
  const [lastBackup, setLastBackup] = useState({
    local: null,
    googleDrive: null,
    oneDrive: null,
  });
  const [backupSuccessModal, setBackupSuccessModal] = useState({
    isOpen: false,
    type: '',
    message: '',
  });
  const [restoreSuccessModal, setRestoreSuccessModal] = useState({
    isOpen: false,
    details: null,
  });

  const [appointmentSettings, setAppointmentSettings] = useState({
    defaultDuration: DEFAULT_APPOINTMENT_SETTINGS.DURATION,
    slotInterval: DEFAULT_APPOINTMENT_SETTINGS.SLOT_INTERVAL,
    maxAdvanceBooking: DEFAULT_APPOINTMENT_SETTINGS.MAX_ADVANCE_BOOKING,
    cancellationDeadline: DEFAULT_APPOINTMENT_SETTINGS.CANCELLATION_DEADLINE,
  });
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);

  const [currentPlan, setCurrentPlan] = useState(planTier || PLAN_IDS.PROFESSIONAL);

  // Integration settings: status + connection info (never raw tokens)
  const [telehealthStatus, setTelehealthStatus] = useState({
    zoom: { is_enabled: false, is_configured: false, has_tokens: false, zoom_user_email: null, token_expires_at: null },
    google_meet: { is_enabled: false, is_configured: false, has_tokens: false, zoom_user_email: null },
    webex: { is_enabled: false, is_configured: false, has_tokens: false, zoom_user_email: null },
    microsoft_teams: { is_enabled: false, is_configured: false, has_tokens: false, zoom_user_email: null },
  });
  const [telehealthDbMissing, setTelehealthDbMissing] = useState(false);

  const [vendorStatus, setVendorStatus] = useState({
    surescripts: { is_enabled: false, is_configured: false, sandbox_mode: true },
    labcorp: { is_enabled: false, is_configured: false, sandbox_mode: true },
    optum: { is_enabled: false, is_configured: false, sandbox_mode: true },
  });
  const [vendorDbMissing, setVendorDbMissing] = useState(false);

  // Custom role creation state
  const [showCustomRoleForm, setShowCustomRoleForm] = useState(false);
  const [customRoleName, setCustomRoleName] = useState('');
  const [customRolePermissions, setCustomRolePermissions] = useState({
    patients: { view: false, create: false, edit: false, delete: false },
    appointments: { view: false, create: false, edit: false, delete: false },
    claims: { view: false, create: false, edit: false, delete: false },
    ehr: { view: false, create: false, edit: false, delete: false },
    telehealth: { view: false, create: false, edit: false, delete: false },
    crm: { view: false, create: false, edit: false, delete: false },
    rcm: { view: false, create: false, edit: false, delete: false },
    practiceManagement: { view: false, create: false, edit: false, delete: false },
    clinicalServices: { view: false, create: false, edit: false, delete: false },
    reports: { view: false, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    backup: { view: false, create: false, edit: false, delete: false },
    audit: { view: false, create: false, edit: false, delete: false },
  });

  // Confirmation modal state
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    onConfirm: null,
  });

  // User form inline state
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    role: 'patient',
    practice: '',
    license: '',
    specialty: '',
    country: '',
    timezone: '',
    license_number: '',
    language: '',
    password: '',
    confirmPassword: '',
  });
  const [userFormErrors, setUserFormErrors] = useState({});
  const [isUserFormSubmitting, setIsUserFormSubmitting] = useState(false);

  // Credential modal state (for vendor integrations — API key based)
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [credentialModalConfig, setCredentialModalConfig] = useState({
    providerName: '',
    providerType: '',
    credentialType: 'oauth',
    onSuccess: null,
    onConnect: null,
    existingCredentials: null,
  });

  // Per-provider: env vars not configured on the platform (zero-config SaaS model)
  const [providerEnvMissing, setProviderEnvMissing] = useState({});
  // Per-provider: test connection in-flight flag and result
  const [testingProvider, setTestingProvider] = useState({});
  const [providerTestResult, setProviderTestResult] = useState({});

  // ==================== MEMOIZED VALUES ====================

  /**
   * Tabs configuration - memoized to prevent recreation on every render
   */
  const tabs = useMemo(
    () => [
      { id: ADMIN_TABS.CLINIC, label: t.clinicSettings || 'Clinic Settings', icon: Building2 },
      { id: ADMIN_TABS.USERS, label: t.userManagement || 'User Management', icon: Users },
      { id: ADMIN_TABS.ROLES, label: t.rolesPermissions || 'Roles & Permissions', icon: Shield },
      { id: ADMIN_TABS.PLANS, label: t.subscriptionPlans || 'Subscription Plans', icon: CreditCard },
      { id: ADMIN_TABS.TELEHEALTH, label: t.integrations || 'Integrations', icon: Video },
      { id: ADMIN_TABS.HOURS, label: t.workingHours || 'Working Hours', icon: Clock },
      { id: ADMIN_TABS.APPOINTMENTS, label: t.appointmentSettings || 'Appointment Settings', icon: Settings },
      { id: ADMIN_TABS.BACKUP, label: 'Backup & Restore', icon: HardDrive },
      { id: ADMIN_TABS.ARCHIVE, label: 'Archive Management', icon: Archive },
      { id: ADMIN_TABS.AUDIT, label: 'Audit Logs', icon: FileText },
    ],
    [t]
  );

  /**
   * Memoized role permission entries to avoid recalculating Object.entries on every render
   */
  const rolePermissionEntries = useMemo(
    () => Object.entries(rolePermissions),
    [rolePermissions]
  );

  /**
   * Filter users by status for display
   */
  const activeUsers = useMemo(
    () => users.filter((u) => u.status === USER_STATUS.ACTIVE),
    [users]
  );

  const pendingUsers = useMemo(
    () => users.filter((u) => u.status === USER_STATUS.PENDING),
    [users]
  );

  const blockedUsers = useMemo(
    () => users.filter((u) => u.status === USER_STATUS.BLOCKED),
    [users]
  );

  // ==================== AUDIT HOOK ====================

  const { logViewAccess } = useAudit();

  // ==================== EFFECTS ====================

  /**
   * Log view access on mount
   */
  useEffect(() => {
    logViewAccess('AdminPanelView', {
      module: 'Admin',
    });
  }, [logViewAccess]);

  /**
   * Sync currentPlan with planTier from context
   */
  useEffect(() => {
    if (planTier) {
      setCurrentPlan(planTier);
    }
  }, [planTier]);

  /**
   * Load backup configuration on mount
   */
  useEffect(() => {
    const loadBackupConfig = async () => {
      try {
        const config = await api.getBackupConfig();
        setBackupConfig(config);
      } catch (error) {
        console.error('Error loading backup config:', error);
        await addNotification('error', 'Failed to load backup configuration');
      }
    };
    loadBackupConfig();
  }, [api, addNotification]);

  /**
   * Load telehealth integration status (NOT credentials)
   * SECURITY: Only status information is loaded, credentials remain server-side
   */
  useEffect(() => {
    const loadTelehealthStatus = async () => {
      try {
        const settings = await api.getTelehealthSettings();
        if (settings && settings.length > 0) {
          const statusMap = {};
          settings.forEach((s) => {
            statusMap[s.provider_type] = {
              is_enabled: s.is_enabled || false,
              is_configured: Boolean(s.client_id || s.api_key),
              has_tokens: s.has_tokens || false,
              is_expired: s.is_expired || false,
              zoom_user_email: s.zoom_user_email || null,
              zoom_user_id: s.zoom_user_id || null,
              account_id: s.account_id || null,
              token_expires_at: s.token_expires_at || null,
            };
          });

          setTelehealthStatus((prev) => ({
            ...prev,
            ...statusMap,
          }));
        }
      } catch (error) {
        console.error('Error loading telehealth settings:', error);
        if (
          error.message &&
          (error.message.includes('telehealth_provider_settings') || error.message.includes('503'))
        ) {
          console.warn(
            'Telehealth provider settings table does not exist. Please run the database migration: node backend/scripts/migrate-telehealth.js'
          );
          setTelehealthDbMissing(true);
          await addNotification(
            'warning',
            'Telehealth database table missing. Please run migrations.'
          );
        } else {
          await addNotification('error', 'Failed to load telehealth integration status');
        }
      }
    };
    loadTelehealthStatus();
  }, [api, addNotification]);

  /**
   * Load vendor integration status (NOT credentials)
   * SECURITY: Only status information is loaded, credentials remain server-side
   */
  useEffect(() => {
    const loadVendorStatus = async () => {
      try {
        const settings = await api.getVendorIntegrationSettings();
        if (settings && settings.length > 0) {
          const statusMap = {};
          settings.forEach((s) => {
            // Only extract status information, NOT credentials
            statusMap[s.vendor_type] = {
              is_enabled: s.is_enabled || false,
              is_configured: Boolean(s.client_id || s.api_key), // Check if configured
              sandbox_mode: s.sandbox_mode !== undefined ? s.sandbox_mode : true,
            };
          });

          setVendorStatus((prev) => ({
            ...prev,
            ...statusMap,
          }));
        }
      } catch (error) {
        console.error('Error loading vendor integration settings:', error);
        if (
          error.message &&
          (error.message.includes('vendor_integration_settings') || error.message.includes('503'))
        ) {
          console.warn(
            'Vendor integration settings table does not exist. Please run the database migration: 033_add_vendor_integrations.sql'
          );
          setVendorDbMissing(true);
          await addNotification(
            'warning',
            'Vendor integration database table missing. Please run migrations.'
          );
        } else {
          await addNotification('error', 'Failed to load vendor integration status');
        }
      }
    };
    loadVendorStatus();
  }, [api, addNotification]);

  /**
   * Load role permissions from backend
   */
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const permissions = await api.getPermissions();
        if (Object.keys(permissions).length > 0) {
          setRolePermissions(permissions);
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
        await addNotification('error', 'Failed to load role permissions');
        // Continue with default permissions
      }
    };
    loadPermissions();
  }, [api, addNotification]);

  /**
   * Load working hours from backend
   */
  useEffect(() => {
    const loadWorkingHours = async () => {
      try {
        const hours = await api.getWorkingHours();
        if (hours && Object.keys(hours).length > 0) {
          setWorkingHours(hours);
        }
      } catch (error) {
        console.error('Error loading working hours:', error);
        // Continue with default working hours
      }
    };
    loadWorkingHours();
  }, [api]);

  /**
   * Load appointment settings from backend
   */
  useEffect(() => {
    const loadAppointmentSettings = async () => {
      try {
        const settings = await api.getAppointmentSettings();
        if (settings) {
          setAppointmentSettings(settings);
        }
      } catch (error) {
        console.error('Error loading appointment settings:', error);
        // Continue with default appointment settings
      }
    };
    loadAppointmentSettings();
  }, [api]);

  // ==================== CALLBACKS ====================

  /**
   * Confirmation handler - memoized to prevent recreation
   */
  const handleConfirmSave = useCallback(() => {
    if (pendingSaveAction) {
      pendingSaveAction();
    }
    setShowSaveConfirmation(false);
    setPendingSaveAction(null);
  }, [pendingSaveAction]);

  /**
   * Save clinic settings handler - uses the hook
   */
  const handleSaveClinicSettingsClick = useCallback(() => {
    setPendingSaveAction(() => saveClinicSettings);
    setShowSaveConfirmation(true);
  }, [saveClinicSettings]);

  /**
   * Delete user handler with proper confirmation
   */
  const handleDeleteUser = useCallback(
    (userId) => {
      setConfirmModalConfig({
        title: t.deleteUser || 'Delete User',
        message: t.confirmDeleteUser || 'Are you sure you want to delete this user? This action cannot be undone.',
        onConfirm: async () => {
          try {
            await api.deleteUser(userId);
            setUsers((prevUsers) => prevUsers.filter((u) => u.id !== userId));
            await addNotification('success', t.userDeletedSuccessfully || 'User deleted successfully');
          } catch (error) {
            console.error('Error deleting user:', error);
            await addNotification('alert', t.failedToDeleteUser || 'Failed to delete user');
          }
        },
      });
      setShowConfirmModal(true);
    },
    [api, setUsers, addNotification, t]
  );

  /**
   * Toggle user status (block/unblock)
   */
  const handleToggleUserStatus = useCallback(
    (userId, currentStatus) => {
      const newStatus = currentStatus === USER_STATUS.BLOCKED ? USER_STATUS.ACTIVE : USER_STATUS.BLOCKED;
      const actionText = newStatus === USER_STATUS.BLOCKED ? 'block' : 'unblock';
      const confirmMsg =
        newStatus === USER_STATUS.BLOCKED
          ? t.confirmBlockUser || 'Are you sure you want to block this user?'
          : t.confirmUnblockUser || 'Are you sure you want to unblock this user?';
      const title = newStatus === USER_STATUS.BLOCKED ? 'Block User' : 'Unblock User';

      setConfirmModalConfig({
        title,
        message: confirmMsg,
        onConfirm: async () => {
          try {
            const updatedUser = await api.updateUser(userId, { status: newStatus });
            setUsers((prevUsers) => prevUsers.map((u) => (u.id === userId ? updatedUser : u)));

            const successMsg =
              newStatus === USER_STATUS.BLOCKED
                ? t.userBlockedSuccessfully || 'User blocked successfully'
                : t.userUnblockedSuccessfully || 'User unblocked successfully';
            await addNotification('success', successMsg);
          } catch (error) {
            console.error(`Error ${actionText}ing user:`, error);
            const errorMsg =
              newStatus === USER_STATUS.BLOCKED
                ? t.failedToBlockUser || 'Failed to block user'
                : t.failedToUnblockUser || 'Failed to unblock user';
            await addNotification('alert', errorMsg);
          }
        },
      });
      setShowConfirmModal(true);
    },
    [api, setUsers, addNotification, t]
  );

  /**
   * Approve user handler
   */
  const handleApproveUser = useCallback(
    (userId) => {
      setConfirmModalConfig({
        title: t.approveUser || 'Approve User',
        message: t.confirmApproveUser || 'Are you sure you want to approve this user?',
        onConfirm: async () => {
          try {
            const updatedUser = await api.updateUser(userId, { status: USER_STATUS.ACTIVE });
            setUsers((prevUsers) => prevUsers.map((u) => (u.id === userId ? updatedUser : u)));
            await addNotification('success', t.userApprovedSuccessfully || 'User approved successfully');
          } catch (error) {
            console.error('Error approving user:', error);
            await addNotification('alert', t.failedToApproveUser || 'Failed to approve user');
          }
        },
      });
      setShowConfirmModal(true);
    },
    [api, setUsers, addNotification, t]
  );

  /**
   * Handle user form submission (create or update)
   */
  const handleUserFormSubmit = useCallback(
    async (formData) => {
      try {
        if (editingUser) {
          // Update existing user
          const updateData = {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            role: formData.role,
            practice: formData.practice,
            license: formData.license,
            specialty: formData.specialty,
            country: formData.country,
            timezone: formData.timezone,
            license_number: formData.license_number,
            language: formData.language,
          };

          // Only include password if it was changed
          if (formData.password) {
            updateData.password = formData.password;
          }

          const updatedUser = await api.updateUser(editingUser.id, updateData);
          setUsers((prevUsers) => prevUsers.map((u) => (u.id === editingUser.id ? updatedUser : u)));

          // Close user form and show success notification
          setShowUserForm(false);
          setEditingUser(null);
          await addNotification('success', (t.userUpdatedSuccessfully || 'User updated successfully') + '. Changes will take effect after logout and login.');
        } else {
          // Create new user
          const userData = {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            role: formData.role,
            practice: formData.practice,
            license: formData.license,
            specialty: formData.specialty,
            country: formData.country,
            timezone: formData.timezone,
            license_number: formData.license_number,
            language: formData.language,
            password: formData.password,
          };

          const newUser = await api.createUser(userData);
          setUsers((prevUsers) => [...prevUsers, newUser]);

          // Close user form and show success notification
          setShowUserForm(false);
          setEditingUser(null);
          await addNotification('success', (t.userCreatedSuccessfully || 'User created successfully') + '. Changes will take effect after logout and login.');
        }
      } catch (error) {
        console.error('Error saving user:', error);
        await addNotification('alert', error.message || (editingUser ? 'Failed to update user' : 'Failed to create user'));
        throw error; // Re-throw to keep form open
      }
    },
    [editingUser, api, setUsers, t, addNotification]
  );

  /**
   * Save role permissions
   */
  const handleSaveRolePermissions = useCallback(async () => {
    try {
      await api.updatePermissions(rolePermissions);
      await addNotification('success', t.rolePermissionsSaved || 'Role permissions saved successfully');
    } catch (error) {
      console.error('Error saving permissions:', error);
      await addNotification('alert', t.failedToSaveRolePermissions || 'Failed to save role permissions');
    }
  }, [api, rolePermissions, addNotification, t]);

  const handleSaveRolePermissionsClick = useCallback(() => {
    setPendingSaveAction(() => handleSaveRolePermissions);
    setShowSaveConfirmation(true);
  }, [handleSaveRolePermissions]);

  /**
   * Toggle permission for a specific role and module
   */
  const handleTogglePermission = useCallback((role, module, action) => {
    setRolePermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [module]: {
          ...prev[role][module],
          [action]: !prev[role][module][action],
        },
      },
    }));
  }, []);

  /**
   * Delete custom role
   */
  const handleDeleteCustomRole = useCallback(
    (roleName) => {
      setConfirmModalConfig({
        title: 'Delete Custom Role',
        message: `Are you sure you want to delete the "${roleName}" role? This action cannot be undone.`,
        onConfirm: async () => {
          try {
            // Remove from state
            setRolePermissions((prev) => {
              const updated = { ...prev };
              delete updated[roleName];
              return updated;
            });

            // Delete from API
            await api.deleteRole(roleName);
            await addNotification('success', `Custom role "${roleName}" deleted successfully`);
          } catch (error) {
            console.error('Error deleting custom role:', error);
            await addNotification('alert', 'Failed to delete custom role');
          }
        },
      });
      setShowConfirmModal(true);
    },
    [api, addNotification]
  );

  /**
   * Create or update custom role
   */
  const handleCreateCustomRole = useCallback(
    async (roleName, permissions) => {
      try {
        // Sanitize role name
        const sanitizedName = sanitizeString(roleName);

        // Check if role already exists (editing mode)
        const isEditMode = rolePermissions.hasOwnProperty(sanitizedName);

        // Add to state
        setRolePermissions((prev) => ({
          ...prev,
          [sanitizedName]: permissions,
        }));

        // Save to API using updateRolePermissions
        await api.updateRolePermissions(sanitizedName, permissions);

        await addNotification(
          'success',
          isEditMode
            ? `Role "${sanitizedName}" updated successfully`
            : `Custom role "${sanitizedName}" created successfully`
        );

        setShowCustomRoleForm(false);
        setCustomRoleName('');
        setCustomRolePermissions({
          patients: { view: false, create: false, edit: false, delete: false },
          appointments: { view: false, create: false, edit: false, delete: false },
          claims: { view: false, create: false, edit: false, delete: false },
          ehr: { view: false, create: false, edit: false, delete: false },
          users: { view: false, create: false, edit: false, delete: false },
          reports: { view: false, create: false, edit: false, delete: false },
          settings: { view: false, create: false, edit: false, delete: false },
          backup: { view: false, create: false, edit: false, delete: false },
        });
      } catch (error) {
        console.error('Error saving custom role:', error);
        await addNotification('alert', 'Failed to save custom role');
      }
    },
    [api, addNotification, rolePermissions]
  );

  /**
   * SECURITY FIX: Integration toggle only changes status
   * Configuration (credentials) is handled via secure backend flow
   */
  const handleToggleTelehealthProvider = useCallback(
    async (providerType, isEnabled) => {
      // Store previous state for rollback
      const previousState = telehealthStatus[providerType];

      try {
        // Optimistically update UI
        setTelehealthStatus((prev) => ({
          ...prev,
          [providerType]: {
            ...prev[providerType],
            is_enabled: isEnabled,
          },
        }));

        await api.toggleTelehealthProvider(providerType, isEnabled);

        const providerName = providerType
          .replace('_', ' ')
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

        await addNotification(
          'success',
          `${providerName} ${isEnabled ? 'enabled' : 'disabled'} successfully`
        );
      } catch (error) {
        console.error('Error toggling telehealth provider:', error);
        // Revert to previous state on error
        setTelehealthStatus((prev) => ({
          ...prev,
          [providerType]: previousState,
        }));
        await addNotification('alert', `Failed to toggle ${providerType}`);
      }
    },
    [api, telehealthStatus, addNotification]
  );

  /**
   * Handle credential modal submission
   */
  const handleCredentialSubmit = useCallback(async (credentials) => {
    const { providerType, onSuccess } = credentialModalConfig;

    try {
      // Save credentials
      const saveResponse = await fetch(`/api/integrations/oauth/${providerType}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.error || 'Failed to save credentials');
      }

      await addNotification('success', 'Credentials saved successfully.');
      setShowCredentialModal(false);

      // Call the success callback if provided (e.g., trigger OAuth)
      if (onSuccess) {
        await onSuccess();
      }
    } catch (error) {
      console.error('Error saving credentials:', error);
      await addNotification('alert', error.message || 'Failed to save credentials');
      throw error; // Re-throw to keep modal open
    }
  }, [credentialModalConfig, addNotification]);

  /**
   * Handle OneClick Integration - initiates OAuth flow directly for a provider
   * that already has credentials saved, bypassing the manual form.
   */
  const handleOneClickIntegration = useCallback(
    async (providerType) => {
      try {
        const providerNames = {
          zoom: 'Zoom',
          google_meet: 'Google Meet',
          webex: 'Cisco Webex',
        };
        const displayName = providerNames[providerType] || providerType;

        await addNotification('info', `Starting ${displayName} OneClick Integration...`);

        const response = await fetch(`/api/integrations/oauth/${providerType}/initiate`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to initiate OAuth flow');
        }

        if (data.authUrl) {
          const width = 600;
          const height = 700;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;

          const popup = window.open(
            data.authUrl,
            'OAuth Authorization',
            `width=${width},height=${height},left=${left},top=${top}`
          );

          const pollTimer = setInterval(async () => {
            if (popup && popup.closed) {
              clearInterval(pollTimer);
              try {
                const settings = await api.getTelehealthSettings();
                if (settings) {
                  setTelehealthStatus((prev) => ({
                    ...prev,
                    ...settings,
                  }));
                }
                await addNotification('success', `${displayName} connected successfully via OneClick Integration.`);
              } catch (error) {
                console.error('Error refreshing telehealth status:', error);
                await addNotification('warning', 'Configuration may have been saved. Please refresh the page.');
              }
            }
          }, 1000);
        }
      } catch (error) {
        console.error('Error in OneClick Integration:', error);
        await addNotification('alert', error.message || 'OneClick Integration failed. Please try manual configuration.');
      }
    },
    [api, addNotification]
  );

  /**
   * Fetch backup provider configuration status
   */
  const fetchBackupConfigStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/backup-providers/config/status');
      if (response.ok) {
        const status = await response.json();
        setBackupConfig({
          googleDrive: { configured: status.googleDrive?.configured || false },
          oneDrive: { configured: status.oneDrive?.configured || false },
        });
      }
    } catch (error) {
      console.error('Error fetching backup config status:', error);
    }
  }, []);

  /**
   * Poll backend OAuth status endpoint to detect when tokens are saved.
   * Does NOT access the popup window reference (COOP blocks cross-origin access
   * to popup.closed, causing repeated browser warnings).
   * Pure backend polling — works regardless of COOP policy.
   */
  const pollOAuthStatus = useCallback((providerType, _popup, onComplete) => {
    const POLL_INTERVAL = 2000; // 2 seconds
    const MAX_POLL_TIME = 5 * 60 * 1000; // 5 minute timeout
    const startTime = Date.now();

    const pollTimer = setInterval(async () => {
      if (Date.now() - startTime > MAX_POLL_TIME) {
        clearInterval(pollTimer);
        onComplete(false);
        return;
      }

      try {
        const statusResponse = await fetch(`/api/integrations/oauth/${providerType}/status`);
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (status.hasTokens) {
            clearInterval(pollTimer);
            onComplete(true);
          }
        }
      } catch (err) {
        // Network error — keep polling
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollTimer);
  }, []);

  /**
   * Handle reconfigure integration - fetches existing credentials and shows edit modal
   */
  const handleReconfigureIntegration = useCallback(
    async (providerType, providerName, credentialType = 'oauth') => {
      try {
        // Fetch existing credentials
        const response = await fetch(`/api/integrations/oauth/${providerType}/credentials`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch credentials');
        }

        // Helper: initiate OAuth popup and poll for completion
        const initiateOAuthPopup = async () => {
          const oauthResponse = await fetch(`/api/integrations/oauth/${providerType}/initiate`);
          const oauthData = await oauthResponse.json();

          if (!oauthResponse.ok) {
            throw new Error(oauthData.error || 'Failed to initiate OAuth flow');
          }

          if (oauthData.authUrl) {
            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;
            const popup = window.open(
              oauthData.authUrl,
              'OAuth Authorization',
              `width=${width},height=${height},left=${left},top=${top}`
            );

            // Poll backend OAuth status (COOP-safe, no popup.closed dependency)
            pollOAuthStatus(providerType, popup, async (success) => {
              if (success) {
                if (['zoom', 'google_meet', 'webex', 'microsoft_teams'].includes(providerType)) {
                  const settings = await api.getTelehealthSettings();
                  setTelehealthStatus((prev) => ({ ...prev, ...settings }));
                } else if (['google_drive', 'onedrive'].includes(providerType)) {
                  await fetchBackupConfigStatus();
                }
                setShowCredentialModal(false);
                await addNotification('success', `${providerName} configured successfully.`);
              }
            });
          }
        };

        // onSuccess: called after saving updated credentials → triggers OAuth
        const onSuccess = credentialType === 'oauth' ? initiateOAuthPopup : null;

        // onConnect: one-click connect (credentials already saved, go straight to OAuth)
        const onConnect = credentialType === 'oauth' ? async () => {
          await addNotification('info', `Connecting to ${providerName}...`);
          await initiateOAuthPopup();
        } : null;

        // Show credential modal with existing data
        setCredentialModalConfig({
          providerName,
          providerType,
          credentialType,
          existingCredentials: data,
          onSuccess,
          onConnect,
        });
        setShowCredentialModal(true);
      } catch (error) {
        console.error('Error fetching credentials for reconfiguration:', error);
        await addNotification('alert', 'Failed to load existing credentials');
      }
    },
    [api, addNotification, fetchBackupConfigStatus, pollOAuthStatus]
  );

  /**
   * Helper: open OAuth popup and poll for completion
   */
  const openOAuthPopup = useCallback(async (providerType, displayName) => {
    const response = await fetch(`/api/integrations/oauth/${providerType}/initiate`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to initiate OAuth flow');
    }

    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      data.authUrl,
      'OAuth Authorization',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Single completion handler — ensures popup is closed and UI is refreshed exactly once
    let completed = false;
    const onOAuthComplete = async (success) => {
      if (completed) return;
      completed = true;
      // Try to close the popup (COOP may block access — that's fine, it self-closes)
      try { popup?.close(); } catch (_) {}

      if (success) {
        try {
          const settings = await api.getTelehealthSettings();
          if (settings && Array.isArray(settings)) {
            const statusMap = {};
            settings.forEach((s) => {
              statusMap[s.provider_type] = {
                is_enabled: s.is_enabled || false,
                is_configured: Boolean(s.client_id || s.api_key),
                has_tokens: s.has_tokens || false,
                is_expired: s.is_expired || false,
                zoom_user_email: s.zoom_user_email || null,
                zoom_user_id: s.zoom_user_id || null,
                account_id: s.account_id || null,
                token_expires_at: s.token_expires_at || null,
              };
            });
            setTelehealthStatus((prev) => ({ ...prev, ...statusMap }));
          }
          setShowCredentialModal(false);
          await addNotification('success', `${displayName} connected successfully.`);
        } catch (error) {
          console.error('Error refreshing telehealth status:', error);
          await addNotification('warning', 'Connection may have been saved. Please refresh the page.');
        }
      } else {
        await addNotification('alert', `Failed to connect ${displayName}. Please try again.`);
      }
    };

    // Primary signal: postMessage from the popup's self-closing success/error page
    const messageHandler = (event) => {
      if (!event.data || event.data.provider !== providerType) return;
      if (event.data.type === 'oauth_success' || event.data.type === 'oauth_error') {
        window.removeEventListener('message', messageHandler);
        onOAuthComplete(event.data.type === 'oauth_success');
      }
    };
    window.addEventListener('message', messageHandler);

    // Fallback: backend polling (handles COOP environments where window.opener is null)
    pollOAuthStatus(providerType, popup, (success) => {
      window.removeEventListener('message', messageHandler);
      onOAuthComplete(success);
    });
  }, [api, addNotification, pollOAuthStatus]);

  /**
   * Disconnect a telehealth provider (clear OAuth tokens, keep app credentials)
   */
  const handleDisconnectProvider = useCallback(async (providerType) => {
    const providerNames = { zoom: 'Zoom', google_meet: 'Google Meet', webex: 'Cisco Webex', microsoft_teams: 'Microsoft Teams' };
    const displayName = providerNames[providerType] || providerType;

    try {
      const response = await fetch(`/api/integrations/oauth/${providerType}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to disconnect');

      setTelehealthStatus((prev) => ({
        ...prev,
        [providerType]: {
          ...prev[providerType],
          is_enabled: false,
          has_tokens: false,
          zoom_user_email: null,
          zoom_user_id: null,
          token_expires_at: null,
        },
      }));
      await addNotification('success', `${displayName} disconnected.`);
    } catch (error) {
      console.error(`Error disconnecting ${providerType}:`, error);
      await addNotification('alert', `Failed to disconnect ${displayName}`);
    }
  }, [addNotification]);

  /**
   * Configure telehealth provider (SaaS zero-config model).
   * All OAuth providers (Zoom, Google Meet, Webex, Teams) use the same flow:
   *   1. App credentials (Client ID/Secret) come from platform env vars — never from the clinic admin.
   *   2. Clinic admin clicks "Connect [Provider] Account" → OAuth popup opens.
   *   3. If platform env vars are missing, shows a "not enabled on this platform" message.
   */
  const handleConfigureTelehealthProvider = useCallback(
    async (providerType) => {
      try {
        const providerNames = { zoom: 'Zoom', google_meet: 'Google Meet', webex: 'Cisco Webex', microsoft_teams: 'Microsoft Teams' };
        const displayName = providerNames[providerType] || providerType;

        // Try to initiate OAuth directly (env-var credentials resolved server-side)
        try {
          await openOAuthPopup(providerType, displayName);
          setProviderEnvMissing(prev => ({ ...prev, [providerType]: false }));
          return;
        } catch (oauthError) {
          if (!oauthError.message?.includes('not configured')) {
            throw oauthError;
          }
        }

        // Platform env vars not set — show admin-facing message
        setProviderEnvMissing(prev => ({ ...prev, [providerType]: true }));

        const envVarHint = {
          zoom: 'ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET',
          google_meet: 'GOOGLE_MEET_CLIENT_ID and GOOGLE_MEET_CLIENT_SECRET',
          webex: 'WEBEX_CLIENT_ID and WEBEX_CLIENT_SECRET',
          microsoft_teams: 'TEAMS_CLIENT_ID and TEAMS_CLIENT_SECRET',
        }[providerType] || `${providerType.toUpperCase()}_CLIENT_ID and ${providerType.toUpperCase()}_CLIENT_SECRET`;

        await addNotification(
          'warning',
          `${displayName} integration is not enabled on this platform. A system administrator needs to set the ${envVarHint} environment variables on the server.`
        );
      } catch (error) {
        console.error('Error starting provider configuration:', error);
        await addNotification('alert', error.message || 'Failed to start configuration flow');
      }
    },
    [addNotification, openOAuthPopup]
  );

  /**
   * Toggle vendor integration
   */
  const handleToggleVendorIntegration = useCallback(
    async (vendorType, isEnabled) => {
      const previousState = vendorStatus[vendorType];

      try {
        // Optimistically update UI
        setVendorStatus((prev) => ({
          ...prev,
          [vendorType]: {
            ...prev[vendorType],
            is_enabled: isEnabled,
          },
        }));

        await api.toggleVendorIntegration(vendorType, isEnabled);
        const vendorName = vendorType.charAt(0).toUpperCase() + vendorType.slice(1);
        await addNotification(
          'success',
          `${vendorName} ${isEnabled ? 'enabled' : 'disabled'} successfully`
        );
      } catch (error) {
        console.error('Error toggling vendor integration:', error);
        // Revert to previous state on error
        setVendorStatus((prev) => ({
          ...prev,
          [vendorType]: previousState,
        }));
        await addNotification('alert', `Failed to toggle ${vendorType}`);
      }
    },
    [api, vendorStatus, addNotification]
  );

  /**
   * Configure vendor integration (API key based)
   */
  const handleConfigureVendorIntegration = useCallback(async (vendorType) => {
    try {
      const vendorNames = {
        surescripts: 'Surescripts ePrescribe',
        labcorp: 'Labcorp',
        optum: 'Optum',
      };
      const displayName = vendorNames[vendorType] || vendorType;

      setCredentialModalConfig({
        providerName: displayName,
        providerType: vendorType,
        credentialType: 'api_key',
        onSuccess: async () => {
          // Update vendor status
          setVendorStatus((prev) => ({
            ...prev,
            [vendorType]: {
              ...prev[vendorType],
              is_configured: true,
            },
          }));
          await addNotification('success', `${displayName} configured successfully.`);
        }
      });
      setShowCredentialModal(true);
    } catch (error) {
      console.error('Error configuring vendor integration:', error);
      await addNotification('alert', error.message || 'Failed to configure vendor integration');
    }
  }, [addNotification]);

  /**
   * Save working hours with validation
   */
  const handleSaveWorkingHours = useCallback(async () => {
    try {
      await api.saveWorkingHours(workingHours);
      await addNotification('success', t.workingHoursSaved || 'Working hours saved successfully');
    } catch (error) {
      console.error('Error saving working hours:', error);
      await addNotification('alert', 'Failed to save working hours');
    }
  }, [api, workingHours, addNotification, t]);

  const handleSaveWorkingHoursClick = useCallback(() => {
    setPendingSaveAction(() => handleSaveWorkingHours);
    setShowSaveConfirmation(true);
  }, [handleSaveWorkingHours]);

  /**
   * Update appointment setting with validation
   */
  const handleAppointmentSettingChange = useCallback(
    (field, value) => {
      let validation;

      switch (field) {
        case 'defaultDuration':
          validation = validateAppointmentDuration(value);
          break;
        case 'slotInterval':
          validation = validateSlotInterval(value);
          break;
        case 'maxAdvanceBooking':
          validation = validateMaxAdvanceBooking(value);
          break;
        case 'cancellationDeadline':
          validation = validateCancellationDeadline(value);
          break;
        default:
          return;
      }

      if (!validation.isValid) {
        addNotification('warning', validation.error);
        return;
      }

      setAppointmentSettings((prev) => ({
        ...prev,
        [field]: validation.value,
      }));
    },
    [addNotification]
  );

  /**
   * Save appointment settings
   */
  const handleSaveAppointmentSettings = useCallback(async () => {
    try {
      await api.saveAppointmentSettings(appointmentSettings);
      await addNotification(
        'success',
        t.appointmentSettingsSaved || 'Appointment settings saved successfully'
      );
    } catch (error) {
      console.error('Error saving appointment settings:', error);
      await addNotification('alert', 'Failed to save appointment settings');
    }
  }, [api, appointmentSettings, addNotification, t]);

  const handleSaveAppointmentSettingsClick = useCallback(() => {
    setPendingSaveAction(() => handleSaveAppointmentSettings);
    setShowSaveConfirmation(true);
  }, [handleSaveAppointmentSettings]);

  /**
   * Local backup - download JSON file
   */
  const handleLocalBackup = useCallback(async () => {
    try {
      setBackupLoading((prev) => ({ ...prev, local: true }));
      await addNotification('info', 'Starting local backup...');

      const backupData = await api.generateBackup();

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `aureoncare-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      setLastBackup((prev) => ({ ...prev, local: new Date().toISOString() }));
      setBackupSuccessModal({
        isOpen: true,
        type: 'Local',
        message: `Backup file has been downloaded successfully as ${filename}`,
      });
    } catch (error) {
      console.error('Error creating local backup:', error);
      await addNotification('alert', 'Failed to create local backup');
    } finally {
      setBackupLoading((prev) => ({ ...prev, local: false }));
    }
  }, [api, addNotification]);

  /**
   * Google Drive backup
   */
  const handleGoogleDriveBackup = useCallback(async () => {
    try {
      setBackupLoading((prev) => ({ ...prev, googleDrive: true }));
      await addNotification('info', 'Starting Google Drive backup...');

      await api.backupToGoogleDrive();

      setLastBackup((prev) => ({ ...prev, googleDrive: new Date().toISOString() }));
      setBackupSuccessModal({
        isOpen: true,
        type: 'Google Drive',
        message: 'Your complete system backup has been successfully uploaded to Google Drive.',
      });
    } catch (error) {
      console.error('Error backing up to Google Drive:', error);
      await addNotification('alert', error.message || 'Failed to backup to Google Drive');
    } finally {
      setBackupLoading((prev) => ({ ...prev, googleDrive: false }));
    }
  }, [api, addNotification]);

  /**
   * OneDrive backup
   */
  const handleOneDriveBackup = useCallback(async () => {
    try {
      setBackupLoading((prev) => ({ ...prev, oneDrive: true }));
      await addNotification('info', 'Starting OneDrive backup...');

      await api.backupToOneDrive();

      setLastBackup((prev) => ({ ...prev, oneDrive: new Date().toISOString() }));
      setBackupSuccessModal({
        isOpen: true,
        type: 'OneDrive',
        message: 'Your complete system backup has been successfully uploaded to OneDrive.',
      });
    } catch (error) {
      console.error('Error backing up to OneDrive:', error);
      await addNotification('alert', error.message || 'Failed to backup to OneDrive');
    } finally {
      setBackupLoading((prev) => ({ ...prev, oneDrive: false }));
    }
  }, [api, addNotification]);

  /**
   * Load backup configuration status on mount
   */
  useEffect(() => {
    fetchBackupConfigStatus();
  }, [fetchBackupConfigStatus]);

  /**
   * Sign in to a cloud backup provider (Google Drive / OneDrive).
   * Credentials are configured at the platform level (env vars), so this goes
   * directly to the OAuth sign-in popup — no credential modal, no manual entry.
   */
  const handleConfigureCloudBackup = useCallback(async (providerType) => {
    const displayName = providerType === 'google_drive' ? 'Google Drive' : 'OneDrive';
    try {
      const response = await fetch(`/api/integrations/oauth/${providerType}/initiate`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to start ${displayName} sign-in`);

      const width = 600, height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top  = window.screen.height / 2 - height / 2;
      const popup = window.open(data.authUrl, 'OAuth Authorization',
        `width=${width},height=${height},left=${left},top=${top}`);

      pollOAuthStatus(providerType, popup, async (success) => {
        if (success) {
          await fetchBackupConfigStatus();
          await addNotification('success', `${displayName} connected successfully.`);
        }
      });
    } catch (error) {
      console.error(`Error connecting ${providerType}:`, error);
      await addNotification('alert', error.message || `Failed to connect ${displayName}`);
    }
  }, [addNotification, fetchBackupConfigStatus, pollOAuthStatus]);

  /**
   * Restore from backup file
   */
  const handleRestoreBackup = useCallback(
    async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        setRestoreLoading(true);
        await addNotification('info', 'Starting data restore...');

        const fileContent = await file.text();
        const backupData = safeJSONParse(fileContent);

        if (!backupData) {
          throw new Error('Invalid backup file format');
        }

        const result = await api.restoreBackup(backupData);

        setRestoreSuccessModal({
          isOpen: true,
          details: result,
        });
      } catch (error) {
        console.error('Error restoring backup:', error);
        await addNotification('alert', error.message || 'Failed to restore backup');
      } finally {
        setRestoreLoading(false);
        event.target.value = ''; // Clear file input
      }
    },
    [api, addNotification]
  );

  /**
   * Custom role form submission
   */
  const handleSubmitCustomRole = useCallback(async () => {
    if (!customRoleName.trim()) {
      await addNotification('alert', 'Please enter a role name');
      return;
    }

    const sanitizedName = customRoleName.toLowerCase().replace(/\s+/g, '_');
    await handleCreateCustomRole(sanitizedName, customRolePermissions);
  }, [customRoleName, customRolePermissions, handleCreateCustomRole, addNotification]);

  /**
   * Toggle custom role permission
   */
  const handleToggleCustomRolePermission = useCallback((module, action) => {
    setCustomRolePermissions((prev) => ({
      ...prev,
      [module]: {
        ...(prev[module] || { view: false, create: false, edit: false, delete: false }),
        [action]: !(prev[module]?.[action] || false),
      },
    }));
  }, []);

  /**
   * Update working hours
   */
  const handleWorkingHoursChange = useCallback((day, field, value) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  }, []);

  // ==================== RENDER HELPERS ====================

  /**
   * Render Clinic Settings Tab
   * TODO: Extract to separate component ClinicSettingsTab.js
   */
  const renderClinicSettingsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}
          >
            Clinic Name *
          </label>
          <input
            type="text"
            value={clinicSettings.name}
            onChange={(e) => updateClinicSetting('name', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              validationErrors.name
                ? 'border-red-500'
                : theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          {validationErrors.name && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}
          >
            Email *
          </label>
          <input
            type="email"
            value={clinicSettings.email}
            onChange={(e) => updateClinicSetting('email', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              validationErrors.email
                ? 'border-red-500'
                : theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          {validationErrors.email && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}
          >
            Phone *
          </label>
          <input
            type="tel"
            value={clinicSettings.phone}
            onChange={(e) => updateClinicSetting('phone', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              validationErrors.phone
                ? 'border-red-500'
                : theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          {validationErrors.phone && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.phone}</p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}
          >
            Website
          </label>
          <input
            type="url"
            value={clinicSettings.website}
            onChange={(e) => updateClinicSetting('website', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              validationErrors.website
                ? 'border-red-500'
                : theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          {validationErrors.website && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.website}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}
          >
            Address
          </label>
          <textarea
            value={clinicSettings.address}
            onChange={(e) => updateClinicSetting('address', e.target.value)}
            rows={3}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
        </div>

        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}
          >
            Tax ID (Format: XX-XXXXXXX)
          </label>
          <input
            type="text"
            value={clinicSettings.taxId}
            onChange={(e) => updateClinicSetting('taxId', e.target.value)}
            placeholder="12-3456789"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              validationErrors.taxId
                ? 'border-red-500'
                : theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          {validationErrors.taxId && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.taxId}</p>
          )}
        </div>

        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}
          >
            NPI Number (10 digits)
          </label>
          <input
            type="text"
            value={clinicSettings.npi}
            onChange={(e) => updateClinicSetting('npi', e.target.value)}
            placeholder="1234567890"
            maxLength={10}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              validationErrors.npi
                ? 'border-red-500'
                : theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          {validationErrors.npi && <p className="text-red-500 text-sm mt-1">{validationErrors.npi}</p>}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveClinicSettingsClick}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors ${
            isSaving ? 'cursor-not-allowed' : ''
          }`}
        >
          <Save className="w-5 h-5" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );

  // ==================== USER FORM HELPERS ====================

  /**
   * Sync user form data when editing user changes
   */
  useEffect(() => {
    if (showUserForm && editingUser) {
      setUserFormData({
        firstName: editingUser.firstName || '',
        lastName: editingUser.lastName || '',
        email: editingUser.email || '',
        phone: editingUser.phone || '',
        address: editingUser.address || '',
        role: editingUser.role || 'patient',
        practice: editingUser.practice || '',
        license: editingUser.license || '',
        specialty: editingUser.specialty || '',
        country: editingUser.country || '',
        timezone: editingUser.timezone || '',
        license_number: editingUser.license_number || '',
        language: editingUser.language || '',
        password: '',
        confirmPassword: '',
      });
    } else if (showUserForm && !editingUser) {
      setUserFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        role: 'patient',
        practice: '',
        license: '',
        specialty: '',
        country: '',
        timezone: '',
        license_number: '',
        language: '',
        password: '',
        confirmPassword: '',
      });
    }
    setUserFormErrors({});
  }, [showUserForm, editingUser]);

  const validateUserForm = () => {
    const newErrors = {};
    const isEditMode = Boolean(editingUser);

    if (!userFormData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!userFormData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!userFormData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userFormData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!isEditMode) {
      if (!userFormData.password) {
        newErrors.password = 'Password is required';
      } else if (userFormData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }

      if (userFormData.password !== userFormData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    } else if (userFormData.password) {
      if (userFormData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
      if (userFormData.password !== userFormData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    return newErrors;
  };

  const handleUserFormChange = (field, value) => {
    setUserFormData({ ...userFormData, [field]: value });
    if (userFormErrors[field]) {
      setUserFormErrors({ ...userFormErrors, [field]: null });
    }
  };

  const handleInlineUserFormSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateUserForm();

    if (Object.keys(newErrors).length > 0) {
      setUserFormErrors(newErrors);
      return;
    }

    setIsUserFormSubmitting(true);
    try {
      await handleUserFormSubmit(userFormData);
    } catch (error) {
      console.error('Error submitting user form:', error);
    } finally {
      setIsUserFormSubmitting(false);
    }
  };

  const handleCloseUserForm = () => {
    setShowUserForm(false);
    setEditingUser(null);
    setUserFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      role: 'patient',
      practice: '',
      license: '',
      specialty: '',
      country: '',
      timezone: '',
      license_number: '',
      language: '',
      password: '',
      confirmPassword: '',
    });
    setUserFormErrors({});
  };

  // ==================== RENDER FUNCTIONS ====================

  /**
   * Render User Management Tab with inline form
   * TODO: Extract to separate component UserManagementTab.js
   */
  const renderUserManagementTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Users
        </h2>
        <button
          onClick={() => {
            if (showUserForm) {
              handleCloseUserForm();
            } else {
              setEditingUser(null);
              setShowUserForm(true);
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 ${showUserForm ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg font-medium transition-colors`}
        >
          {showUserForm ? <X className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          {showUserForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {/* Inline User Form */}
      {showUserForm && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-300'}`}>
          <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {editingUser ? (t.editUser || 'Edit User') : (t.addUser || 'Add New User')}
          </h3>

          <form onSubmit={handleInlineUserFormSubmit} className="space-y-4">
            {/* First Name and Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.firstName || 'First Name'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={userFormData.firstName}
                    onChange={(e) => handleUserFormChange('firstName', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } ${userFormErrors.firstName ? 'border-red-500' : ''}`}
                    placeholder="John"
                  />
                </div>
                {userFormErrors.firstName && <p className="mt-1 text-sm text-red-500">{userFormErrors.firstName}</p>}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.lastName || 'Last Name'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={userFormData.lastName}
                  onChange={(e) => handleUserFormChange('lastName', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                  } ${userFormErrors.lastName ? 'border-red-500' : ''}`}
                  placeholder="Doe"
                />
                {userFormErrors.lastName && <p className="mt-1 text-sm text-red-500">{userFormErrors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.email || 'Email'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                <input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => handleUserFormChange('email', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                  } ${userFormErrors.email ? 'border-red-500' : ''}`}
                  placeholder="email@example.com"
                />
              </div>
              {userFormErrors.email && <p className="mt-1 text-sm text-red-500">{userFormErrors.email}</p>}
            </div>

            {/* Phone and Address in 2 columns */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.phone || 'Phone'}
                </label>
                <div className="relative">
                  <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                  <input
                    type="tel"
                    value={userFormData.phone}
                    onChange={(e) => handleUserFormChange('phone', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.address || 'Address'}
                </label>
                <div className="relative">
                  <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={userFormData.address}
                    onChange={(e) => handleUserFormChange('address', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="123 Main St"
                  />
                </div>
              </div>
            </div>

            {/* Practice, License, License Number in 3 columns */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.practice || 'Practice'}
                </label>
                <div className="relative">
                  <Building2 className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={userFormData.practice}
                    onChange={(e) => handleUserFormChange('practice', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="Medical Center"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.license || 'License'}
                </label>
                <div className="relative">
                  <FileText className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={userFormData.license}
                    onChange={(e) => handleUserFormChange('license', e.target.value)}
                    disabled={userFormData.role === 'patient'}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } ${userFormData.role === 'patient' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="License Type"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.licenseNumber || 'License #'}
                </label>
                <input
                  type="text"
                  value={userFormData.license_number}
                  onChange={(e) => handleUserFormChange('license_number', e.target.value)}
                  disabled={userFormData.role === 'patient'}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                  } ${userFormData.role === 'patient' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  placeholder="12345678"
                />
              </div>
            </div>

            {/* Specialty, Country, Timezone, Language in 4 columns */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.specialty || 'Specialty'}
                </label>
                <div className="relative">
                  <Stethoscope className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={userFormData.specialty}
                    onChange={(e) => handleUserFormChange('specialty', e.target.value)}
                    disabled={userFormData.role === 'patient'}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } ${userFormData.role === 'patient' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="Cardiology"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.country || 'Country'}
                </label>
                <div className="relative">
                  <Globe className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                  <select
                    value={userFormData.country}
                    onChange={(e) => handleUserFormChange('country', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">Select</option>
                    <option value="US">US</option>
                    <option value="CA">Canada</option>
                    <option value="GB">UK</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.timezone || 'Timezone'}
                </label>
                <div className="relative">
                  <Clock className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                  <select
                    value={userFormData.timezone}
                    onChange={(e) => handleUserFormChange('timezone', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">Select</option>
                    <option value="America/New_York">ET</option>
                    <option value="America/Chicago">CT</option>
                    <option value="America/Denver">MT</option>
                    <option value="America/Los_Angeles">PT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.language || 'Language'}
                </label>
                <div className="relative">
                  <Languages className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                  <select
                    value={userFormData.language}
                    onChange={(e) => handleUserFormChange('language', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">Select</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="ar">العربية</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.role || 'Role'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Shield className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                <select
                  value={userFormData.role}
                  onChange={(e) => handleUserFormChange('role', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="admin">Admin</option>
                  <option value="doctor">Doctor</option>
                  <option value="staff">Staff</option>
                  <option value="patient">Patient</option>
                </select>
              </div>
            </div>

            {/* Password fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.password || 'Password'} {!editingUser && <span className="text-red-500">*</span>}
                  {editingUser && <span className={`text-sm font-normal ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}> (leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                  <input
                    type="password"
                    value={userFormData.password}
                    onChange={(e) => handleUserFormChange('password', e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    } ${userFormErrors.password ? 'border-red-500' : ''}`}
                    placeholder="Enter password"
                  />
                </div>
                {userFormErrors.password && <p className="mt-1 text-sm text-red-500">{userFormErrors.password}</p>}
              </div>

              {(!editingUser || userFormData.password) && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.confirmPassword || 'Confirm Password'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                    <input
                      type="password"
                      value={userFormData.confirmPassword}
                      onChange={(e) => handleUserFormChange('confirmPassword', e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                      } ${userFormErrors.confirmPassword ? 'border-red-500' : ''}`}
                      placeholder="Confirm password"
                    />
                  </div>
                  {userFormErrors.confirmPassword && <p className="mt-1 text-sm text-red-500">{userFormErrors.confirmPassword}</p>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleCloseUserForm}
                className={`flex-1 px-4 py-2 border rounded-lg font-medium transition-colors ${
                  theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                disabled={isUserFormSubmitting}
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                disabled={isUserFormSubmitting}
              >
                {isUserFormSubmitting ? (t.saving || 'Saving...') : (editingUser ? (t.update || 'Update') : (t.create || 'Create'))}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Users */}
      {activeUsers.length > 0 && (
        <div>
          <h3 className={`text-lg font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Active Users ({activeUsers.length})
          </h3>
          <div className="space-y-2">
            {activeUsers.map((user) => (
              <div
                key={user.id}
                className={`p-4 border rounded-lg flex items-center justify-between ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'
                }`}
              >
                <div>
                  <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {user.name || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email)}
                  </h4>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {user.email} • {user.role}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingUser(user);
                      setShowUserForm(true);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                    }`}
                    title="Edit user"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleToggleUserStatus(user.id, user.status)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                    }`}
                    title="Block user"
                  >
                    <Lock className="w-5 h-5 text-yellow-500" />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                    }`}
                    title="Delete user"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Users */}
      {pendingUsers.length > 0 && (
        <div>
          <h3 className={`text-lg font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Pending Approval ({pendingUsers.length})
          </h3>
          <div className="space-y-2">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className={`p-4 border rounded-lg flex items-center justify-between ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'
                }`}
              >
                <div>
                  <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {user.name || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email)}
                  </h4>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {user.email} • {user.role}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApproveUser(user.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                    }`}
                    title="Delete user"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked Users */}
      {blockedUsers.length > 0 && (
        <div>
          <h3 className={`text-lg font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Blocked Users ({blockedUsers.length})
          </h3>
          <div className="space-y-2">
            {blockedUsers.map((user) => (
              <div
                key={user.id}
                className={`p-4 border rounded-lg flex items-center justify-between ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'
                }`}
              >
                <div>
                  <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {user.name || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email)}
                  </h4>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {user.email} • {user.role}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleUserStatus(user.id, user.status)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <Unlock className="w-5 h-5" />
                    Unblock
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                    }`}
                    title="Delete user"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /**
   * Handle one-click Zoom test connection from the Admin Panel
   */
  const handleTestTelehealthConnection = useCallback(async (providerType) => {
    const providerNames = { zoom: 'Zoom', google_meet: 'Google Meet', webex: 'Cisco Webex', microsoft_teams: 'Microsoft Teams' };
    const displayName = providerNames[providerType] || providerType;
    try {
      setTestingProvider(prev => ({ ...prev, [providerType]: true }));
      setProviderTestResult(prev => ({ ...prev, [providerType]: null }));
      const result = await api.testTelehealthProvider(providerType);
      const msg = result.message || `${displayName} connection successful`;
      setProviderTestResult(prev => ({ ...prev, [providerType]: { success: true, message: msg } }));
      await addNotification('success', msg);
      return result;
    } catch (error) {
      console.error(`${displayName} test connection failed:`, error);
      const msg = error.message || `${displayName} connection test failed`;
      setProviderTestResult(prev => ({ ...prev, [providerType]: { success: false, message: msg } }));
      await addNotification('alert', msg);
      return { success: false, message: msg };
    } finally {
      setTestingProvider(prev => ({ ...prev, [providerType]: false }));
    }
  }, [api, addNotification]);

  /**
   * Render Telehealth Integrations Tab
   * All telehealth providers use the same rich card: zero-config for clinic admins.
   * Platform credentials come from env vars — admins only click "Connect [Provider] Account".
   */

  const TELEHEALTH_CARD_CONFIG = [
    {
      key: 'zoom',
      providerType: TELEHEALTH_PROVIDERS.ZOOM,
      displayName: 'Zoom',
      description: 'HIPAA-compliant video conferencing with embedded SDK',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      gradientFrom: 'from-blue-500',
      gradientTo: 'to-blue-600',
      gradientHoverFrom: 'hover:from-blue-600',
      gradientHoverTo: 'hover:to-blue-700',
    },
    {
      key: 'google_meet',
      providerType: TELEHEALTH_PROVIDERS.GOOGLE_MEET,
      displayName: 'Google Meet',
      description: 'Google video conferencing via Calendar integration',
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-500',
      gradientFrom: 'from-red-500',
      gradientTo: 'to-red-600',
      gradientHoverFrom: 'hover:from-red-600',
      gradientHoverTo: 'hover:to-red-700',
    },
    {
      key: 'webex',
      providerType: TELEHEALTH_PROVIDERS.WEBEX,
      displayName: 'Cisco Webex',
      description: 'Enterprise video conferencing',
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-500',
      gradientFrom: 'from-green-500',
      gradientTo: 'to-green-600',
      gradientHoverFrom: 'hover:from-green-600',
      gradientHoverTo: 'hover:to-green-700',
    },
    {
      key: 'microsoft_teams',
      providerType: 'microsoft_teams',
      displayName: 'Microsoft Teams',
      description: 'Microsoft 365 video conferencing & collaboration',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
      gradientFrom: 'from-purple-500',
      gradientTo: 'to-purple-600',
      gradientHoverFrom: 'hover:from-purple-600',
      gradientHoverTo: 'hover:to-purple-700',
    },
  ];

  const renderTelehealthProviderCard = (cfg) => {
    const status = telehealthStatus[cfg.key] || {};
    const isTesting = testingProvider[cfg.key];
    const testResult = providerTestResult[cfg.key];
    const envMissing = providerEnvMissing[cfg.key];
    const connectedEmail = status.zoom_user_email;

    return (
      <div key={cfg.key} className={`border rounded-lg overflow-hidden ${
        theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'
      }`}>
        {/* Header */}
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${cfg.iconBg}`}>
                <Video className={`w-6 h-6 ${cfg.iconColor}`} />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {cfg.displayName}
                </h3>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  {cfg.description}
                </p>
                {status.has_tokens ? (
                  <div className="flex items-center gap-2 mt-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className={`text-sm ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                      Connected{connectedEmail ? ` as ${connectedEmail}` : ''} — all providers can launch sessions
                    </span>
                  </div>
                ) : status.is_configured ? (
                  <div className="flex items-center gap-2 mt-2">
                    <RefreshCw className={`w-4 h-4 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} />
                    <span className={`text-sm ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      Enabled on platform — connect your {cfg.displayName} account
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => handleToggleTelehealthProvider(cfg.providerType, !status.is_enabled)}
              disabled={!status.has_tokens}
              role="switch"
              aria-checked={status.is_enabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                !status.has_tokens
                  ? theme === 'dark' ? 'bg-slate-700 cursor-not-allowed' : 'bg-gray-200 cursor-not-allowed'
                  : status.is_enabled ? 'bg-green-500 cursor-pointer' : theme === 'dark' ? 'bg-slate-600 cursor-pointer' : 'bg-gray-300 cursor-pointer'
              }`}
              title={!status.has_tokens ? `Connect ${cfg.displayName} account first` : ''}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                status.is_enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pt-4 pb-2 flex flex-wrap gap-3">
          {status.has_tokens ? (
            <>
              <button
                onClick={() => handleTestTelehealthConnection(cfg.key)}
                disabled={isTesting}
                className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-60 flex items-center gap-2 ${
                  theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isTesting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Testing...
                  </>
                ) : 'Test Connection'}
              </button>
              <button
                onClick={() => { setProviderTestResult(prev => ({ ...prev, [cfg.key]: null })); handleConfigureTelehealthProvider(cfg.providerType); }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Reconnect
              </button>
              <button
                onClick={() => { setProviderTestResult(prev => ({ ...prev, [cfg.key]: null })); handleDisconnectProvider(cfg.providerType); }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  theme === 'dark' ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'
                }`}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => handleConfigureTelehealthProvider(cfg.providerType)}
              className={`px-6 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r ${cfg.gradientFrom} ${cfg.gradientTo} ${cfg.gradientHoverFrom} ${cfg.gradientHoverTo} transition-all shadow-sm`}
            >
              <Video className="w-4 h-4 inline mr-2" />
              Connect {cfg.displayName} Account
            </button>
          )}
        </div>

        {/* Inline test result banner */}
        {testResult && (
          <div className={`mx-4 mb-3 px-4 py-2.5 rounded-lg flex items-start gap-2 text-sm ${
            testResult.success
              ? theme === 'dark' ? 'bg-green-500/10 border border-green-500/30 text-green-300' : 'bg-green-50 border border-green-200 text-green-800'
              : theme === 'dark' ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <span className="flex-shrink-0 mt-0.5">{testResult.success ? '✓' : '✗'}</span>
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Not yet enabled on this platform (env vars not set) */}
        {envMissing && !status.has_tokens && (
          <div className={`mx-4 mb-2 p-3 rounded-lg flex items-start gap-2 ${
            theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-300'
          }`}>
            <Settings className={`w-4 h-4 mt-0.5 flex-shrink-0 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
            <p className={`text-xs ${theme === 'dark' ? 'text-amber-300' : 'text-amber-800'}`}>
              {cfg.displayName} integration is not yet enabled on this platform.
              Contact your platform administrator or refer to the developer setup guide below.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderTelehealthTab = () => (
    <div className="space-y-6">
      {telehealthDbMissing && (
        <div
          className={`p-4 rounded-lg border ${
            theme === 'dark'
              ? 'bg-yellow-500/10 border-yellow-500/20'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <p className={`font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
            Database Migration Required
          </p>
          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-yellow-400/80' : 'text-yellow-600'}`}>
            Please run: node backend/scripts/migrate-telehealth.js
          </p>
        </div>
      )}

      <div>
        <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Telehealth Integrations
        </h2>
        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          Connect your clinic's video conferencing account. All providers in your practice will use this connection — zero configuration required.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {TELEHEALTH_CARD_CONFIG.map(renderTelehealthProviderCard)}
      </div>

      {/* Developer-only setup guide — collapsed by default */}
      <PlatformSetupGuide theme={theme} />

      <div className="mt-8">
        <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Vendor Integrations
        </h2>

        {vendorDbMissing && (
          <div
            className={`mb-4 p-4 rounded-lg border ${
              theme === 'dark'
                ? 'bg-yellow-500/10 border-yellow-500/20'
                : 'bg-yellow-50 border-yellow-200'
            }`}
          >
            <p className={`font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
              Database Migration Required
            </p>
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-yellow-400/80' : 'text-yellow-600'}`}>
              Please run: 033_add_vendor_integrations.sql
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {/* Surescripts Integration */}
          <IntegrationCard
            name={VENDOR_TYPES.SURESCRIPTS}
            displayName="Surescripts ePrescribe"
            description="Electronic prescribing network"
            isEnabled={vendorStatus.surescripts.is_enabled}
            isConfigured={vendorStatus.surescripts.is_configured}
            theme={theme}
            onToggle={handleToggleVendorIntegration}
            onConfigure={handleConfigureVendorIntegration}
            t={t}
          />

          {/* Labcorp Integration */}
          <IntegrationCard
            name={VENDOR_TYPES.LABCORP}
            displayName="Labcorp"
            description="Laboratory test ordering and results"
            isEnabled={vendorStatus.labcorp.is_enabled}
            isConfigured={vendorStatus.labcorp.is_configured}
            theme={theme}
            onToggle={handleToggleVendorIntegration}
            onConfigure={handleConfigureVendorIntegration}
            t={t}
          />

          {/* Optum Integration */}
          <IntegrationCard
            name={VENDOR_TYPES.OPTUM}
            displayName="Optum"
            description="Claims processing and eligibility verification"
            isEnabled={vendorStatus.optum.is_enabled}
            isConfigured={vendorStatus.optum.is_configured}
            theme={theme}
            onToggle={handleToggleVendorIntegration}
            onConfigure={handleConfigureVendorIntegration}
            t={t}
          />
        </div>
      </div>
    </div>
  );

  /**
   * Render Roles & Permissions Tab
   * TODO: Extract to separate component RolesPermissionsTab.js
   */
  const renderRolesPermissionsTab = () => {
    // Check if user has permission to manage roles (admin only)
    const canManageRoles = hasPermission(user, 'admin', 'roles');

    return (
      <div className="space-y-6">
        {/* Permission Warning */}
        {!canManageRoles && (
          <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              <span className="font-medium">Read-only mode: Only administrators can modify role permissions</span>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Role Permissions
            </h2>
            {/* Legend */}
            <div className={`flex gap-4 mt-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              <span className="flex items-center gap-1">
                <span className="text-green-500 font-semibold">V</span> = View
              </span>
              <span className="flex items-center gap-1">
                <span className="text-blue-500 font-semibold">C</span> = Create
              </span>
              <span className="flex items-center gap-1">
                <span className="text-yellow-500 font-semibold">E</span> = Edit
              </span>
              <span className="flex items-center gap-1">
                <span className="text-red-500 font-semibold">D</span> = Delete
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowCustomRoleForm(true)}
            disabled={!canManageRoles}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              canManageRoles
                ? 'bg-purple-500 hover:bg-purple-600 text-white'
                : 'bg-gray-400 cursor-not-allowed text-gray-200'
            }`}
            title={!canManageRoles ? 'Only administrators can create custom roles' : 'Create Custom Role'}
          >
            <Plus className="w-5 h-5" />
            Create Custom Role
          </button>
        </div>

      {/* Inline Custom Role Form */}
      {showCustomRoleForm && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-300'}`}>
          <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {customRoleName && !['admin', 'doctor', 'staff', 'patient'].includes(customRoleName)
              ? 'Edit Custom Role'
              : customRoleName
                ? `Edit ${customRoleName.charAt(0).toUpperCase() + customRoleName.slice(1)} Permissions`
                : 'Create Custom Role'}
          </h3>

          <div className="space-y-6">
            {/* Role Name - only editable for new roles */}
            {!customRoleName || !['admin', 'doctor', 'staff', 'patient'].includes(customRoleName) ? (
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customRoleName}
                  onChange={(e) => setCustomRoleName(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="e.g., Nurse, Receptionist, Billing Manager"
                />
              </div>
            ) : (
              <div className={`p-4 rounded-lg ${
                theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'
              }`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                  Editing permissions for <strong>{customRoleName}</strong> role
                </p>
              </div>
            )}

            {/* Permissions Grid */}
            <div>
              <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Permissions
              </h4>
              <div className="space-y-4">
                {['patients', 'appointments', 'claims', 'ehr', 'users', 'reports', 'settings', 'backup'].map((module) => {
                  return (
                    <div key={module} className={`p-4 border rounded-lg ${
                      theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-gray-300 bg-gray-50'
                    }`}>
                      <h5 className={`font-medium mb-3 capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {module}
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['view', 'create', 'edit', 'delete'].map((action) => {
                          return (
                            <label key={action} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={customRolePermissions[module]?.[action] || false}
                                onChange={() => handleToggleCustomRolePermission(module, action)}
                                className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className={`text-sm capitalize ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                                {action}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCustomRoleForm(false);
                  setCustomRoleName('');
                  setCustomRolePermissions({
                    patients: { view: false, create: false, edit: false, delete: false },
                    appointments: { view: false, create: false, edit: false, delete: false },
                    claims: { view: false, create: false, edit: false, delete: false },
                    ehr: { view: false, create: false, edit: false, delete: false },
                    users: { view: false, create: false, edit: false, delete: false },
                    reports: { view: false, create: false, edit: false, delete: false },
                    settings: { view: false, create: false, edit: false, delete: false },
                    backup: { view: false, create: false, edit: false, delete: false },
                  });
                }}
                className={`flex-1 px-4 py-2 border rounded-lg font-medium transition-colors ${
                  theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCustomRole}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                {customRoleName && rolePermissions.hasOwnProperty(customRoleName.toLowerCase().replace(/\s+/g, '_')) ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Legend */}
      <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50 border border-slate-700' : 'bg-gray-50 border border-gray-300'}`}>
        <h4 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Permission Legend
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-green-500 font-semibold text-lg">V</span>
            <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>View</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-500 font-semibold text-lg">C</span>
            <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Create</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-500 font-semibold text-lg">E</span>
            <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Edit</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-semibold text-lg">D</span>
            <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Delete</span>
          </div>
        </div>
      </div>

      {/* Roles & Permissions Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className={`${theme === 'dark' ? 'bg-slate-800 border-b-2 border-slate-700' : 'bg-gray-100 border-b-2 border-gray-300'}`}>
              <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Role
              </th>
              <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Patients
              </th>
              <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Appointments
              </th>
              <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Claims
              </th>
              <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                EHR
              </th>
              <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Users
              </th>
              <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Reports
              </th>
              <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Settings
              </th>
              <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Backup
              </th>
              <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rolePermissionEntries.map(([role, permissions], index) => (
              <tr
                key={role}
                className={`border-b ${theme === 'dark' ? 'border-slate-800' : 'border-gray-200'} ${
                  index % 2 === 0
                    ? theme === 'dark' ? 'bg-slate-900/30' : 'bg-white'
                    : theme === 'dark' ? 'bg-slate-900/50' : 'bg-gray-50'
                } hover:${theme === 'dark' ? 'bg-slate-800' : 'bg-blue-50'} transition-colors`}
              >
                <td className={`px-4 py-4 font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  <div className="flex items-center gap-2">
                    <span>{role.replace(/_/g, ' ')}</span>
                    {role === 'admin' && (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                      }`}>
                        Protected
                      </span>
                    )}
                  </div>
                </td>
                {['patients', 'appointments', 'claims', 'ehr', 'users', 'reports', 'settings', 'backup'].map((module) => (
                  <td key={module} className="px-4 py-4">
                    <div className="flex justify-center gap-1.5">
                      {permissions[module]?.view && (
                        <span className="text-green-500 font-bold text-base" title="View">V</span>
                      )}
                      {permissions[module]?.create && (
                        <span className="text-blue-500 font-bold text-base" title="Create">C</span>
                      )}
                      {permissions[module]?.edit && (
                        <span className="text-yellow-500 font-bold text-base" title="Edit">E</span>
                      )}
                      {permissions[module]?.delete && (
                        <span className="text-red-500 font-bold text-base" title="Delete">D</span>
                      )}
                      {!permissions[module]?.view && !permissions[module]?.create && !permissions[module]?.edit && !permissions[module]?.delete && (
                        <span className={`text-xs ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`}>-</span>
                      )}
                    </div>
                  </td>
                ))}
                <td className="px-4 py-4">
                  <div className="flex justify-center gap-2">
                    {/* Allow editing for doctor and staff roles */}
                    {(['doctor', 'staff'].includes(role)) && (
                      <button
                        onClick={() => {
                          setCustomRoleName(role);
                          setCustomRolePermissions(permissions);
                          setShowCustomRoleForm(true);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          theme === 'dark'
                            ? 'hover:bg-slate-700 bg-slate-800'
                            : 'hover:bg-blue-50 bg-white border border-gray-300'
                        }`}
                        title="Edit permissions"
                      >
                        <Edit className="w-4 h-4 text-blue-500" />
                      </button>
                    )}
                    {/* Allow editing and deleting custom roles only */}
                    {!['admin', 'doctor', 'staff', 'patient'].includes(role) && (
                      <>
                        <button
                          onClick={() => {
                            setCustomRoleName(role);
                            setCustomRolePermissions(permissions);
                            setShowCustomRoleForm(true);
                          }}
                          className={`p-2 rounded-lg transition-colors ${
                            theme === 'dark'
                              ? 'hover:bg-slate-700 bg-slate-800'
                              : 'hover:bg-blue-50 bg-white border border-gray-300'
                          }`}
                          title="Edit permissions"
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomRole(role)}
                          className={`p-2 rounded-lg transition-colors ${
                            theme === 'dark'
                              ? 'hover:bg-red-900/30 bg-slate-800'
                              : 'hover:bg-red-50 bg-white border border-gray-300'
                          }`}
                          title="Delete role"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </>
                    )}
                    {role === 'admin' && (
                      <span className={`px-3 py-2 text-xs ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`}>
                        N/A
                      </span>
                    )}
                    {role === 'patient' && (
                      <span className={`px-3 py-2 text-xs ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`}>
                        N/A
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

  /**
   * Render Subscription Plans Tab
   * TODO: Extract to separate component SubscriptionPlansTab.js
   */
  const renderSubscriptionPlansTab = () => (
    <div className="space-y-6">
      <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Subscription Plans
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`border rounded-lg p-6 ${
              currentPlan === plan.id
                ? theme === 'dark'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-blue-500 bg-blue-50'
                : theme === 'dark'
                ? 'border-slate-700 bg-slate-800'
                : 'border-gray-300 bg-white'
            } ${plan.popular ? 'relative' : ''}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  Popular
                </span>
              </div>
            )}

            <div className="text-center">
              <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>
              <div className="mb-4">
                <span className={`text-4xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  ${plan.price}
                </span>
                <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  /{plan.billing}
                </span>
              </div>

              <div className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                <p>Up to {plan.maxUsers === -1 ? 'Unlimited' : plan.maxUsers} users</p>
                <p>Up to {plan.maxPatients === -1 ? 'Unlimited' : plan.maxPatients} patients</p>
              </div>

              <ul className="space-y-2 mb-6">
                {Object.entries(plan.features).map(([feature, enabled]) => (
                  <li
                    key={feature}
                    className={`flex items-center justify-center gap-2 text-sm ${
                      enabled
                        ? theme === 'dark'
                          ? 'text-green-400'
                          : 'text-green-600'
                        : theme === 'dark'
                        ? 'text-slate-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {enabled ? <Check className="w-4 h-4" /> : <span className="w-4 h-4">-</span>}
                    <span className="capitalize">{feature.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  setCurrentPlan(plan.id);
                  setPlanTier(plan.id);
                  updateUserPreferences({ planTier: plan.id });
                  addNotification('success', `Switched to ${plan.name}`);
                }}
                disabled={currentPlan === plan.id}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPlan === plan.id
                    ? theme === 'dark'
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {currentPlan === plan.id ? 'Current Plan' : 'Select Plan'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Render Working Hours Tab
   * TODO: Extract to separate component WorkingHoursTab.js
   */
  const renderWorkingHoursTab = () => (
    <div className="space-y-6">
      <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Working Hours
      </h2>

      <div className="space-y-4">
        {Object.entries(workingHours).map(([day, hours]) => (
          <div
            key={day}
            className={`p-4 border rounded-lg ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-32">
                  <span className={`font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {day}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={hours.open}
                    onChange={(e) => handleWorkingHoursChange(day, 'open', e.target.value)}
                    disabled={!hours.enabled}
                    className={`px-3 py-2 border rounded-lg ${
                      theme === 'dark'
                        ? 'bg-slate-700 border-slate-600 text-white disabled:bg-slate-800 disabled:text-slate-600'
                        : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-100 disabled:text-gray-400'
                    }`}
                  />
                  <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>to</span>
                  <input
                    type="time"
                    value={hours.close}
                    onChange={(e) => handleWorkingHoursChange(day, 'close', e.target.value)}
                    disabled={!hours.enabled}
                    className={`px-3 py-2 border rounded-lg ${
                      theme === 'dark'
                        ? 'bg-slate-700 border-slate-600 text-white disabled:bg-slate-800 disabled:text-slate-600'
                        : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-100 disabled:text-gray-400'
                    }`}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleWorkingHoursChange(day, 'enabled', !hours.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  hours.enabled ? 'bg-green-500' : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    hours.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveWorkingHoursClick}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          <Save className="w-5 h-5" />
          Save Working Hours
        </button>
      </div>
    </div>
  );

  /**
   * Render Appointment Settings Tab
   * TODO: Extract to separate component AppointmentSettingsTab.js
   */
  const renderAppointmentSettingsTab = () => (
    <div className="space-y-6">
      <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Appointment Settings
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Default Appointment Duration (minutes)
          </label>
          <input
            type="number"
            min="5"
            max="480"
            value={appointmentSettings.defaultDuration}
            onChange={(e) => handleAppointmentSettingChange('defaultDuration', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            Range: 5-480 minutes (5 min to 8 hours)
          </p>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Slot Interval (minutes)
          </label>
          <input
            type="number"
            min="5"
            max="120"
            value={appointmentSettings.slotInterval}
            onChange={(e) => handleAppointmentSettingChange('slotInterval', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            Range: 5-120 minutes (5 min to 2 hours)
          </p>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Max Advance Booking (days)
          </label>
          <input
            type="number"
            min="1"
            max="365"
            value={appointmentSettings.maxAdvanceBooking}
            onChange={(e) => handleAppointmentSettingChange('maxAdvanceBooking', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            Range: 1-365 days (1 day to 1 year)
          </p>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Cancellation Deadline (hours)
          </label>
          <input
            type="number"
            min="0"
            max="168"
            value={appointmentSettings.cancellationDeadline}
            onChange={(e) => handleAppointmentSettingChange('cancellationDeadline', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            Range: 0-168 hours (0 to 7 days)
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveAppointmentSettingsClick}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          <Save className="w-5 h-5" />
          Save Settings
        </button>
      </div>
    </div>
  );

  /**
   * Render Backup & Restore Tab
   * TODO: Extract to separate component BackupRestoreTab.js
   */
  const renderBackupRestoreTab = () => (
    <div className="space-y-6">
      <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Backup & Restore
      </h2>

      {/* Backup Options */}
      <div>
        <h3 className={`text-lg font-medium mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Create Backup
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Local Backup */}
          <div className={`p-6 border rounded-lg ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center gap-3 mb-4">
              <HardDrive className={`w-6 h-6 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
              <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Local Backup
              </h4>
            </div>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Download a backup file to your computer
            </p>
            {lastBackup.local && (
              <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                Last backup: {new Date(lastBackup.local).toLocaleString()}
              </p>
            )}
            <button
              onClick={handleLocalBackup}
              disabled={backupLoading.local}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {backupLoading.local ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download Backup
                </>
              )}
            </button>
          </div>

          {/* Google Drive Backup */}
          <div className={`p-6 border rounded-lg ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Cloud className={`w-6 h-6 ${theme === 'dark' ? 'text-green-400' : 'text-green-500'}`} />
                <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Google Drive
                </h4>
              </div>
              <button
                onClick={() => handleConfigureCloudBackup('google_drive')}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                title="Configure Google Drive"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
            <div className={`flex items-center gap-2 mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              <div className={`w-2 h-2 rounded-full ${backupConfig.googleDrive.configured ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-xs">
                {backupConfig.googleDrive.configured ? 'Configured' : 'Not configured'}
              </span>
            </div>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Backup to Google Drive
            </p>
            {lastBackup.googleDrive && (
              <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                Last backup: {new Date(lastBackup.googleDrive).toLocaleString()}
              </p>
            )}
            <button
              onClick={handleGoogleDriveBackup}
              disabled={backupLoading.googleDrive || !backupConfig.googleDrive.configured}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {backupLoading.googleDrive ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  {backupConfig.googleDrive.configured ? 'Upload to Drive' : 'Not Configured'}
                </>
              )}
            </button>
          </div>

          {/* OneDrive Backup */}
          <div className={`p-6 border rounded-lg ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Cloud className={`w-6 h-6 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-500'}`} />
                <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  OneDrive
                </h4>
              </div>
              <button
                onClick={() => handleConfigureCloudBackup('onedrive')}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                title="Configure OneDrive"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
            <div className={`flex items-center gap-2 mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              <div className={`w-2 h-2 rounded-full ${backupConfig.oneDrive.configured ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-xs">
                {backupConfig.oneDrive.configured ? 'Configured' : 'Not configured'}
              </span>
            </div>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Backup to Microsoft OneDrive
            </p>
            {lastBackup.oneDrive && (
              <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                Last backup: {new Date(lastBackup.oneDrive).toLocaleString()}
              </p>
            )}
            <button
              onClick={handleOneDriveBackup}
              disabled={backupLoading.oneDrive || !backupConfig.oneDrive.configured}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {backupLoading.oneDrive ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  {backupConfig.oneDrive.configured ? 'Upload to OneDrive' : 'Not Configured'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Restore Section */}
      <div>
        <h3 className={`text-lg font-medium mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Restore from Backup
        </h3>
        <div className={`p-6 border rounded-lg ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`}>
          <div className={`mb-4 p-4 rounded-lg border ${theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'}`}>
            <p className={`font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
              Warning
            </p>
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-yellow-400/80' : 'text-yellow-600'}`}>
              Restoring from backup will replace all current data. This action cannot be undone.
            </p>
          </div>

          <input
            type="file"
            accept=".json"
            onChange={handleRestoreBackup}
            disabled={restoreLoading}
            className={`block w-full text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
            } file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold ${
              theme === 'dark'
                ? 'file:bg-slate-700 file:text-slate-300 hover:file:bg-slate-600'
                : 'file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200'
            } cursor-pointer`}
          />

          {restoreLoading && (
            <div className="mt-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>
                Restoring data...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ==================== MAIN RENDER ====================

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentModule && setCurrentModule('dashboard')}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'
              }`}
              title={t.backToDashboard || 'Back to Dashboard'}
              aria-label="Back to Dashboard"
            >
              <ArrowLeft
                className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}
              />
            </button>
            <div>
              <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t.adminPanel || 'Admin Panel'}
              </h1>
              <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.manageClinicSettingsUsers || 'Manage clinic settings and users'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-4 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-500'
                      : `border-transparent ${
                          theme === 'dark'
                            ? 'text-slate-400 hover:text-slate-300'
                            : 'text-gray-600 hover:text-gray-900'
                        }`
                  }`}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === ADMIN_TABS.CLINIC && renderClinicSettingsTab()}
          {activeTab === ADMIN_TABS.USERS && renderUserManagementTab()}
          {activeTab === ADMIN_TABS.ROLES && renderRolesPermissionsTab()}
          {activeTab === ADMIN_TABS.PLANS && renderSubscriptionPlansTab()}
          {activeTab === ADMIN_TABS.TELEHEALTH && renderTelehealthTab()}
          {activeTab === ADMIN_TABS.HOURS && renderWorkingHoursTab()}
          {activeTab === ADMIN_TABS.APPOINTMENTS && renderAppointmentSettingsTab()}
          {activeTab === ADMIN_TABS.BACKUP && renderBackupRestoreTab()}
          {activeTab === ADMIN_TABS.ARCHIVE && <ArchiveManagementTab theme={theme} api={api} addNotification={addNotification} />}
          {activeTab === ADMIN_TABS.AUDIT && <AuditLogsTab theme={theme} api={api} addNotification={addNotification} />}
        </div>
      </div>

      {/* Global Styles for Scrollbar */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Custom scrollbar for tabs */
        .flex.space-x-8.overflow-x-auto::-webkit-scrollbar {
          height: 6px;
        }

        .flex.space-x-8.overflow-x-auto::-webkit-scrollbar-track {
          background: ${theme === 'dark' ? '#1e293b' : '#f1f5f9'};
          border-radius: 3px;
        }

        .flex.space-x-8.overflow-x-auto::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? '#475569' : '#cbd5e1'};
          border-radius: 3px;
        }

        .flex.space-x-8.overflow-x-auto::-webkit-scrollbar-thumb:hover {
          background: ${theme === 'dark' ? '#64748b' : '#94a3b8'};
        }

        /* For Firefox */
        .flex.space-x-8.overflow-x-auto {
          scrollbar-width: thin;
          scrollbar-color: ${theme === 'dark' ? '#475569 #1e293b' : '#cbd5e1 #f1f5f9'};
        }
      ` }} />

      {/* Confirmation Modals */}
      <ConfirmationModal
        theme={theme}
        isOpen={showSaveConfirmation}
        onClose={() => {
          setShowSaveConfirmation(false);
          setPendingSaveAction(null);
        }}
        onConfirm={handleConfirmSave}
        title="Confirm Save"
        message="Are you sure you want to save these settings?"
        type="confirm"
        confirmText="Save"
        cancelText="Cancel"
      />

      <ConfirmationModal
        theme={theme}
        isOpen={backupSuccessModal.isOpen}
        onClose={() => setBackupSuccessModal({ isOpen: false, type: '', message: '' })}
        onConfirm={() => setBackupSuccessModal({ isOpen: false, type: '', message: '' })}
        title={`${backupSuccessModal.type} Backup Successful`}
        message={backupSuccessModal.message}
        type="success"
        confirmText="OK"
        showCancel={false}
      />

      {/* Credential Modal */}
      <CredentialModal
        isOpen={showCredentialModal}
        onClose={() => {
          setShowCredentialModal(false);
          setCredentialModalConfig({
            providerName: '',
            providerType: '',
            credentialType: 'oauth',
            onSuccess: null,
            onConnect: null,
            existingCredentials: null,
          });
        }}
        onSubmit={handleCredentialSubmit}
        onConnect={credentialModalConfig.onConnect}
        providerName={credentialModalConfig.providerName}
        credentialType={credentialModalConfig.credentialType}
        existingCredentials={credentialModalConfig.existingCredentials}
        onOneClickIntegration={handleOneClickIntegration}
        theme={theme}
      />

      {/* User Action Confirmation Modal */}
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={async () => {
          if (confirmModalConfig.onConfirm) {
            await confirmModalConfig.onConfirm();
          }
          setShowConfirmModal(false);
        }}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        type="warning"
        confirmText="Confirm"
        showCancel={true}
      />

      {/* Restore Success Modal */}
      <ConfirmationModal
        theme={theme}
        isOpen={restoreSuccessModal.isOpen}
        onClose={() => setRestoreSuccessModal({ isOpen: false, details: null })}
        onConfirm={() => setRestoreSuccessModal({ isOpen: false, details: null })}
        title="Restore Completed Successfully"
        message={
          restoreSuccessModal.details
            ? `Successfully restored ${restoreSuccessModal.details.totalTables} tables.`
            : 'Data has been successfully restored from backup.'
        }
        type={restoreSuccessModal.details?.errors?.length > 0 ? 'warning' : 'success'}
        confirmText="OK"
        showCancel={false}
      />
    </>
  );
};

// ==================== PROP TYPES ====================

AdminPanelView.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
  users: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string,
      email: PropTypes.string.isRequired,
      role: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
    })
  ).isRequired,
  setUsers: PropTypes.func.isRequired,
  setShowForm: PropTypes.func.isRequired,
  setEditingItem: PropTypes.func.isRequired,
  setCurrentView: PropTypes.func,
  api: PropTypes.shape({
    getBackupConfig: PropTypes.func,
    getTelehealthSettings: PropTypes.func,
    getVendorIntegrationSettings: PropTypes.func,
    getPermissions: PropTypes.func,
    updatePermissions: PropTypes.func,
    deleteUser: PropTypes.func,
    updateUser: PropTypes.func,
    toggleTelehealthProvider: PropTypes.func,
    toggleVendorIntegration: PropTypes.func,
    getProviderConfigUrl: PropTypes.func,
    deleteRole: PropTypes.func,
    createRole: PropTypes.func,
    generateBackup: PropTypes.func,
    backupToGoogleDrive: PropTypes.func,
    backupToOneDrive: PropTypes.func,
    restoreBackup: PropTypes.func,
  }).isRequired,
  addNotification: PropTypes.func.isRequired,
  setCurrentModule: PropTypes.func,
  t: PropTypes.object,
};

export default React.memo(AdminPanelView);
