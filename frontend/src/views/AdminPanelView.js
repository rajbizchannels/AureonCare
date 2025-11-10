import React, { useState, useEffect } from 'react';
import { Settings, Users, Clock, Building2, Save, Edit, Trash2, UserPlus, Shield, Lock, Unlock, CheckCircle, ArrowLeft, CreditCard, Check } from 'lucide-react';
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
  const { setPlanTier, updateUserPreferences } = useApp();
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

  const [currentPlan, setCurrentPlan] = useState('professional');

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
    if (!window.confirm('Are you sure you want to delete this user?')) return;

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

    if (!window.confirm(`Are you sure you want to ${actionText} this user?`)) return;

    try {
      const updatedUser = await api.updateUser(userId, { status: newStatus });
      setUsers(users.map(u => u.id === userId ? updatedUser : u));
      await addNotification('success', `User ${actionText}ed successfully`);
    } catch (error) {
      await addNotification('alert', `Failed to ${actionText} user`);
    }
  };

  const handleApproveUser = async (userId) => {
    if (!window.confirm('Are you sure you want to approve this user?')) return;

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

  const tabs = [
    { id: 'clinic', label: 'Clinic Settings', icon: Building2 },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'roles', label: 'Roles & Permissions', icon: Shield },
    { id: 'plans', label: 'Subscription Plans', icon: CreditCard },
    { id: 'hours', label: 'Working Hours', icon: Clock },
    { id: 'appointments', label: 'Appointment Settings', icon: Settings }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title="Back to Dashboard"
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
          <div>
            <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Admin Panel
            </h1>
            <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Manage clinic settings and users
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
            Clinic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Clinic Name
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
                Phone
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
                Address
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
                Email
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
                Website
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
                Tax ID
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
                NPI Number
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
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Users ({users.length})
            </h2>
            <button
              onClick={() => setShowForm('user')}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors text-white flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add User
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Name</th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Email</th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Role</th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Specialty</th>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
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
                        {user.role}
                      </span>
                    </td>
                    <td className={`px-4 py-3`}>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                        user.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        user.status === 'blocked' ? 'bg-red-500/20 text-red-400' :
                        user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {user.status || 'active'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {user.specialty || 'N/A'}
                    </td>
                    <td className={`px-4 py-3`}>
                      <div className="flex items-center gap-2">
                        {user.status === 'pending' && (
                          <button
                            onClick={() => handleApproveUser(user.id)}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title="Approve User"
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
                          title="Edit User"
                        >
                          <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                        </button>
                        {user.status !== 'pending' && (
                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.status || 'active')}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title={(user.status || 'active') === 'blocked' ? 'Unblock User' : 'Block User'}
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
                          title="Delete User"
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
            Role Permissions
          </h2>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Configure what each role can do in the system. Check or uncheck permissions for each role.
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
                    {role}
                  </h3>
                  <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${
                    role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                    role === 'doctor' ? 'bg-blue-500/20 text-blue-400' :
                    role === 'patient' ? 'bg-green-500/20 text-green-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {Object.values(permissions).reduce((count, perms) =>
                      count + Object.values(perms).filter(Boolean).length, 0
                    )} permissions
                  </span>
                </div>

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
                      {Object.entries(permissions).map(([module, actions]) => (
                        <tr key={module} className={`border-b ${theme === 'dark' ? 'border-slate-800' : 'border-gray-200'}`}>
                          <td className={`px-4 py-3 font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {module}
                          </td>
                          {['view', 'create', 'edit', 'delete'].map(action => (
                            <td key={action} className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={actions[action]}
                                onChange={() => handleTogglePermission(role, module, action)}
                                className="form-checkbox h-5 w-5 text-blue-500"
                              />
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

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveRolePermissions}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors text-white flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Permissions
            </button>
          </div>
        </div>
      )}

      {/* Subscription Plans Tab */}
      {activeTab === 'plans' && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Subscription Plans
          </h2>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Choose the plan that best fits your practice needs. Upgrade or downgrade anytime.
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
                      Most Popular
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
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      ${plan.price}
                    </span>
                    <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      /{plan.billing}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>
                      {plan.maxUsers === -1 ? 'Unlimited' : plan.maxUsers} user{plan.maxUsers !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>
                      {plan.maxPatients === -1 ? 'Unlimited' : plan.maxPatients} patient{plan.maxPatients !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {plan.features.ehr && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>Electronic Health Records</span>
                    </div>
                  )}
                  {plan.features.appointments && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>Appointment Management</span>
                    </div>
                  )}
                  {plan.features.billing && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>Billing & Claims</span>
                    </div>
                  )}
                  {plan.features.crm && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>CRM</span>
                    </div>
                  )}
                  {plan.features.telehealth && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>Telehealth</span>
                    </div>
                  )}
                  {plan.features.integrations && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>Integrations</span>
                    </div>
                  )}
                  {plan.features.customBranding && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>Custom Branding</span>
                    </div>
                  )}
                  {plan.features.apiAccess && (
                    <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span>API Access</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={async () => {
                    setCurrentPlan(plan.id);
                    setPlanTier(plan.id); // Update global plan tier
                    await updateUserPreferences({ planTier: plan.id }); // Save to backend
                    await addNotification('success', `Switched to ${plan.name}`);
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
                  {currentPlan === plan.id ? 'Current Plan' : 'Select Plan'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Working Hours Tab */}
      {activeTab === 'hours' && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Working Hours
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
                  {day}
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
                <span className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>to</span>
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
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Appointment Settings Tab */}
      {activeTab === 'appointments' && (
        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Appointment Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Default Duration (minutes)
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
                Time Slot Interval (minutes)
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
                Max Advance Booking (days)
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
                Cancellation Deadline (hours)
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
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanelView;
