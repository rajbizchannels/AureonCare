import React, { useState, useEffect } from 'react';
import { Settings, Users, Clock, Building2, Save, Edit, Trash2, UserPlus, Shield } from 'lucide-react';

const AdminPanelView = ({
  theme,
  users,
  setUsers,
  setShowForm,
  setEditingItem,
  setCurrentView,
  api,
  addNotification
}) => {
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
    }
  });

  const handleSaveClinicSettings = async () => {
    try {
      // In a real app, this would call an API endpoint
      await addNotification('success', 'Clinic settings saved successfully');
    } catch (error) {
      await addNotification('alert', 'Failed to save clinic settings');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      await addNotification('success', 'User deleted successfully');
    } catch (error) {
      await addNotification('alert', 'Failed to delete user');
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
      await addNotification('success', 'Role permissions saved successfully');
    } catch (error) {
      console.error('Error saving permissions:', error);
      await addNotification('alert', 'Failed to save role permissions');
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
    { id: 'hours', label: 'Working Hours', icon: Clock },
    { id: 'appointments', label: 'Appointment Settings', icon: Settings }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Admin Panel
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Manage clinic settings and users
          </p>
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
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {user.specialty || 'N/A'}
                    </td>
                    <td className={`px-4 py-3`}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingItem({ type: 'user', data: user });
                            setCurrentView('edit');
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                        >
                          <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
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
                    'text-gray-400'
                  }`} />
                  <h3 className={`text-lg font-semibold capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {role}
                  </h3>
                  <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${
                    role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                    role === 'doctor' ? 'bg-blue-500/20 text-blue-400' :
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
                await addNotification('success', 'Working hours saved successfully');
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
                await addNotification('success', 'Appointment settings saved successfully');
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
