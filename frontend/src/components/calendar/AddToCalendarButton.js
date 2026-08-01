import React, { useState } from 'react';
import { CalendarPlus, Check, RefreshCw } from 'lucide-react';

import api from '../../api/apiService';
import ConfirmationModal from '../modals/ConfirmationModal';

/**
 * Pushes one appointment to the patient's connected Google Calendar and
 * confirms it in a themed dialog.
 *
 * Renders nothing unless the calendar is actually connected — there is no
 * half-state to explain to a patient.
 */
const AddToCalendarButton = ({ appointmentId, patientId, connected, theme = 'light', addNotification }) => {
  const dark = theme === 'dark';

  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [result, setResult] = useState(null);

  if (!connected) return null;

  const addToCalendar = async () => {
    try {
      setBusy(true);
      const response = await api.syncAppointmentToCalendar(appointmentId, patientId);
      setAdded(true);
      setResult({
        type: 'success',
        title: 'Added to your calendar',
        message: 'This appointment is now in your Google Calendar, with reminders a day before and 30 minutes ahead.',
        link: response?.eventLink || null,
      });
    } catch (error) {
      console.error('Error adding appointment to calendar:', error);
      if (addNotification) addNotification('alert', error.message || 'Could not add to Google Calendar');
      setResult({
        type: 'warning',
        title: 'Could not add to your calendar',
        message: error.message || 'Something went wrong adding this appointment to Google Calendar. Please try again.',
        link: null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={addToCalendar}
        disabled={busy || added}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
          added
            ? dark ? 'bg-green-500/15 text-green-300' : 'bg-green-50 text-green-700'
            : dark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {busy ? <RefreshCw className="w-4 h-4 animate-spin" />
          : added ? <Check className="w-4 h-4" />
          : <CalendarPlus className="w-4 h-4" />}
        {busy ? 'Adding…' : added ? 'In your calendar' : 'Add to Google Calendar'}
      </button>

      <ConfirmationModal
        theme={theme}
        isOpen={Boolean(result)}
        onClose={() => setResult(null)}
        onConfirm={() => {
          if (result?.link) window.open(result.link, '_blank', 'noopener,noreferrer');
          setResult(null);
        }}
        title={result?.title || ''}
        message={result?.message || ''}
        type={result?.type === 'success' ? 'success' : 'warning'}
        confirmText={result?.link ? 'Open in Google Calendar' : 'Done'}
        showCancel={Boolean(result?.link)}
        cancelText="Close"
      />
    </>
  );
};

export default AddToCalendarButton;
