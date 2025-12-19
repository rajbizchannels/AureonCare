import React, { useState, useEffect } from 'react';
import { Microscope, X, Save } from 'lucide-react';
import LabCPTMultiSelect from './LabCPTMultiSelect';
import ResultRecipientsMultiSelect from './ResultRecipientsMultiSelect';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewLabOrderForm = ({
  theme,
  api,
  patient,
  patients = [],
  providers = [],
  user,
  onClose,
  onSuccess,
  addNotification,
  t = {},
  editLabOrder = null,
  createDiagnosisOption = false
}) => {
  const [formData, setFormData] = useState({
    patientId: patient?.id || '',
    providerId: user?.id || '',
    laboratoryId: '',
    cptCodes: [],
    priority: 'routine',
    status: 'one-time',
    statusDate: new Date().toISOString().split('T')[0],
    frequency: '',
    class: 'clinic-collect',
    recipients: [],
    instructions: '',
    clinicalNotes: '',
    diagnosisCodes: []
  });
  const [laboratories, setLaboratories] = useState([]);
  const [loadingLaboratories, setLoadingLaboratories] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccessConfirmation, setShowSuccessConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createDiagnosis, setCreateDiagnosis] = useState(false);
  const [medicalCodes, setMedicalCodes] = useState([]);

  // Load laboratories on mount
  useEffect(() => {
    const loadLaboratories = async () => {
      try {
        const labs = await api.getLaboratories(true);
        setLaboratories(labs);
      } catch (error) {
        console.error('Error loading laboratories:', error);
      } finally {
        setLoadingLaboratories(false);
      }
    };
    loadLaboratories();
  }, [api]);

  // If editing, populate form
  useEffect(() => {
    if (editLabOrder) {
      const testCodes = editLabOrder.test_codes
        ? (typeof editLabOrder.test_codes === 'string' ? JSON.parse(editLabOrder.test_codes) : editLabOrder.test_codes)
        : [];
      const diagCodes = editLabOrder.diagnosis_codes
        ? (typeof editLabOrder.diagnosis_codes === 'string' ? JSON.parse(editLabOrder.diagnosis_codes) : editLabOrder.diagnosis_codes)
        : [];
      const resultRecipients = editLabOrder.result_recipients
        ? (typeof editLabOrder.result_recipients === 'string' ? JSON.parse(editLabOrder.result_recipients) : editLabOrder.result_recipients)
        : [];

      setFormData({
        patientId: editLabOrder.patient_id || patient?.id || '',
        providerId: editLabOrder.provider_id || user?.id || '',
        laboratoryId: editLabOrder.laboratory_id || '',
        cptCodes: testCodes.map(code => ({ code, description: '' })),
        priority: editLabOrder.priority || 'routine',
        status: editLabOrder.order_status || 'one-time',
        statusDate: editLabOrder.order_status_date || new Date().toISOString().split('T')[0],
        frequency: editLabOrder.frequency || '',
        class: editLabOrder.collection_class || 'clinic-collect',
        recipients: Array.isArray(resultRecipients) ? resultRecipients : [],
        instructions: editLabOrder.special_instructions || '',
        clinicalNotes: editLabOrder.clinical_notes || '',
        diagnosisCodes: diagCodes
      });
    }
  }, [editLabOrder, patient, user]);

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
    if (!formData.patientId) {
      addNotification('alert', 'Please select a patient.');
      return;
    }

    if (formData.cptCodes.length === 0) {
      addNotification('alert', 'Please select at least one lab test (CPT code).');
      return;
    }

    if (!formData.laboratoryId) {
      addNotification('alert', 'Please select a laboratory.');
      return;
    }

    if (formData.status === 'recurring' && !formData.frequency) {
      addNotification('alert', 'Please select a frequency for recurring orders.');
      return;
    }

    if (formData.status === 'future' && !formData.statusDate) {
      addNotification('alert', 'Please select a scheduled date for future orders.');
      return;
    }

    setShowConfirmation(true);
  };

  const handleActualSubmit = async () => {
    setIsSubmitting(true);
    setShowConfirmation(false);

    try {
      // Convert recipients array to JSON
      const recipientIds = formData.recipients && formData.recipients.length > 0
        ? formData.recipients.map(r => ({ id: r.id, name: r.name, type: r.type }))
        : [];

      const labOrderData = {
        patient_id: formData.patientId,
        provider_id: formData.providerId,
        laboratory_id: formData.laboratoryId,
        order_type: 'lab_test',
        priority: formData.priority,
        diagnosis_codes: formData.diagnosisCodes,
        test_codes: formData.cptCodes.map(c => c.code),
        clinical_notes: formData.clinicalNotes || null,
        special_instructions: formData.instructions || null,
        order_status: formData.status,
        order_status_date: formData.statusDate || null,
        frequency: formData.frequency || null,
        collection_class: formData.class,
        result_recipients: JSON.stringify(recipientIds),
        send_to_vendor: false
      };

      let result;
      if (editLabOrder) {
        result = await api.updateLabOrder(editLabOrder.id, labOrderData);
      } else {
        result = await api.createLabOrder(labOrderData);
      }

      const selectedPatient = patients.find(p => p.id === formData.patientId) || patient;
      const patientName = selectedPatient
        ? `${selectedPatient.first_name || selectedPatient.firstName || ''} ${selectedPatient.last_name || selectedPatient.lastName || ''}`.trim()
        : 'patient';
      const action = editLabOrder ? 'updated' : 'created';
      await addNotification('success', `Lab order ${action} for ${patientName}`);

      // Create diagnosis if requested (only for new orders)
      if (createDiagnosis && !editLabOrder && createDiagnosisOption) {
        try {
          const diagnosisData = {
            patientId: formData.patientId,
            providerId: formData.providerId,
            diagnosisCode: formData.diagnosisCodes.join(', '),
            diagnosisName: `Lab order: ${formData.cptCodes.map(c => c.code).join(', ')}`,
            description: formData.clinicalNotes || 'Lab order created',
            severity: 'Moderate',
            status: 'Active',
            diagnosedDate: new Date().toISOString().split('T')[0],
            notes: `Lab order ${result.order_number} created`
          };
          await api.createDiagnosis(diagnosisData);
          await addNotification('success', 'Diagnosis created for lab order');
        } catch (err) {
          console.error('Error creating diagnosis:', err);
          addNotification('alert', 'Lab order created but failed to create diagnosis');
        }
      }

      setShowSuccessConfirmation(true);
      setTimeout(() => {
        onSuccess(result);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error saving lab order:', err);
      const action = editLabOrder ? 'update' : 'create';
      addNotification('alert', `Failed to ${action} lab order. Please try again.`);
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
        onConfirm={handleActualSubmit}
        title={editLabOrder ? 'Update Lab Order' : 'Create Lab Order'}
        message={editLabOrder ? 'Are you sure you want to update this lab order?' : 'Are you sure you want to create this lab order?'}
        type="confirm"
        confirmText={editLabOrder ? 'Update' : 'Create'}
        cancelText="Cancel"
      />

      <ConfirmationModal
        theme={theme}
        isOpen={showSuccessConfirmation}
        onClose={() => setShowSuccessConfirmation(false)}
        onConfirm={() => {
          setShowSuccessConfirmation(false);
          onSuccess();
          onClose();
        }}
        title={t.success || 'Success!'}
        message={editLabOrder ? 'Lab order updated successfully.' : 'Lab order created successfully.'}
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
          className={`rounded-xl border max-w-3xl w-full max-h-[90vh] overflow-hidden ${
            theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10 ${
              theme === 'dark' ? 'border-slate-700' : 'border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Microscope className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
              </div>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {editLabOrder ? 'Edit Lab Order' : 'New Lab Order'}
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
              {/* Patient */}
              {!patient && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Patient *
                  </label>
                  <select
                    required
                    value={formData.patientId}
                    onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
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
              )}

              {patient && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Patient
                  </label>
                  <div className={`w-full px-3 py-2 border rounded-lg ${
                    theme === 'dark'
                      ? 'bg-slate-800/50 border-slate-600 text-gray-300'
                      : 'bg-gray-50 border-gray-300 text-gray-700'
                  }`}>
                    {patient.first_name || patient.firstName} {patient.last_name || patient.lastName} - MRN: {patient.mrn || 'N/A'}
                  </div>
                </div>
              )}

              {/* Lab Tests (CPT Codes) */}
              <LabCPTMultiSelect
                theme={theme}
                api={api}
                value={formData.cptCodes}
                onChange={(codes) => setFormData({ ...formData, cptCodes: codes })}
                label="Lab Tests (CPT Codes) *"
                placeholder="Select lab test CPT codes..."
              />

              {/* Laboratory and Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Laboratory *
                  </label>
                  <select
                    required
                    value={formData.laboratoryId}
                    onChange={(e) => setFormData({ ...formData, laboratoryId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  >
                    <option value="">Select Laboratory</option>
                    {laboratories.map((lab) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.labName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="stat">STAT</option>
                  </select>
                </div>
              </div>

              {/* Status and Date/Frequency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Status *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  >
                    <option value="one-time">One-Time</option>
                    <option value="recurring">Recurring</option>
                    <option value="future">Future</option>
                  </select>
                </div>

                <div>
                  {formData.status === 'recurring' ? (
                    <>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Frequency *
                      </label>
                      <select
                        required
                        value={formData.frequency}
                        onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                          theme === 'dark'
                            ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        }`}
                      >
                        <option value="">Select Frequency</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annually">Annually</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {formData.status === 'future' ? 'Scheduled Date *' : 'Latest Date'}
                      </label>
                      <input
                        type="date"
                        required={formData.status === 'future'}
                        value={formData.statusDate}
                        min={new Date().toISOString().split('T')[0]}
                        max={new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]}
                        onChange={(e) => setFormData({ ...formData, statusDate: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                          theme === 'dark'
                            ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        }`}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Collection Class and Recipients */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Collection Class *
                  </label>
                  <select
                    required
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  >
                    <option value="clinic-collect">Clinic Collect</option>
                    <option value="lab-collect">Lab Collect</option>
                  </select>
                </div>

                <div>
                  <ResultRecipientsMultiSelect
                    theme={theme}
                    value={formData.recipients || []}
                    onChange={(recipients) => setFormData({ ...formData, recipients })}
                    label="Result Recipients *"
                    placeholder="Select who should receive the lab results..."
                    required={true}
                    doctor={user}
                    staff={providers.filter(p => p.role === 'staff')}
                    patient={patient || (formData.patientId && patients.find(p => p.id === formData.patientId))}
                  />
                </div>
              </div>

              {/* Clinical Notes */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Clinical Notes
                </label>
                <textarea
                  value={formData.clinicalNotes}
                  onChange={(e) => setFormData({ ...formData, clinicalNotes: e.target.value })}
                  placeholder="Clinical indication for lab tests..."
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Special Instructions */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Special Instructions
                </label>
                <input
                  type="text"
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  placeholder="e.g., Fasting required, collect in morning"
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Create Diagnosis Option */}
              {!editLabOrder && createDiagnosisOption && (
                <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-600' : 'bg-blue-50 border-blue-200'}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createDiagnosis}
                      onChange={(e) => setCreateDiagnosis(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Create diagnosis record for this lab order
                    </span>
                  </label>
                  {createDiagnosis && (
                    <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      A diagnosis will be automatically created with this lab order information.
                    </p>
                  )}
                </div>
              )}
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
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
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
                  {editLabOrder ? 'Update Order' : 'Create Order'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NewLabOrderForm;
