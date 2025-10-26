import React, { useEffect } from 'react';
import { X, Zap, Mail, Plus, Edit, Trash2, Check, XCircle } from 'lucide-react';

const SettingsModal = ({
  theme,
  user,
  users,
  language,
  onClose,
  setCurrentView,
  updateUserPreferences,
  setTheme,
  setLanguage,
  setShowForm,
  setEditingItem,
  setUsers,
  setCurrentModule,
  api,
  addNotification
}) => {
  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose]);

  return (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
      <div className={`rounded-xl border max-w-3xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-6">
            {/* Admin Panel Access (only for admins) */}
            {user.role === 'admin' && (
              <div className={`rounded-lg p-6 border-2 border-purple-500/30 ${theme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Admin Panel</h3>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      Manage clinic settings, users, and system configuration
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      setCurrentModule('admin');
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors text-white"
                  >
                    Open Admin Panel
                  </button>
                </div>
              </div>
            )}

            {/* General Settings */}
            <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>General Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Email Notifications</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Receive email updates for appointments and tasks</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={user.preferences?.emailNotifications ?? true}
                    onChange={async (e) => {
                      await updateUserPreferences({ emailNotifications: e.target.checked });
                    }}
                    className="form-checkbox h-5 w-5 text-cyan-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>SMS Alerts</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Get text message reminders</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={user.preferences?.smsAlerts ?? true}
                    onChange={async (e) => {
                      await updateUserPreferences({ smsAlerts: e.target.checked });
                    }}
                    className="form-checkbox h-5 w-5 text-cyan-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Push Notifications</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Browser notifications for important updates</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={user.preferences?.pushNotifications ?? true}
                    onChange={async (e) => {
                      await updateUserPreferences({ pushNotifications: e.target.checked });
                    }}
                    className="form-checkbox h-5 w-5 text-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Appearance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Dark Mode</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Use dark theme</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={theme === 'dark'}
                    onChange={async (e) => {
                      const isDark = e.target.checked;
                      setTheme(isDark ? 'dark' : 'light');
                      await updateUserPreferences({ darkMode: isDark });
                    }}
                    className="form-checkbox h-5 w-5 text-cyan-500"
                  />
                </div>
                <div>
                  <label className={`block font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Language</label>
                  <select
                    value={language}
                    onChange={async (e) => {
                      const newLanguage = e.target.value;
                      setLanguage(newLanguage);
                      await updateUserPreferences({ language: newLanguage });
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Privacy & Security */}
            <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Privacy & Security</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Two-Factor Authentication</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Enhanced account security</p>
                  </div>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm">Enabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Session Timeout</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Auto logout after inactivity</p>
                  </div>
                  <select className={`px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}>
                    <option value="15">15 minutes</option>
                    <option value="30" defaultValue>30 minutes</option>
                    <option value="60">1 hour</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Integration Settings */}
            <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Integrations</h3>
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Calendar Sync</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Google Calendar integration</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors">
                    Connected
                  </button>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Email Provider</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Gmail integration</p>
                    </div>
                  </div>
                  <button className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                    Connect
                  </button>
                </div>
              </div>
            </div>

            {/* User Management */}
            {user.role === 'admin' && (
              <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>User Management</h3>
                  <button
                    onClick={() => setShowForm('user')}
                    className={`flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    <Plus className="w-4 h-4" />
                    Add User
                  </button>
                </div>
                <div className="space-y-3">
                  {users.map((u) => (
                    <div key={u.id} className={`flex items-center justify-between p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {u.avatar || u.name?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{u.name}</p>
                          <p className={`text-sm capitalize ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{u.role} • {u.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingItem({ type: 'user', data: u });
                            setCurrentView('edit');
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-gray-300'}`}
                          title="Edit"
                        >
                          <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                        </button>
                        <button
                          onClick={async () => {
                            if (u.id === user.id) {
                              alert('You cannot delete your own account');
                              return;
                            }
                            if (window.confirm(`Are you sure you want to delete ${u.name}?`)) {
                              try {
                                await api.deleteUser(u.id);
                                setUsers(prev => prev.filter(usr => usr.id !== u.id));
                                await addNotification('alert', 'User deleted successfully');
                              } catch (err) {
                                console.error('Error deleting user:', err);
                                alert('Failed to delete user');
                              }
                            }
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-gray-300'}`}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <p className={`text-center py-8 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      No users found. Click "Add User" to create one.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Roles & Permissions */}
            {user.role === 'admin' && (
              <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Roles & Permissions</h3>
                <div className="space-y-4">
                  {/* Admin Role */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Administrator</h4>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Full access to all features and settings
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium">
                        {users.filter(u => u.role === 'admin').length} users
                      </span>
                    </div>
                    <div className={`grid grid-cols-2 gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>User Management</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>All Modules</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>System Settings</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Reports & Analytics</span>
                      </div>
                    </div>
                  </div>

                  {/* Doctor Role */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Doctor</h4>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Access to patient records and clinical features
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium">
                        {users.filter(u => u.role === 'doctor').length} users
                      </span>
                    </div>
                    <div className={`grid grid-cols-2 gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Patient Records</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Appointments</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>EHR & Telehealth</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span>User Management</span>
                      </div>
                    </div>
                  </div>

                  {/* Staff Role */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Staff</h4>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Access to appointments and basic features
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium">
                        {users.filter(u => u.role === 'staff' || u.role === 'user').length} users
                      </span>
                    </div>
                    <div className={`grid grid-cols-2 gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Appointments</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Patient Search</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span>Patient Records</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span>System Settings</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6 p-6 pt-0">
          <button
            onClick={onClose}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
          >
            Close
          </button>
          <button
            onClick={async () => {
              await addNotification('success', 'Settings saved successfully');
              onClose();
            }}
            className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
