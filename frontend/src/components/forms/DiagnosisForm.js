import React, { useState, useEffect, useCallback } from 'react';
import { Activity, X, Save, Calendar, FileText, Pill, Microscope, Plus, Trash2, Search } from 'lucide-react';
import MedicalCodeMultiSelect from './MedicalCodeMultiSelect';
import LabCPTMultiSelect from './LabCPTMultiSelect';
import ResultRecipientsMultiSelect from './ResultRecipientsMultiSelect';
import ConfirmationModal from '../modals/ConfirmationModal';
import EPrescribeModal from '../modals/ePrescribeModal';

const DiagnosisForm = ({
  theme,
  api,
  patient, // Optional - if provided, patient dropdown will be pre-selected
  patients = [], // List of all patients for dropdown
  providers = [],
  user, // Logged-in user
  onClose,
  onSuccess,
  onPrescribe, // Optional callback to open prescription modal
  addNotification,
  t = {},
  editDiagnosis = null, // If provided, we're editing an existing diagnosis
  allowPatientSelection = false // If true, show patient dropdown; if false, show patient name as label
}) => {
  const [formData, setFormData] = useState({
    patientId: patient?.id || '',
    providerId: user?.id || '', // Default to logged-in user
    icdCodes: [],
    cptCodes: [],
    medications: [], // Selected medications for automatic prescription creation
    labOrders: [], // Lab tests to order: [{cptCodes, laboratoryId, priority, instructions, status, statusDate, frequency, class, recipient}]
    diagnosisName: '',
    description: '',
    severity: 'Moderate',
    status: 'Active',
    diagnosedDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [laboratories, setLaboratories] = useState([]);
  const [loadingLaboratories, setLoadingLaboratories] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccessConfirmation, setShowSuccessConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedDiagnosisResult, setSavedDiagnosisResult] = useState(null);
  const [linkedPrescriptions, setLinkedPrescriptions] = useState([]);
  const [linkedLabOrders, setLinkedLabOrders] = useState([]);
  const [pendingSubmit, setPendingSubmit] = useState(null);

  // Medication search state
  const [medicationSearchQuery, setMedicationSearchQuery] = useState('');
  const [searchMedications, setSearchMedications] = useState([]);
  const [loadingMedications, setLoadingMedications] = useState(false);

  // ePrescribe modal state
  const [showEPrescribeForm, setShowEPrescribeForm] = useState(false);
  const [preSelectedMedication, setPreSelectedMedication] = useState(null);

  // Load laboratories on mount
  useEffect(() => {
    const loadLaboratories = async () => {
      try {
        const labs = await api.getLaboratories(true); // Only active laboratories
        setLaboratories(labs);
      } catch (error) {
        console.error('Error loading laboratories:', error);
      } finally {
        setLoadingLaboratories(false);
      }
    };
    loadLaboratories();
  }, [api]);

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
          medications: [], // Initialize for edit mode
          labOrders: [], // Initialize for edit mode
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

        // Load linked prescriptions for this diagnosis
        if (editDiagnosis.id) {
          try {
            const prescriptions = await api.getPrescriptionsByDiagnosisId?.(editDiagnosis.id);
            if (prescriptions && prescriptions.length > 0) {
              setLinkedPrescriptions(prescriptions);
            }
          } catch (err) {
            console.log('Could not load linked prescriptions:', err);
          }
        }

        // Load linked lab orders for this diagnosis (by matching patient and diagnosis codes)
        if (editDiagnosis.id && editDiagnosis.patientId) {
          try {
            const labOrders = await api.getLabOrders?.({ patient_id: editDiagnosis.patientId });
            if (labOrders && labOrders.length > 0) {
              // Filter lab orders that contain any of the diagnosis codes from this diagnosis
              const diagnosisCodesList = editDiagnosis.diagnosisCode
                ? editDiagnosis.diagnosisCode.split(',').map(c => c.trim()).filter(Boolean)
                : [];

              // If we have diagnosis codes, filter by matching codes; otherwise show all patient's lab orders
              if (diagnosisCodesList.length > 0) {
                const relatedLabOrders = labOrders.filter(order => {
                  const orderDiagCodes = order.diagnosis_codes
                    ? (typeof order.diagnosis_codes === 'string' ? JSON.parse(order.diagnosis_codes) : order.diagnosis_codes)
                    : [];
                  return orderDiagCodes.some(code => diagnosisCodesList.includes(code));
                });
                setLinkedLabOrders(relatedLabOrders);
              } else {
                // No diagnosis codes yet, show all lab orders for this patient
                setLinkedLabOrders(labOrders);
              }
            }
          } catch (err) {
            console.log('Could not load linked lab orders:', err);
          }
        }
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

  // Search medications - wrapped in useCallback to prevent unnecessary re-renders
  const handleSearchMedications = useCallback(async () => {
    if (!medicationSearchQuery || medicationSearchQuery.length < 2) {
      return;
    }

    setLoadingMedications(true);
    setSearchMedications([]); // Clear previous results

    try {
      const data = await api.searchMedications(medicationSearchQuery, null, null, 50);

      if (data && Array.isArray(data)) {
        setSearchMedications(data);
      } else {
        setSearchMedications([]);
        addNotification('alert', 'Received invalid data format from server');
      }
    } catch (error) {
      console.error('Error searching medications:', error);

      // Check for specific error types
      if (error.message && error.message.includes('501')) {
        addNotification('alert', 'ePrescribing functionality requires migration 015 to be run. Please contact your system administrator.');
      } else if (error.message && error.message.includes('Failed to fetch')) {
        addNotification('alert', 'Cannot connect to server. Please check if the backend is running.');
      } else if (error.message && error.message.includes('404')) {
        addNotification('alert', 'Medication search endpoint not found. Migration 015 may not be installed.');
      } else if (error.message && error.message.includes('500')) {
        addNotification('alert', 'Server error while searching medications. Check console for details.');
      } else {
        addNotification('alert', `Failed to search medications: ${error.message}`);
      }

      setSearchMedications([]);
    } finally {
      setLoadingMedications(false);
    }
  }, [medicationSearchQuery, api, addNotification]);

  // Auto-search as user types (debounced)
  useEffect(() => {
    if (!medicationSearchQuery || medicationSearchQuery.length < 2) {
      setSearchMedications([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearchMedications();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [medicationSearchQuery, handleSearchMedications]);

  // Function to handle adding a medication - opens ePrescribe modal with pre-selected medication
  const handleAddMedication = useCallback((medication) => {
    if (!medication) {
      return;
    }

    // Set the pre-selected medication and open ePrescribe modal
    setPreSelectedMedication(medication);
    setShowEPrescribeForm(true);

    // Clear search
    setMedicationSearchQuery('');
    setSearchMedications([]);
  }, []);

  // Function to remove a medication from the list
  const handleRemoveMedication = useCallback((medicationId) => {
    setFormData({
      ...formData,
      medications: formData.medications.filter(m => m.id !== medicationId)
    });
  }, [formData]);

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

    // Show confirmation before submitting
    setPendingSubmit(e);
    setShowConfirmation(true);
  };

  const handleActualSubmit = async () => {
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

      // Auto-create prescriptions for selected medications
      const createdPrescriptions = [];
      if (formData.medications && formData.medications.length > 0 && !editDiagnosis) {
        for (const medication of formData.medications) {
          try {
            const prescriptionData = {
              patient_id: formData.patientId,
              provider_id: formData.providerId,
              medication_name: medication.drug_name || medication.brand_name,
              dosage: medication.strength || '',
              frequency: 'As directed',
              duration: '30 days',
              quantity: 30,
              refills: 0,
              instructions: `For ${diagnosisData.diagnosisName || 'diagnosis'}`,
              status: 'Active',
              diagnosis_id: result.id, // Link to diagnosis
              ndc_code: medication.ndc_code
            };
            const prescription = await api.createPrescription(prescriptionData);
            createdPrescriptions.push(prescription);
          } catch (err) {
            console.error('Error creating prescription for medication:', medication.drug_name, err);
          }
        }

        if (createdPrescriptions.length > 0) {
          await addNotification('success', `Created ${createdPrescriptions.length} prescription(s) from selected medications`);
        }
      }

      // Auto-create lab orders if specified
      const createdLabOrders = [];
      if (formData.labOrders && formData.labOrders.length > 0 && !editDiagnosis) {
        for (const labOrder of formData.labOrders) {
          try {
            // Convert recipients array to JSON
            const recipientIds = labOrder.recipients && labOrder.recipients.length > 0
              ? labOrder.recipients.map(r => ({ id: r.id, name: r.name, type: r.type }))
              : [];

            const labOrderData = {
              patient_id: formData.patientId,
              provider_id: formData.providerId,
              laboratory_id: labOrder.laboratoryId,
              order_type: 'lab_test',
              priority: labOrder.priority || 'routine',
              diagnosis_codes: formData.icdCodes.map(c => c.code),
              test_codes: labOrder.cptCodes ? labOrder.cptCodes.map(c => c.code) : [],
              clinical_notes: `For ${diagnosisData.diagnosisName || 'diagnosis'}`,
              special_instructions: labOrder.instructions || null,
              order_status: labOrder.status || 'one-time',
              order_status_date: labOrder.statusDate || null,
              frequency: labOrder.frequency || null,
              collection_class: labOrder.class || 'clinic-collect',
              result_recipients: JSON.stringify(recipientIds),
              send_to_vendor: false
            };
            const createdLabOrder = await api.createLabOrder(labOrderData);
            createdLabOrders.push(createdLabOrder);
          } catch (err) {
            console.error('Error creating lab order:', err);
          }
        }

        if (createdLabOrders.length > 0) {
          await addNotification('success', `Created ${createdLabOrders.length} lab order(s)`);
        }
      }

      // Save result for potential prescription creation
      setSavedDiagnosisResult({ result, selectedPatient, createdPrescriptions });

      // Show success confirmation and auto-close after 2 seconds
      setShowSuccessConfirmation(true);
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
      {/* Confirmation before submit */}
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => {
          setShowConfirmation(false);
          setPendingSubmit(null);
        }}
        onConfirm={handleActualSubmit}
        title={editDiagnosis ? 'Update Diagnosis' : 'Create Diagnosis'}
        message={editDiagnosis ? 'Are you sure you want to update this diagnosis?' : 'Are you sure you want to create this diagnosis?'}
        type="confirm"
        confirmText={editDiagnosis ? 'Update' : 'Create'}
        cancelText="Cancel"
      />

      {/* Success confirmation after submit */}
      <ConfirmationModal
        theme={theme}
        isOpen={showSuccessConfirmation}
        onClose={() => setShowSuccessConfirmation(false)}
        onConfirm={() => {
          setShowSuccessConfirmation(false);
          onSuccess(savedDiagnosisResult?.result);
          onClose();
        }}
        title={t.success || 'Success!'}
        message={
          editDiagnosis
            ? 'Diagnosis has been updated successfully.'
            : 'Diagnosis has been created successfully.'
        }
        type="success"
        confirmText={t.ok || 'OK'}
        showCancel={false}
      />

      <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
          {/* Header */}
          <div
            className={`p-6 border-b flex items-center justify-between ${
              theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'
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
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {/* Patient - Dropdown if allowPatientSelection, otherwise read-only label */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Patient {allowPatientSelection && <span className="text-red-500">*</span>}
                </label>
                {allowPatientSelection ? (
                  <select
                    value={formData.patientId}
                    onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                  >
                    <option value="">Select a patient...</option>
                    {patients.map((p) => {
                      const patientName = `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim();
                      const mrn = p.mrn || 'N/A';
                      return (
                        <option key={p.id} value={p.id}>
                          {patientName} - MRN: {mrn}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className={`w-full px-3 py-2 border rounded-lg ${
                    theme === 'dark'
                      ? 'bg-slate-800/50 border-slate-600 text-gray-300'
                      : 'bg-gray-50 border-gray-300 text-gray-700'
                  }`}>
                    {(() => {
                      const selectedPatient = patients.find(p => p.id === formData.patientId) || patient;
                      if (selectedPatient) {
                        const patientName = `${selectedPatient.first_name || selectedPatient.firstName || ''} ${selectedPatient.last_name || selectedPatient.lastName || ''}`.trim();
                        const mrn = selectedPatient.mrn || 'N/A';
                        return `${patientName} - MRN: ${mrn}`;
                      }
                      return 'No patient selected';
                    })()}
                  </div>
                )}
              </div>

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

              {/* Medications */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4" />
                    Medications (Optional - Will auto-create prescriptions)
                  </div>
                </label>

                <div className="space-y-3">
                  {/* ePrescribe Form - shown when user clicks "Add Prescription" */}
                  {showEPrescribeForm && (
                    <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-600' : 'bg-gray-50 border-gray-300'}`}>
                  <EPrescribeModal
                    theme={theme}
                    api={api}
                    patient={patients.find(p => p.id === formData.patientId) || patient}
                    provider={user}
                    initialMedication={preSelectedMedication}
                    inline={true}
                    onClose={() => {
                      setShowEPrescribeForm(false);
                      setPreSelectedMedication(null);
                    }}
                    onSuccess={(prescriptions) => {
                      setShowEPrescribeForm(false);
                      setPreSelectedMedication(null);
                      addNotification('success', `${Array.isArray(prescriptions) ? prescriptions.length : 1} prescription(s) created via ePrescribe`);
                      // Optionally, add prescriptions to linkedPrescriptions state
                      if (Array.isArray(prescriptions)) {
                        setLinkedPrescriptions(prev => [...prev, ...prescriptions]);
                      } else {
                        setLinkedPrescriptions(prev => [...prev, prescriptions]);
                      }
                    }}
                    addNotification={addNotification}
                  />
                </div>
              )}

              {/* Add Prescription Button */}
              {!showEPrescribeForm && (
                <button
                  type="button"
                  onClick={() => {
                    // Validate patient selection
                    if (!formData.patientId) {
                      addNotification('error', 'Please select Patient');
                      return;
                    }
                    setShowEPrescribeForm(true);
                  }}
                  className={`w-full px-4 py-3 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center gap-2 ${
                    theme === 'dark'
                      ? 'border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/5'
                      : 'border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  title="Add a new prescription"
                >
                  <Plus className="w-4 h-4" />
                  Add Prescription
                </button>
              )}
            </div>
          </div>

              {/* Lab Orders */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  <div className="flex items-center gap-2">
                    <Microscope className="w-4 h-4" />
                    Lab Orders (Optional - Will create orders)
                    </div>
                  </label>
                  <div className="space-y-3">
                    {formData.labOrders.map((labOrder, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          theme === 'dark' ? 'bg-slate-800/50 border-slate-600' : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* CPT Codes Multiselect */}
                          <div>
                            <LabCPTMultiSelect
                              theme={theme}
                              api={api}
                              value={labOrder.cptCodes || []}
                              onChange={(codes) => {
                                const updated = [...formData.labOrders];
                                updated[index].cptCodes = codes;
                                setFormData({ ...formData, labOrders: updated });
                              }}
                              label="Lab Tests (CPT Codes) *"
                              placeholder="Select lab test CPT codes..."
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Laboratory */}
                            <div>
                              <label className={`block text-xs font-medium mb-1 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                              }`}>
                                Laboratory *
                              </label>
                              <select
                                required
                                value={labOrder.laboratoryId}
                                onChange={(e) => {
                                  const updated = [...formData.labOrders];
                                  updated[index].laboratoryId = e.target.value;
                                  setFormData({ ...formData, labOrders: updated });
                                }}
                                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${
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

                            {/* Priority */}
                            <div>
                              <label className={`block text-xs font-medium mb-1 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                              }`}>
                                Priority
                              </label>
                              <select
                                value={labOrder.priority || 'routine'}
                                onChange={(e) => {
                                  const updated = [...formData.labOrders];
                                  updated[index].priority = e.target.value;
                                  setFormData({ ...formData, labOrders: updated });
                                }}
                                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${
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

                            {/* Status */}
                            <div>
                              <label className={`block text-xs font-medium mb-1 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                              }`}>
                                Status *
                              </label>
                              <select
                                required
                                value={labOrder.status || 'one-time'}
                                onChange={(e) => {
                                  const updated = [...formData.labOrders];
                                  updated[index].status = e.target.value;
                                  setFormData({ ...formData, labOrders: updated });
                                }}
                                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${
                                  theme === 'dark'
                                    ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                                    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                                }`}
                              >
                                <option value="one-time">One-Time</option>
                                <option value="recurring">Recurring</option>
                              </select>
                            </div>

                            {/* Conditional Date or Frequency based on Status */}
                            <div>
                              {labOrder.status === 'recurring' ? (
                                <>
                                  <label className={`block text-xs font-medium mb-1 ${
                                    theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                                  }`}>
                                    Frequency *
                                  </label>
                                  <select
                                    required
                                    value={labOrder.frequency || ''}
                                    onChange={(e) => {
                                      const updated = [...formData.labOrders];
                                      updated[index].frequency = e.target.value;
                                      setFormData({ ...formData, labOrders: updated });
                                    }}
                                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${
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
                                  <label className={`block text-xs font-medium mb-1 ${
                                    theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                                  }`}>
                                    Collection Date
                                  </label>
                                  <input
                                    type="date"
                                    value={labOrder.statusDate || ''}
                                    min={new Date().toISOString().split('T')[0]}
                                    max={new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]}
                                    onChange={(e) => {
                                      const updated = [...formData.labOrders];
                                      updated[index].statusDate = e.target.value;
                                      setFormData({ ...formData, labOrders: updated });
                                    }}
                                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${
                                      theme === 'dark'
                                        ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                                    }`}
                                  />
                                </>
                              )}
                            </div>

                            {/* Class */}
                            <div>
                              <label className={`block text-xs font-medium mb-1 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                              }`}>
                                Collection Class *
                              </label>
                              <select
                                required
                                value={labOrder.class || 'clinic-collect'}
                                onChange={(e) => {
                                  const updated = [...formData.labOrders];
                                  updated[index].class = e.target.value;
                                  setFormData({ ...formData, labOrders: updated });
                                }}
                                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${
                                  theme === 'dark'
                                    ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                                    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                                }`}
                              >
                                <option value="clinic-collect">Clinic Collect</option>
                                <option value="lab-collect">Lab Collect</option>
                              </select>
                            </div>

                            {/* Result Recipients */}
                            <div className="md:col-span-2">
                              <ResultRecipientsMultiSelect
                                theme={theme}
                                value={labOrder.recipients || []}
                                onChange={(recipients) => {
                                  const updated = [...formData.labOrders];
                                  updated[index].recipients = recipients;
                                  setFormData({ ...formData, labOrders: updated });
                                }}
                                label="Result Recipients *"
                                placeholder="Select who should receive the lab results..."
                                required={true}
                                doctor={user}
                                staff={providers.filter(p => p.role === 'staff')}
                                patient={patient || (formData.patientId && patients.find(p => p.id === formData.patientId))}
                              />
                            </div>
                          </div>

                          {/* Special Instructions */}
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${
                              theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                            }`}>
                              Special Instructions
                            </label>
                            <input
                              type="text"
                              value={labOrder.instructions || ''}
                              onChange={(e) => {
                                const updated = [...formData.labOrders];
                                updated[index].instructions = e.target.value;
                                setFormData({ ...formData, labOrders: updated });
                              }}
                              placeholder="Fasting required, etc."
                              className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${
                                theme === 'dark'
                                  ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-500 focus:border-blue-500'
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                              }`}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.labOrders.filter((_, i) => i !== index);
                            setFormData({ ...formData, labOrders: updated });
                          }}
                          className={`mt-3 flex items-center gap-2 text-xs font-medium transition-colors ${
                            theme === 'dark'
                              ? 'text-red-400 hover:text-red-300'
                              : 'text-red-600 hover:text-red-700'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove Lab Order
                        </button>
                      </div>
                    ))}

                    {/* No Laboratories Message */}
                    {laboratories.length === 0 && (
                      <div className={`p-4 rounded-lg border-2 border-dashed mb-3 ${
                        theme === 'dark' ? 'border-yellow-700 bg-yellow-900/20' : 'border-yellow-300 bg-yellow-50'
                      }`}>
                        <div className="flex items-start gap-3">
                          <Microscope className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                            theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                          }`} />
                          <div>
                            <p className={`font-semibold text-sm ${
                              theme === 'dark' ? 'text-yellow-300' : 'text-yellow-800'
                            }`}>
                              No Laboratories Available
                            </p>
                            <p className={`text-sm mt-1 ${
                              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                            }`}>
                              Please add a laboratory first from the <strong>Laboratory Management</strong> module before creating lab orders.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (laboratories.length === 0) return;
                        setFormData({
                          ...formData,
                          labOrders: [
                            ...formData.labOrders,
                            {
                              cptCodes: [],
                              laboratoryId: '',
                              priority: 'routine',
                              instructions: '',
                              status: 'one-time',
                              statusDate: new Date().toISOString().split('T')[0],
                              frequency: '',
                              class: 'clinic-collect',
                              recipients: []
                            }
                          ]
                        });
                      }}
                      disabled={laboratories.length === 0}
                      className={`w-full px-4 py-3 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center gap-2 ${
                        laboratories.length === 0
                          ? 'border-gray-400 text-gray-400 cursor-not-allowed opacity-50'
                          : theme === 'dark'
                            ? 'border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/5'
                            : 'border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                      title={laboratories.length === 0 ? 'No laboratories available in the system' : 'Add a new lab order'}
                    >
                      <Plus className="w-4 h-4" />
                      {laboratories.length === 0 ? 'No Labs Available' : 'Add Lab Order'}
                    </button>
                  </div>
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

          {/* Linked Prescriptions (shown when editing) */}
          {editDiagnosis && linkedPrescriptions.length > 0 && (
            <div className={`px-6 py-4 border-t ${theme === 'dark' ? 'border-slate-700 bg-slate-900/30' : 'border-gray-300 bg-gray-50'}`}>
              <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <Pill className="w-4 h-4" />
                Prescriptions Created from this Diagnosis ({linkedPrescriptions.length})
              </h4>
              <div className="space-y-2">
                {linkedPrescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className={`p-3 rounded-lg border ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {rx.medicationName || rx.medication_name}
                        </p>
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          {rx.dosage} • {rx.frequency}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        rx.status === 'Active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {rx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked Lab Orders (shown when editing) */}
          {editDiagnosis && linkedLabOrders.length > 0 && (
            <div className={`px-6 py-4 border-t ${theme === 'dark' ? 'border-slate-700 bg-slate-900/30' : 'border-gray-300 bg-gray-50'}`}>
              <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <Microscope className="w-4 h-4" />
                Lab Orders Created from this Diagnosis ({linkedLabOrders.length})
              </h4>
              <div className="space-y-3">
                {linkedLabOrders.map((order) => {
                  const testCodes = order.test_codes ? (typeof order.test_codes === 'string' ? JSON.parse(order.test_codes) : order.test_codes) : [];
                  const recipients = order.result_recipients ? (typeof order.result_recipients === 'string' ? JSON.parse(order.result_recipients) : order.result_recipients) : [];

                  // Helper function to get color for recipient type
                  const getRecipientColor = (type) => {
                    switch (type) {
                      case 'doctor':
                        return theme === 'dark' ? 'bg-blue-900/50 text-blue-200 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-300';
                      case 'staff':
                        return theme === 'dark' ? 'bg-green-900/50 text-green-200 border-green-700' : 'bg-green-100 text-green-800 border-green-300';
                      case 'patient':
                        return theme === 'dark' ? 'bg-orange-900/50 text-orange-200 border-orange-700' : 'bg-orange-100 text-orange-800 border-orange-300';
                      default:
                        return theme === 'dark' ? 'bg-gray-900/50 text-gray-200 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-300';
                    }
                  };

                  return (
                    <div
                      key={order.id}
                      className={`p-4 rounded-lg border ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {order.order_number}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {testCodes.slice(0, 3).map((code, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {code}
                              </span>
                            ))}
                            {testCodes.length > 3 && (
                              <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                +{testCodes.length - 3} more
                              </span>
                            )}
                          </div>
                          <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                            Priority: {(order.priority || 'routine').toUpperCase()} • Class: {(order.collection_class || 'clinic-collect').replace('-', ' ').toUpperCase()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : order.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {order.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      {/* Result Recipients */}
                      {recipients && recipients.length > 0 && (
                        <div className="mt-2 pt-2 border-t" style={{borderColor: theme === 'dark' ? '#475569' : '#e5e7eb'}}>
                          <p className={`text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                            Result Recipients:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {recipients.map((recipient, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${getRecipientColor(recipient.type)}`}
                              >
                                <span>{recipient.name}</span>
                                <span className="opacity-75">({recipient.type})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
    </>
  );
};

export default DiagnosisForm;
