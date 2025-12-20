import React, { useState, useEffect } from 'react';
import { Calendar, X, Save } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewAppointmentForm = ({ theme, api, patients, users, onClose, onSuccess, addNotification, t }) => {
  const [formData, setFormData] = useState({
    patientId: '',
    providerId: '',
    date: '',
    time: '',
    type: 'office-visit',
    duration: 30,
    reason: '',
    notes: '',
    offeringId: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccessConfirmation, setShowSuccessConfirmation] = useState(false);
  const [offerings, setOfferings] = useState([]);

  // Fetch active offerings
  useEffect(() => {
    const fetchOfferings = async () => {
      try {
        const data = await api.getOfferings({ is_active: true, available_online: true });
        setOfferings(data);
      } catch (error) {
        console.error('Error fetching offerings:', error);
      }
    };
    fetchOfferings();
  }, [api]);

  // Set default provider to first available provider when users are loaded
  useEffect(() => {
    if (users && users.length > 0 && !formData.providerId) {
      const firstProvider = users.find(u => u.role === 'physician' || u.role === 'doctor' || u.role === 'provider') || users[0];
      setFormData(prev => ({ ...prev, providerId: firstProvider.id }));
    }
  }, [users, formData.providerId]);

  // Auto-update duration when offering is selected
  useEffect(() => {
    if (formData.offeringId) {
      const selectedOffering = offerings.find(o => o.id.toString() === formData.offeringId);
      if (selectedOffering && selectedOffering.duration_minutes) {
        setFormData(prev => ({ ...prev, duration: selectedOffering.duration_minutes }));
      }
    }
  }, [formData.offeringId, offerings]);

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

    try {
      // Combine date and time into start_time timestamp
      const startTime = `${formData.date}T${formData.time}:00`;

      // Calculate end_time by adding duration
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + formData.duration * 60000);
      const endTime = endDate.toISOString().slice(0, 19).replace('T', ' ');
      const formattedStartTime = startDate.toISOString().slice(0, 19).replace('T', ' ');

      const appointmentData = {
        patient_id: formData.patientId,
        provider_id: formData.providerId,
        practice_id: null, // Can be set if you have practice context
        appointment_type: formData.type,
        start_time: formattedStartTime,
        end_time: endTime,
        duration_minutes: formData.duration,
        status: 'scheduled',
        reason: formData.reason,
        notes: formData.notes,
        offering_id: formData.offeringId || null
      };

      const newAppointment = await api.createAppointment(appointmentData);

      const patient = patients.find(p => p.id.toString() === formData.patientId);
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : t.patient || 'patient';
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
      addNotification('alert', t.failedToCreateAppointment || 'Failed to create appointment. Please try again.');
    }
  };

  // Filter providers from users
  const providers = users?.filter(u =>
    u.role === 'physician' || u.role === 'doctor' || u.role === 'provider' || u.role === 'admin'
  ) || [];

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
                <select
                  required
                  value={formData.patientId}
                  onChange={(e) => setFormData({...formData, patientId: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="">{t.selectPatient || 'Select Patient'}</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name} - {p.mrn}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.appointmentType || 'Appointment Type'} <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="office-visit">{t.officeVisit || 'Office Visit'}</option>
                  <option value="telehealth">{t.telehealth || 'Telehealth'}</option>
                  <option value="follow-up">{t.followUp || 'Follow-up'}</option>
                  <option value="annual-physical">{t.annualPhysical || 'Annual Physical'}</option>
                  <option value="consultation">{t.consultation || 'Consultation'}</option>
                  <option value="procedure">{t.procedure || 'Procedure'}</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.service || 'Service/Offering'} <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <select
                  value={formData.offeringId}
                  onChange={(e) => setFormData({...formData, offeringId: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="">{t.selectService || 'Select a service (optional)'}</option>
                  {offerings.map(offering => (
                    <option key={offering.id} value={offering.id}>
                      {offering.name} {offering.duration_minutes && `(${offering.duration_minutes} min)`}
                      {offering.pricing_options && offering.pricing_options.length > 0 &&
                        ` - $${Math.min(...offering.pricing_options.map(p => p.final_price))}`}
                    </option>
                  ))}
                </select>
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
                <select
                  value={formData.providerId}
                  onChange={(e) => setFormData({...formData, providerId: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="">{t.selectProvider || 'Select Provider'}</option>
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {`${provider.first_name || provider.firstName || ''} ${provider.last_name || provider.lastName || ''}`.trim() || provider.email}
                    </option>
                  ))}
                </select>
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
