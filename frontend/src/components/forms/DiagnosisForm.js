import React, { useState, useEffect } from 'react';
import { Activity, X, Save, Calendar, FileText } from 'lucide-react';
import MedicalCodeMultiSelect from './MedicalCodeMultiSelect';
import ConfirmationModal from '../modals/ConfirmationModal';

const DiagnosisForm = ({
  theme,
  api,
  patient, // Optional - if provided, patient dropdown will be pre-selected
  patients = [], // List of all patients for dropdown
  providers = [],
  user, // Logged-in user
  onClose,
  onSuccess,
  addNotification,
  t = {},
  editDiagnosis = null // If provided, we're editing an existing diagnosis
}) => {
  const [formData, setFormData] = useState({
    patientId: patient?.id || '',
    providerId: user?.id || '', // Default to logged-in user
    icdCodes: [],
    cptCodes: [],
    diagnosisName: '',
    description: '',
    severity: 'Moderate',
    status: 'Active',
    diagnosedDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If editing, populate form with existing diagnosis data
  useEffect(() => {
    const loadCodesFromDiagnosis = async () => {
      if (editDiagnosis) {
        // Start with basic form data
        const newFormData = {
          patientId: editDiagnosis.patientId || patient?.id || '',
          providerId: editDiagnosis.providerId || user?.id || '',
          icdCodes: [],
          cptCodes: [],
          diagnosisName: editDiagnosis.diagnosisName || '',
          description: editDiagnosis.description || '',
          severity: editDiagnosis.severity || 'Moderate',
          status: editDiagnosis.status || 'Active',
          diagnosedDate: editDiagnosis.diagnosedDate || new Date().toISOString().split('T')[0],
          notes: editDiagnosis.notes || ''
        };

        // Parse and load ICD codes from comma-separated diagnosisCode string
        if (editDiagnosis.diagnosisCode && typeof editDiagnosis.diagnosisCode === 'string') {
          const icdCodeStrings = editDiagnosis.diagnosisCode.split(',').map(c => c.trim()).filter(Boolean);

          // Fetch full code objects for each ICD code
          const icdCodePromises = icdCodeStrings.map(async (codeStr) => {
            try {
              const codeData = await api.getMedicalCodeByCode(codeStr);
              return codeData;
            } catch (err) {
              console.warn(`Could not load ICD code ${codeStr}:`, err);
              return null;
            }
          });

          const icdCodesData = await Promise.all(icdCodePromises);
          newFormData.icdCodes = icdCodesData.filter(Boolean);
        }

        // Parse CPT codes from notes field if present
        // Notes format: "CPT Codes: 99213 (Description); 85025 (Description)"
        if (editDiagnosis.notes && typeof editDiagnosis.notes === 'string') {
          const cptMatch = editDiagnosis.notes.match(/CPT Codes:\s*([^]*?)(?:\n\n|$)/);
          if (cptMatch) {
            // Extract code strings from format "99213 (Description); 85025 (Description)"
            const cptSection = cptMatch[1];
            const cptCodeMatches = cptSection.matchAll(/(\d+)\s*\(/g);
            const cptCodeStrings = Array.from(cptCodeMatches).map(match => match[1]).filter(Boolean);

            // Fetch full code objects for each CPT code
            const cptCodePromises = cptCodeStrings.map(async (codeStr) => {
              try {
                const codeData = await api.getMedicalCodeByCode(codeStr);
                return codeData;
              } catch (err) {
                console.warn(`Could not load CPT code ${codeStr}:`, err);
                return null;
              }
            });

            const cptCodesData = await Promise.all(cptCodePromises);
            newFormData.cptCodes = cptCodesData.filter(Boolean);
          }

          // Clean up notes to remove metadata section for editing
          // Remove "ICD Codes: ..." and "CPT Codes: ..." sections
          let cleanedNotes = editDiagnosis.notes;
          cleanedNotes = cleanedNotes.replace(/\n*ICD Codes:\s*[^]*?(?=\n\n|CPT Codes:|$)/g, '');
          cleanedNotes = cleanedNotes.replace(/\n*CPT Codes:\s*[^]*?$/g, '');
          newFormData.notes = cleanedNotes.trim();
        }

        setFormData(newFormData);
      } else if (user?.id) {
        // Default provider to logged-in user for new diagnoses
        setFormData(prev => ({ ...prev, providerId: user.id }));
      }
    };

    loadCodesFromDiagnosis();
  }, [editDiagnosis, patient, user, api]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.diagnosisName && formData.icdCodes.length === 0) {
      addNotification('alert', 'Please provide either a diagnosis name or select at least one ICD code.');
      return;
    }

    if (!formData.patientId) {
      addNotification('alert', 'Patient information is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare diagnosis data - store codes as comma-separated string for backward compatibility
      const diagnosisData = {
        patientId: formData.patientId,
        providerId: formData.providerId || null,
        appointmentId: null,
        diagnosisCode: formData.icdCodes.length > 0 ? formData.icdCodes.map(c => c.code).join(', ') : null,
        diagnosisName: formData.diagnosisName || (formData.icdCodes.length > 0 ? formData.icdCodes[0].description : ''),
        description: formData.description || null,
        severity: formData.severity,
        status: formData.status,
        diagnosedDate: formData.diagnosedDate,
        notes: formData.notes || null,
        // Store additional metadata in notes for full details
        metadata: {
          icdCodes: formData.icdCodes,
          cptCodes: formData.cptCodes
        }
      };

      // Append metadata to notes if not empty
      if (diagnosisData.metadata.icdCodes.length > 0 || diagnosisData.metadata.cptCodes.length > 0) {
        const metadataText = [];
        if (diagnosisData.metadata.icdCodes.length > 0) {
          metadataText.push(`ICD Codes: ${diagnosisData.metadata.icdCodes.map(c => `${c.code} (${c.description})`).join('; ')}`);
        }
        if (diagnosisData.metadata.cptCodes.length > 0) {
          metadataText.push(`CPT Codes: ${diagnosisData.metadata.cptCodes.map(c => `${c.code} (${c.description})`).join('; ')}`);
        }
        diagnosisData.notes = [diagnosisData.notes, ...metadataText].filter(Boolean).join('\n\n');
      }

      let result;
      if (editDiagnosis) {
        // Update existing diagnosis
        result = await api.updateDiagnosis(editDiagnosis.id, diagnosisData);
      } else {
        // Create new diagnosis
        result = await api.createDiagnosis(diagnosisData);
      }

      // Find patient name from patients array or use provided patient
      const selectedPatient = patients.find(p => p.id === formData.patientId) || patient;
      const patientName = selectedPatient ? `${selectedPatient.first_name || selectedPatient.firstName || ''} ${selectedPatient.last_name || selectedPatient.lastName || ''}`.trim() : 'patient';
      const action = editDiagnosis ? 'updated' : 'created';
      await addNotification('diagnosis', `Diagnosis ${action} for ${patientName}`);

      // Show success confirmation
      setShowConfirmation(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onSuccess(result);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error saving diagnosis:', err);
      const action = editDiagnosis ? 'update' : 'create';
      addNotification('alert', `Failed to ${action} diagnosis. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        title={t.success || 'Success!'}
        message={editDiagnosis ? 'Diagnosis has been updated successfully.' : 'Diagnosis has been created successfully.'}
        type="success"
        confirmText={t.ok || 'OK'}
        showCancel={false}
      />

      <div
        className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${
          theme === 'dark' ? 'bg-black/50' : 'bg-black/30'
        }`}
        onClick={onClose}
      >
        <div
          className={`rounded-xl border max-w-4xl w-full max-h-[90vh] overflow-hidden ${
            theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-green-500/10 to-teal-500/10 ${
              theme === 'dark' ? 'border-slate-700' : 'border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                <Activity className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
              </div>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {editDiagnosis ? 'Edit Diagnosis' : 'New Diagnosis'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'
              }`}
            >
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            <div className="space-y-4">
              {/* Patient Dropdown */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Patient <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  required
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                  }`}
                >
                  <option value="">Select Patient</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name || p.firstName} {p.last_name || p.lastName} - MRN: {p.mrn || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              {/* ICD Codes */}
              <MedicalCodeMultiSelect
                theme={theme}
                api={api}
                value={formData.icdCodes}
                onChange={(codes) => setFormData({ ...formData, icdCodes: codes })}
                codeType="icd"
                label="ICD-10 Diagnosis Codes"
                placeholder="Search for ICD codes by code or description..."
              />

              {/* CPT Codes */}
              <MedicalCodeMultiSelect
                theme={theme}
                api={api}
                value={formData.cptCodes}
                onChange={(codes) => setFormData({ ...formData, cptCodes: codes })}
                codeType="cpt"
                label="CPT Procedure Codes"
                placeholder="Search for CPT codes by code or description..."
              />

              {/* Diagnosis Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Diagnosis Name
                  {formData.icdCodes.length === 0 && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type="text"
                  value={formData.diagnosisName}
                  onChange={(e) => setFormData({ ...formData, diagnosisName: e.target.value })}
                  placeholder="E.g., Essential Hypertension"
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details about the diagnosis..."
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Row: Provider, Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider (Read-only, shows logged-in user) */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Provider
                  </label>
                  <div className={`w-full px-3 py-2 border rounded-lg ${
                    theme === 'dark'
                      ? 'bg-slate-800/50 border-slate-600 text-gray-300'
                      : 'bg-gray-50 border-gray-300 text-gray-700'
                  }`}>
                    {user ? `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim() || 'Current User' : 'Not specified'}
                  </div>
                </div>

                {/* Diagnosis Date */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Diagnosis Date
                  </label>
                  <input
                    type="date"
                    value={formData.diagnosedDate}
                    onChange={(e) => setFormData({ ...formData, diagnosedDate: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* Row: Severity, Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Severity */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Severity
                  </label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  >
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  >
                    <option value="Active">Active</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Chronic">Chronic</option>
                  </select>
                </div>
              </div>

              {/* Clinical Notes */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Clinical Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional clinical notes, treatment plan, or observations..."
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  }`}
                />
              </div>
            </div>
          </form>

          {/* Footer */}
          <div
            className={`p-6 border-t flex justify-end gap-3 ${
              theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-gray-300 bg-gray-50'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-700 text-white hover:bg-slate-600'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors flex items-center gap-2 ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {editDiagnosis ? 'Update Diagnosis' : 'Save Diagnosis'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DiagnosisForm;
