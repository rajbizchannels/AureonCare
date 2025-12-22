import React, { useEffect, useState } from 'react';
import { X, Zap, Mail, MessageCircle } from 'lucide-react';
import { getTranslations } from '../../config/translations';
import ConfirmationModal from './ConfirmationModal';

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
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(true);
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Load WhatsApp notification preference
  useEffect(() => {
    const loadWhatsAppPreference = async () => {
      if (user.role === 'patient' && user.id) {
        try {
          const preferences = await api.getNotificationPreferences(user.id);
          const whatsappPref = preferences.find(p => p.channel_type === 'whatsapp');
          if (whatsappPref) {
            setWhatsappEnabled(whatsappPref.is_enabled);
            setWhatsappPhoneNumber(whatsappPref.contact_info || user.phone || '');
          } else {
            // Default to user's phone number if no preference exists
            setWhatsappPhoneNumber(user.phone || '');
          }
        } catch (error) {
          console.error('Error loading WhatsApp preference:', error);
          // Default to user's phone number on error
          setWhatsappPhoneNumber(user.phone || '');
        } finally {
          setLoadingWhatsApp(false);
        }
      } else {
        setLoadingWhatsApp(false);
      }
    };
    loadWhatsAppPreference();
  }, [user.id, user.role, user.phone, api]);

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

  const handleWhatsAppPhoneUpdate = async () => {
    try {
      await api.updateNotificationPreference(user.id, 'whatsapp', whatsappEnabled, whatsappPhoneNumber);
      await addNotification('success', 'WhatsApp phone number updated');
    } catch (error) {
      console.error('Error updating WhatsApp phone:', error);
      await addNotification('alert', 'Failed to update WhatsApp phone number');
    }
  };

  const handleSubmit = () => {
    // Show confirmation modal before saving settings
    setShowConfirmation(true);
  };

  const handleActualSubmit = async () => {
    setShowConfirmation(false);
    await addNotification('success', t.settingsSaved);
    onClose();
  };

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleActualSubmit}
        title={t.confirmSaveSettings || 'Confirm Save Settings'}
        message={t.confirmSaveSettingsMessage || 'Are you sure you want to save these settings?'}
        type="confirm"
        confirmText={t.saveChanges || 'Save Changes'}
        cancelText={t.cancel || 'Cancel'}
      />
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
                  <button
                    type="button"
                    onClick={async () => {
                      const newValue = !(user.preferences?.emailNotifications ?? true);
                      await updateUserPreferences({ emailNotifications: newValue });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      (user.preferences?.emailNotifications ?? true)
                        ? 'bg-blue-500'
                        : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (user.preferences?.emailNotifications ?? true) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>SMS Alerts</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.getTextReminders}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const newValue = !(user.preferences?.smsAlerts ?? true);
                      await updateUserPreferences({ smsAlerts: newValue });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      (user.preferences?.smsAlerts ?? true)
                        ? 'bg-blue-500'
                        : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (user.preferences?.smsAlerts ?? true) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {/* WhatsApp Notifications - Patient only */}
                {user.role === 'patient' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                          <MessageCircle className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>WhatsApp Notifications</p>
                          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Get appointment reminders via WhatsApp</p>
                        </div>
                      </div>
                      <button
                        disabled={loadingWhatsApp}
                        onClick={async () => {
                          const newValue = !whatsappEnabled;
                          setWhatsappEnabled(newValue);
                          try {
                            await api.updateNotificationPreference(user.id, 'whatsapp', newValue, whatsappPhoneNumber);
                            await addNotification('success', `WhatsApp notifications ${newValue ? 'enabled' : 'disabled'}`);
                          } catch (error) {
                            console.error('Error updating WhatsApp preference:', error);
                            setWhatsappEnabled(!newValue); // Revert on error
                            await addNotification('alert', 'Failed to update WhatsApp preference');
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                          whatsappEnabled
                            ? 'bg-green-500'
                            : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                        } ${loadingWhatsApp ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            whatsappEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* WhatsApp Phone Number Input */}
                    {whatsappEnabled && (
                      <div className="ml-14 mt-3 animate-fadeIn">
                        <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          {t.whatsappPhoneNumber || 'WhatsApp Phone Number'}
                        </label>
                        <input
                          type="tel"
                          value={whatsappPhoneNumber}
                          onChange={(e) => setWhatsappPhoneNumber(e.target.value)}
                          onBlur={handleWhatsAppPhoneUpdate}
                          placeholder="+1 (555) 123-4567"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                            theme === 'dark'
                              ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                          }`}
                        />
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                          {t.whatsappPhoneHint || 'Include country code (e.g., +1 for US)'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.pushNotifications}</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.browserNotifications}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const newValue = !(user.preferences?.pushNotifications ?? true);
                      await updateUserPreferences({ pushNotifications: newValue });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      (user.preferences?.pushNotifications ?? true)
                        ? 'bg-blue-500'
                        : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (user.preferences?.pushNotifications ?? true) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
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
                  <button
                    type="button"
                    onClick={async () => {
                      const isDark = theme !== 'dark';
                      setTheme(isDark ? 'dark' : 'light');
                      await updateUserPreferences({ darkMode: isDark });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-blue-500'
                        : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
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
          </div>
                  </div>
                  <div>
                    <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {t.dataBackup || 'Data Backup'}
                    </h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.backupDescription || 'Export and backup all system data'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Local Backup */}
                  <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'}`}>
                          <Download className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {t.localBackup || 'Local Hard Drive'}
                          </p>
                          <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                            {t.downloadBackupFile || 'Download backup as JSON file'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleLocalBackup}
                        disabled={backupLoading.local}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                          backupLoading.local
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {backupLoading.local ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {t.backing || 'Backing up...'}
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            {t.backup || 'Backup'}
                          </>
                        )}
                      </button>
                    </div>
                    {lastBackup.local && (
                      <p className={`text-xs ml-11 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                        Last backup: {new Date(lastBackup.local).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Google Drive Backup */}
                  <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                          <Cloud className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {t.googleDriveBackup || 'Google Drive'}
                          </p>
                          <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                            {t.backupToGoogleDrive || 'Backup to your Google Drive'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleGoogleDriveBackup}
                        disabled={backupLoading.googleDrive}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                          backupLoading.googleDrive
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                      >
                        {backupLoading.googleDrive ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {t.backing || 'Backing up...'}
                          </>
                        ) : (
                          <>
                            <Cloud className="w-4 h-4" />
                            {t.backup || 'Backup'}
                          </>
                        )}
                      </button>
                    </div>
                    {lastBackup.googleDrive && (
                      <p className={`text-xs ml-11 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                        Last backup: {new Date(lastBackup.googleDrive).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* OneDrive Backup */}
                  <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                          <Cloud className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {t.oneDriveBackup || 'OneDrive'}
                          </p>
                          <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                            {t.backupToOneDrive || 'Backup to your OneDrive'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleOneDriveBackup}
                        disabled={backupLoading.oneDrive}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                          backupLoading.oneDrive
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-purple-500 hover:bg-purple-600 text-white'
                        }`}
                      >
                        {backupLoading.oneDrive ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {t.backing || 'Backing up...'}
                          </>
                        ) : (
                          <>
                            <Cloud className="w-4 h-4" />
                            {t.backup || 'Backup'}
                          </>
                        )}
                      </button>
                    </div>
                    {lastBackup.oneDrive && (
                      <p className={`text-xs ml-11 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                        Last backup: {new Date(lastBackup.oneDrive).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className={`mt-4 p-3 rounded-lg border-l-4 border-yellow-500 ${theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
                  <p className={`text-sm ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                    <strong>Note:</strong> Backups include all patients, appointments, claims, medical records, and system settings. Keep your backups secure and confidential.
                  </p>
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
            onClick={handleSubmit}
            className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            {t.saveChanges}
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default SettingsModal;
