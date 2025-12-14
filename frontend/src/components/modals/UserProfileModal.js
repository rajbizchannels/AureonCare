import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import Toggle from '../Toggle';

const UserProfileModal = ({
  theme,
  user,
  onClose,
  setCurrentView,
  setEditingItem,
  showChangePassword,
  setShowChangePassword,
  updateUserPreferences,
  setTheme,
  api,
  addNotification,
  t
}) => {
  // Local state for password change
  const [localPasswordData, setLocalPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
        setShowChangePassword(false);
      }
    };
    window.addEventListener('keydown', handleEsc, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose, setShowChangePassword]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    // Validation
    if (!localPasswordData.currentPassword || !localPasswordData.newPassword || !localPasswordData.confirmPassword) {
      await addNotification('alert', t.fillAllPasswordFields);
      return;
    }

    if (localPasswordData.newPassword !== localPasswordData.confirmPassword) {
      await addNotification('alert', t.passwordsDoNotMatch);
      return;
    }

    if (localPasswordData.newPassword.length < 6) {
      await addNotification('alert', t.passwordTooShort);
      return;
    }

    // Show confirmation modal before changing password
    setShowConfirmation(true);
  };

  const handleActualPasswordChange = async () => {
    setShowConfirmation(false);

    try {
      await api.changePassword(user.id, localPasswordData.currentPassword, localPasswordData.newPassword);
      await addNotification('success', t.passwordChanged);
      setLocalPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowChangePassword(false);
    } catch (error) {
      await addNotification('alert', error.message || t.failedToChangePassword);
    }
  };

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleActualPasswordChange}
        title={t.confirmPasswordChange || 'Confirm Password Change'}
        message={t.confirmPasswordChangeMessage || 'Are you sure you want to change your password?'}
        type="confirm"
        confirmText={t.updatePassword || 'Update Password'}
        cancelText={t.cancel || 'Cancel'}
      />
      <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
        <div className={`rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.userProfile || 'User Profile'}</h2>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-6">
          <div className="flex items-center gap-4">
            <div className={`w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {user.avatar}
            </div>
            <div>
              <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.name}</h3>
              <p className={`capitalize ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{user.role}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>{user.practice}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.firstName || 'First Name'}</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.firstName || t.notApplicable || 'N/A'}</p>
            </div>
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.lastName || 'Last Name'}</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.lastName || t.notApplicable || 'N/A'}</p>
            </div>
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.role || 'Role'}</p>
              <p className={`capitalize font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.role || t.notApplicable || 'N/A'}</p>
            </div>
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.email || 'Email'}</p>
              <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.email || t.notApplicable || 'N/A'}</p>
            </div>
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.phone || 'Phone'}</p>
              <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.phone || t.notApplicable || 'N/A'}</p>
            </div>
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.license || 'License'}</p>
              <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.license || t.notApplicable || 'N/A'}</p>
            </div>
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.specialty || 'Specialty'}</p>
              <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.specialty || t.notApplicable || 'N/A'}</p>
            </div>
          </div>

          <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
            <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.preferences || 'Preferences'}</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.emailNotifications || 'Email Notifications'}</span>
                <Toggle
                  checked={user.preferences?.emailNotifications ?? true}
                  onChange={async (checked) => {
                    const success = await updateUserPreferences({ emailNotifications: checked });
                    if (success) {
                      await addNotification('success', t.preferenceSaved);
                    }
                  }}
                  theme={theme}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.smsAlerts || 'SMS Alerts'}</span>
                <Toggle
                  checked={user.preferences?.smsAlerts ?? true}
                  onChange={async (checked) => {
                    const success = await updateUserPreferences({ smsAlerts: checked });
                    if (success) {
                      await addNotification('success', t.preferenceSaved);
                    }
                  }}
                  theme={theme}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.darkMode || 'Dark Mode'}</span>
                <Toggle
                  checked={theme === 'dark'}
                  onChange={async (checked) => {
                    setTheme(checked ? 'dark' : 'light');
                    const success = await updateUserPreferences({ darkMode: checked });
                    if (success) {
                      await addNotification('success', t.themePreferenceSaved);
                    }
                  }}
                  theme={theme}
                />
              </div>
            </div>
          </div>

          {/* Change Password Section */}
          <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.security || 'Security'}</h4>
              <button
                onClick={() => {
                  setShowChangePassword(!showChangePassword);
                  if (!showChangePassword) {
                    setLocalPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  showChangePassword
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                    : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
                }`}
              >
                {showChangePassword ? (t.cancel || 'Cancel') : (t.changePassword || 'Change Password')}
              </button>
            </div>

            {showChangePassword && (
              <form onSubmit={handlePasswordChange} className="space-y-3 mt-4">
                <div>
                  <label className={`block text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.currentPassword || 'Current Password'}
                  </label>
                  <input
                    type="password"
                    value={localPasswordData.currentPassword}
                    onChange={(e) => setLocalPasswordData({ ...localPasswordData, currentPassword: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${
                      theme === 'dark'
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.newPassword || 'New Password'}
                  </label>
                  <input
                    type="password"
                    value={localPasswordData.newPassword}
                    onChange={(e) => setLocalPasswordData({ ...localPasswordData, newPassword: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${
                      theme === 'dark'
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.confirmNewPassword || 'Confirm New Password'}
                  </label>
                  <input
                    type="password"
                    value={localPasswordData.confirmPassword}
                    onChange={(e) => setLocalPasswordData({ ...localPasswordData, confirmPassword: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${
                      theme === 'dark'
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                    minLength={6}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors text-white"
                >
                  {t.updatePassword || 'Update Password'}
                </button>
              </form>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setCurrentView('edit');
                setEditingItem({ type: 'userProfile', data: user });
              }}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
            >
              {t.editProfile || 'Edit Profile'}
            </button>
            <button onClick={onClose} className={`flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t.close || 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default UserProfileModal;
