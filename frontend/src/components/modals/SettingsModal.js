import React, { useEffect } from 'react';
import { X, Zap, Mail } from 'lucide-react';
import { getTranslations } from '../../config/translations';

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
  const t = getTranslations(language);
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
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.settings}</h2>
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
                    <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.adminPanel}</h3>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.manageClinicSettings}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      setCurrentModule('admin');
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors text-white"
                  >
                    {t.openAdminPanel}
                  </button>
                </div>
              </div>
            )}

            {/* General Settings */}
            <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.generalSettings}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.notifications}</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.receiveEmailUpdates}</p>
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
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.getTextReminders}</p>
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
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.pushNotifications}</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.browserNotifications}</p>
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
              <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.appearance}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.darkMode}</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.useDarkTheme}</p>
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
              </div>
            </div>

            {/* Privacy & Security - Admin Only */}
            {user.role === 'admin' && (
              <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.privacySecurity}</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.twoFactorAuth}</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.enhancedSecurity}</p>
                    </div>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm">{t.enabled}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.sessionTimeout}</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.autoLogout}</p>
                    </div>
                    <select className={`px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}>
                      <option value="15">{t.fifteenMinutes}</option>
                      <option value="30" defaultValue>{t.thirtyMinutes}</option>
                      <option value="60">{t.oneHour}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Integration Settings - Admin Only */}
            {user.role === 'admin' && (
              <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.integrations}</h3>
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.calendarSync}</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.googleCalendarIntegration}</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors">
                    {t.connected}
                  </button>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.emailProvider}</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.gmailIntegration}</p>
                    </div>
                  </div>
                  <button className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                    {t.connect}
                  </button>
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
            {t.close}
          </button>
          <button
            onClick={async () => {
              await addNotification('success', t.settingsSaved);
              onClose();
            }}
            className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            {t.saveChanges}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
