import React, { useState, useEffect } from 'react';
import { DollarSign, X, Save, Bot, Search, Plus, Trash2 } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewClaimForm = ({ theme, api, patients, claims, onClose, onSuccess, addNotification, t }) => {
  const [formData, setFormData] = useState({
    patientId: '',
    payerId: '',
    serviceDate: '',
    amount: '',
    notes: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
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
  const [existingDiagnoses, setExistingDiagnoses] = useState([]);
  const [loadingDiagnoses, setLoadingDiagnoses] = useState(false);

  // Auto-load insurance payer from patient profile when patient is selected
  useEffect(() => {
    if (formData.patientId) {
      const selectedPatient = patients.find(p => p.id.toString() === formData.patientId);
      if (selectedPatient && selectedPatient.insurance_payer_id) {
        setFormData(prev => ({...prev, payerId: selectedPatient.insurance_payer_id}));
      }
    }
  }, [formData.patientId, patients]);

  // Load existing diagnoses when patient is selected
  useEffect(() => {
    const loadPatientDiagnoses = async () => {
      if (!formData.patientId) {
        setExistingDiagnoses([]);
        return;
      }

      setLoadingDiagnoses(true);
      try {
        const diagnoses = await api.getPatientDiagnoses(formData.patientId);
        setExistingDiagnoses(diagnoses || []);
      } catch (error) {
        console.error('Error loading patient diagnoses:', error);
        setExistingDiagnoses([]);
      } finally {
        setLoadingDiagnoses(false);
      }
    };
    loadPatientDiagnoses();
  }, [formData.patientId, api]);

  // Load insurance payers on mount
  useEffect(() => {
    const loadPayers = async () => {
      try {
        const payers = await api.getInsurancePayers(true); // active_only=true
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

      // Auto-populate service date from diagnosis date if not already set
      if (diagnosis.diagnosedDate || diagnosis.diagnosed_date) {
        if (!formData.serviceDate) {
          const diagnosisDate = diagnosis.diagnosedDate || diagnosis.diagnosed_date;
          // Format date to YYYY-MM-DD if needed
          const formattedDate = diagnosisDate.split('T')[0];
          setFormData(prev => ({ ...prev, serviceDate: formattedDate }));
        }
      }

      // If diagnosis has associated CPT codes in notes, extract and add them
      // Only do this when selecting from existing patient diagnoses
      if (diagnosis.notes && typeof diagnosis.notes === 'string') {
        const cptMatch = diagnosis.notes.match(/CPT Codes:\s*([^]*?)(?:\n\n|$)/);
        if (cptMatch) {
          const cptSection = cptMatch[1];
          // Extract codes from format "99213 (Description); 85025 (Description)"
          const cptEntries = cptSection.split(';').map(entry => entry.trim()).filter(Boolean);

          for (const entry of cptEntries) {
            // Parse "99213 (Description)" format
            const match = entry.match(/^(\d+)\s*\(([^)]+)\)/);
            if (match) {
              const [, code, description] = match;
              // Check if this procedure is not already added
              if (!selectedProcedures.find(p => p.code === code)) {
                setSelectedProcedures(prev => [...prev, { code, description }]);
              }
            }
          }
        }
      }
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedDiagnoses.length === 0) {
      addNotification('alert', 'Please add at least one diagnosis code');
      return;
    }

    if (selectedProcedures.length === 0) {
      addNotification('alert', 'Please add at least one procedure code');
      return;
    }

    try {
      const claimNo = `CLM-2024-${String(claims.length + 1).padStart(3, '0')}`;
      const patient = patients.find(p => p.id.toString() === formData.patientId);
      const payer = insurancePayers.find(p => p.id.toString() === formData.payerId);

      const claimData = {
        claim_number: claimNo,
        patient_id: formData.patientId,
        payer: payer?.name || 'Unknown',
        amount: parseFloat(formData.amount),
        status: 'pending',
        service_date: formData.serviceDate,
        diagnosis_codes: selectedDiagnoses.map(d => d.code),
        procedure_codes: selectedProcedures.map(p => p.code),
        notes: formData.notes
      };

      const newClaim = await api.createClaim(claimData);

      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : t.patient || 'patient';
      await addNotification('claim', `${t.newClaimCreated || 'New claim'} ${claimNo} ${t.createdFor || 'created for'} ${patientName}`);

      // Show success confirmation
      setShowConfirmation(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onSuccess(newClaim);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error creating claim:', err);
      addNotification('alert', t.failedToCreateClaim || 'Failed to create claim. Please try again.');
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
        message={t.claimCreatedSuccess || 'Claim has been created successfully.'}
        type="success"
        confirmText={t.ok || 'OK'}
        showCancel={false}
      />
      <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
        <div className={`rounded-xl border max-w-4xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-yellow-500/10 to-orange-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
              <DollarSign className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.newClaim || 'New Claim'}</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-6">
            {/* Patient and Payer Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.patient || 'Patient'} <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.patientId}
                  onChange={(e) => setFormData({...formData, patientId: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="">{t.selectPatient || 'Select Patient'}</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name} - {p.mrn}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.insurancePayer || 'Insurance Payer'} <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.payerId}
                  onChange={(e) => setFormData({...formData, payerId: e.target.value})}
                  disabled={loadingPayers}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'} ${loadingPayers ? 'opacity-50' : ''}`}
                >
                  <option value="">{loadingPayers ? 'Loading...' : (t.selectPayer || 'Select Payer')}</option>
                  {insurancePayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.payer_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.serviceDate || 'Service Date'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.serviceDate}
                  onChange={(e) => setFormData({...formData, serviceDate: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.claimAmount || 'Claim Amount ($)'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  placeholder={t.amountPlaceholder || '0.00'}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>
            </div>

            {/* Diagnosis Codes Search and Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.diagnosisCodes || 'Diagnosis Codes (ICD-10)'} <span className="text-red-400">*</span>
              </label>

              {/* Existing Patient Diagnoses Dropdown */}
              {formData.patientId && existingDiagnoses.length > 0 && (
                <div className="mb-3">
                  <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.selectFromExistingDiagnoses || 'Select from existing diagnoses (also loads related CPT codes)'}
                  </label>
                  <select
                    onChange={(e) => {
                      const diagnosis = existingDiagnoses.find(d => d.diagnosisCode === e.target.value);
                      if (diagnosis) {
                        handleAddDiagnosis({
                          code: diagnosis.diagnosisCode,
                          description: diagnosis.diagnosisName,
                          notes: diagnosis.notes // Include notes to extract CPT codes
                        });
                        e.target.value = '';
                      }
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    disabled={loadingDiagnoses}
                  >
                    <option value="">{loadingDiagnoses ? 'Loading...' : (t.selectDiagnosis || 'Select a previous diagnosis')}</option>
                    {existingDiagnoses.map((d) => (
                      <option key={d.id} value={d.diagnosisCode}>
                        {d.diagnosisCode} - {d.diagnosisName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search Input */}
              <div className="relative mb-3">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={diagnosisSearch}
                  onChange={(e) => setDiagnosisSearch(e.target.value)}
                  placeholder={t.searchDiagnosisCodes || 'Search diagnosis codes or descriptions...'}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
                {searchingDiagnosis && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-500"></div>
                  </div>
                )}
              </div>

              {/* Search Results Dropdown */}
              {diagnosisResults.length > 0 && (
                <div className={`mb-3 max-h-48 overflow-y-auto border rounded-lg ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`}>
                  {diagnosisResults.map((diagnosis) => (
                    <button
                      key={diagnosis.code}
                      type="button"
                      onClick={() => handleAddDiagnosis(diagnosis)}
                      className={`w-full text-left px-4 py-2 hover:bg-yellow-500/10 transition-colors border-b last:border-b-0 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`font-mono text-sm ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>{diagnosis.code}</span>
                          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{diagnosis.description}</p>
                        </div>
                        <Plus className="w-5 h-5 text-yellow-500" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Diagnoses */}
              <div className="space-y-2">
                {selectedDiagnoses.map((diagnosis) => (
                  <div key={diagnosis.code} className={`flex items-center justify-between p-3 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-yellow-50 border-yellow-200'}`}>
                    <div>
                      <span className={`font-mono text-sm font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>{diagnosis.code}</span>
                      <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{diagnosis.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDiagnosis(diagnosis.code)}
                      className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-yellow-200'}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
              {selectedDiagnoses.length === 0 && (
                <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                  {t.searchAndSelectDiagnoses || 'Search and select diagnosis codes above'}
                </p>
              )}
            </div>

            {/* Procedure Codes Search and Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.procedureCodes || 'Procedure Codes (CPT)'} <span className="text-red-400">*</span>
              </label>

              {/* Search Input */}
              <div className="relative mb-3">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={procedureSearch}
                  onChange={(e) => setProcedureSearch(e.target.value)}
                  placeholder={t.searchProcedureCodes || 'Search procedure codes or descriptions...'}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
                {searchingProcedure && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-500"></div>
                  </div>
                )}
              </div>

              {/* Search Results Dropdown */}
              {procedureResults.length > 0 && (
                <div className={`mb-3 max-h-48 overflow-y-auto border rounded-lg ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`}>
                  {procedureResults.map((procedure) => (
                    <button
                      key={procedure.code}
                      type="button"
                      onClick={() => handleAddProcedure(procedure)}
                      className={`w-full text-left px-4 py-2 hover:bg-yellow-500/10 transition-colors border-b last:border-b-0 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`font-mono text-sm ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>{procedure.code}</span>
                          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{procedure.description}</p>
                        </div>
                        <Plus className="w-5 h-5 text-yellow-500" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Procedures */}
              <div className="space-y-2">
                {selectedProcedures.map((procedure) => (
                  <div key={procedure.code} className={`flex items-center justify-between p-3 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-yellow-50 border-yellow-200'}`}>
                    <div>
                      <span className={`font-mono text-sm font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>{procedure.code}</span>
                      <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{procedure.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveProcedure(procedure.code)}
                      className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-yellow-200'}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
              {selectedProcedures.length === 0 && (
                <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                  {t.searchAndSelectProcedures || 'Search and select procedure codes above'}
                </p>
              )}
            </div>

            {/* Clinical Notes */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.clinicalNotes || 'Clinical Notes'}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows="4"
                placeholder={t.clinicalNotesPlaceholder || 'Add any relevant clinical documentation or notes...'}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
            </div>

            {/* AI Assistant Info */}
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Bot className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-cyan-400 text-sm font-medium mb-1">{t.aiCodingAssistant || 'AI Coding Assistant'}</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.aiCodingAssistantDescription || 'Search for diagnosis and procedure codes by description or code. Codes are automatically populated from the medical codes database.'}
                  </p>
                </div>
              </div>
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
              className={`flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              <Save className="w-5 h-5" />
              {t.createClaim || 'Create Claim'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default NewClaimForm;
