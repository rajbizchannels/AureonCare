import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Phone, Edit2, Check } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { getTranslations } from '../../config/translations';
import { useAudit } from '../../hooks/useAudit';
import { isPhoneValid, validateOptionalPhone } from '../../utils/validators';

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
  language
}) => {
  const { logModalOpen, logModalClose, logError, startAction } = useAudit();
  const t = getTranslations(language || 'en');
  // Local state for password change
  const [localPasswordData, setLocalPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);

  // WhatsApp state — defaults to the user's phone number
  const [whatsappNumber, setWhatsappNumber] = useState(
    user?.preferences?.whatsappNumber ?? user?.phone ?? ''
  );
  const [editingWhatsapp, setEditingWhatsapp] = useState(false);
  const [whatsappDraft, setWhatsappDraft] = useState('');
  const [whatsappDraftError, setWhatsappDraftError] = useState('');

  // Log modal open on mount
  useEffect(() => {
    startAction();
    logModalOpen('UserProfileModal', {
      module: 'Profile',
      metadata: {
        userId: user?.id,
        userRole: user?.role,
      },
    });
  }, [logModalOpen, startAction, user?.id, user?.role]);

  // Handle close with audit logging
  const handleClose = () => {
    logModalClose('UserProfileModal', {
      module: 'Profile',
      metadata: {
        userId: user?.id,
        userRole: user?.role,
      },
    });
    setShowChangePassword(false);
    onClose();
  };

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [handleClose]);

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
      logError('UserProfileModal', 'modal', error.message, {
        module: 'Profile',
        metadata: {
          userId: user?.id,
        },
      });
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
      <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={handleClose}>
        <div className={`rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.userProfile || 'User Profile'}</h2>
          <button onClick={handleClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
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
                <button
                  type="button"
                  onClick={async () => {
                    const newValue = !(user.preferences?.emailNotifications ?? true);
                    const success = await updateUserPreferences({ emailNotifications: newValue });
                    if (success) {
                      await addNotification('success', t.preferenceSaved);
                    }
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
                <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.smsAlerts || 'SMS Alerts'}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const newValue = !(user.preferences?.smsAlerts ?? true);
                    const success = await updateUserPreferences({ smsAlerts: newValue });
                    if (success) {
                      await addNotification('success', t.preferenceSaved);
                    }
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
              {/* WhatsApp Number + Notification Toggle */}
              <div className={`rounded-lg p-3 space-y-3 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle className="w-4 h-4 text-green-500" />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                    WhatsApp
                  </span>
                </div>

                {/* WhatsApp number field */}
                <div className="flex items-center gap-2">
                  <Phone className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                  {editingWhatsapp ? (
                    <>
                      <div className="flex-1 flex flex-col gap-1">
                        <input
                          type="tel"
                          value={whatsappDraft}
                          onChange={e => { setWhatsappDraft(e.target.value); setWhatsappDraftError(''); }}
                          placeholder="+1 555 000 0000"
                          className={`w-full text-sm px-2 py-1 rounded border focus:outline-none ${
                            whatsappDraftError
                              ? 'border-red-500 focus:border-red-500'
                              : 'focus:border-green-500'
                          } ${
                            theme === 'dark'
                              ? 'bg-slate-600 border-slate-500 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                          autoFocus
                        />
                        {whatsappDraftError && (
                          <p className="text-xs text-red-500">{whatsappDraftError}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const trimmed = whatsappDraft.trim();
                          const err = validateOptionalPhone(trimmed);
                          if (err) { setWhatsappDraftError(err); return; }
                          setWhatsappNumber(trimmed);
                          setEditingWhatsapp(false);
                          setWhatsappDraftError('');
                          const success = await updateUserPreferences({ whatsappNumber: trimmed });
                          if (success) await addNotification('success', t.preferenceSaved || 'Preference saved');
                        }}
                        className="p-1 rounded text-green-500 hover:bg-green-500/10 transition-colors flex-shrink-0"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingWhatsapp(false); setWhatsappDraftError(''); }}
                        className={`p-1 rounded transition-colors flex-shrink-0 ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-600' : 'text-gray-400 hover:bg-gray-200'}`}
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        {whatsappNumber || (t.notApplicable || 'N/A')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsappDraft(whatsappNumber);
                          setEditingWhatsapp(true);
                        }}
                        className={`p-1 rounded transition-colors ${
                          theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Edit WhatsApp number"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* WhatsApp notifications toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t.whatsappNotifications || 'WhatsApp Notifications'}
                    </span>
                    {!isPhoneValid(whatsappNumber) && (
                      <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                        {whatsappNumber ? 'Enter a valid WhatsApp number' : 'Enter a WhatsApp number first'}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!isPhoneValid(whatsappNumber)}
                    onClick={async () => {
                      if (!isPhoneValid(whatsappNumber)) return;
                      const newValue = !(user.preferences?.whatsappNotifications ?? false);
                      const success = await updateUserPreferences({ whatsappNotifications: newValue });
                      if (success) await addNotification('success', t.preferenceSaved || 'Preference saved');
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      !isPhoneValid(whatsappNumber)
                        ? `opacity-40 cursor-not-allowed ${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'}`
                        : (user.preferences?.whatsappNotifications && isPhoneValid(whatsappNumber))
                          ? 'bg-green-500 cursor-pointer'
                          : `cursor-pointer ${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'}`
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (user.preferences?.whatsappNotifications && isPhoneValid(whatsappNumber)) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.darkMode || 'Dark Mode'}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const isDark = theme !== 'dark';
                    setTheme(isDark ? 'dark' : 'light');
                    const success = await updateUserPreferences({ darkMode: isDark });
                    if (success) {
                      await addNotification('success', t.themePreferenceSaved);
                    }
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
            <button onClick={handleClose} className={`flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
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
