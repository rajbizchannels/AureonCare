import React from 'react';
import { Bot, X, AlertCircle } from 'lucide-react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';

// Context
import { AppProvider, useApp } from './context/AppContext';

// OAuth Config
import { googleOAuthConfig, microsoftOAuthConfig } from './config/oauthConfig';

// API
import api from './api/apiService';

// Config
import { getTranslations } from './config/translations';
import { getModules } from './config/modules';
import { hasAccess } from './config/planFeatures';
import {
  getNavigation,
  getPatientNavigation,
  filterNavigation,
  findNavLocation,
  defaultItemFor,
} from './config/navigation';

// App shell (3-pane layout)
import AppShell from './components/layout/AppShell';

// Views
import DashboardView from './views/DashboardView';
import PracticeManagementView from './views/PracticeManagementView';
import ProviderManagementView from './views/ProviderManagementView';
import EHRView from './views/EHRView';
import TelehealthView from './views/TelehealthView';
import RCMView from './views/RCMView';
import ReportsView from './views/ReportsView';
import CRMView from './views/CRMView';
import IntegrationsView from './views/IntegrationsView';
import FHIRView from './views/FHIRView';
import AdminPanelView from './views/AdminPanelView';
import OfferingManagementView from './views/OfferingManagementView';
import PatientDiagnosisView from './views/PatientDiagnosisView';
import PatientHistoryDirectoryView from './views/PatientHistoryDirectoryView';
import CampaignsManagementView from './views/CampaignsManagementView';
import AppointmentTypesManagementView from './views/AppointmentTypesManagementView';
import PatientIntakeView from './views/PatientIntakeView';
import PharmacyManagementView from './views/PharmacyManagementView';
import LaboratoryManagementView from './views/LaboratoryManagementView';
import ClinicalServicesView from './views/ClinicalServicesView';
import WaitlistManagementView from './views/WaitlistManagementView';
import FormManagementView from './views/FormManagementView';
import MessagesView from './views/MessagesView';
import AccountsView from './views/AccountsView';
import InventoryView from './views/InventoryView';

// Public pages
import PublicBookingPage from './components/scheduling/PublicBookingPage';

// Modals
import LoginPage from './components/modals/LoginPage';
import PatientLoginPage from './components/modals/PatientLoginPage';
import RegisterPage from './components/modals/RegisterPage';
import ForgotPasswordModal from './components/modals/ForgotPasswordModal';
import ViewEditModal from './components/modals/ViewEditModal';
import UserProfileModal from './components/modals/UserProfileModal';
import SettingsModal from './components/modals/SettingsModal';

// Forms
import NewAppointmentForm from './components/forms/NewAppointmentForm';
import NewPatientForm from './components/forms/NewPatientForm';
import NewClaimForm from './components/forms/NewClaimForm';
import NewPaymentForm from './components/forms/NewPaymentForm';
import NewTaskForm from './components/forms/NewTaskForm';
import NewUserForm from './components/forms/NewUserForm';
import NewInsurancePayerForm from './components/forms/NewInsurancePayerForm';
import NewAppointmentTypeForm from './components/forms/NewAppointmentTypeForm';
import NewHealthcareOfferingForm from './components/forms/NewHealthcareOfferingForm';
import NewCampaignForm from './components/forms/NewCampaignForm';
import DiagnosisForm from './components/forms/DiagnosisForm';
import NewPharmacyForm from './components/forms/NewPharmacyForm';
import NewLaboratoryForm from './components/forms/NewLaboratoryForm';

// Panels
import NotificationsPanel from './components/panels/NotificationsPanel';
import SearchPanel from './components/panels/SearchPanel';
import AIAssistantPanel from './components/panels/AIAssistantPanel';

// Help System Components
import HelpDrawer from './components/help/HelpDrawer';
import OnboardingTour from './components/help/OnboardingTour';
import EnhancedAIAssistant from './components/help/EnhancedAIAssistant';

// Quick Views
import AppointmentsQuickView from './components/quickViews/AppointmentsQuickView';
import TasksQuickView from './components/quickViews/TasksQuickView';
import RevenueQuickView from './components/quickViews/RevenueQuickView';
import PatientsQuickView from './components/quickViews/PatientsQuickView';

// Initialize MSAL instance for Microsoft OAuth
const msalInstance = new PublicClientApplication(microsoftOAuthConfig);

// Lazy-load PatientPortalView so it lands in a separate Webpack chunk,
// preventing scope-hoisting TDZ when the main bundle is concatenated.
const PatientPortalView = React.lazy(() => import('./views/PatientPortalView'));

