import React, { useState, useEffect } from 'react';
import { FileCheck, X, Save } from 'lucide-react';

const NewConsentFormForm = ({ theme, api, patients, editingConsent, onClose, onSuccess, addNotification }) => {
  const [formData, setFormData] = useState({
    patient_id: editingConsent?.patient_id || '',
    consent_type: editingConsent?.consent_type || 'treatment',
    consent_title: editingConsent?.consent_title || '',
    consent_description: editingConsent?.consent_description || '',
    consent_content: editingConsent?.consent_content || '',
    version: editingConsent?.version || '1.0',
    status: editingConsent?.status || 'pending'
  });

  const [processing, setProcessing] = useState(false);

  const consentTypes = [
    { id: 'treatment', name: 'Treatment Consent' },
    { id: 'privacy', name: 'Privacy & HIPAA' },
    { id: 'release_of_information', name: 'Release of Information' },
    { id: 'financial', name: 'Financial Responsibility' },
    { id: 'research', name: 'Research Participation' },
    { id: 'telehealth', name: 'Telehealth Services' },
    { id: 'custom', name: 'Custom Consent' }
  ];

  const statusOptions = [
    { id: 'pending', name: 'Pending Signature' },
    { id: 'signed', name: 'Signed' },
    { id: 'declined', name: 'Declined' },
    { id: 'expired', name: 'Expired' },
    { id: 'revoked', name: 'Revoked' }
  ];

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

      const consentData = {
        patient_id: formData.patient_id,
        consent_type: formData.consent_type,
        consent_title: formData.consent_title,
        consent_description: formData.consent_description,
        consent_content: formData.consent_content,
        version: formData.version,
        status: formData.status
      };

      let result;
      if (editingConsent) {
        result = await api.updateConsentForm(editingConsent.id, consentData);
        const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'patient';
        await addNotification('success', `Consent form updated successfully for ${patientName}`);
      } else {
        result = await api.createConsentForm(consentData);
        const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'patient';
        await addNotification('success', `Consent form created successfully for ${patientName}`);
      }

      onSuccess(result);
    } catch (err) {
      console.error('Error saving consent form:', err);
      await addNotification('error', editingConsent ? 'Failed to update consent form' : 'Failed to create consent form');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-pink-500/10 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <FileCheck className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
          </div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {editingConsent ? 'Edit Consent Form' : 'New Consent Form'}
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
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              >
                <option value="">Select Patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} - {p.mrn}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Consent Type <span className="text-red-400">*</span>
              </label>
              <select
                required
                disabled={processing}
                value={formData.consent_type}
                onChange={(e) => setFormData({...formData, consent_type: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              >
                {consentTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              Consent Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              disabled={processing}
              value={formData.consent_title}
              onChange={(e) => setFormData({...formData, consent_title: e.target.value})}
              placeholder="e.g., Informed Consent for Treatment"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              Description
            </label>
            <textarea
              disabled={processing}
              value={formData.consent_description}
              onChange={(e) => setFormData({...formData, consent_description: e.target.value})}
              rows="2"
              placeholder="Brief description of the consent form..."
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              Consent Content <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              disabled={processing}
              value={formData.consent_content}
              onChange={(e) => setFormData({...formData, consent_content: e.target.value})}
              rows="8"
              placeholder="Enter the full text of the consent form..."
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Version <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                disabled={processing}
                value={formData.version}
                onChange={(e) => setFormData({...formData, version: e.target.value})}
                placeholder="e.g., 1.0, 2.1"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
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
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              >
                {statusOptions.map(status => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
              processing ? 'opacity-50 cursor-not-allowed' : ''
            } ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={processing}
            className={`flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
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
                {editingConsent ? 'Update Consent' : 'Create Consent'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewConsentFormForm;
