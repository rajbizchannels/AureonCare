import React, { useState, useEffect } from 'react';
import { Calendar, X, Save, AlertTriangle } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';
import { useAudit } from '../../hooks/useAudit';
import { toLocalDateTimeString } from '../../utils/formatters';
import ThemedSelect from './ThemedSelect';

// Which roles can hold an appointment. The provider list and the "default to whoever is
// booking" rule read the same constant, so the person defaulted into the field is always
// someone the field can actually offer.
const PROVIDER_ROLES = ['physician', 'doctor'];

const roleOf = (u) => u?.role || u?.activeRole || u?.active_role || null;

/**
 * Is this row from a provider list a provider?
 *
 * Lenient about a missing role on purpose: some callers pass rows from the providers
 * table, which carries no role column because every row in it is a provider.
 */
const isProviderRow = (u) => {
  const role = roleOf(u);
  return role ? PROVIDER_ROLES.includes(role) : true;
};

/**
 * Is the SIGNED-IN user a provider?
 *
 * Strict, unlike isProviderRow: the signed-in user always has a role, and the leniency
 * that is right for a providers-table row would quietly default a receptionist into the
 * provider field — booking the appointment against the person at the front desk.
 */
const isProviderUser = (u) => PROVIDER_ROLES.includes(roleOf(u));

/** Append `extra` unless the list already has a row with that id. */
const withFallback = (list, extra) => {
  const rows = list || [];
  if (!extra?.id) return rows;
  return rows.some((r) => String(r.id) === String(extra.id)) ? rows : [...rows, extra];
};

