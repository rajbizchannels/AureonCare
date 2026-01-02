import React, { useState, useEffect } from 'react';
import { FileText, X, Save } from 'lucide-react';

const NewIntakeFormForm = ({ theme, api, patients, editingForm, onClose, onSuccess, addNotification }) => {
  const [formData, setFormData] = useState({
    patient_id: editingForm?.patient_id || '',
    form_type: editingForm?.form_type || 'general',
    form_name: editingForm?.form_name || '',
    status: editingForm?.status || 'draft',
    notes: editingForm?.notes || '',
    // Form fields stored as JSON
    chief_complaint: editingForm?.form_data?.chief_complaint || '',
    medical_history: editingForm?.form_data?.medical_history || '',
    current_medications: editingForm?.form_data?.current_medications || '',
    allergies: editingForm?.form_data?.allergies || '',
    emergency_contact_name: editingForm?.form_data?.emergency_contact_name || '',
    emergency_contact_phone: editingForm?.form_data?.emergency_contact_phone || '',
    insurance_provider: editingForm?.form_data?.insurance_provider || '',
    insurance_policy_number: editingForm?.form_data?.insurance_policy_number || ''
  });

  const [processing, setProcessing] = useState(false);

  const formTypes = [
    { id: 'general', name: 'General Intake' },
    { id: 'medical_history', name: 'Medical History' },
    { id: 'insurance', name: 'Insurance Information' },
    { id: 'emergency_contact', name: 'Emergency Contact' },
    { id: 'custom', name: 'Custom Form' }
  ];

  const statusOptions = [
    { id: 'draft', name: 'Draft' },
    { id: 'submitted', name: 'Submitted' },
    { id: 'reviewed', name: 'Reviewed' },
    { id: 'approved', name: 'Approved' },
    { id: 'rejected', name: 'Rejected' }
  ];

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !processing) {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose, processing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      const patient = patients.find(p => p.id?.toString() === formData.patient_id);

      // Build form_data JSON from individual fields
      const form_data = {
        chief_complaint: formData.chief_complaint,
        medical_history: formData.medical_history,
        current_medications: formData.current_medications,
        allergies: formData.allergies,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
        insurance_provider: formData.insurance_provider,
        insurance_policy_number: formData.insurance_policy_number
      };

      const intakeFormData = {
        patient_id: formData.patient_id,
        form_type: formData.form_type,
        form_name: formData.form_name,
        form_data: form_data,
        status: formData.status,
        notes: formData.notes
      };

      let result;
      if (editingForm) {
        result = await api.updateIntakeForm(editingForm.id, intakeFormData);
        const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'patient';
        await addNotification('success', `Intake form updated successfully for ${patientName}`);
      } else {
        result = await api.createIntakeForm(intakeFormData);
        const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'patient';
        await addNotification('success', `Intake form created successfully for ${patientName}`);
      }

      onSuccess(result);
    } catch (err) {
      console.error('Error saving intake form:', err);
      await addNotification('error', editingForm ? 'Failed to update intake form' : 'Failed to create intake form');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-indigo-500/10 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
            <FileText className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
          </div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {editingForm ? 'Edit Intake Form' : 'New Intake Form'}
          </h2>
        </div>
        {!processing && (
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {/* Patient and Form Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Patient <span className="text-red-400">*</span>
              </label>
              <select
                required
                disabled={processing}
                value={formData.patient_id}
                onChange={(e) => setFormData({...formData, patient_id: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              >
                <option value="">Select Patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} - {p.mrn}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Form Type <span className="text-red-400">*</span>
              </label>
              <select
                required
                disabled={processing}
                value={formData.form_type}
                onChange={(e) => setFormData({...formData, form_type: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              >
                {formTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Form Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                disabled={processing}
                value={formData.form_name}
                onChange={(e) => setFormData({...formData, form_name: e.target.value})}
                placeholder="e.g., New Patient Intake - John Doe"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Status <span className="text-red-400">*</span>
              </label>
              <select
                required
                disabled={processing}
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              >
                {statusOptions.map(status => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Form Fields */}
          <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Patient Information
            </h3>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Chief Complaint
                </label>
                <textarea
                  disabled={processing}
                  value={formData.chief_complaint}
                  onChange={(e) => setFormData({...formData, chief_complaint: e.target.value})}
                  rows="2"
                  placeholder="What brings the patient in today?"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Medical History
                </label>
                <textarea
                  disabled={processing}
                  value={formData.medical_history}
                  onChange={(e) => setFormData({...formData, medical_history: e.target.value})}
                  rows="3"
                  placeholder="Previous medical conditions, surgeries, etc."
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Current Medications
                  </label>
                  <textarea
                    disabled={processing}
                    value={formData.current_medications}
                    onChange={(e) => setFormData({...formData, current_medications: e.target.value})}
                    rows="3"
                    placeholder="List all current medications"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Allergies
                  </label>
                  <textarea
                    disabled={processing}
                    value={formData.allergies}
                    onChange={(e) => setFormData({...formData, allergies: e.target.value})}
                    rows="3"
                    placeholder="List all known allergies"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    disabled={processing}
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})}
                    placeholder="Full name"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    disabled={processing}
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({...formData, emergency_contact_phone: e.target.value})}
                    placeholder="(555) 123-4567"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Insurance Provider
                  </label>
                  <input
                    type="text"
                    disabled={processing}
                    value={formData.insurance_provider}
                    onChange={(e) => setFormData({...formData, insurance_provider: e.target.value})}
                    placeholder="e.g., Blue Cross Blue Shield"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Insurance Policy Number
                  </label>
                  <input
                    type="text"
                    disabled={processing}
                    value={formData.insurance_policy_number}
                    onChange={(e) => setFormData({...formData, insurance_policy_number: e.target.value})}
                    placeholder="Policy or member ID"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              Additional Notes
            </label>
            <textarea
              disabled={processing}
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows="3"
              placeholder="Add any additional notes..."
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
            />
          </div>
        </div>

        <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
              processing
                ? 'opacity-50 cursor-not-allowed'
                : ''
            } ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={processing}
            className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              processing ? 'opacity-75 cursor-wait' : ''
            } text-white`}
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {editingForm ? 'Update Form' : 'Create Form'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewIntakeFormForm;
