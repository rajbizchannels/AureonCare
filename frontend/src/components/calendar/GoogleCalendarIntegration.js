import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle, Link as LinkIcon, RefreshCw, Unlink } from 'lucide-react';

import api from '../../api/apiService';
import { markOAuthDeparture } from '../../context/AppContext';
import ConfirmationModal from '../modals/ConfirmationModal';
import { useCalendarSync } from './useCalendarSync';

/**
 * Lets a patient connect their Google Calendar so appointments can be pushed to
 * it. Every call goes through apiService, which attaches the Bearer token —
 * /api/calendar-sync is authenticated and authorises the caller against the
 * patient in the path.
 */
const GoogleCalendarIntegration = ({ patientId, theme = 'light', addNotification, sync }) => {
  const dark = theme === 'dark';

  // The parent may already hold the status (the portal does, to decide whether
  // to offer per-appointment buttons); share it rather than asking twice.
  const ownSync = useCalendarSync(sync ? null : patientId);
  const { configured, connected, account, loading, refresh, setStatus } = sync || ownSync;

  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
    if (addNotification) addNotification(type === 'error' ? 'alert' : type, text);
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  }, [addNotification]);

  // The OAuth callback returns the browser here with a result in the query.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('calendar_connected');
    const failure = params.get('calendar_error');
    if (!connected && !failure) return;

    if (connected) {
      showMessage('success', 'Google Calendar connected successfully');
      refresh();
    } else {
      const reasons = {
        not_configured: 'Google Calendar sync is not configured on this server',
        missing_code: 'Google did not return an authorization code',
        invalid_state: 'The authorization link expired — please try again',
        exchange_failed: 'Could not complete the Google authorization'
      };
      showMessage('error', reasons[failure] || 'Failed to connect Google Calendar');
    }

    params.delete('calendar_connected');
    params.delete('calendar_error');
    const query = params.toString();
    window.history.replaceState({}, document.title, window.location.pathname + (query ? `?${query}` : ''));
  }, [showMessage, refresh]);

  const connectGoogleCalendar = async () => {
    try {
      setConnecting(true);
      const authUrl = await api.getCalendarAuthUrl(patientId);
      if (authUrl) {
        // Keeps the session alive across the round trip to Google.
        markOAuthDeparture();
        window.location.href = authUrl;
      }
    } catch (error) {
      console.error('Error connecting calendar:', error);
      showMessage('error', error.message || 'Failed to connect Google Calendar');
      setConnecting(false);
    }
  };

  const disconnectGoogleCalendar = async () => {
    setConfirmDisconnect(false);
    try {
      await api.disconnectCalendarSync(patientId);
      setStatus(prev => ({ ...prev, connected: false, account: null }));
      showMessage('success', 'Google Calendar disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      showMessage('error', error.message || 'Failed to disconnect Google Calendar');
    }
  };

  const panel = `p-5 rounded-xl border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`;
  const heading = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-slate-400' : 'text-gray-500';

  if (!configured) return null;

  if (loading) {
    return (
      <div className={panel}>
        <div className={`flex items-center justify-center gap-2 ${muted}`}>
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-500" />
          Loading calendar status…
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={disconnectGoogleCalendar}
        title="Disconnect Google Calendar"
        message="Appointments will stop syncing to your Google Calendar. Events already added stay in your calendar."
        type="warning"
        confirmText="Disconnect"
        cancelText="Cancel"
      />

      <div className={panel}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <Calendar className="w-6 h-6 text-cyan-500 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className={`font-semibold ${heading}`}>Google Calendar</h3>
              <p className={`text-sm ${muted}`}>Add your appointments to your own calendar</p>
            </div>
          </div>
          {connected ? (
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium flex-shrink-0 ${
              dark ? 'bg-green-500/15 text-green-300 border-green-500/30' : 'bg-green-50 text-green-700 border-green-200'
            }`}>
              <CheckCircle className="w-3.5 h-3.5" /> Connected
            </span>
          ) : (
            <span className={`px-2.5 py-1 rounded-full border text-xs font-medium flex-shrink-0 ${
              dark ? 'bg-slate-700/50 text-slate-300 border-slate-600' : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              Not connected
            </span>
          )}
        </div>

        {message.text && (
          <div className={`mb-4 rounded-lg border px-3 py-2 flex items-start gap-2 text-sm ${
            message.type === 'error'
              ? dark ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
              : dark ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            {message.type === 'error'
              ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <span>{message.text}</span>
          </div>
        )}

        {connected ? (
          <div className="space-y-4">
            <div className={`rounded-lg px-3 py-2.5 ${dark ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
              {account?.email && (
                <p className={`text-sm ${heading}`}>{account.email}</p>
              )}
              {account?.connectedAt && (
                <p className={`text-xs mt-0.5 ${muted}`}>
                  Connected {new Date(account.connectedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={() => setConfirmDisconnect(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Unlink className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectGoogleCalendar}
            disabled={connecting}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {connecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
            {connecting ? 'Redirecting…' : 'Connect Google Calendar'}
          </button>
        )}
      </div>
    </>
  );
};

export default GoogleCalendarIntegration;
