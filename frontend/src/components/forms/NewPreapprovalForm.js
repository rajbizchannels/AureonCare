import React, { useState, useEffect } from 'react';
import { FileCheck, X, Save, Search, Plus, Trash2, Printer, AlertCircle, Shield } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewPreapprovalForm = ({ theme, api, patients, onClose, onSuccess, addNotification, t }) => {
  const [formData, setFormData] = useState({
    patientId: '',
    insurancePayerId: '',
    requestedService: '',
    serviceStartDate: '',
    serviceEndDate: '',
    estimatedCost: '',
    clinicalNotes: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showNoClearinghouseModal, setShowNoClearinghouseModal] = useState(false);
  const [clearinghouseStatus, setClearinghouseStatus] = useState({ hasClearinghouse: false });
  const [insurancePayers, setInsurancePayers] = useState([]);
  const [loadingPayers, setLoadingPayers] = useState(true);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState([]);
  const [selectedProcedures, setSelectedProcedures] = useState([]);
  const [diagnosisSearch, setDiagnosisSearch] = useState('');
  const [procedureSearch, setProcedureSearch] = useState('');
  const [diagnosisResults, setDiagnosisResults] = useState([]);
  const [procedureResults, setProcedureResults] = useState([]);
  const [searchingDiagnosis, setSearchingDiagnosis] = useState(false);
  const [searchingProcedure, setSearchingProcedure] = useState(false);
  const [selectedPatientInsurer, setSelectedPatientInsurer] = useState(null);
  const [diagnoses, setDiagnoses] = useState([]);
  const [loadingDiagnoses, setLoadingDiagnoses] = useState(false);
  const [selectedDiagnosisId, setSelectedDiagnosisId] = useState('');

  // Load diagnoses when patient is selected
  useEffect(() => {
    const loadDiagnoses = async () => {
      if (!formData.patientId) {
        setDiagnoses([]);
        return;
      }

      setLoadingDiagnoses(true);
      try {
        const patientDiagnoses = await api.getDiagnoses(formData.patientId);
        setDiagnoses(patientDiagnoses || []);
      } catch (error) {
        console.error('Error loading diagnoses:', error);
        setDiagnoses([]);
      } finally {
        setLoadingDiagnoses(false);
      }
    };
    loadDiagnoses();
  }, [formData.patientId, api]);

  // Auto-load insurance payer from patient profile when patient is selected
  useEffect(() => {
    if (formData.patientId) {
      const selectedPatient = patients.find(p => p.id.toString() === formData.patientId);
      if (selectedPatient && selectedPatient.insurance_payer_id) {
        setFormData(prev => ({ ...prev, insurancePayerId: selectedPatient.insurance_payer_id }));

        // Find the insurance payer details
        const payer = insurancePayers.find(ip => ip.id === selectedPatient.insurance_payer_id);
        setSelectedPatientInsurer(payer);
      } else {
        setSelectedPatientInsurer(null);
      }
    }
  }, [formData.patientId, patients, insurancePayers]);

  // Load insurance payers on mount
  useEffect(() => {
    const loadPayers = async () => {
      try {
        const payers = await api.getInsurancePayers(true);
        setInsurancePayers(payers);
      } catch (error) {
        console.error('Error loading insurance payers:', error);
        addNotification('alert', 'Failed to load insurance payers');
      } finally {
        setLoadingPayers(false);
      }
    };
    loadPayers();
  }, [api, addNotification]);

  // Check clearinghouse status on mount
  useEffect(() => {
    const checkClearinghouse = async () => {
      try {
        const status = await api.checkClearinghouseStatus();
        setClearinghouseStatus(status);
      } catch (error) {
        console.error('Error checking clearinghouse status:', error);
      }
    };
    checkClearinghouse();
  }, [api]);

  // Search diagnoses (ICD codes) with debounce
  useEffect(() => {
    const searchDiagnoses = async () => {
      if (!diagnosisSearch || diagnosisSearch.length < 2) {
        setDiagnosisResults([]);
        return;
      }

      setSearchingDiagnosis(true);
      try {
        const results = await api.searchMedicalCodes(diagnosisSearch, 'icd');
        setDiagnosisResults(results);
      } catch (error) {
        console.error('Error searching diagnoses:', error);
      } finally {
        setSearchingDiagnosis(false);
      }
    };

    const timer = setTimeout(searchDiagnoses, 300);
    return () => clearTimeout(timer);
  }, [diagnosisSearch, api]);

  // Search procedures (CPT codes) with debounce
  useEffect(() => {
    const searchProcedures = async () => {
      if (!procedureSearch || procedureSearch.length < 2) {
        setProcedureResults([]);
        return;
      }

      setSearchingProcedure(true);
      try {
        const results = await api.searchMedicalCodes(procedureSearch, 'cpt');
        setProcedureResults(results);
      } catch (error) {
        console.error('Error searching procedures:', error);
      } finally {
        setSearchingProcedure(false);
      }
    };

    const timer = setTimeout(searchProcedures, 300);
    return () => clearTimeout(timer);
  }, [procedureSearch, api]);

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

  const handleAddDiagnosis = (diagnosis) => {
    if (!selectedDiagnoses.find(d => d.code === diagnosis.code)) {
      setSelectedDiagnoses([...selectedDiagnoses, diagnosis]);
      setDiagnosisSearch('');
      setDiagnosisResults([]);
    }
  };

  const handleRemoveDiagnosis = (code) => {
    setSelectedDiagnoses(selectedDiagnoses.filter(d => d.code !== code));
  };

  const handleAddProcedure = (procedure) => {
    if (!selectedProcedures.find(p => p.code === procedure.code)) {
      setSelectedProcedures([...selectedProcedures, procedure]);
      setProcedureSearch('');
      setProcedureResults([]);
    }
  };

  const handleRemoveProcedure = (code) => {
    setSelectedProcedures(selectedProcedures.filter(p => p.code !== code));
  };

  // Handle diagnosis selection - populate form fields from diagnosis
  const handleDiagnosisSelection = async (diagnosisId) => {
    setSelectedDiagnosisId(diagnosisId);

    if (!diagnosisId) {
      // Clear fields if no diagnosis selected
      return;
    }

    const diagnosis = diagnoses.find(d => d.id.toString() === diagnosisId);
    if (!diagnosis) return;

    try {
      // Set the requested service from diagnosis name
      setFormData(prev => ({
        ...prev,
        requestedService: diagnosis.diagnosisName || '',
        clinicalNotes: diagnosis.notes || prev.clinicalNotes
      }));

      // Parse and load ICD codes from diagnosis
      const icdCodes = [];
      if (diagnosis.diagnosisCode && typeof diagnosis.diagnosisCode === 'string') {
        const icdCodeStrings = diagnosis.diagnosisCode.split(',').map(c => c.trim()).filter(Boolean);

        // Fetch full code objects for each ICD code
        for (const codeStr of icdCodeStrings) {
          try {
            const codeData = await api.getMedicalCodeByCode(codeStr);
            if (codeData) {
              icdCodes.push({
                code: codeData.code,
                display: codeData.display || codeData.description || codeStr
              });
            }
          } catch (error) {
            console.error(`Error fetching ICD code ${codeStr}:`, error);
            // Add as fallback even if fetch fails
            icdCodes.push({ code: codeStr, display: codeStr });
          }
        }
      }
      setSelectedDiagnoses(icdCodes);

      // Parse and load CPT codes from diagnosis notes
      const cptCodes = [];
      if (diagnosis.notes && typeof diagnosis.notes === 'string') {
        const cptMatch = diagnosis.notes.match(/CPT Codes:\s*([^]*?)(?:\n\n|$)/);
        if (cptMatch) {
          const cptSection = cptMatch[1];
          const cptEntries = cptSection.split(';').map(entry => entry.trim()).filter(Boolean);

          for (const entry of cptEntries) {
            const match = entry.match(/^(\d+)\s*\(([^)]+)\)/);
            if (match) {
              const [, code, description] = match;
              cptCodes.push({ code, display: description });
            }
          }
        }
      }
      setSelectedProcedures(cptCodes);

    } catch (error) {
      console.error('Error loading diagnosis details:', error);
      addNotification('alert', 'Error loading diagnosis details');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.patientId || !formData.insurancePayerId || !formData.requestedService) {
      addNotification('alert', 'Please fill in all required fields');
      return;
    }

    // Check if clearinghouse is integrated
    if (!clearinghouseStatus.hasClearinghouse) {
      setShowNoClearinghouseModal(true);
      return;
    }

    // Proceed with clearinghouse submission
    await submitPreapproval(true);
  };

  const submitPreapproval = async (submitToClearinghouse = false) => {
    try {
      // Generate preapproval number
      const timestamp = Date.now();
      const preapprovalNumber = `PA-${timestamp}`;

      const preapprovalData = {
        preapproval_number: preapprovalNumber,
        patient_id: formData.patientId,
        insurance_payer_id: formData.insurancePayerId,
        requested_service: formData.requestedService,
        diagnosis_codes: JSON.stringify(selectedDiagnoses.map(d => ({ code: d.code, display: d.display }))),
        procedure_codes: JSON.stringify(selectedProcedures.map(p => ({ code: p.code, display: p.display }))),
        service_start_date: formData.serviceStartDate,
        service_end_date: formData.serviceEndDate,
        estimated_cost: parseFloat(formData.estimatedCost) || 0,
        clinical_notes: formData.clinicalNotes,
        submitToClearinghouse: submitToClearinghouse
      };

      const newPreapproval = await api.createPreapproval(preapprovalData);
      addNotification('success', 'Pre-authorization request created successfully');
      onSuccess(newPreapproval);
    } catch (error) {
      console.error('Error creating preapproval:', error);
      addNotification('alert', error.message || 'Failed to create pre-authorization request');
    }
  };

  const handlePrint = () => {
    // Generate print content
    const printWindow = window.open('', '_blank');
    const patient = patients.find(p => p.id.toString() === formData.patientId);
    const insurer = insurancePayers.find(ip => ip.id === formData.insurancePayerId);

    printWindow.document.write(`
      <html>
        <head>
          <title>Pre-Authorization Request</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
            .section { margin: 20px 0; }
            .field { margin: 10px 0; }
            .label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Prior Authorization Request</h1>
          <div class="section">
            <h2>Patient Information</h2>
            <div class="field"><span class="label">Name:</span> ${patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'}</div>
            <div class="field"><span class="label">MRN:</span> ${patient?.medical_record_number || 'N/A'}</div>
          </div>
          <div class="section">
            <h2>Insurance Information</h2>
            <div class="field"><span class="label">Payer:</span> ${insurer?.name || 'N/A'}</div>
            <div class="field"><span class="label">Payer ID:</span> ${insurer?.payer_id || 'N/A'}</div>
          </div>
          <div class="section">
            <h2>Requested Service</h2>
            <div class="field">${formData.requestedService}</div>
          </div>
          <div class="section">
            <h2>Service Dates</h2>
            <div class="field"><span class="label">Start:</span> ${formData.serviceStartDate || 'N/A'}</div>
            <div class="field"><span class="label">End:</span> ${formData.serviceEndDate || 'N/A'}</div>
          </div>
          <div class="section">
            <h2>Diagnosis Codes (ICD-10)</h2>
            <table>
              <tr><th>Code</th><th>Description</th></tr>
              ${selectedDiagnoses.map(d => `<tr><td>${d.code}</td><td>${d.display}</td></tr>`).join('')}
            </table>
          </div>
          <div class="section">
            <h2>Procedure Codes (CPT)</h2>
            <table>
              <tr><th>Code</th><th>Description</th></tr>
              ${selectedProcedures.map(p => `<tr><td>${p.code}</td><td>${p.display}</td></tr>`).join('')}
            </table>
          </div>
          <div class="section">
            <h2>Estimated Cost</h2>
            <div class="field">$${formData.estimatedCost || '0.00'}</div>
          </div>
          <div class="section">
            <h2>Clinical Notes</h2>
            <div class="field">${formData.clinicalNotes || 'None'}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleNoClearinghouseAction = async (action) => {
    setShowNoClearinghouseModal(false);
    if (action === 'print') {
      handlePrint();
      // Still save the preapproval without clearinghouse submission
      await submitPreapproval(false);
    } else if (action === 'save') {
      await submitPreapproval(false);
    }
  };

  return (
    <div className="relative">
      {/* Close button - positioned at top right */}
      <button
        onClick={onClose}
        className={`absolute -top-2 -right-2 p-2 rounded-full transition-colors ${
          theme === 'dark'
            ? 'bg-slate-700 hover:bg-slate-600 text-white'
            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
        }`}
        title="Close (Esc)"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3 mb-6">
        <FileCheck className="w-6 h-6 text-blue-500" />
        <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Request Pre-Authorization
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Selection */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Patient *
          </label>
          <select
            value={formData.patientId}
            onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
            className={`w-full px-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            required
          >
            <option value="">Select a patient</option>
            {patients.map(patient => (
              <option key={patient.id} value={patient.id}>
                {patient.first_name} {patient.last_name} - MRN: {patient.medical_record_number}
              </option>
            ))}
          </select>
        </div>

        {/* Insurance Payer - Auto-populated from patient */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Insurance Payer *
          </label>
          {selectedPatientInsurer ? (
            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : 'bg-gray-100 border-gray-300'}`}>
              <div className="flex items-start gap-2">
                <Shield className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} mt-0.5`} />
                <div>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {selectedPatientInsurer.name}
                  </p>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Payer ID: {selectedPatientInsurer.payer_id}
                  </p>
                  {selectedPatientInsurer.prior_authorization_required && (
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                      ✓ Prior authorization required by this payer
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-300'}`}>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {formData.patientId ? 'No insurance payer assigned to this patient' : 'Select a patient to view insurance payer'}
              </p>
            </div>
          )}
        </div>

        {/* Diagnosis Selection - Load data from existing diagnosis */}
        {formData.patientId && (
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Load from Existing Diagnosis (Optional)
            </label>
            <select
              value={selectedDiagnosisId}
              onChange={(e) => handleDiagnosisSelection(e.target.value)}
              disabled={loadingDiagnoses || diagnoses.length === 0}
              className={`w-full px-4 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            >
              <option value="">
                {loadingDiagnoses ? 'Loading diagnoses...' : diagnoses.length === 0 ? 'No diagnoses available' : 'Select a diagnosis to auto-fill'}
              </option>
              {diagnoses.map(diagnosis => (
                <option key={diagnosis.id} value={diagnosis.id}>
                  {diagnosis.diagnosisName} - {diagnosis.diagnosedDate ? new Date(diagnosis.diagnosedDate).toLocaleDateString() : 'No date'}
                </option>
              ))}
            </select>
            {selectedDiagnosisId && (
              <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                ✓ Form fields have been auto-filled from diagnosis. You can still edit all fields below.
              </p>
            )}
          </div>
        )}

        {/* Requested Service */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Requested Service *
          </label>
          <input
            type="text"
            value={formData.requestedService}
            onChange={(e) => setFormData({ ...formData, requestedService: e.target.value })}
            className={`w-full px-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            placeholder="e.g., MRI of the spine, Physical therapy, Surgical procedure"
            required
          />
        </div>

        {/* Service Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Service Start Date
            </label>
            <input
              type="date"
              value={formData.serviceStartDate}
              onChange={(e) => setFormData({ ...formData, serviceStartDate: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Service End Date
            </label>
            <input
              type="date"
              value={formData.serviceEndDate}
              onChange={(e) => setFormData({ ...formData, serviceEndDate: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>
        </div>

        {/* Diagnosis Codes */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Diagnosis Codes (ICD-10)
          </label>
          <div className="relative">
            <div className="flex gap-2">
              <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                value={diagnosisSearch}
                onChange={(e) => setDiagnosisSearch(e.target.value)}
                className={`flex-1 pl-10 pr-4 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="Search ICD-10 codes..."
              />
            </div>
            {searchingDiagnosis && (
              <div className={`absolute right-3 top-3 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Searching...
              </div>
            )}
            {diagnosisResults.length > 0 && (
              <div className={`absolute z-10 w-full mt-1 rounded-lg border shadow-lg max-h-60 overflow-y-auto ${
                theme === 'dark' ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'
              }`}>
                {diagnosisResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleAddDiagnosis(result)}
                    className={`px-4 py-2 cursor-pointer flex justify-between items-center ${
                      theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-gray-100'
                    }`}
                  >
                    <div>
                      <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {result.code}
                      </div>
                      <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {result.display}
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-blue-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedDiagnoses.length > 0 && (
            <div className="mt-2 space-y-2">
              {selectedDiagnoses.map((diagnosis) => (
                <div
                  key={diagnosis.code}
                  className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                    theme === 'dark' ? 'bg-slate-600' : 'bg-gray-100'
                  }`}
                >
                  <div>
                    <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {diagnosis.code}
                    </span>
                    <span className={`ml-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {diagnosis.display}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDiagnosis(diagnosis.code)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Procedure Codes */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Procedure Codes (CPT)
          </label>
          <div className="relative">
            <div className="flex gap-2">
              <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                value={procedureSearch}
                onChange={(e) => setProcedureSearch(e.target.value)}
                className={`flex-1 pl-10 pr-4 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="Search CPT codes..."
              />
            </div>
            {searchingProcedure && (
              <div className={`absolute right-3 top-3 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Searching...
              </div>
            )}
            {procedureResults.length > 0 && (
              <div className={`absolute z-10 w-full mt-1 rounded-lg border shadow-lg max-h-60 overflow-y-auto ${
                theme === 'dark' ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'
              }`}>
                {procedureResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleAddProcedure(result)}
                    className={`px-4 py-2 cursor-pointer flex justify-between items-center ${
                      theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-gray-100'
                    }`}
                  >
                    <div>
                      <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {result.code}
                      </div>
                      <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {result.display}
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-blue-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedProcedures.length > 0 && (
            <div className="mt-2 space-y-2">
              {selectedProcedures.map((procedure) => (
                <div
                  key={procedure.code}
                  className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                    theme === 'dark' ? 'bg-slate-600' : 'bg-gray-100'
                  }`}
                >
                  <div>
                    <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {procedure.code}
                    </span>
                    <span className={`ml-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {procedure.display}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveProcedure(procedure.code)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Estimated Cost */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Estimated Cost
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.estimatedCost}
            onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
            className={`w-full px-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            placeholder="0.00"
          />
        </div>

        {/* Clinical Notes */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Clinical Notes
          </label>
          <textarea
            value={formData.clinicalNotes}
            onChange={(e) => setFormData({ ...formData, clinicalNotes: e.target.value })}
            rows="4"
            className={`w-full px-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            placeholder="Enter any additional clinical notes or justification for the pre-authorization request..."
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className={`px-6 py-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            Submit Pre-Authorization Request
          </button>
        </div>
      </form>

      {/* No Clearinghouse Modal */}
      {showNoClearinghouseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-xl p-6 max-w-md w-full mx-4 ${
            theme === 'dark' ? 'bg-slate-800' : 'bg-white'
          }`}>
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  No ClearingHouse Integrated
                </h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  There is no clearinghouse integration configured. However, you can save this request and print it for manual submission.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNoClearinghouseModal(false)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleNoClearinghouseAction('save')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                Save Only
              </button>
              <button
                onClick={() => handleNoClearinghouseAction('print')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewPreapprovalForm;
