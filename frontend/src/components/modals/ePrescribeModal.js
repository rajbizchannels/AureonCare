import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, AlertCircle, CheckCircle, Pill, Building2, Send } from 'lucide-react';

const EPrescribeModal = ({
  theme,
  patient,
  provider,
  api,
  onClose,
  onSuccess,
  addNotification
}) => {
  const [step, setStep] = useState(1); // 1: Search Med, 2: Details, 3: Pharmacy, 4: Review
  const [searchQuery, setSearchQuery] = useState('');
  const [medications, setMedications] = useState([]);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [safetyWarnings, setSafetyWarnings] = useState([]);

  const [prescriptionDetails, setPrescriptionDetails] = useState({
    dosage: '',
    frequency: '',
    duration: '',
    quantity: '',
    refills: 0,
    instructions: '',
    substitutionAllowed: true
  });

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

  // Auto-advance to step 2 when medication is selected
  useEffect(() => {
    if (selectedMedication && step === 1) {
      console.log('[ePrescribe] selectedMedication changed, advancing to step 2');
      setStep(2);
    }
  }, [selectedMedication, step]);

  // Search medications - wrapped in useCallback to prevent unnecessary re-renders
  const handleSearchMedications = useCallback(async () => {
    if (!searchQuery) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/medications/search?query=${encodeURIComponent(searchQuery)}&limit=20`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

        if (response.status === 501 || response.status === 500) {
          // ePrescribing not available
          addNotification('alert', 'ePrescribing functionality requires migration 015 to be run. Please contact your system administrator.');
          setMedications([]);
          return;
        }

        throw new Error(errorData.error || 'Failed to search medications');
      }

      const data = await response.json();
      setMedications(data);
    } catch (error) {
      console.error('Error searching medications:', error);
      addNotification('alert', 'Failed to search medications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, addNotification]);

  // Auto-search as user types (debounced)
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setMedications([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearchMedications();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearchMedications]);

  // Select medication and check safety
  const handleSelectMedication = async (medication) => {
    console.log('[ePrescribe] Selected medication:', medication);
    console.log('[ePrescribe] Patient:', patient);

    // Pre-fill dosage from medication
    const dosage = medication.commonDosages && medication.commonDosages.length > 0
      ? (medication.strength || medication.commonDosages[0])
      : (medication.strength || '');

    setPrescriptionDetails(prev => ({
      ...prev,
      dosage: dosage
    }));

    // Set selected medication - useEffect will handle step advancement
    setSelectedMedication(medication);

    // Run safety check in background (non-blocking)
    setLoading(true);
    try {
      const ndcCode = medication.ndcCode || medication.ndc_code;
      console.log('[ePrescribe] Checking safety with NDC:', ndcCode, 'Patient ID:', patient.id);

      const response = await fetch('/api/prescriptions/check-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          ndcCode: ndcCode,
          currentMedications: [] // TODO: Get patient's current medications
        })
      });

      console.log('[ePrescribe] Safety check response status:', response.status);

      if (response.ok) {
        const safetyData = await response.json();
        console.log('[ePrescribe] Safety data:', safetyData);
        setSafetyWarnings(safetyData.warnings || []);
      } else if (response.status === 501) {
        console.log('[ePrescribe] Safety check not available - ePrescribing schema not installed');
        setSafetyWarnings([]);
      } else {
        const errorText = await response.text();
        console.error('[ePrescribe] Safety check error:', response.status, errorText);
        setSafetyWarnings([]);
      }
    } catch (error) {
      console.error('[ePrescribe] Error in safety check:', error);
      setSafetyWarnings([]);
    } finally {
      setLoading(false);
    }
  };

  // Load patient's preferred pharmacies
  const loadPharmacies = async () => {
    setLoading(true);
    try {
      // First try to get patient's preferred pharmacies
      let response = await fetch(`/api/pharmacies/patient/${patient.id}/preferred`);

      if (!response.ok) {
        if (response.status === 501 || response.status === 500) {
          addNotification('alert', 'Pharmacy network requires migration 015. Please contact your administrator.');
          setPharmacies([]);
          setLoading(false);
          return;
        }
        throw new Error('Failed to load preferred pharmacies');
      }

      let data = await response.json();

      // If no preferred pharmacies, get nearby pharmacies
      const zipCode = patient.zipCode || patient.zip_code || patient.zip;
      if (data.length === 0 && zipCode) {
        response = await fetch(`/api/pharmacies/search?zip=${zipCode}&limit=10`);
        if (response.ok) {
          data = await response.json();
        }
      }

      setPharmacies(data);

      // Auto-select preferred pharmacy if exists
      const preferred = data.find(p => p.isPreferred);
      if (preferred) {
        setSelectedPharmacy(preferred);
      }
    } catch (error) {
      console.error('Error loading pharmacies:', error);
      addNotification('alert', 'Failed to load pharmacies');
      setPharmacies([]);
    } finally {
      setLoading(false);
    }
  };

  // Submit prescription
  const handleSubmitPrescription = async () => {
    setLoading(true);
    try {
      // Create prescription
      const prescriptionPayload = {
        patientId: patient.id,
        providerId: provider.id,
        medicationName: selectedMedication.drugName,
        ndcCode: selectedMedication.ndcCode,
        dosage: prescriptionDetails.dosage,
        frequency: prescriptionDetails.frequency,
        duration: prescriptionDetails.duration,
        quantity: parseInt(prescriptionDetails.quantity),
        refills: parseInt(prescriptionDetails.refills),
        instructions: prescriptionDetails.instructions,
        substitutionAllowed: prescriptionDetails.substitutionAllowed,
        status: 'Active',
        prescribedDate: new Date().toISOString().split('T')[0]
      };

      const createResponse = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prescriptionPayload)
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create prescription');
      }

      const prescription = await createResponse.json();

      // Send electronically to pharmacy (if ePrescribing is available)
      if (selectedPharmacy) {
        const sendResponse = await fetch(`/api/prescriptions/${prescription.id}/send-erx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pharmacyId: selectedPharmacy.id,
            prescriberDeaNumber: provider?.deaNumber || ''
          })
        });

        if (sendResponse.ok) {
          addNotification('success', 'Prescription sent electronically to pharmacy');
        } else if (sendResponse.status === 501) {
          // ePrescribing not available - prescription still created
          addNotification('alert', 'Prescription created but electronic sending is not available. Migration 015 required.');
        } else {
          // Other error - still notify success for prescription creation
          console.error('Failed to send eRx:', sendResponse.status);
          addNotification('alert', 'Prescription created but failed to send electronically');
        }
      } else {
        addNotification('success', 'Prescription created successfully');
      }

      if (onSuccess) onSuccess(prescription);
      onClose();
    } catch (error) {
      console.error('Error submitting prescription:', error);
      addNotification('alert', 'Failed to submit prescription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
      <div className={`rounded-xl border max-w-5xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-purple-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              ePrescribe for {patient.firstName} {patient.lastName}
            </h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Step {step} of 4
            </p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Step 1: Search and Select Medication */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Search Medication
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Start typing medication name or NDC code..."
                    className={`w-full px-4 py-3 pr-10 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                    autoFocus
                  />
                  {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                  {!loading && searchQuery && (
                    <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                  )}
                </div>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                  Results appear automatically as you type (minimum 2 characters)
                </p>
              </div>

              {!loading && searchQuery && searchQuery.length >= 2 && medications.length === 0 && (
                <div className={`text-center py-8 rounded-lg border-2 border-dashed ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                  <Pill className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
                  <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    No medications found matching "{searchQuery}"
                  </p>
                  <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                    Try a different search term or NDC code
                  </p>
                </div>
              )}

              {medications.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Found {medications.length} medication{medications.length !== 1 ? 's' : ''} - Click to select:
                  </p>
                  {medications.map((med) => (
                    <div
                      key={med.id}
                      onClick={() => handleSelectMedication(med)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        theme === 'dark'
                          ? 'border-slate-700 hover:border-blue-500 hover:bg-slate-800'
                          : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Pill className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                          <div>
                            <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {med.drugName}
                            </h4>
                            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                              {med.genericName && med.genericName !== med.drugName && `Generic: ${med.genericName} • `}
                              {med.strength} {med.dosageForm}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {med.isGeneric && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                              Generic
                            </span>
                          )}
                          {med.controlledSubstance && (
                            <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs ml-2">
                              C-{med.deaSchedule}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Prescription Details */}
          {step === 2 && selectedMedication && (
            <div className="space-y-6">
              {/* Loading indicator for safety check */}
              {loading && safetyWarnings.length === 0 && (
                <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'border-blue-700 bg-blue-500/10' : 'border-blue-300 bg-blue-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                      Checking for drug interactions and allergies...
                    </p>
                  </div>
                </div>
              )}

              {/* Safety Warnings */}
              {safetyWarnings.length > 0 && (
                <div className={`p-4 rounded-lg border-2 ${safetyWarnings.some(w => w.severity === 'severe') ? 'border-red-500 bg-red-500/10' : 'border-yellow-500 bg-yellow-500/10'}`}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${safetyWarnings.some(w => w.severity === 'severe') ? 'text-red-500' : 'text-yellow-500'}`} />
                    <div>
                      <h4 className={`font-semibold ${safetyWarnings.some(w => w.severity === 'severe') ? 'text-red-400' : 'text-yellow-400'}`}>
                        Safety Warnings
                      </h4>
                      <ul className="mt-2 space-y-1">
                        {safetyWarnings.map((warning, idx) => (
                          <li key={idx} className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                            • {warning.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {selectedMedication.drugName} - {selectedMedication.strength}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Dosage *
                  </label>
                  <input
                    type="text"
                    value={prescriptionDetails.dosage}
                    onChange={(e) => setPrescriptionDetails({ ...prescriptionDetails, dosage: e.target.value })}
                    placeholder="e.g., 500mg"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Frequency *
                  </label>
                  <select
                    value={prescriptionDetails.frequency}
                    onChange={(e) => setPrescriptionDetails({ ...prescriptionDetails, frequency: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                  >
                    <option value="">Select frequency</option>
                    <option value="Once daily">Once daily</option>
                    <option value="Twice daily">Twice daily (BID)</option>
                    <option value="Three times daily">Three times daily (TID)</option>
                    <option value="Four times daily">Four times daily (QID)</option>
                    <option value="Every 4 hours">Every 4 hours</option>
                    <option value="Every 6 hours">Every 6 hours</option>
                    <option value="Every 8 hours">Every 8 hours</option>
                    <option value="Every 12 hours">Every 12 hours</option>
                    <option value="As needed">As needed (PRN)</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Duration *
                  </label>
                  <input
                    type="text"
                    value={prescriptionDetails.duration}
                    onChange={(e) => setPrescriptionDetails({ ...prescriptionDetails, duration: e.target.value })}
                    placeholder="e.g., 30 days"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={prescriptionDetails.quantity}
                    onChange={(e) => setPrescriptionDetails({ ...prescriptionDetails, quantity: e.target.value })}
                    placeholder="30"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Refills
                  </label>
                  <select
                    value={prescriptionDetails.refills}
                    onChange={(e) => setPrescriptionDetails({ ...prescriptionDetails, refills: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 11].map(n => (
                      <option key={n} value={n}>{n} {n === 11 ? '(1 year)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Instructions for Patient
                  </label>
                  <textarea
                    value={prescriptionDetails.instructions}
                    onChange={(e) => setPrescriptionDetails({ ...prescriptionDetails, instructions: e.target.value })}
                    placeholder="Take with food. Avoid alcohol."
                    rows="3"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prescriptionDetails.substitutionAllowed}
                      onChange={(e) => setPrescriptionDetails({ ...prescriptionDetails, substitutionAllowed: e.target.checked })}
                      className="form-checkbox h-5 w-5 text-blue-500"
                    />
                    <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Allow generic substitution
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className={`px-6 py-2 rounded-lg ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    loadPharmacies();
                    setStep(3);
                  }}
                  disabled={!prescriptionDetails.dosage || !prescriptionDetails.frequency || !prescriptionDetails.duration || !prescriptionDetails.quantity}
                  className="flex-1 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
                >
                  Continue to Pharmacy Selection
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Select Pharmacy */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Select Pharmacy
              </h3>

              {loading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                  <p className={`mt-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Loading pharmacies...</p>
                </div>
              )}

              {!loading && pharmacies.length === 0 && (
                <div className={`p-8 text-center rounded-lg border-2 border-dashed ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                  <Building2 className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
                  <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    No pharmacies found. You can still print the prescription.
                  </p>
                </div>
              )}

              {!loading && pharmacies.length > 0 && (
                <div className="space-y-2">
                  {pharmacies.map((pharmacy) => (
                    <div
                      key={pharmacy.id}
                      onClick={() => setSelectedPharmacy(pharmacy)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedPharmacy?.id === pharmacy.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : theme === 'dark'
                          ? 'border-slate-700 hover:border-blue-500/50'
                          : 'border-gray-200 hover:border-blue-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className={`w-5 h-5 ${selectedPharmacy?.id === pharmacy.id ? 'text-blue-500' : theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          <div>
                            <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {pharmacy.pharmacyName}
                              {pharmacy.isPreferred && (
                                <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                                  Preferred
                                </span>
                              )}
                            </h4>
                            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                              {pharmacy.addressLine1}, {pharmacy.city}, {pharmacy.state} {pharmacy.zipCode}
                            </p>
                            {pharmacy.phone && (
                              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                {pharmacy.phone}
                              </p>
                            )}
                          </div>
                        </div>
                        {pharmacy.acceptsErx && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                            eRx Enabled
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(2)}
                  className={`px-6 py-2 rounded-lg ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  Review & Send
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review and Send */}
          {step === 4 && (
            <div className="space-y-6">
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Review Prescription
              </h3>

              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50'}`}>
                <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Medication Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Medication:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{selectedMedication.drugName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Dosage:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{prescriptionDetails.dosage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Frequency:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{prescriptionDetails.frequency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Duration:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{prescriptionDetails.duration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Quantity:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{prescriptionDetails.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Refills:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{prescriptionDetails.refills}</span>
                  </div>
                  {prescriptionDetails.instructions && (
                    <div className="pt-2 border-t border-slate-700">
                      <span className={`block mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Instructions:</span>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{prescriptionDetails.instructions}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedPharmacy && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50'}`}>
                  <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Pharmacy
                  </h4>
                  <div className="text-sm">
                    <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{selectedPharmacy.pharmacyName}</p>
                    <p className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>
                      {selectedPharmacy.addressLine1}, {selectedPharmacy.city}, {selectedPharmacy.state} {selectedPharmacy.zipCode}
                    </p>
                    <p className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>{selectedPharmacy.phone}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className={`px-6 py-2 rounded-lg ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
                >
                  Back
                </button>
                <button
                  onClick={handleSubmitPrescription}
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                  {selectedPharmacy ? 'Send to Pharmacy Electronically' : 'Create Prescription'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EPrescribeModal;
