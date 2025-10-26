import React from 'react';
import { Shield, Bot, Bell, Search, Settings, Menu, X, ChevronRight, Stethoscope, AlertCircle, ArrowLeft } from 'lucide-react';
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

// Views
import DashboardView from './views/DashboardView';
import PracticeManagementView from './views/PracticeManagementView';
import EHRView from './views/EHRView';
import TelehealthView from './views/TelehealthView';
import RCMView from './views/RCMView';
import CRMView from './views/CRMView';
import IntegrationsView from './views/IntegrationsView';
import FHIRView from './views/FHIRView';
import PatientPortalView from './views/PatientPortalView';

// Modals
import LoginPage from './components/modals/LoginPage';
import ForgotPasswordModal from './components/modals/ForgotPasswordModal';
import ViewEditModal from './components/modals/ViewEditModal';
import UserProfileModal from './components/modals/UserProfileModal';
import SettingsModal from './components/modals/SettingsModal';

// Forms
import NewAppointmentForm from './components/forms/NewAppointmentForm';
import NewPatientForm from './components/forms/NewPatientForm';
import NewClaimForm from './components/forms/NewClaimForm';
import NewUserForm from './components/forms/NewUserForm';

// Panels
import NotificationsPanel from './components/panels/NotificationsPanel';
import SearchPanel from './components/panels/SearchPanel';
import AIAssistantPanel from './components/panels/AIAssistantPanel';

// Quick Views
import AppointmentsQuickView from './components/quickViews/AppointmentsQuickView';
import TasksQuickView from './components/quickViews/TasksQuickView';
import RevenueQuickView from './components/quickViews/RevenueQuickView';
import PatientsQuickView from './components/quickViews/PatientsQuickView';

// Initialize MSAL instance for Microsoft OAuth
const msalInstance = new PublicClientApplication(microsoftOAuthConfig);

