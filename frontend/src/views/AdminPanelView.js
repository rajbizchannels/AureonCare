import React, { useState, useEffect } from 'react';
import { Settings, Users, Clock, Building2, Save, Edit, Trash2, UserPlus, Shield, Lock, Unlock, CheckCircle, ArrowLeft, CreditCard, Check, Video } from 'lucide-react';
import { useApp } from '../context/AppContext';

const AdminPanelView = ({
  theme,
  users,
  setUsers,
  setShowForm,
  setEditingItem,
  setCurrentView,
  api,
  addNotification,
  setCurrentModule,
  t
}) => {
  const { setPlanTier, updateUserPreferences, planTier } = useApp();
  const [activeTab, setActiveTab] = useState('clinic');
  const [clinicSettings, setClinicSettings] = useState({
    name: 'MedFlow Medical Center',
    address: '123 Healthcare Ave, Medical City, MC 12345',
    phone: '(555) 123-4567',
    email: 'info@medflowclinic.com',
    website: 'www.medflowclinic.com',
    taxId: '12-3456789',
    npi: '1234567890'
  });

  const [workingHours, setWorkingHours] = useState({
    monday: { open: '08:00', close: '17:00', enabled: true },
    tuesday: { open: '08:00', close: '17:00', enabled: true },
    wednesday: { open: '08:00', close: '17:00', enabled: true },
    thursday: { open: '08:00', close: '17:00', enabled: true },
    friday: { open: '08:00', close: '17:00', enabled: true },
    saturday: { open: '09:00', close: '13:00', enabled: false },
    sunday: { open: '09:00', close: '13:00', enabled: false }
  });

  // Load clinic settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('clinicSettings');
      if (savedSettings) {
        setClinicSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading clinic settings:', error);
    }
  }, []);

  const [appointmentSettings, setAppointmentSettings] = useState({
    defaultDuration: 30,
    slotInterval: 15,
    maxAdvanceBooking: 90,
    cancellationDeadline: 24
  });

  const [rolePermissions, setRolePermissions] = useState({
    admin: {
      patients: { view: true, create: true, edit: true, delete: true },
      appointments: { view: true, create: true, edit: true, delete: true },
      claims: { view: true, create: true, edit: true, delete: true },
      ehr: { view: true, create: true, edit: true, delete: true },
      users: { view: true, create: true, edit: true, delete: true },
      reports: { view: true, create: true, edit: true, delete: true },
      settings: { view: true, create: true, edit: true, delete: true }
    },
    doctor: {
      patients: { view: true, create: true, edit: true, delete: false },
      appointments: { view: true, create: true, edit: true, delete: false },
      claims: { view: true, create: true, edit: true, delete: false },
      ehr: { view: true, create: true, edit: true, delete: false },
      users: { view: true, create: false, edit: false, delete: false },
      reports: { view: true, create: false, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false }
    },
    staff: {
      patients: { view: true, create: true, edit: true, delete: false },
      appointments: { view: true, create: true, edit: true, delete: false },
      claims: { view: true, create: false, edit: false, delete: false },
      ehr: { view: true, create: false, edit: false, delete: false },
      users: { view: false, create: false, edit: false, delete: false },
      reports: { view: true, create: false, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false }
    },
    patient: {
      patients: { view: true, create: false, edit: false, delete: false },
      appointments: { view: true, create: true, edit: false, delete: false },
      claims: { view: true, create: false, edit: false, delete: false },
      ehr: { view: true, create: false, edit: false, delete: false },
      users: { view: false, create: false, edit: false, delete: false },
      reports: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false }
    }
  });

  const [subscriptionPlans, setSubscriptionPlans] = useState([
    {
      id: 'free',
      name: 'Free Plan',
      price: 0,
      billing: 'monthly',
      maxUsers: 3,
      maxPatients: 50,
      features: {
        ehr: true,
        appointments: true,
        billing: false,
        crm: false,
        telehealth: false,
        integrations: false
      }
    },
    {
      id: 'starter',
      name: 'Starter Plan',
      price: 99,
      billing: 'monthly',
      maxUsers: 10,
      maxPatients: 200,
      features: {
        ehr: true,
        appointments: true,
        billing: true,
        crm: false,
        telehealth: true,
        integrations: false
      },
      popular: false
    },
    {
      id: 'professional',
      name: 'Professional Plan',
      price: 299,
      billing: 'monthly',
      maxUsers: 25,
      maxPatients: 1000,
      features: {
        ehr: true,
        appointments: true,
        billing: true,
        crm: true,
        telehealth: true,
        integrations: true
      },
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise Plan',
      price: 999,
      billing: 'monthly',
      maxUsers: -1,
      maxPatients: -1,
      features: {
        ehr: true,
        appointments: true,
        billing: true,
        crm: true,
        telehealth: true,
        integrations: true,
        customBranding: true,
        apiAccess: true
      }
    }
  ]);

  const [currentPlan, setCurrentPlan] = useState(planTier || 'professional');

  // Telehealth integrations state
  const [telehealthSettings, setTelehealthSettings] = useState({
    zoom: {
      is_enabled: false,
      api_key: '',
      api_secret: '',
      client_id: '',
      client_secret: '',
      settings: {
        user_id: '',
        account_id: '',
        use_oauth: false
      }
    },
    google_meet: {
      is_enabled: false,
      client_id: '',
      client_secret: '',
      settings: {
        refresh_token: '',
        access_token: '',
        redirect_uri: ''
      }
    },
    webex: {
      is_enabled: false,
      api_key: '',
      settings: {
        site_url: ''
      }
    }
  });
  const [telehealthDbMissing, setTelehealthDbMissing] = useState(false);

  // Custom role creation state
  const [showCustomRoleForm, setShowCustomRoleForm] = useState(false);
  const [customRoleName, setCustomRoleName] = useState('');
  const [customRolePermissions, setCustomRolePermissions] = useState({
    patients: { view: false, create: false, edit: false, delete: false },
    appointments: { view: false, create: false, edit: false, delete: false },
    billing: { view: false, create: false, edit: false, delete: false },
    reports: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false }
  });

  // Sync currentPlan with planTier from context
  useEffect(() => {
    if (planTier) {
      setCurrentPlan(planTier);
    }
  }, [planTier]);

  // Load telehealth settings
  useEffect(() => {
    const loadTelehealthSettings = async () => {
      try {
        const settings = await api.getTelehealthSettings();
        if (settings && settings.length > 0) {
          const settingsMap = {};
          settings.forEach(s => {
            // Parse settings if it's a string
            const parsedSettings = typeof s.settings === 'string'
              ? JSON.parse(s.settings)
              : (s.settings || {});

            settingsMap[s.provider_type] = {
              is_enabled: s.is_enabled || false,
              api_key: s.api_key || '',
              api_secret: s.api_secret || '',
              client_id: s.client_id || '',
              client_secret: s.client_secret || '',
              webhook_secret: s.webhook_secret || '',
              settings: parsedSettings
            };
          });

          // Merge with existing state to preserve default structure
          setTelehealthSettings(prev => {
            const merged = { ...prev };
            Object.keys(settingsMap).forEach(key => {
              merged[key] = {
                ...prev[key],
                ...settingsMap[key],
                settings: {
                  ...(prev[key]?.settings || {}),
                  ...(settingsMap[key]?.settings || {})
                }
              };
            });
            return merged;
          });
        }
      } catch (error) {
        console.error('Error loading telehealth settings:', error);
        // Show helpful message if tables don't exist
        if (error.message && (error.message.includes('telehealth_provider_settings') || error.message.includes('503'))) {
          console.warn('Telehealth provider settings table does not exist. Please run the database migration: node backend/scripts/migrate-telehealth.js');
          setTelehealthDbMissing(true);
        }
      }
    };
    loadTelehealthSettings();
  }, [api]);

  const handleSaveClinicSettings = async () => {
    try {
      // Save to localStorage for now (until backend endpoint is created)
      localStorage.setItem('clinicSettings', JSON.stringify(clinicSettings));
      await addNotification('success', t.clinicSettingsSaved);
    } catch (error) {
      console.error('Error saving clinic settings:', error);
      await addNotification('alert', t.failedToSaveClinicSettings);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm(t.confirmDeleteUser || 'Are you sure you want to delete this user?')) return;

    try {
      await api.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      await addNotification('success', t.userDeletedSuccessfully);
    } catch (error) {
      await addNotification('alert', t.failedToDeleteUser);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    const actionText = newStatus === 'blocked' ? 'block' : 'unblock';
    const confirmMsg = newStatus === 'blocked'
      ? (t.confirmBlockUser || 'Are you sure you want to block this user?')
      : (t.confirmUnblockUser || 'Are you sure you want to unblock this user?');

    if (!window.confirm(confirmMsg)) return;

    try {
      const updatedUser = await api.updateUser(userId, { status: newStatus });
      setUsers(users.map(u => u.id === userId ? updatedUser : u));
      const successMsg = newStatus === 'blocked'
        ? (t.userBlockedSuccessfully || 'User blocked successfully')
        : (t.userUnblockedSuccessfully || 'User unblocked successfully');
      await addNotification('success', successMsg);
    } catch (error) {
      const errorMsg = newStatus === 'blocked'
        ? (t.failedToBlockUser || 'Failed to block user')
        : (t.failedToUnblockUser || 'Failed to unblock user');
      await addNotification('alert', errorMsg);
    }
  };

  const handleApproveUser = async (userId) => {
    if (!window.confirm(t.confirmApproveUser || 'Are you sure you want to approve this user?')) return;

    try {
      const updatedUser = await api.updateUser(userId, { status: 'active' });
      setUsers(users.map(u => u.id === userId ? updatedUser : u));
      await addNotification('success', t.userApprovedSuccessfully);
    } catch (error) {
      await addNotification('alert', t.failedToApproveUser);
    }
  };

  // Load permissions from backend on mount
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const permissions = await api.getPermissions();
        if (Object.keys(permissions).length > 0) {
          setRolePermissions(permissions);
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
        // Use default permissions if loading fails
      }
    };
    loadPermissions();
  }, [api]);

  const handleSaveRolePermissions = async () => {
    try {
      await api.updatePermissions(rolePermissions);
      await addNotification('success', t.rolePermissionsSaved);
    } catch (error) {
      console.error('Error saving permissions:', error);
      await addNotification('alert', t.failedToSaveRolePermissions);
    }
  };

  const handleTogglePermission = (role, module, action) => {
    setRolePermissions({
      ...rolePermissions,
      [role]: {
        ...rolePermissions[role],
        [module]: {
          ...rolePermissions[role][module],
          [action]: !rolePermissions[role][module][action]
        }
      }
    });
  };

  const handleDeleteCustomRole = async (roleName) => {
    if (window.confirm(`Are you sure you want to delete the "${roleName}" role? This action cannot be undone.`)) {
      try {
        // Remove from rolePermissions state
        const updatedPermissions = { ...rolePermissions };
        delete updatedPermissions[roleName];
        setRolePermissions(updatedPermissions);

        // Delete from API/database
        await api.deleteRole(roleName);
        await addNotification('success', `Custom role "${roleName}" deleted successfully`);
      } catch (error) {
        console.error('Error deleting custom role:', error);
        await addNotification('alert', 'Failed to delete custom role');
      }
    }
  };

  const handleCreateCustomRole = async (roleName, permissions) => {
    try {
      // Add to rolePermissions state
      setRolePermissions({
        ...rolePermissions,
        [roleName]: permissions
      });

      // Save to API/database
      await api.createRole({ name: roleName, permissions });
      await addNotification('success', `Custom role "${roleName}" created successfully`);
      setShowForm(null);
    } catch (error) {
      console.error('Error creating custom role:', error);
      await addNotification('alert', 'Failed to create custom role');
    }
  };

  const handleSaveTelehealthSettings = async (providerType) => {
    try {
      const settings = telehealthSettings[providerType];
      await api.saveTelehealthSettings(providerType, settings);
      await addNotification('success', `${providerType} settings saved successfully`);
    } catch (error) {
      console.error('Error saving telehealth settings:', error);
      await addNotification('alert', `Failed to save ${providerType} settings`);
    }
  };

  const handleToggleTelehealthProvider = async (providerType, isEnabled) => {
    // Store previous state for rollback (outside try block so catch can access it)
    const previousState = { ...telehealthSettings[providerType] };

    try {
      // Optimistically update UI - preserve all existing fields
      setTelehealthSettings(prev => ({
        ...prev,
        [providerType]: {
          ...prev[providerType],
          is_enabled: isEnabled,
          // Ensure settings object is preserved
          settings: {
            ...(prev[providerType]?.settings || {})
          }
        }
      }));

      await api.toggleTelehealthProvider(providerType, isEnabled);
      const providerName = providerType.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      await addNotification('success', `${providerName} ${isEnabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error toggling telehealth provider:', error);
      // Revert to previous state on error
      setTelehealthSettings(prev => ({
        ...prev,
        [providerType]: previousState
      }));
      await addNotification('alert', `Failed to toggle ${providerType}`);
    }
  };

  const tabs = [
    { id: 'clinic', label: t.clinicSettings || 'Clinic Settings', icon: Building2 },
    { id: 'users', label: t.userManagement || 'User Management', icon: Users },
    { id: 'roles', label: t.rolesPermissions || 'Roles & Permissions', icon: Shield },
    { id: 'plans', label: t.subscriptionPlans || 'Subscription Plans', icon: CreditCard },
    { id: 'telehealth', label: t.integrations || 'Integrations', icon: Video },
    { id: 'hours', label: t.workingHours || 'Working Hours', icon: Clock },
    { id: 'appointments', label: t.appointmentSettings || 'Appointment Settings', icon: Settings }
  ];

  // Handle custom role form submission
  const handleSubmitCustomRole = async () => {
    if (!customRoleName.trim()) {
      await addNotification('alert', 'Please enter a role name');
      return;
    }

    await handleCreateCustomRole(customRoleName.toLowerCase().replace(/\s+/g, '_'), customRolePermissions);
    setShowCustomRoleForm(false);
  };

  const handleToggleCustomRolePermission = (module, action) => {
    setCustomRolePermissions({
      ...customRolePermissions,
      [module]: {
        ...customRolePermissions[module],
        [action]: !customRolePermissions[module][action]
      }
    });
  };

  return (
    <>
      {/* Custom Role Creation/Edit Modal */}
      {showCustomRoleForm && (
        <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={() => setShowCustomRoleForm(false)}>
          <div className={`rounded-xl border max-w-4xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
            <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-pink-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {customRoleName ? 'Edit Custom Role' : 'Create Custom Role'}
              </h2>
              <button onClick={() => setShowCustomRoleForm(false)} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
                <Edit className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
              <div className="space-y-6">
                {/* Role Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Role Name
                  </label>
                  <input
                    type="text"
                    value={customRoleName}
                    onChange={(e) => setCustomRoleName(e.target.value)}
                    placeholder="e.g., Medical Assistant, Lab Technician"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>

                {/* Permissions */}
                <div>
                  <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Permissions
                  </h3>
                  <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Configure what this role can do in the system. Toggle permissions for each module.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                          <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                            Module
                          </th>
                          <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                            View
                          </th>
                          <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                            Create
                          </th>
                          <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                            Edit
                          </th>
                          <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                            Delete
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(customRolePermissions).map(([module, actions]) => (
                          <tr key={module} className={`border-b ${theme === 'dark' ? 'border-slate-800' : 'border-gray-200'}`}>
                            <td className={`px-4 py-3 font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {module}
                            </td>
                            {['view', 'create', 'edit', 'delete'].map(action => (
                              <td key={action} className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCustomRolePermission(module, action)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                    actions[action]
                                      ? 'bg-purple-500'
                                      : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      actions[action] ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-0 border-t">
              <button
                onClick={() => setShowCustomRoleForm(false)}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCustomRole}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors text-white flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {customRoleName ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title={t.backToDashboard || 'Back to Dashboard'}
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
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
        <div className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-500'
                  : `border-transparent ${theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-gray-600 hover:text-gray-900'}`
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clinic Settings Tab */}
      {activeTab === 'clinic' && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.clinicInformation || 'Clinic Information'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.clinicName || 'Clinic Name'}
              </label>
              <input
                type="text"
                value={clinicSettings.name}
                onChange={(e) => setClinicSettings({ ...clinicSettings, name: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.phone || 'Phone'}
              </label>
              <input
                type="tel"
                value={clinicSettings.phone}
                onChange={(e) => setClinicSettings({ ...clinicSettings, phone: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>
            <div className="md:col-span-2">
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.address || 'Address'}
              </label>
              <input
                type="text"
                value={clinicSettings.address}
                onChange={(e) => setClinicSettings({ ...clinicSettings, address: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.email || 'Email'}
              </label>
              <input
                type="email"
                value={clinicSettings.email}
                onChange={(e) => setClinicSettings({ ...clinicSettings, email: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.website || 'Website'}
              </label>
              <input
                type="text"
                value={clinicSettings.website}
                onChange={(e) => setClinicSettings({ ...clinicSettings, website: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.taxId || 'Tax ID'}
              </label>
              <input
                type="text"
                value={clinicSettings.taxId}
                onChange={(e) => setClinicSettings({ ...clinicSettings, taxId: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.npiNumber || 'NPI Number'}
              </label>
              <input
                type="text"
                value={clinicSettings.npi}
                onChange={(e) => setClinicSettings({ ...clinicSettings, npi: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveClinicSettings}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors text-white flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {t.saveChanges || 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t.users || 'Users'} ({users.length})
            </h2>
            <button
              onClick={() => setShowForm('user')}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors text-white flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {t.addUser || 'Add User'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.name || 'Name'}</th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.email || 'Email'}</th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.role || 'Role'}</th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.status || 'Status'}</th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.specialty || 'Specialty'}</th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.actions || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={`border-b ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {user.name || `${user.firstName} ${user.lastName}`}
                    </td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {user.email}
                    </td>
                    <td className={`px-4 py-3`}>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                        user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                        user.role === 'doctor' ? 'bg-blue-500/20 text-blue-400' :
                        user.role === 'patient' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {t[user.role] || user.role}
                      </span>
                    </td>
                    <td className={`px-4 py-3`}>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                        user.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        user.status === 'blocked' ? 'bg-red-500/20 text-red-400' :
                        user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {t[user.status || 'active'] || user.status || 'active'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {user.specialty || (t.notApplicable || 'N/A')}
                    </td>
                    <td className={`px-4 py-3`}>
                      <div className="flex items-center gap-2">
                        {user.status === 'pending' && (
                          <button
                            onClick={() => handleApproveUser(user.id)}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title={t.approveUser || 'Approve User'}
                          >
                            <CheckCircle className={`w-4 h-4 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingItem({ type: 'user', data: user });
                            setCurrentView('edit');
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                          title={t.editUser || 'Edit User'}
                        >
                          <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                        </button>
                        {user.status !== 'pending' && (
                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.status || 'active')}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title={(user.status || 'active') === 'blocked' ? (t.unblockUser || 'Unblock User') : (t.blockUser || 'Block User')}
                          >
                            {(user.status || 'active') === 'blocked' ? (
                              <Unlock className={`w-4 h-4 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                            ) : (
                              <Lock className={`w-4 h-4 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                          title={t.deleteUser || 'Delete User'}
                        >
                          <Trash2 className={`w-4 h-4 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles & Permissions Tab */}
      {activeTab === 'roles' && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.rolePermissions || 'Role Permissions'}
          </h2>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            {t.rolePermissionsDescription || 'Configure what each role can do in the system. Check or uncheck permissions for each role.'}
          </p>

          <div className="space-y-8">
            {Object.entries(rolePermissions).map(([role, permissions]) => (
              <div key={role} className={`rounded-lg border p-6 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <Shield className={`w-6 h-6 ${
                    role === 'admin' ? 'text-purple-400' :
                    role === 'doctor' ? 'text-blue-400' :
                    role === 'patient' ? 'text-green-400' :
                    'text-gray-400'
                  }`} />
                  <h3 className={`text-lg font-semibold capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {t[role] || role}
                  </h3>
                  <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${
                    role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                    role === 'doctor' ? 'bg-blue-500/20 text-blue-400' :
                    role === 'patient' ? 'bg-green-500/20 text-green-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {Object.values(permissions).reduce((count, perms) =>
                      count + Object.values(perms).filter(Boolean).length, 0
                    )} {t.permissions || 'permissions'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                        <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                          {t.module || 'Module'}
                        </th>
                        <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                          {t.view || 'View'}
                        </th>
                        <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                          {t.create || 'Create'}
                        </th>
                        <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                          {t.edit || 'Edit'}
                        </th>
                        <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                          {t.delete || 'Delete'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(permissions).map(([module, actions]) => (
                        <tr key={module} className={`border-b ${theme === 'dark' ? 'border-slate-800' : 'border-gray-200'}`}>
                          <td className={`px-4 py-3 font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {t[module] || module}
                          </td>
                          {['view', 'create', 'edit', 'delete'].map(action => (
                            <td key={action} className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleTogglePermission(role, module, action)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                  actions[action]
                                    ? 'bg-blue-500'
                                    : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    actions[action] ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Custom Roles Section */}
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {t.customRoles || 'Custom Roles'}
                </h3>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  {t.customRolesDescription || 'Create custom roles with specific permissions tailored to your organization\'s needs.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCustomRoleForm(true);
                  setCustomRoleName('');
                  setCustomRolePermissions({
                    patients: { view: false, create: false, edit: false, delete: false },
                    appointments: { view: false, create: false, edit: false, delete: false },
                    billing: { view: false, create: false, edit: false, delete: false },
                    reports: { view: false, create: false, edit: false, delete: false },
                    settings: { view: false, create: false, edit: false, delete: false }
                  });
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t.createCustomRole || 'Create Custom Role'}
              </button>
            </div>

            {/* Custom Roles List */}
            <div className="space-y-4">
              {Object.entries(rolePermissions)
                .filter(([role]) => !['admin', 'doctor', 'nurse', 'staff', 'patient'].includes(role))
                .map(([role, permissions]) => (
                  <div key={role} className={`rounded-lg border p-6 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <Shield className="w-6 h-6 text-purple-400" />
                      <h3 className={`text-lg font-semibold capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {role}
                      </h3>
                      <span className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                        Custom Role
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400`}>
                        {Object.values(permissions).reduce((count, perms) =>
                          count + Object.values(perms).filter(Boolean).length, 0
                        )} {t.permissions || 'permissions'}
                      </span>
                      <button
                        onClick={() => {
                          setShowCustomRoleForm(true);
                          setCustomRoleName(role);
                          setCustomRolePermissions(permissions);
                        }}
                        className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                        title="Edit Role"
                      >
                        <Edit className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomRole(role)}
                        className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                        title="Delete Role"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className={`border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                            <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                              {t.module || 'Module'}
                            </th>
                            <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                              {t.view || 'View'}
                            </th>
                            <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                              {t.create || 'Create'}
                            </th>
                            <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                              {t.edit || 'Edit'}
                            </th>
                            <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                              {t.delete || 'Delete'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(permissions).map(([module, actions]) => (
                            <tr key={module} className={`border-b ${theme === 'dark' ? 'border-slate-800' : 'border-gray-200'}`}>
                              <td className={`px-4 py-3 font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {t[module] || module}
                              </td>
                              {['view', 'create', 'edit', 'delete'].map(action => (
                                <td key={action} className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePermission(role, module, action)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                      actions[action]
                                        ? 'bg-purple-500'
                                        : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        actions[action] ? 'translate-x-6' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

              {Object.keys(rolePermissions).filter(role => !['admin', 'doctor', 'nurse', 'staff', 'patient'].includes(role)).length === 0 && (
                <div className={`text-center py-12 rounded-lg border ${theme === 'dark' ? 'border-slate-700 bg-slate-800/30' : 'border-gray-200 bg-gray-50'}`}>
                  <Shield className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
                  <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.noCustomRoles || 'No custom roles created yet. Click "Create Custom Role" to get started.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveRolePermissions}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors text-white flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {t.savePermissions || 'Save Permissions'}
            </button>
          </div>
        </div>
      )}

      {/* Subscription Plans Tab */}
      {activeTab === 'plans' && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.subscriptionPlans || 'Subscription Plans'}
          </h2>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            {t.subscriptionPlansDescription || 'Choose the plan that best fits your practice needs. Upgrade or downgrade anytime.'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {subscriptionPlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl border-2 p-6 transition-all ${
                  currentPlan === plan.id
                    ? 'border-blue-500 bg-blue-500/5'
                    : theme === 'dark'
                    ? 'border-slate-700 hover:border-slate-600'
                    : 'border-gray-300 hover:border-gray-400'
                } ${plan.popular ? 'ring-2 ring-purple-500/50' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-full">
                      {t.mostPopular || 'Most Popular'}
                    </span>
                  </div>
                )}

                {currentPlan === plan.id && (
                  <div className="absolute -top-3 -right-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {t[plan.id + 'Plan'] || plan.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      ${plan.price}
                    </span>
                    <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      /{t[plan.billing] || plan.billing}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>
                      {plan.maxUsers === -1 ? (t.unlimited || 'Unlimited') : plan.maxUsers} {plan.maxUsers === 1 ? (t.user || 'user') : (t.users || 'users')}
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>
                      {plan.maxPatients === -1 ? (t.unlimited || 'Unlimited') : plan.maxPatients} {plan.maxPatients === 1 ? (t.patient || 'patient') : (t.patients || 'patients')}
                    </span>
                  </div>
                  {plan.features.ehr && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>{t.electronicHealthRecords || 'Electronic Health Records'}</span>
                    </div>
                  )}
                  {plan.features.appointments && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>{t.appointmentManagement || 'Appointment Management'}</span>
                    </div>
                  )}
                  {plan.features.billing && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>{t.billingAndClaims || 'Billing & Claims'}</span>
                    </div>
                  )}
                  {plan.features.crm && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>{t.crm || 'CRM'}</span>
                    </div>
                  )}
                  {plan.features.telehealth && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>{t.telehealth || 'Telehealth'}</span>
                    </div>
                  )}
                  {plan.features.integrations && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>{t.integrations || 'Integrations'}</span>
                    </div>
                  )}
                  {plan.features.customBranding && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>{t.customBranding || 'Custom Branding'}</span>
                    </div>
                  )}
                  {plan.features.apiAccess && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>{t.apiAccess || 'API Access'}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={async () => {
                    setCurrentPlan(plan.id);
                    setPlanTier(plan.id); // Update global plan tier
                    await updateUserPreferences({ planTier: plan.id }); // Save to backend
                    const planName = t[plan.id + 'Plan'] || plan.name;
                    await addNotification('success', `${t.switchedToPlan || 'Switched to'} ${planName}`);
                  }}
                  disabled={currentPlan === plan.id}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    currentPlan === plan.id
                      ? theme === 'dark'
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {currentPlan === plan.id ? (t.currentPlan || 'Current Plan') : (t.selectPlan || 'Select Plan')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Telehealth Integrations Tab */}
      {activeTab === 'telehealth' && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.integrations || 'Integrations'}
          </h2>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            {t.integrationsDescription || 'Configure video conferencing providers for telehealth sessions. Enable one or more providers based on your needs.'}
          </p>

          {/* Database Migration Warning */}
          {telehealthDbMissing && (
            <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className={`text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    Database Migration Required
                  </h4>
                  <p className={`text-sm ${theme === 'dark' ? 'text-yellow-300/80' : 'text-yellow-700'}`}>
                    The telehealth provider settings tables haven't been created yet. Please run the following command in your backend directory:
                  </p>
                  <code className={`block mt-2 p-2 rounded text-xs font-mono ${theme === 'dark' ? 'bg-slate-800 text-green-400' : 'bg-white text-green-600'}`}>
                    node backend/scripts/migrate-telehealth.js
                  </code>
                  <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-yellow-300/60' : 'text-yellow-600'}`}>
                    After running the migration, refresh this page to enable the telehealth integrations.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Zoom Integration */}
            <div className={`rounded-lg border p-6 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Zoom
                    </h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      Professional video conferencing
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${telehealthSettings.zoom?.is_enabled ? 'text-green-500' : theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    {telehealthSettings.zoom?.is_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => handleToggleTelehealthProvider('zoom', !telehealthSettings.zoom?.is_enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      telehealthSettings.zoom?.is_enabled
                        ? 'bg-blue-500'
                        : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        telehealthSettings.zoom?.is_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {telehealthSettings.zoom?.is_enabled && (
                <div className="mt-4 space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        API Key
                      </label>
                      <input
                        type="text"
                        value={telehealthSettings.zoom?.api_key || ''}
                        onChange={(e) => setTelehealthSettings(prev => ({
                          ...prev,
                          zoom: { ...prev.zoom, api_key: e.target.value }
                        }))}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        placeholder="Enter Zoom API Key"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        API Secret
                      </label>
                      <input
                        type="password"
                        value={telehealthSettings.zoom?.api_secret || ''}
                        onChange={(e) => setTelehealthSettings(prev => ({
                          ...prev,
                          zoom: { ...prev.zoom, api_secret: e.target.value }
                        }))}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        placeholder="Enter Zoom API Secret"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Client ID (for OAuth)
                      </label>
                      <input
                        type="text"
                        value={telehealthSettings.zoom?.client_id || ''}
                        onChange={(e) => setTelehealthSettings(prev => ({
                          ...prev,
                          zoom: { ...prev.zoom, client_id: e.target.value }
                        }))}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        placeholder="Optional - for OAuth"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Client Secret (for OAuth)
                      </label>
                      <input
                        type="password"
                        value={telehealthSettings.zoom?.client_secret || ''}
                        onChange={(e) => setTelehealthSettings(prev => ({
                          ...prev,
                          zoom: { ...prev.zoom, client_secret: e.target.value }
                        }))}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        placeholder="Optional - for OAuth"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveTelehealthSettings('zoom')}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Zoom Settings
                  </button>
                </div>
              )}
            </div>

            {/* Google Meet Integration */}
            <div className={`rounded-lg border p-6 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Google Meet
                    </h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      Google Workspace integration
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${telehealthSettings.google_meet?.is_enabled ? 'text-green-500' : theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    {telehealthSettings.google_meet?.is_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => handleToggleTelehealthProvider('google_meet', !telehealthSettings.google_meet?.is_enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                      telehealthSettings.google_meet?.is_enabled
                        ? 'bg-green-500'
                        : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        telehealthSettings.google_meet?.is_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {telehealthSettings.google_meet?.is_enabled && (
                <div className="mt-4 space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Client ID
                      </label>
                      <input
                        type="text"
                        value={telehealthSettings.google_meet?.client_id || ''}
                        onChange={(e) => setTelehealthSettings(prev => ({
                          ...prev,
                          google_meet: { ...prev.google_meet, client_id: e.target.value }
                        }))}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        placeholder="Enter Google OAuth Client ID"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Client Secret
                      </label>
                      <input
                        type="password"
                        value={telehealthSettings.google_meet?.client_secret || ''}
                        onChange={(e) => setTelehealthSettings(prev => ({
                          ...prev,
                          google_meet: { ...prev.google_meet, client_secret: e.target.value }
                        }))}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        placeholder="Enter Google OAuth Client Secret"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveTelehealthSettings('google_meet')}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Google Meet Settings
                  </button>
                </div>
              )}
            </div>

            {/* Webex Integration */}
            <div className={`rounded-lg border p-6 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Webex
                    </h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      Cisco Webex Meetings
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${telehealthSettings.webex?.is_enabled ? 'text-cyan-500' : theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    {telehealthSettings.webex?.is_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => handleToggleTelehealthProvider('webex', !telehealthSettings.webex?.is_enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
                      telehealthSettings.webex?.is_enabled
                        ? 'bg-cyan-500'
                        : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        telehealthSettings.webex?.is_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {telehealthSettings.webex?.is_enabled && (
                <div className="mt-4 space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Access Token
                      </label>
                      <input
                        type="password"
                        value={telehealthSettings.webex?.api_key || ''}
                        onChange={(e) => setTelehealthSettings(prev => ({
                          ...prev,
                          webex: { ...prev.webex, api_key: e.target.value }
                        }))}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        placeholder="Enter Webex Access Token"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Site URL (Optional)
                      </label>
                      <input
                        type="text"
                        value={telehealthSettings.webex?.settings?.site_url || ''}
                        onChange={(e) => setTelehealthSettings(prev => ({
                          ...prev,
                          webex: {
                            ...prev.webex,
                            settings: { ...prev.webex.settings, site_url: e.target.value }
                          }
                        }))}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        placeholder="e.g., yourcompany.webex.com"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveTelehealthSettings('webex')}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Webex Settings
                  </button>
                </div>
              )}
            </div>

            {/* WhatsApp Notifications */}
            <div className={`rounded-lg border p-6 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">💬</span>
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    WhatsApp Notifications
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Send appointment reminders via WhatsApp
                  </p>
                </div>
              </div>
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-white'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
                  WhatsApp notification settings will be configured per patient in their profile. Supported providers: Twilio, WhatsApp Business API.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Working Hours Tab */}
      {activeTab === 'hours' && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.workingHours || 'Working Hours'}
          </h2>
          <div className="space-y-4">
            {Object.entries(workingHours).map(([day, hours]) => (
              <div key={day} className={`flex items-center gap-4 p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                <input
                  type="checkbox"
                  checked={hours.enabled}
                  onChange={(e) => setWorkingHours({
                    ...workingHours,
                    [day]: { ...hours, enabled: e.target.checked }
                  })}
                  className="form-checkbox h-5 w-5 text-blue-500"
                />
                <span className={`w-32 capitalize font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {t[day] || day}
                </span>
                <input
                  type="time"
                  value={hours.open}
                  onChange={(e) => setWorkingHours({
                    ...workingHours,
                    [day]: { ...hours, open: e.target.value }
                  })}
                  disabled={!hours.enabled}
                  className={`px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
                    theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  } ${!hours.enabled && 'opacity-50'}`}
                />
                <span className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.to || 'to'}</span>
                <input
                  type="time"
                  value={hours.close}
                  onChange={(e) => setWorkingHours({
                    ...workingHours,
                    [day]: { ...hours, close: e.target.value }
                  })}
                  disabled={!hours.enabled}
                  className={`px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
                    theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  } ${!hours.enabled && 'opacity-50'}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={async () => {
                await addNotification('success', t.workingHoursSaved);
              }}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors text-white flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {t.saveChanges || 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Appointment Settings Tab */}
      {activeTab === 'appointments' && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.appointmentConfiguration || 'Appointment Configuration'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.defaultDurationMinutes || 'Default Duration (minutes)'}
              </label>
              <input
                type="number"
                value={appointmentSettings.defaultDuration}
                onChange={(e) => setAppointmentSettings({ ...appointmentSettings, defaultDuration: parseInt(e.target.value) })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.timeSlotIntervalMinutes || 'Time Slot Interval (minutes)'}
              </label>
              <input
                type="number"
                value={appointmentSettings.slotInterval}
                onChange={(e) => setAppointmentSettings({ ...appointmentSettings, slotInterval: parseInt(e.target.value) })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.maxAdvanceBookingDays || 'Max Advance Booking (days)'}
              </label>
              <input
                type="number"
                value={appointmentSettings.maxAdvanceBooking}
                onChange={(e) => setAppointmentSettings({ ...appointmentSettings, maxAdvanceBooking: parseInt(e.target.value) })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.cancellationDeadlineHours || 'Cancellation Deadline (hours)'}
              </label>
              <input
                type="number"
                value={appointmentSettings.cancellationDeadline}
                onChange={(e) => setAppointmentSettings({ ...appointmentSettings, cancellationDeadline: parseInt(e.target.value) })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={async () => {
                await addNotification('success', t.appointmentSettingsSaved);
              }}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors text-white flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {t.saveChanges || 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default AdminPanelView;