const NewAppointmentForm = ({ theme, api, patients, users, patient, user, onClose, onSuccess, addNotification, t }) => {
  const { logFormView, logCreate, logError, startAction } = useAudit();
  const [formData, setFormData] = useState({
    // Both of these are DEFAULTS, not decisions — see the fields themselves.
    //
    // patientId is stringified because everything downstream compares it as a string
    // (`p.id.toString() === formData.patientId`). Left as the number it arrives as, those
    // comparisons silently miss and the success notification says "appointment scheduled
    // with patient" instead of naming them.
    patientId: patient?.id != null ? String(patient.id) : '',
    // Deliberately NOT seeded from `user`: the signed-in user is only the right default
    // when they are a provider, and that is decided below once the provider list is known.
    providerId: '',
    date: '',
    time: '',
    type: '',
    duration: 30,
    reason: '',
    notes: '',
    offeringId: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccessConfirmation, setShowSuccessConfirmation] = useState(false);
  const [conflictError, setConflictError] = useState(null);
  const [offerings, setOfferings] = useState([]);
  const [appointmentTypes, setAppointmentTypes] = useState([]);

  // Log form view on mount
  useEffect(() => {
    startAction();
    logFormView('NewAppointmentForm', {
      module: 'Scheduling',
      patient_id: patient?.id,
      provider_id: user?.id,
      metadata: {
        preselectedPatient: !!patient,
        preselectedProvider: !!user,
      },
    });
  }, [logFormView, patient, startAction, user]);

  // Fetch active offerings
  useEffect(() => {
    const fetchOfferings = async () => {
      try {
        const data = await api.getOfferings({ is_active: true, available_online: true });
        // Guarded because the whole form is rendered from this: a response that is not an
        // array (an error body, a 204, a shape change) reached `offerings.map` and took
        // the entire appointment form down with a white screen, rather than costing one
        // optional field.
        setOfferings(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching offerings:', error);
      }
    };
    fetchOfferings();
  }, [api]);

  // Fetch appointment types
  useEffect(() => {
    const fetchAppointmentTypes = async () => {
      try {
        const data = await api.getAppointmentTypes();
        if (data && data.length > 0) {
          setAppointmentTypes(data);
        } else {
          // Fallback to default appointment types if API returns empty
          setAppointmentTypes([
            { id: 1, name: 'General Consultation', durationMinutes: 30 },
            { id: 2, name: 'Follow-up', durationMinutes: 20 },
            { id: 3, name: 'Check-up', durationMinutes: 30 },
            { id: 4, name: 'Physical Exam', durationMinutes: 45 },
            { id: 5, name: 'Vaccination', durationMinutes: 15 },
            { id: 6, name: 'Lab Results', durationMinutes: 15 },
            { id: 7, name: 'Telehealth', durationMinutes: 30 }
          ]);
        }
      } catch (error) {
        console.error('Error fetching appointment types:', error);
        // Fallback to default appointment types on error
        setAppointmentTypes([
          { id: 1, name: 'General Consultation', durationMinutes: 30 },
          { id: 2, name: 'Follow-up', durationMinutes: 20 },
          { id: 3, name: 'Check-up', durationMinutes: 30 },
          { id: 4, name: 'Physical Exam', durationMinutes: 45 },
          { id: 5, name: 'Vaccination', durationMinutes: 15 },
          { id: 6, name: 'Lab Results', durationMinutes: 15 },
          { id: 7, name: 'Telehealth', durationMinutes: 30 }
        ]);
      }
    };
    fetchAppointmentTypes();
  }, [api]);

  // Default the provider to whoever is booking, when they are one.
  //
  // A doctor scheduling an appointment is nearly always scheduling it for themselves, so
  // they should not have to find their own name in a list. Previously this picked the
  // FIRST doctor in the list regardless of who was signed in: right in a single-provider
  // practice, arbitrary in any other, and a doctor booking their own clinic had to correct
  // it every time. The signed-in user wins where they qualify; the first-provider fallback
  // is kept for everyone else, because for a one-doctor practice it is still the only
  // sensible answer.
  useEffect(() => {
    if (formData.providerId) return;
    if (isProviderUser(user)) {
      setFormData(prev => ({ ...prev, providerId: String(user.id) }));
      return;
    }
    const firstProvider = (users || []).find(isProviderRow);
    if (firstProvider) {
      setFormData(prev => ({ ...prev, providerId: String(firstProvider.id) }));
    }
  }, [users, user, formData.providerId]);

  // Auto-update duration when offering is selected
  useEffect(() => {
    if (formData.offeringId) {
      const selectedOffering = offerings.find(o => o.id.toString() === formData.offeringId);
      if (selectedOffering && selectedOffering.duration_minutes) {
        setFormData(prev => ({ ...prev, duration: selectedOffering.duration_minutes }));
      }
    }
  }, [formData.offeringId, offerings]);

  const nameOf = (p) =>
    `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim() || p.email || '—';

  // Only providers can hold an appointment, but the person defaulted into the field has to
  // be offered by it as well, or the form would show a name the dropdown cannot produce —
  // and changing away from it would be a one-way door.
  const providers = withFallback(
    (users || []).filter(isProviderRow),
    isProviderUser(user) ? user : null,
  );

  // Likewise for the patient: a chart-side booking arrives with one patient and, before
  // this change, a patient list of exactly that patient. Both the default and a real
  // choice are needed, so fall back to the booked-for patient when the full list has not
  // arrived. Declared above the handlers, which close over it.
  const patientOptions = withFallback(patients, patient);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation - form is already validated by HTML5 required attributes
    // Show confirmation modal before submitting
    setShowConfirmation(true);
  };

  const handleActualSubmit = async () => {
    setShowConfirmation(false);

    const appointmentData = {
      patient_id: formData.patientId,
      provider_id: formData.providerId,
      practice_id: null,
      appointment_type: formData.type,
      duration_minutes: formData.duration,
      status: 'scheduled',
      reason: formData.reason,
      notes: formData.notes,
      offering_id: formData.offeringId || null,
      date: formData.date,
      time: formData.time,
    };

    try {
      // Combine date and time into start_time timestamp
      const startTime = `${formData.date}T${formData.time}:00`;

      // Calculate end_time by adding duration (use local time, not UTC)
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + formData.duration * 60000);
      const endTime = toLocalDateTimeString(endDate);
      const formattedStartTime = toLocalDateTimeString(startDate);

      appointmentData.start_time = formattedStartTime;
      appointmentData.end_time = endTime;

      const newAppointment = await api.createAppointment(appointmentData);

      // Log successful creation
      logCreate('NewAppointmentForm', appointmentData, {
        module: 'Scheduling',
        resource_id: newAppointment.id,
        patient_id: formData.patientId,
        provider_id: formData.providerId,
        metadata: {
          appointmentType: formData.type,
          duration: formData.duration,
          offering_id: formData.offeringId,
        },
      });

      // Look in the options actually offered, not in `patients`, and do not shadow the
      // `patient` prop with a local of the same name: booked from a chart the prop is the
      // only row available, so searching `patients` alone could miss and announce
      // "appointment scheduled with patient".
      const bookedFor = patientOptions.find(p => String(p.id) === String(formData.patientId));
      const patientName = bookedFor ? nameOf(bookedFor) : t.patient || 'patient';
      await addNotification('appointment', `${t.newAppointmentScheduledWith || 'New appointment scheduled with'} ${patientName}`);

      // Show success confirmation
      setShowSuccessConfirmation(true);

      // Auto-close confirmation and form after 2 seconds
      setTimeout(() => {
        onSuccess(newAppointment);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error creating appointment:', err);

      // Show themed conflict popup for scheduling conflicts
      const conflictType = err.response?.data?.conflictType;
      if (conflictType || err.message?.includes('busy at the selected time') || err.message?.includes('already has an appointment booked')) {
        setConflictError(err.message || 'Scheduling conflict detected.');
      } else {
        addNotification('alert', t.failedToCreateAppointment || 'Failed to create appointment. Please try again.');
      }

      // Log error
      logError('NewAppointmentForm', 'form', err.message || 'Failed to create appointment', {
        module: 'Scheduling',
        patient_id: formData.patientId,
        provider_id: formData.providerId,
        metadata: { formData: appointmentData },
      });
    }
  };

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleActualSubmit}
        title="Schedule Appointment"
        message="Are you sure you want to schedule this appointment?"
        type="confirm"
        confirmText="Schedule"
        cancelText="Cancel"
      />
      <ConfirmationModal
        theme={theme}
        isOpen={showSuccessConfirmation}
        onClose={() => setShowSuccessConfirmation(false)}
        onConfirm={() => {
          setShowSuccessConfirmation(false);
          onClose();
        }}
        title={t.success || 'Success!'}
        message={t.appointmentScheduledSuccess || 'Appointment has been scheduled successfully.'}
        type="success"
        confirmText={t.ok || 'OK'}
        showCancel={false}
      />
      {/* Scheduling Conflict Error Popup */}
      {conflictError && (
        <div
          className={`fixed inset-0 backdrop-blur-sm z-[70] flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`}
          onClick={() => setConflictError(null)}
        >
          <div
            className={`rounded-xl border max-w-md w-full shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border-red-500/30' : 'bg-white border-red-300'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                  <AlertTriangle className="w-6 h-6" />
                  Scheduling Conflict
                </h2>
                <button
                  onClick={() => setConflictError(null)}
                  className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                >
                  <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'}`}>
                  <AlertTriangle className={`w-8 h-8 ${theme === 'dark' ? 'text-red-400' : 'text-red-500'}`} />
                </div>
                <p className={`text-lg ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {conflictError}
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                  Please choose a different date or time to avoid the conflict.
                </p>
              </div>
            </div>
            <div className={`p-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setConflictError(null)}
                className={`w-full px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                  theme === 'dark'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                Choose Different Time
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10 ${theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-gray-300 bg-white'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Calendar className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.newAppointment || 'New Appointment'}</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.patient || 'Patient'} <span className="text-red-400">*</span>
                </label>
                {/* Pre-selected when a patient is in context, never locked. Booking from a
                    patient's chart used to render this as read-only text, so correcting the
                    wrong patient meant abandoning the form and starting again from a screen
                    that did not know who it was for. */}
                <ThemedSelect
                  theme={theme}
                  focusClass="focus:border-cyan-500"
                  required
                  value={formData.patientId}
                  onChange={(e) => setFormData({...formData, patientId: e.target.value})}
                >
                  <option value="">{t.selectPatient || 'Select Patient'}</option>
                  {patientOptions.map(p => (
                    <option key={p.id} value={p.id}>
                      {nameOf(p)}{p.mrn ? ` - ${p.mrn}` : ''}
                    </option>
                  ))}
                </ThemedSelect>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.appointmentType || 'Appointment Type'} <span className="text-red-400">*</span>
                </label>
                <ThemedSelect
                  theme={theme}
                  focusClass="focus:border-cyan-500"
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  <option value="">{t.selectType || 'Select Type'}</option>
                  {appointmentTypes.map(type => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </ThemedSelect>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.service || 'Service/Offering'} <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <ThemedSelect
                  theme={theme}
                  focusClass="focus:border-cyan-500"
                  value={formData.offeringId}
                  onChange={(e) => setFormData({...formData, offeringId: e.target.value})}
                >
                  <option value="">{t.selectService || 'Select a service (optional)'}</option>
                  {offerings.map(offering => (
                    <option key={offering.id} value={offering.id}>
                      {offering.name} {offering.duration_minutes && `(${offering.duration_minutes} min)`}
                      {offering.pricing_options && offering.pricing_options.length > 0 &&
                        ` - $${Math.min(...offering.pricing_options.map(p => p.final_price))}`}
                    </option>
                  ))}
                </ThemedSelect>
                {formData.offeringId && (() => {
                  const selectedOffering = offerings.find(o => o.id.toString() === formData.offeringId);
                  return selectedOffering && selectedOffering.description && (
                    <p className="mt-1 text-xs text-gray-500">{selectedOffering.description}</p>
                  );
                })()}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.date || 'Date'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.time || 'Time'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.durationMinutes || 'Duration (minutes)'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="15"
                  step="15"
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.provider || 'Provider'}
                </label>
                {/* Defaults to the signed-in provider, and stays editable so a doctor can
                    book on a colleague's behalf. It used to be read-only whenever a caller
                    passed the signed-in user, which also meant a receptionist booking from
                    a chart had the appointment pinned to themselves. */}
                <ThemedSelect
                  theme={theme}
                  focusClass="focus:border-cyan-500"
                  value={formData.providerId}
                  onChange={(e) => setFormData({...formData, providerId: e.target.value})}
                >
                  <option value="">{t.selectProvider || 'Select Provider'}</option>
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {nameOf(provider)}
                      {isProviderUser(user) && String(provider.id) === String(user.id)
                        ? ` (${t.you || 'you'})`
                        : ''}
                    </option>
                  ))}
                </ThemedSelect>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.reasonForVisit || 'Reason for Visit'} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder={t.reasonPlaceholder || 'e.g., Annual physical, Follow-up on treatment'}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.additionalNotes || 'Additional Notes'}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows="3"
                placeholder={t.additionalNotesPlaceholder || 'Any additional information...'}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
            </div>
          </div>

          <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
            >
              {t.cancel || 'Cancel'}
            </button>
            <button
              type="submit"
              className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              <Save className="w-5 h-5" />
              {t.scheduleAppointment || 'Schedule Appointment'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default NewAppointmentForm;
