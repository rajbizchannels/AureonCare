import React, { useState, useEffect } from 'react';
import { Calendar, X, Save } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewAppointmentForm = ({ theme, api, patients, users, onClose, onSuccess, addNotification }) => {
  const [formData, setFormData] = useState({
    patientId: '',
    providerId: '',
    date: '',
    time: '',
    type: 'office-visit',
    duration: 30,
    reason: '',
    notes: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Set default provider to first available provider when users are loaded
  useEffect(() => {
    if (users && users.length > 0 && !formData.providerId) {
      const firstProvider = users.find(u => u.role === 'physician' || u.role === 'doctor' || u.role === 'provider') || users[0];
      setFormData(prev => ({ ...prev, providerId: firstProvider.id }));
    }
  }, [users, formData.providerId]);

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
        notes: formData.notes
      };

      const newAppointment = await api.createAppointment(appointmentData);

      const patient = patients.find(p => p.id.toString() === formData.patientId);
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'patient';
      await addNotification('appointment', `New appointment scheduled with ${patientName}`);

      // Show success confirmation
      setShowConfirmation(true);

      // Auto-close confirmation and form after 2 seconds
      setTimeout(() => {
        onSuccess(newAppointment);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error creating appointment:', err);
      addNotification('alert', 'Failed to create appointment. Please try again.');
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
        onConfirm={() => {
          setShowConfirmation(false);
          onClose();
        }}
        title="Success!"
        message="Appointment has been scheduled successfully."
        type="success"
        confirmText="OK"
        showCancel={false}
      />
      <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
        <div className={`rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Calendar className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>New Appointment</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Patient <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.patientId}
                  onChange={(e) => setFormData({...formData, patientId: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="">Select Patient</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name} - {p.mrn}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Appointment Type <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="office-visit">Office Visit</option>
                  <option value="telehealth">Telehealth</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="annual-physical">Annual Physical</option>
                  <option value="consultation">Consultation</option>
                  <option value="procedure">Procedure</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Date <span className="text-red-400">*</span>
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
                  Time <span className="text-red-400">*</span>
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
                  Duration (minutes) <span className="text-red-400">*</span>
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
                  Provider
                </label>
                <select
                  value={formData.providerId}
                  onChange={(e) => setFormData({...formData, providerId: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="">Select Provider</option>
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {`${provider.first_name || ''} ${provider.last_name || ''}`.trim() || provider.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Reason for Visit <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="e.g., Annual physical, Follow-up on treatment"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Additional Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows="3"
                placeholder="Any additional information..."
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
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              <Save className="w-5 h-5" />
              Schedule Appointment
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default NewAppointmentForm;