function App() {
  const {
    // Auth & Navigation
    isAuthenticated,
    setIsAuthenticated,
    showForgotPassword,
    setShowForgotPassword,
    showRegister,
    setShowRegister,
    currentModule,
    setCurrentModule,
    currentView,
    setCurrentView,

    // UI State
    theme,
    setTheme,
    language,
    setLanguage,
    planTier,
    selectedItem,
    setSelectedItem,
    showNotifications,
    setShowNotifications,
    showSearch,
    setShowSearch,
    showAIAssistant,
    setShowAIAssistant,
    showForm,
    setShowForm,
    editingItem,
    setEditingItem,
    showChangePassword,
    setShowChangePassword,
    appointmentViewType,
    setAppointmentViewType,
    calendarViewType,
    setCalendarViewType,
    currency,
    setCurrency,

    // Data
    appointments,
    setAppointments,
    patients,
    setPatients,
    providers,
    setProviders,
    claims,
    setClaims,
    payments,
    setPayments,
    notifications,
    setNotifications,
    tasks,
    setTasks,
    users,
    setUsers,
    user,
    setUser,

    // Loading & Error
    loading,
    error,
    setError,

    // Helper Functions
    updateUserPreferences,
    addNotification,
    completeTask,
    clearNotification,
    clearAllNotifications
  } = useApp();

  // Get translations and modules
  const t = getTranslations(language);
  const allModules = getModules(t);
  // Check both plan-based and role-based access
  const hasModuleAccess = (moduleId) => hasAccess(planTier, moduleId, user);
  // Filter modules based on user's role and plan permissions
  const modules = allModules.filter(module => hasModuleAccess(module.id));

  // Local state for patient history
  const [selectedPatient, setSelectedPatient] = React.useState(null);
  const [patientHistoryInitialTab, setPatientHistoryInitialTab] = React.useState('overview');

  // Local state for campaigns and appointment types
  const [editingCampaign, setEditingCampaign] = React.useState(null);
  const [editingAppointmentType, setEditingAppointmentType] = React.useState(null);

  // CRM refresh trigger - increment this to force CRM counts to refresh
  const [crmRefreshKey, setCrmRefreshKey] = React.useState(0);

  // Help system state
  const [showHelpDrawer, setShowHelpDrawer] = React.useState(false);
  const [currentContext, setCurrentContext] = React.useState('dashboard');
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  // Don't auto-show onboarding - let users trigger it manually from help menu
  // React.useEffect(() => {
  //   if (isAuthenticated && user?.role) {
  //     const hasSeenOnboarding = localStorage.getItem(`onboarding_${user.role}_complete`);
  //     if (!hasSeenOnboarding) {
  //       setShowOnboarding(true);
  //     }
  //   }
  // }, [isAuthenticated, user]);

  // Check URL parameters for help redirect after login
  React.useEffect(() => {
    if (isAuthenticated) {
      const urlParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;

      // Check if help parameter is present in URL or hash
      if (urlParams.get('help') === 'true' || hash.includes('#help')) {
        setShowHelpDrawer(true);

        // Clean up URL parameters
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [isAuthenticated]);

  // Update current context when module or form changes
  React.useEffect(() => {
    if (showForm) {
      setCurrentContext(`${showForm}-form`);
    } else if (currentModule) {
      setCurrentContext(currentModule);
    }
  }, [currentModule, showForm]);

  // ── Unread messages badge ─────────────────────────────────────────────────
  // Polled, since no websocket server is wired up. Sixty seconds is slower
  // than the messaging view's own refresh: the badge only has to be roughly
  // right, and whoever is actually reading a thread already sees it live.
  const [unreadMessages, setUnreadMessages] = React.useState(0);

  React.useEffect(() => {
    if (!isAuthenticated) {
      setUnreadMessages(0);
      return undefined;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const count = await api.getUnreadMessageCount();
        if (!cancelled) setUnreadMessages(count);
      } catch {
        // A stale badge is not worth a toast on every screen in the app.
      }
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // currentModule is a dependency so the badge re-checks on navigation:
    // leaving the messages view should clear it straight away rather than
    // leave a stale count sitting there for the rest of the minute.
  }, [isAuthenticated, currentModule]);

  // ── App-shell navigation ──────────────────────────────────────────────────
  // The shell tracks which sub-module (tab) of a module is on screen. It is
  // stored together with the module it belongs to so that navigating straight
  // to a module from elsewhere in the app (search results, deep links inside a
  // view) falls back to that module's default tab instead of a stale one.
  const [navSelection, setNavSelection] = React.useState({ module: 'dashboard', tab: null });

  // A patient's Home is the portal, not the practice dashboard, and their rail
  // carries nothing else.
  const isPatient = user?.role === 'patient';
  const navigation = filterNavigation(
    isPatient ? getPatientNavigation(t) : getNavigation(t),
    hasModuleAccess
  );
  const activeModule = isPatient && currentModule === 'dashboard' ? 'patientPortal' : currentModule;

  // Appointments keep their sub-module in appointmentViewType (list/calendar/waitlist).
  const moduleTab = navSelection.module === activeModule ? navSelection.tab : null;
  const activeTab = activeModule === 'practiceManagement' ? appointmentViewType : moduleTab;

  const navLocation = findNavLocation(navigation, activeModule, activeTab);
  const activeGroup = navLocation?.group || navigation[0];
  const activeItem = navLocation?.item;
  const activeTrail = navLocation?.trail || (activeItem ? [activeItem] : []);

  // Selects a sub-module tab from inside a view, keeping the shell in sync.
  const selectModuleTab = (moduleId, tab) => setNavSelection({ module: moduleId, tab });

  // A patient's portal owns its own tab state — the shell does not drive it,
  // because their nav group holds a single destination. So asking it to open a
  // particular tab from outside (the header's Messages icon) is a request it
  // watches, carrying a nonce so clicking twice re-opens rather than no-ops.
  const [portalTabRequest, setPortalTabRequest] = React.useState(null);

  const canMessage = isPatient || hasModuleAccess('messages');

  const goToMessages = () => {
    if (isPatient) {
      handleSelectNavItem({ module: 'patientPortal' });
      setPortalTabRequest({ tab: 'messages', nonce: Date.now() });
    } else {
      handleSelectNavItem({ module: 'messages' });
    }
  };

  const handleSelectNavItem = (item) => {
    // Grouping-only branches (a report category, say) have nowhere to go —
    // pane 2 expands them instead.
    if (!item.module && !item.action) return;

    // Snapshot entries open a quick-view drawer instead of switching modules.
    if (item.action) {
      setEditingItem(null);
      setShowForm(null);
      setSelectedItem(item.action);
      return;
    }

    setSelectedItem(null);
    setEditingItem(null);
    setShowForm(null);
    setNavSelection({ module: item.module, tab: item.tab || null });
    if (item.module === 'practiceManagement' && item.tab) {
      setAppointmentViewType(item.tab);
    }
    setCurrentModule(item.module);
  };

  // Anything inside a view that jumps to another module — the dashboard's
  // module tiles and stat cards, most of all — goes through the shell so the
  // rail switches group and pane 2 opens the branch that owns the module.
  const navigateToModule = (moduleId) => handleSelectNavItem({ module: moduleId });

  const handleSelectNavGroup = (group) => {
    if (group.id === activeGroup?.id) return;
    const item = defaultItemFor(group);
    if (item) handleSelectNavItem(item);
  };

  // Modal management: close other modals when opening a new one
  const handleSetEditingItem = (item) => {
    setEditingItem(item);
    if (item) {
      setShowForm(null);
      setSelectedItem(null);
    }
  };

  const handleSetShowForm = (form) => {
    setShowForm(form);
    if (form) {
      setEditingItem(null);
      setSelectedItem(null);
    }
  };

  const handleSetSelectedItem = (item) => {
    setSelectedItem(item);
    if (item) {
      setEditingItem(null);
      setShowForm(null);
    }
  };


  // Provider public booking link: /book/<slug>. Served before the auth gate so
  // the link works for anyone who receives it.
  const bookingSlug = React.useMemo(() => {
    const match = window.location.pathname.match(/^\/book\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, []);
  const [showBookingLogin, setShowBookingLogin] = React.useState(false);

  // Check if URL is patient login page
  const isPatientLoginUrl = React.useMemo(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    return path.includes('/patient-login') || hash.includes('#patient-login') || window.location.search.includes('type=patient');
  }, []);


  // Render the appropriate view based on currentModule
  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <DashboardView
            theme={theme}
            t={t}
            user={user}
            appointments={appointments}
            tasks={tasks}
            claims={claims}
            patients={patients}
            users={users}
            modules={modules}
            hasAccess={hasModuleAccess}
            setSelectedItem={handleSetSelectedItem}
            showForm={showForm}
            setShowForm={handleSetShowForm}
            setCurrentModule={navigateToModule}
            setAppointmentViewType={setAppointmentViewType}
            setCalendarViewType={setCalendarViewType}
            setAppointments={setAppointments}
            setPatients={setPatients}
            setTasks={setTasks}
            setClaims={setClaims}
            api={api}
            completeTask={completeTask}
            updateUserPreferences={updateUserPreferences}
            addNotification={addNotification}
            planTier={planTier}
            currency={currency}
          />
        );
      case 'practiceManagement':
        return (
          <PracticeManagementView
            theme={theme}
            appointments={appointments}
            patients={patients}
            users={users}
            appointmentViewType={appointmentViewType}
            calendarViewType={calendarViewType}
            setAppointmentViewType={setAppointmentViewType}
            setCalendarViewType={setCalendarViewType}
            showForm={showForm}
            setShowForm={handleSetShowForm}
            editingItem={editingItem}
            setEditingItem={handleSetEditingItem}
            currentView={currentView}
            setCurrentView={setCurrentView}
            setAppointments={setAppointments}
            api={api}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
            setClaims={setClaims}
            setUsers={setUsers}
            setPatients={setPatients}
            setUser={setUser}
            t={t}
            user={user}
          />
        );
      case 'providerManagement':
        return (
          <ProviderManagementView
            theme={theme}
            providers={providers}
            api={api}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
          />
        );
      case 'ehr':
        return (
          <EHRView
            theme={theme}
            patients={patients}
            users={users}
            showForm={showForm}
            setShowForm={handleSetShowForm}
            editingItem={editingItem}
            setEditingItem={handleSetEditingItem}
            currentView={currentView}
            setCurrentView={setCurrentView}
            setCurrentModule={setCurrentModule}
            setPatients={setPatients}
            setAppointments={setAppointments}
            setClaims={setClaims}
            setUsers={setUsers}
            setUser={setUser}
            api={api}
            addNotification={addNotification}
            user={user}
            t={t}
            onViewTelehealth={(patient) => {
              setCurrentModule('telehealth');
              addNotification('info', `Starting telehealth session with ${patient.first_name} ${patient.last_name}`);
            }}
          />
        );
      case 'diagnosis':
      case 'patientDiagnosis':
        return (
          <PatientDiagnosisView
            theme={theme}
            api={api}
            appointments={appointments}
            patients={patients}
            addNotification={addNotification}
            user={user}
            setCurrentModule={setCurrentModule}
          />
        );
      case 'patientHistory':
        // The roster is the module; a row expands into that patient's chart.
        // Arriving with a patient already picked (search, quick view) simply
        // opens that row.
        return (
          <PatientHistoryDirectoryView
            theme={theme}
            api={api}
            patients={patients}
            addNotification={addNotification}
            user={user}
            t={t}
            initialPatientId={selectedPatient?.id || null}
            initialTab={patientHistoryInitialTab}
          />
        );
      case 'telehealth':
        return (
          <TelehealthView
            theme={theme}
            api={api}
            appointments={appointments}
            patients={patients}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
          />
        );
      case 'rcm':
        return (
          <RCMView
            theme={theme}
            activeTab={activeTab || 'claims'}
            onTabChange={(tab) => selectModuleTab('rcm', tab)}
            claims={claims}
            patients={patients}
            setShowForm={handleSetShowForm}
            setEditingItem={handleSetEditingItem}
            setCurrentView={setCurrentView}
            setClaims={setClaims}
            addNotification={addNotification}
            api={api}
            setCurrentModule={setCurrentModule}
            tasks={tasks}
            setTasks={setTasks}
            currency={currency}
          />
        );
      case 'accounts':
        return (
          <AccountsView
            theme={theme}
            activeTab={activeTab || 'overview'}
            onTabChange={(tab) => selectModuleTab('accounts', tab)}
            api={api}
            user={user}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
            currency={currency}
          />
        );
      case 'inventory':
        return (
          <InventoryView
            theme={theme}
            activeTab={activeTab || 'overview'}
            onTabChange={(tab) => selectModuleTab('inventory', tab)}
            api={api}
            user={user}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
            currency={currency}
          />
        );
      case 'reports':
        return (
          <ReportsView
            theme={theme}
            activeTab={activeTab}
            onTabChange={(tab) => selectModuleTab('reports', tab)}
            patients={patients}
            appointments={appointments}
            claims={claims}
            payments={payments}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
            api={api}
            currency={currency}
          />
        );
      case 'crm':
        return <CRMView theme={theme} api={api} setShowForm={handleSetShowForm} setCurrentModule={setCurrentModule} currentModule={currentModule} crmRefreshKey={crmRefreshKey} t={t} />;
      case 'integrations':
        return <IntegrationsView theme={theme} setCurrentModule={setCurrentModule} />;
      case 'clinicalServices':
        return (
          <ClinicalServicesView
            theme={theme}
            api={api}
            patients={patients}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
            t={t}
          />
        );
      case 'pharmacies':
        return (
          <PharmacyManagementView
            theme={theme}
            api={api}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
            t={t}
          />
        );
      case 'laboratories':
        return (
          <LaboratoryManagementView
            theme={theme}
            api={api}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
            t={t}
          />
        );
      case 'fhir':
        return (
          <FHIRView
            theme={theme}
            activeTab={activeTab || 'resources'}
            onTabChange={(tab) => selectModuleTab('fhir', tab)}
            api={api}
            patients={patients}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
          />
        );
      case 'messages':
        return (
          <MessagesView
            theme={theme}
            api={api}
            addNotification={addNotification}
            user={user}
            t={t}
          />
        );
      case 'waitlist':
        return (
          <WaitlistManagementView
            theme={theme}
            api={api}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
            t={t}
          />
        );
      case 'patientPortal':
        return (
          <React.Suspense fallback={null}>
            <PatientPortalView
              theme={theme}
              activeTab={isPatient ? undefined : activeTab || 'profile'}
              onTabChange={isPatient ? undefined : (tab) => selectModuleTab('patientPortal', tab)}
              // Only meaningful for patients, whose portal owns its own tabs.
              requestedTab={isPatient ? portalTabRequest : null}
              api={api}
              addNotification={addNotification}
              user={user}
            />
          </React.Suspense>
        );
      case 'admin':
        return (
          <AdminPanelView
            theme={theme}
            activeTab={activeTab || 'clinic'}
            onTabChange={(tab) => selectModuleTab('admin', tab)}
            t={t}
            users={users}
            setUsers={setUsers}
            setShowForm={handleSetShowForm}
            setEditingItem={handleSetEditingItem}
            setCurrentView={setCurrentView}
            api={api}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
            onCurrencyChange={setCurrency}
          />
        );
      case 'offerings':
        return (
          <OfferingManagementView
            activeTab={activeTab || 'offerings'}
            onTabChange={(tab) => selectModuleTab('offerings', tab)}
            theme={theme}
            api={api}
            user={user}
            addNotification={addNotification}
            setCurrentModule={setCurrentModule}
          />
        );
      case 'campaigns':
        return (
          <CampaignsManagementView
            theme={theme}
            api={api}
            setShowForm={handleSetShowForm}
            setEditingCampaign={setEditingCampaign}
            setCurrentModule={setCurrentModule}
            addNotification={addNotification}
            t={t}
          />
        );
      case 'appointmentTypes':
        return (
          <AppointmentTypesManagementView
            theme={theme}
            api={api}
            setShowForm={handleSetShowForm}
            setEditingAppointmentType={setEditingAppointmentType}
            setCurrentModule={setCurrentModule}
            addNotification={addNotification}
            t={t}
          />
        );
      case 'intakeForms':
        return (
          <PatientIntakeView
            theme={theme}
            api={api}
            patients={patients}
            setCurrentModule={setCurrentModule}
            addNotification={addNotification}
            t={t}
          />
        );
      case 'formManagement':
        return (
          <FormManagementView
            theme={theme}
            activeTab={activeTab || 'templates'}
            onTabChange={(tab) => selectModuleTab('formManagement', tab)}
            api={api}
            patients={patients}
            user={user}
            setCurrentModule={setCurrentModule}
            addNotification={addNotification}
            t={t}
          />
        );
      default:
        return null;
    }
  };

  // ── Public booking page ────────────────────────────────────────────────────
  // Open to anyone with the link. A patient may sign in from here to have their
  // details filled in; signing in happens in-place, so the session survives.
  if (bookingSlug) {
    if (showBookingLogin && !isAuthenticated) {
      return (
        <PatientLoginPage
          theme={theme}
          setTheme={setTheme}
          api={api}
          setUser={setUser}
          setIsAuthenticated={setIsAuthenticated}
          addNotification={addNotification}
          setShowForgotPassword={setShowForgotPassword}
          setShowRegister={setShowRegister}
          setCurrentModule={setCurrentModule}
          onBack={() => setShowBookingLogin(false)}
        />
      );
    }

    return (
      <PublicBookingPage
        providerSlug={bookingSlug}
        theme={theme}
        patient={isAuthenticated && user?.role === 'patient' ? user : null}
        onSignIn={() => setShowBookingLogin(true)}
      />
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    // Show register page
    if (showRegister) {
      return (
        <RegisterPage
          theme={theme}
          api={api}
          addNotification={addNotification}
          onClose={() => setShowRegister(false)}
          onRegistered={() => {
            setShowRegister(false);
          }}
        />
      );
    }

    // Show appropriate login page based on URL
    return (
      <>
        {isPatientLoginUrl ? (
          <PatientLoginPage
            theme={theme}
            setTheme={setTheme}
            api={api}
            setUser={setUser}
            setIsAuthenticated={setIsAuthenticated}
            addNotification={addNotification}
            setShowForgotPassword={setShowForgotPassword}
            setShowRegister={setShowRegister}
            setCurrentModule={setCurrentModule}
          />
        ) : (
          <LoginPage
            theme={theme}
            setTheme={setTheme}
            api={api}
            setUser={setUser}
            setIsAuthenticated={setIsAuthenticated}
            addNotification={addNotification}
            setShowForgotPassword={setShowForgotPassword}
            setShowRegister={setShowRegister}
            setCurrentModule={setCurrentModule}
          />
        )}
        {showForgotPassword && (
          <ForgotPasswordModal
            theme={theme}
            api={api}
            onClose={() => setShowForgotPassword(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Loading Overlay */}
      {loading && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`}>
          <div className={`rounded-xl p-8 border ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
              <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Loading data...</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 font-medium">Error</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Three-pane app shell ──────────────────────────────────────────── */}
      <AppShell
        theme={theme}
        navigation={navigation}
        activeGroup={activeGroup}
        activeItem={activeItem}
        activeTrail={activeTrail}
        onSelectGroup={handleSelectNavGroup}
        onSelectItem={handleSelectNavItem}
        topBar={{
          user,
          notificationCount: notifications.length,
          messageCount: canMessage ? unreadMessages : 0,
          onLogoClick: () => handleSelectNavItem({ module: user?.role === 'patient' ? 'patientPortal' : 'dashboard' }),
          onSearch: () => setShowSearch(!showSearch),
          onMessages: canMessage ? goToMessages : null,
          onNotifications: () => setShowNotifications(!showNotifications),
          onHelp: () => setShowHelpDrawer(!showHelpDrawer),
          onAssistant: () => setShowAIAssistant(!showAIAssistant),
          onSettings: () => handleSetShowForm('settings'),
          onProfile: () => {
            // Patients manage their profile from the portal's profile tab
            if (user?.role !== 'patient') handleSetShowForm('userProfile');
          },
          onLogout: () => {
            api.clearToken();
            setIsAuthenticated(false);
            setUser(null);
          },
          onToggleTheme: async () => {
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
            await updateUserPreferences({ darkMode: newTheme === 'dark' });
            await addNotification('success', `Switched to ${newTheme} mode`);
          },
        }}
      >
        {/* Forms - appointment, patient, task, claim, diagnosis are now handled in their respective views */}
        {/* Only forms not handled by specific views are rendered here */}

        {showForm === 'payment' && (
          <div className="mb-8">
            <NewPaymentForm
              theme={theme}
              api={api}
              patients={patients}
              claims={claims}
              onClose={() => setShowForm(null)}
              onSuccess={(newPayment) => {
                addNotification('success', t.paymentRecordedSuccessfully || 'Payment recorded successfully');
                setShowForm(null);
              }}
              addNotification={addNotification}
              t={t}
            />
          </div>
        )}

        {showForm === 'insurancePayer' && (
          <div className="mb-8">
            <NewInsurancePayerForm
              theme={theme}
              api={api}
              onClose={() => setShowForm(null)}
              onSuccess={() => setShowForm(null)}
              addNotification={addNotification}
              t={t}
            />
          </div>
        )}

        {showForm === 'appointmentType' && (
          <div className="mb-8">
            <NewAppointmentTypeForm
              theme={theme}
              api={api}
              onClose={() => setShowForm(null)}
              onSuccess={() => {
                setShowForm(null);
                addNotification('success', t.appointmentTypeCreated || 'Appointment type created successfully');
              }}
              addNotification={addNotification}
              t={t}
            />
          </div>
        )}

        {showForm === 'healthcareOffering' && (
          <div className="mb-8">
            <NewHealthcareOfferingForm
              theme={theme}
              api={api}
              onClose={() => setShowForm(null)}
              onSuccess={() => {
                setShowForm(null);
                addNotification('success', t.offeringCreated || 'Healthcare offering created successfully');
              }}
              addNotification={addNotification}
              t={t}
            />
          </div>
        )}

        {showForm === 'campaign' && (
          <div className="mb-8">
            <NewCampaignForm
              theme={theme}
              api={api}
              onClose={() => setShowForm(null)}
              onSuccess={() => {
                setShowForm(null);
                addNotification('success', t.campaignCreated || 'Campaign created successfully');
              }}
              addNotification={addNotification}
              t={t}
            />
          </div>
        )}

        {showForm === 'pharmacy' && (
          <div className="mb-8">
            <NewPharmacyForm
              theme={theme}
              api={api}
              onClose={() => setShowForm(null)}
              onSuccess={() => setShowForm(null)}
              addNotification={addNotification}
              t={t}
            />
          </div>
        )}

        {showForm === 'laboratory' && (
          <div className="mb-8">
            <NewLaboratoryForm
              theme={theme}
              api={api}
              onClose={() => setShowForm(null)}
              onSuccess={() => setShowForm(null)}
              addNotification={addNotification}
              t={t}
            />
          </div>
        )}

        {showForm === 'user' && (
          <div className="mb-8">
            <NewUserForm
              theme={theme}
              api={api}
              onClose={() => setShowForm(null)}
              onSuccess={(newUser) => {
                setUsers([...users, newUser]);
                setShowForm(null);
              }}
              addNotification={addNotification}
              t={t}
            />
          </div>
        )}

        {/* task, diagnosis forms are now handled in DashboardView */}

        {/* Edit Forms for other types (appointment and patient are now handled in their respective views) */}
        {editingItem && editingItem.type !== 'appointment' && editingItem.type !== 'patient' && (
          <div className="mb-8">
            <ViewEditModal
              theme={theme}
              editingItem={editingItem}
              currentView={currentView}
              onClose={() => {
                setEditingItem(null);
                setCurrentView('list');
              }}
              patients={patients}
              users={users}
              api={api}
              addNotification={addNotification}
              setAppointments={setAppointments}
              setPatients={setPatients}
              setClaims={setClaims}
              setUsers={setUsers}
              setUser={setUser}
              user={user}
              t={t}
              currency={currency}
            />
          </div>
        )}

        {/* Main View Content */}
        {renderModule()}
      </AppShell>

      {/* Floating AI Assistant Button */}
      {!showAIAssistant && (
        <button
          onClick={() => setShowAIAssistant(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center text-white z-40"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {/* Quick Views */}
      {selectedItem === 'appointments' && (
        <AppointmentsQuickView
          theme={theme}
          appointments={appointments}
          patients={patients}
          onClose={() => setSelectedItem(null)}
          onViewAll={() => {
            setSelectedItem(null);
            setCurrentModule('practiceManagement');
          }}
          t={t}
        />
      )}

      {selectedItem === 'tasks' && (
        <TasksQuickView
          theme={theme}
          tasks={tasks}
          onClose={() => setSelectedItem(null)}
          onCompleteTask={completeTask}
          setEditingItem={handleSetEditingItem}
          setCurrentView={setCurrentView}
          t={t}
        />
      )}

      {selectedItem === 'revenue' && (
        <RevenueQuickView
          theme={theme}
          claims={claims}
          patients={patients}
          onClose={() => setSelectedItem(null)}
          onViewAll={() => {
            setSelectedItem(null);
            setCurrentModule('rcm');
          }}
          setEditingItem={handleSetEditingItem}
          setCurrentView={setCurrentView}
          t={t}
          currency={currency}
        />
      )}

      {selectedItem === 'patients' && (
        <PatientsQuickView
          theme={theme}
          t={t}
          patients={patients}
          onClose={() => setSelectedItem(null)}
          onViewAll={() => {
            setSelectedItem(null);
            setCurrentModule('ehr');
          }}
          setEditingItem={handleSetEditingItem}
          setCurrentView={setCurrentView}
          onViewHistory={(patient) => {
            setSelectedPatient(patient);
            setPatientHistoryInitialTab('overview');
            setCurrentModule('patientHistory');
          }}
        />
      )}

      {/* Panels */}
      {showNotifications && (
        <NotificationsPanel
          theme={theme}
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          clearAllNotifications={clearAllNotifications}
          clearNotification={clearNotification}
        />
      )}

      {showSearch && (
        <SearchPanel
          theme={theme}
          onClose={() => setShowSearch(false)}
          onSelectResult={(result) => {
            console.log('Search result selected:', result);
            setShowSearch(false);

            // Navigate to the appropriate module and open the record
            const moduleMap = {
              'patient': 'ehr',
              'appointment': 'practiceManagement',
              'provider': 'providerManagement',
              'claim': 'rcm',
              'payment': 'rcm',
              'prescription': 'patientHistory',
              'lab_order': 'patientHistory',
              'diagnosis': 'patientHistory',
              'task': 'dashboard',
              'offering': 'clinicalServices',
              'campaign': 'crm',
              'preapproval': 'rcm',
              'denial': 'rcm'
            };

            // A patient's results are their own records; every one of them
            // opens inside the portal rather than a practice-side console.
            const targetModule = isPatient
              ? 'patientPortal'
              : moduleMap[result.result_type] || result.module || 'dashboard';

            if (isPatient) {
              const portalTab = {
                appointment: 'appointments',
                diagnosis: 'diagnoses',
                prescription: 'prescriptions',
                lab_order: 'records',
                patient: 'profile',
              }[result.result_type] || 'profile';
              setNavSelection({ module: 'patientPortal', tab: portalTab });
              setCurrentModule('patientPortal');
              return;
            }

            console.log('Navigating to module:', targetModule, 'with result type:', result.result_type);

            // Clear previous state first to avoid conflicts
            setEditingItem(null);
            setSelectedItem(null);
            setCurrentView('list');

            // Use setTimeout to ensure state is cleared before setting new state
            setTimeout(() => {
              // Handle different result types based on how each module works
              if (result.result_type === 'appointment') {
                // Practice Management handles appointments via editingItem
                setCurrentModule(targetModule);
                handleSetEditingItem({ type: 'appointment', data: result });
                setCurrentView('view');
              } else if (result.result_type === 'patient') {
                // EHR handles patients via editingItem
                // Fetch full patient data from API to get all fields (gender, address, insurance, etc.)
                setCurrentModule(targetModule);

                // Find patient in local state first (might have full data)
                const fullPatient = patients.find(p => p.id === result.id || p.id.toString() === result.id.toString());

                if (fullPatient) {
                  // Use full patient data from local state
                  handleSetEditingItem({ type: 'patient', data: fullPatient });
                  setCurrentView('view');
                } else {
                  // Fetch full patient data from API
                  api.getPatient(result.id).then(patient => {
                    handleSetEditingItem({ type: 'patient', data: patient });
                    setCurrentView('view');
                  }).catch(error => {
                    console.error('Error fetching patient:', error);
                    // Fallback to search result data if fetch fails
                    handleSetEditingItem({ type: 'patient', data: result });
                    setCurrentView('view');
                  });
                }
              } else if (result.result_type === 'provider') {
                // Provider Management uses its own internal state, just navigate to module
                setCurrentModule(targetModule);
                addNotification('info', `Navigated to Provider Management. Select the provider from the list.`);
              } else if (result.result_type === 'prescription') {
                // For prescriptions, navigate to patient history with prescriptions tab
                if (result.patient_id) {
                  const patient = patients.find(p => p.id === result.patient_id || p.id.toString() === result.patient_id.toString());
                  if (patient) {
                    setSelectedPatient(patient);
                    setPatientHistoryInitialTab('prescriptions');
                    setCurrentModule('patientHistory');
                    addNotification('success', `Opened patient prescriptions for ${patient.first_name} ${patient.last_name}`);
                  } else {
                    setCurrentModule('ehr');
                    addNotification('warning', `Patient not found. Navigated to EHR module.`);
                  }
                } else {
                  setCurrentModule('ehr');
                  addNotification('info', `Navigated to EHR module.`);
                }
              } else if (result.result_type === 'diagnosis') {
                // For diagnoses, navigate to patient history with diagnoses tab
                if (result.patient_id) {
                  const patient = patients.find(p => p.id === result.patient_id || p.id.toString() === result.patient_id.toString());
                  if (patient) {
                    setSelectedPatient(patient);
                    setPatientHistoryInitialTab('diagnoses');
                    setCurrentModule('patientHistory');
                    addNotification('success', `Opened patient diagnoses for ${patient.first_name} ${patient.last_name}`);
                  } else {
                    setCurrentModule('ehr');
                    addNotification('warning', `Patient not found. Navigated to EHR module.`);
                  }
                } else {
                  setCurrentModule('ehr');
                  addNotification('info', `Navigated to EHR module.`);
                }
              } else if (result.result_type === 'lab_order') {
                // For lab orders, navigate to patient history with lab orders tab
                if (result.patient_id) {
                  const patient = patients.find(p => p.id === result.patient_id || p.id.toString() === result.patient_id.toString());
                  if (patient) {
                    setSelectedPatient(patient);
                    setPatientHistoryInitialTab('labOrders');
                    setCurrentModule('patientHistory');
                    addNotification('success', `Opened patient lab orders for ${patient.first_name} ${patient.last_name}`);
                  } else {
                    setCurrentModule('ehr');
                    addNotification('warning', `Patient not found. Navigated to EHR module.`);
                  }
                } else {
                  setCurrentModule('ehr');
                  addNotification('info', `Navigated to EHR module.`);
                }
              } else if (result.result_type === 'claim') {
                // For claims, open in ViewEditModal
                setCurrentModule(targetModule);
                handleSetEditingItem({ type: 'claim', data: result });
                setCurrentView('view');
              } else if (['payment', 'denial', 'preapproval'].includes(result.result_type)) {
                // For other RCM items, open in ViewEditModal
                setCurrentModule(targetModule);
                handleSetEditingItem({ type: result.result_type, data: result });
                setCurrentView('view');
              } else if (result.result_type === 'task') {
                // For tasks, open in ViewEditModal
                setCurrentModule(targetModule);
                handleSetEditingItem({ type: 'task', data: result });
                setCurrentView('view');
              } else if (result.result_type === 'offering') {
                // Clinical Services
                setCurrentModule(targetModule);
                addNotification('info', 'Navigated to Clinical Services module. Find the service offering in the list.');
              } else if (result.result_type === 'campaign') {
                // CRM
                setCurrentModule(targetModule);
                addNotification('info', 'Navigated to CRM module. Find the campaign in the campaigns list.');
              }
            }, 50);
          }}
        />
      )}

      {showAIAssistant && (
        <EnhancedAIAssistant
          theme={theme}
          tasks={tasks}
          onClose={() => setShowAIAssistant(false)}
          onSelectItem={setSelectedItem}
          onSelectModule={setCurrentModule}
          currentContext={currentContext}
        />
      )}

      {/* Help Drawer */}
      {showHelpDrawer && (
        <HelpDrawer
          theme={theme}
          isOpen={showHelpDrawer}
          onClose={() => setShowHelpDrawer(false)}
          currentContext={currentContext}
          userRole={user?.role}
          onOpenAI={() => {
            setShowHelpDrawer(false);
            setShowAIAssistant(true);
          }}
        />
      )}

      {/* Onboarding Tour */}
      {showOnboarding && (
        <OnboardingTour
          theme={theme}
          userRole={user?.role}
          onComplete={() => {
            setShowOnboarding(false);
            localStorage.setItem(`onboarding_${user.role}_complete`, 'true');
          }}
          onSkip={() => {
            setShowOnboarding(false);
            localStorage.setItem(`onboarding_${user.role}_complete`, 'true');
          }}
        />
      )}

      {/* Settings Modal */}
      {showForm === 'settings' && (
        <SettingsModal
          theme={theme}
          user={user}
          users={users}
          language={language}
          onClose={() => setShowForm(null)}
          setCurrentView={setCurrentView}
          updateUserPreferences={updateUserPreferences}
          setTheme={setTheme}
          setLanguage={setLanguage}
          setShowForm={handleSetShowForm}
          setEditingItem={handleSetEditingItem}
          setUsers={setUsers}
          setCurrentModule={setCurrentModule}
          api={api}
          addNotification={addNotification}
        />
      )}

      {/* User Profile Modal */}
      {showForm === 'userProfile' && (
        <UserProfileModal
          theme={theme}
          user={user}
          language={language}
          onClose={() => setShowForm(null)}
          setCurrentView={setCurrentView}
          setEditingItem={handleSetEditingItem}
          showChangePassword={showChangePassword}
          setShowChangePassword={setShowChangePassword}
          updateUserPreferences={updateUserPreferences}
          setTheme={setTheme}
          api={api}
          addNotification={addNotification}
        />
      )}
    </>
  );
}

// Wrap App with AppProvider and OAuth Providers
export default function AppWithProvider() {
  return (
    <GoogleOAuthProvider clientId={googleOAuthConfig.clientId}>
      <MsalProvider instance={msalInstance}>
        <AppProvider>
          <App />
        </AppProvider>
      </MsalProvider>
    </GoogleOAuthProvider>
  );
}