function App() {
  const {
    // Auth & Navigation
    isAuthenticated,
    setIsAuthenticated,
    showForgotPassword,
    setShowForgotPassword,
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

    // Data
    appointments,
    setAppointments,
    patients,
    setPatients,
    claims,
    setClaims,
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
  const modules = getModules(t);
  const hasModuleAccess = (moduleId) => hasAccess(planTier, moduleId);

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

  // Render the appropriate view based on currentModule
  const renderModule = () => {
    switch (currentModule) {
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
            modules={modules}
            hasAccess={hasModuleAccess}
            setSelectedItem={handleSetSelectedItem}
            setShowForm={handleSetShowForm}
            setCurrentModule={setCurrentModule}
            completeTask={completeTask}
          />
        );
      case 'practiceManagement':
        return (
          <PracticeManagementView
            theme={theme}
            appointments={appointments}
            patients={patients}
            appointmentViewType={appointmentViewType}
            calendarViewType={calendarViewType}
            setAppointmentViewType={setAppointmentViewType}
            setCalendarViewType={setCalendarViewType}
            setShowForm={handleSetShowForm}
            setEditingItem={handleSetEditingItem}
            setCurrentView={setCurrentView}
            setAppointments={setAppointments}
            api={api}
            addNotification={addNotification}
          />
        );
      case 'ehr':
        return (
          <EHRView
            theme={theme}
            patients={patients}
            setShowForm={handleSetShowForm}
            setCurrentView={setCurrentView}
            setEditingItem={handleSetEditingItem}
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
          />
        );
      case 'rcm':
        return (
          <RCMView
            theme={theme}
            claims={claims}
            patients={patients}
            setShowForm={handleSetShowForm}
            setEditingItem={handleSetEditingItem}
            setCurrentView={setCurrentView}
            setClaims={setClaims}
            addNotification={addNotification}
            api={api}
          />
        );
      case 'crm':
        return <CRMView theme={theme} setShowForm={handleSetShowForm} />;
      case 'integrations':
        return <IntegrationsView theme={theme} />;
      case 'fhir':
        return (
          <FHIRView
            theme={theme}
            api={api}
            patients={patients}
            addNotification={addNotification}
          />
        );
      case 'patientPortal':
        return (
          <PatientPortalView
            theme={theme}
            api={api}
            addNotification={addNotification}
          />
        );
      default:
        return null;
    }
  };

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <LoginPage
          theme={theme}
          setTheme={setTheme}
          api={api}
          setUser={setUser}
          setIsAuthenticated={setIsAuthenticated}
          addNotification={addNotification}
          setShowForgotPassword={setShowForgotPassword}
        />
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
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-gray-100 via-white to-gray-100'}`}>
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

      {/* Header */}
      <header className={`backdrop-blur-md border-b sticky top-0 z-50 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/50 border-gray-200/50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button
              onClick={() => setCurrentModule('dashboard')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Stethoscope className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>MedFlow</h1>
                <p className={`text-xs capitalize ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{planTier} Plan</p>
              </div>
            </button>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-2 rounded-lg transition-colors relative ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                title="Search"
              >
                <Search className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
              </button>

              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-lg transition-colors relative ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                title="Notifications"
              >
                <Bell className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>

              <button
                onClick={() => setShowAIAssistant(!showAIAssistant)}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                title="AI Assistant"
              >
                <Bot className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
              </button>

              {/* User Menu */}
              <button
                onClick={() => handleSetShowForm('userProfile')}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors"
                title={`${user?.name || 'User'} (${user?.role || 'user'})`}
              >
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user?.avatar || 'U'}
                </div>
                <div className="text-left">
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user?.name || 'User'}</p>
                  <p className={`text-xs capitalize ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{user?.role || 'user'}</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsAuthenticated(false);
                  setUser(null);
                }}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-600'}`}
                title="Logout"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderModule()}
      </main>

      {/* Floating AI Assistant Button */}
      {!showAIAssistant && (
        <button
          onClick={() => setShowAIAssistant(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center text-white z-40"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {/* Modals and Forms */}
      {showForm === 'appointment' && (
        <NewAppointmentForm
          theme={theme}
          api={api}
          patients={patients}
          users={users}
          onClose={() => setShowForm(null)}
          onSuccess={(newAppointment) => {
            setAppointments([...appointments, newAppointment]);
            setShowForm(null);
          }}
          addNotification={addNotification}
        />
      )}

      {showForm === 'patient' && (
        <NewPatientForm
          theme={theme}
          api={api}
          patients={patients}
          onClose={() => setShowForm(null)}
          onSuccess={(newPatient) => {
            setPatients([...patients, newPatient]);
            setShowForm(null);
          }}
          addNotification={addNotification}
        />
      )}

      {showForm === 'claim' && (
        <NewClaimForm
          theme={theme}
          api={api}
          patients={patients}
          claims={claims}
          onClose={() => setShowForm(null)}
          onSuccess={(newClaim) => {
            setClaims([...claims, newClaim]);
            setShowForm(null);
          }}
          addNotification={addNotification}
        />
      )}

      {showForm === 'user' && (
        <NewUserForm
          theme={theme}
          api={api}
          user={user}
          onClose={() => setShowForm(null)}
          onSuccess={(newUser) => {
            setUsers([...users, newUser]);
            setShowForm(null);
          }}
          addNotification={addNotification}
        />
      )}

      {showForm === 'userProfile' && (
        <UserProfileModal
          theme={theme}
          user={user}
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
          api={api}
          addNotification={addNotification}
        />
      )}

      {editingItem && (
        <ViewEditModal
          theme={theme}
          editingItem={editingItem}
          currentView={currentView}
          onClose={() => {
            setEditingItem(null);
            setCurrentView('list');
          }}
          patients={patients}
          api={api}
          addNotification={addNotification}
          setAppointments={setAppointments}
          setPatients={setPatients}
          setClaims={setClaims}
          setUsers={setUsers}
          setUser={setUser}
          user={user}
        />
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
        />
      )}

      {selectedItem === 'patients' && (
        <PatientsQuickView
          theme={theme}
          patients={patients}
          onClose={() => setSelectedItem(null)}
          onViewAll={() => {
            setSelectedItem(null);
            setCurrentModule('ehr');
          }}
          setEditingItem={handleSetEditingItem}
          setCurrentView={setCurrentView}
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
          patients={patients}
          appointments={appointments}
          onClose={() => setShowSearch(false)}
          onSelectResult={(result) => {
            setShowSearch(false);
            // Handle navigation to result
          }}
        />
      )}

      {showAIAssistant && (
        <AIAssistantPanel
          theme={theme}
          tasks={tasks}
          onClose={() => setShowAIAssistant(false)}
          onSelectItem={setSelectedItem}
          onSelectModule={setCurrentModule}
        />
      )}
    </div>
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
