import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle, Link as LinkIcon, Unlink, RefreshCw } from 'lucide-react';

const GoogleCalendarIntegration = ({ patientId, theme = 'light' }) => {
  const [calendarStatus, setCalendarStatus] = useState({
    connected: false,
    account: null
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    checkCalendarStatus();
  }, [patientId]);

  const checkCalendarStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/calendar-sync/status/${patientId}`);
      const data = await response.json();
      setCalendarStatus(data);
    } catch (error) {
      console.error('Error checking calendar status:', error);
      showMessage('error', 'Failed to check calendar status');
    } finally {
      setLoading(false);
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      const response = await fetch(`/api/calendar-sync/auth-url?patientId=${patientId}`);
      const data = await response.json();

      if (data.authUrl) {
        // Open Google OAuth in a new window
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting calendar:', error);
      showMessage('error', 'Failed to connect Google Calendar');
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Calendar?')) {
      return;
    }

    try {
      const response = await fetch(`/api/calendar-sync/disconnect/${patientId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setCalendarStatus({ connected: false, account: null });
        showMessage('success', 'Google Calendar disconnected successfully');
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      showMessage('error', 'Failed to disconnect Google Calendar');
    }
  };

  const syncAppointment = async (appointmentId) => {
    try {
      setSyncing(true);
      const response = await fetch('/api/calendar-sync/sync-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appointmentId,
          patientId
        })
      });

      if (response.ok) {
        const data = await response.json();
        showMessage('success', 'Appointment synced to Google Calendar!');
        return data;
      } else {
        throw new Error('Failed to sync appointment');
      }
    } catch (error) {
      console.error('Error syncing appointment:', error);
      showMessage('error', 'Failed to sync appointment to calendar');
      throw error;
    } finally {
      setSyncing(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  if (loading) {
    return (
      <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
          <span className={`ml-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
            Loading calendar status...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-6 h-6 text-cyan-500" />
        <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Google Calendar Integration
        </h3>
      </div>

      {message.text && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-100 border border-green-200 text-green-800'
            : 'bg-red-100 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {calendarStatus.connected ? (
          <div>
            <div className={`flex items-center gap-3 p-4 rounded-lg ${
              theme === 'dark' ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
            }`}>
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div className="flex-1">
                <p className={`font-medium ${theme === 'dark' ? 'text-green-300' : 'text-green-800'}`}>
                  Connected to Google Calendar
                </p>
                {calendarStatus.account && (
                  <div className={`text-sm mt-1 ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                    <p>{calendarStatus.account.email}</p>
                    {calendarStatus.account.name && (
                      <p className="text-xs">{calendarStatus.account.name}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={`mt-4 p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
              <h4 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Features
              </h4>
              <ul className={`text-sm space-y-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Automatically sync appointments to your Google Calendar
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Receive calendar notifications for upcoming appointments
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  View appointments across all your devices
                </li>
              </ul>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => checkCalendarStatus()}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium ${
                  theme === 'dark'
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Status
              </button>
              <button
                onClick={disconnectGoogleCalendar}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white font-medium"
              >
                <Unlink className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className={`p-4 rounded-lg mb-4 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
              <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Connect your Google Calendar to:
              </p>
              <ul className={`text-sm space-y-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-cyan-500" />
                  <span>Automatically add your medical appointments to your calendar</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-cyan-500" />
                  <span>Receive timely reminders about upcoming appointments</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-cyan-500" />
                  <span>Keep all your appointments synchronized across devices</span>
                </li>
              </ul>
            </div>

            <button
              onClick={connectGoogleCalendar}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white font-medium transition-colors"
            >
              <LinkIcon className="w-5 h-5" />
              Connect Google Calendar
            </button>

            <p className={`text-xs mt-3 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
              Your calendar data is secure and you can disconnect at any time
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Export the syncAppointment function for use in other components
export const useSyncAppointment = (patientId) => {
  const syncAppointment = async (appointmentId) => {
    try {
      const response = await fetch('/api/calendar-sync/sync-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appointmentId,
          patientId
        })
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        throw new Error('Failed to sync appointment');
      }
    } catch (error) {
      console.error('Error syncing appointment:', error);
      return { success: false, error: error.message };
    }
  };

  return { syncAppointment };
};

export default GoogleCalendarIntegration;
