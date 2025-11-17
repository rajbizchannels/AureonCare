import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  // Normalize provider ID early - accept both 'id' and 'user_id'
  const normalizedProvider = React.useMemo(() => {
    if (!provider) return null;
    return {
      ...provider,
      id: provider.id || provider.user_id
    };
  }, [provider]);

  const [step, setStep] = useState(1); // 1: Search Med, 2: Details, 3: Pharmacy, 4: Review
  const [searchQuery, setSearchQuery] = useState('');
  const [medications, setMedications] = useState([]);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [safetyCheckLoading, setSafetyCheckLoading] = useState(false);
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

  // Track if we've successfully validated - prevents closing modal on re-renders
  const isValidatedRef = useRef(false);
  // Track if we've shown error notification to prevent spam
  const hasShownErrorRef = useRef(false);

  // Validate required props - only close modal on first validation failure
  useEffect(() => {
    console.log('[ePrescribe] Validating modal props:', {
      hasPatient: !!patient,
      patientId: patient?.id,
      hasProvider: !!normalizedProvider,
      providerId: normalizedProvider?.id,
      providerOriginalId: provider?.id,
      providerUserId: provider?.user_id,
      isValidated: isValidatedRef.current
    });

    // Skip validation if already validated successfully
    if (isValidatedRef.current) {
      console.log('[ePrescribe] Already validated, skipping validation');
      return;
    }

    if (!patient || !patient.id) {
      console.error('[ePrescribe] Patient data is missing or invalid:', patient);
      if (!hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        addNotification('alert', 'Cannot open ePrescribe: Patient data is missing');
        onClose();
      }
      return;
    }
    if (!normalizedProvider || !normalizedProvider.id) {
      console.error('[ePrescribe] Provider data is missing or invalid:', {
        provider,
        normalizedProvider,
        hasId: !!provider?.id,
        hasUserId: !!provider?.user_id
      });
      if (!hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        addNotification('alert', 'Cannot open ePrescribe: Provider data is missing');
        onClose();
      }
      return;
    }

    // Mark as successfully validated
    isValidatedRef.current = true;
    console.log('[ePrescribe] Modal opened successfully with valid data');
  }, [patient, normalizedProvider, provider, addNotification, onClose]);

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

  // Debug: Log step changes and render conditions
  useEffect(() => {
    console.log('[ePrescribe] ===== RENDER STATE =====');
    console.log('[ePrescribe] Current step:', step);
    console.log('[ePrescribe] selectedMedication:', selectedMedication ? {
      id: selectedMedication.id,
      drugName: selectedMedication.drugName || selectedMedication.drug_name,
      ndcCode: selectedMedication.ndcCode || selectedMedication.ndc_code
    } : 'NULL');
    console.log('[ePrescribe] Step 2 will render:', step === 2 && !!selectedMedication);
    console.log('[ePrescribe] ======================');
  }, [step, selectedMedication]);

  // Search medications - wrapped in useCallback to prevent unnecessary re-renders
  const handleSearchMedications = useCallback(async () => {
    if (!searchQuery) {
      console.log('[ePrescribe] Search query is empty, skipping search');
      return;
    }

    if (searchQuery.length < 2) {
      console.log('[ePrescribe] Search query too short (min 2 chars):', searchQuery);
      return;
    }

    console.log('[ePrescribe] ========================================');
    console.log('[ePrescribe] Starting medication search');
    console.log('[ePrescribe] Search query:', searchQuery);
    console.log('[ePrescribe] API object:', api ? 'Available' : 'MISSING');

    setLoading(true);
    setMedications([]); // Clear previous results

    try {
      console.log('[ePrescribe] Calling api.searchMedications...');
      const startTime = Date.now();

      // Use the api service instead of direct fetch
      const data = await api.searchMedications(searchQuery, null, null, 50);

      const elapsed = Date.now() - startTime;
      console.log('[ePrescribe] API response received in', elapsed, 'ms');
      console.log('[ePrescribe] Response type:', typeof data);
      console.log('[ePrescribe] Response is array:', Array.isArray(data));
      console.log('[ePrescribe] Number of medications found:', data?.length || 0);

      if (data && Array.isArray(data)) {
        setMedications(data);

        if (data.length > 0) {
          console.log('[ePrescribe] First medication:', data[0]);
          console.log('[ePrescribe] Sample medication structure:', {
            id: data[0].id,
            drugName: data[0].drugName,
            genericName: data[0].genericName,
            ndcCode: data[0].ndcCode,
            strength: data[0].strength
          });
        } else {
          console.log('[ePrescribe] No medications found matching:', searchQuery);
        }
      } else {
        console.error('[ePrescribe] Unexpected response format:', data);
        setMedications([]);
        addNotification('alert', 'Received invalid data format from server');
      }

      console.log('[ePrescribe] Search completed successfully');
      console.log('[ePrescribe] ========================================');
    } catch (error) {
      console.error('[ePrescribe] ========================================');
      console.error('[ePrescribe] ERROR in medication search');
      console.error('[ePrescribe] Error type:', error.constructor.name);
      console.error('[ePrescribe] Error message:', error.message);
      console.error('[ePrescribe] Error stack:', error.stack);
      console.error('[ePrescribe] ========================================');

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

      setMedications([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, api, addNotification]);

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

  // Auto-calculate quantity based on frequency and duration
  useEffect(() => {
    const { frequency, duration, quantity } = prescriptionDetails;

    if (!frequency || !duration) return;

    // Parse frequency to get times per day
    let timesPerDay = 1;
    const frequencyLower = frequency.toLowerCase();
    if (frequencyLower.includes('once')) timesPerDay = 1;
    else if (frequencyLower.includes('twice') || frequencyLower.includes('bid')) timesPerDay = 2;
    else if (frequencyLower.includes('three') || frequencyLower.includes('tid')) timesPerDay = 3;
    else if (frequencyLower.includes('four') || frequencyLower.includes('qid')) timesPerDay = 4;
    else if (frequencyLower.includes('every 4 hours') || frequencyLower.includes('q4h')) timesPerDay = 6;
    else if (frequencyLower.includes('every 6 hours') || frequencyLower.includes('q6h')) timesPerDay = 4;
    else if (frequencyLower.includes('every 8 hours') || frequencyLower.includes('q8h')) timesPerDay = 3;
    else if (frequencyLower.includes('every 12 hours') || frequencyLower.includes('q12h')) timesPerDay = 2;

    // Parse duration to get number of days
    const durationMatch = duration.match(/(\d+)/);
    if (!durationMatch) return;

    const days = parseInt(durationMatch[1]);
    if (isNaN(days)) return;

    // Calculate quantity
    const calculatedQuantity = timesPerDay * days;

    // Update quantity only if it's different from calculated value
    if (quantity !== calculatedQuantity.toString()) {
      setPrescriptionDetails(prev => ({
        ...prev,
        quantity: calculatedQuantity.toString()
      }));
    }
  }, [prescriptionDetails.frequency, prescriptionDetails.duration, prescriptionDetails.quantity]);

  // Select medication and check safety
  const handleSelectMedication = useCallback((medication) => {
    console.log('[ePrescribe] ========================================');
    console.log('[ePrescribe] handleSelectMedication called');
    console.log('[ePrescribe] Medication received:', medication);
    console.log('[ePrescribe] Current step:', step);
    console.log('[ePrescribe] Current selectedMedication:', selectedMedication);

    // Validate medication object
    if (!medication) {
      console.error('[ePrescribe] ERROR: Medication is null or undefined');
      addNotification('alert', 'Invalid medication selected. Please try again.');
      return;
    }

    if (!medication.id && !medication.ndcCode && !medication.ndc_code) {
      console.error('[ePrescribe] ERROR: Medication missing required identifiers:', medication);
      addNotification('alert', 'Invalid medication data. Please try a different search.');
      return;
    }

    console.log('[ePrescribe] Medication validation passed');

    try {
      // Pre-fill dosage from medication
      const dosage = medication.commonDosages && medication.commonDosages.length > 0
        ? (medication.strength || medication.commonDosages[0])
        : (medication.strength || '');

      console.log('[ePrescribe] Calculated dosage:', dosage);

      // Update prescription details with dosage
      console.log('[ePrescribe] Updating prescription details...');
      setPrescriptionDetails(prev => ({
        ...prev,
        dosage: dosage
      }));

      // Set selected medication
      console.log('[ePrescribe] Setting selected medication...');
      setSelectedMedication(medication);

      // Advance to step 2 immediately - THIS IS THE CRITICAL STEP
      console.log('[ePrescribe] *** ADVANCING TO STEP 2 ***');
      console.log('[ePrescribe] Setting step to 2...');
      setStep(2);
      console.log('[ePrescribe] Step state update called - React will batch this with other state updates');

      // Run safety check in background (async, non-blocking)
      // This runs AFTER step advancement, so it won't block the UI
      console.log('[ePrescribe] Starting background safety check...');
      (async () => {
        setSafetyCheckLoading(true);
        try {
          const ndcCode = medication.ndcCode || medication.ndc_code;
          console.log('[ePrescribe] Checking safety with NDC:', ndcCode, 'Patient ID:', patient.id);

          // Use api service for safety check
          const safetyData = await api.checkPrescriptionSafety(patient.id, ndcCode);
          console.log('[ePrescribe] Safety data received:', safetyData);
          setSafetyWarnings(safetyData.warnings || []);
        } catch (error) {
          console.error('[ePrescribe] Error in safety check:', error);

          // Check if it's a "not available" error
          if (error.message && error.message.includes('501')) {
            console.log('[ePrescribe] Safety check not available - ePrescribing schema not installed');
          }

          // Don't show error notification for safety check failures - just log and continue
          setSafetyWarnings([]);
        } finally {
          setSafetyCheckLoading(false);
          console.log('[ePrescribe] Safety check completed');
        }
      })(); // End of async IIFE

      console.log('[ePrescribe] handleSelectMedication function completed successfully');
      console.log('[ePrescribe] Next render should show step 2');
      console.log('[ePrescribe] ========================================');
    } catch (error) {
      console.error('[ePrescribe] CRITICAL ERROR in handleSelectMedication:', error);
      console.error('[ePrescribe] Error stack:', error.stack);

      // Even if there's an error, try to advance to step 2
      console.log('[ePrescribe] Attempting step advancement despite error...');
      setSelectedMedication(medication);
      setStep(2);

      addNotification('alert', `Error processing medication: ${error.message}. Please check the details.`);
    }
  }, [patient, api, addNotification, step, selectedMedication]);

  // Load patient's preferred pharmacies
  const loadPharmacies = async () => {
    console.log('[ePrescribe] Loading pharmacies for patient:', patient.id);
    setLoading(true);
    try {
      // First try to get patient's preferred pharmacies using api service
      let data = await api.getPatientPreferredPharmacies(patient.id);

      console.log('[ePrescribe] Preferred pharmacies:', data);

      // If no preferred pharmacies, get nearby pharmacies by ZIP code
      // Check all possible ZIP code field names (camelCase and snake_case)
      const zipCode = patient.zipCode || patient.zip_code || patient.zip;

      if ((!data || data.length === 0) && zipCode) {
        console.log('[ePrescribe] No preferred pharmacies, searching by ZIP:', zipCode);
        data = await api.searchPharmacies(zipCode, null, null, null, 10);
        console.log('[ePrescribe] Nearby pharmacies by ZIP:', data);
      }

      // If still no pharmacies found, load all pharmacies as fallback
      if (!data || data.length === 0) {
        console.warn('[ePrescribe] No preferred or nearby pharmacies found, loading all pharmacies');
        console.log('[ePrescribe] Patient data:', { zipCode: patient.zipCode, zip_code: patient.zip_code, zip: patient.zip });

        // Get all pharmacies with a limit
        data = await api.getPharmacies();
        console.log('[ePrescribe] All pharmacies loaded:', data?.length || 0, 'pharmacies');

        // Limit to first 20 for performance
        if (data && data.length > 20) {
          data = data.slice(0, 20);
          console.log('[ePrescribe] Limited to first 20 pharmacies');
        }
      }

      setPharmacies(data || []);

      // Auto-select preferred pharmacy if exists
      const preferred = data?.find(p => p.isPreferred || p.is_preferred);
      if (preferred) {
        console.log('[ePrescribe] Auto-selecting preferred pharmacy:', preferred);
        setSelectedPharmacy(preferred);
      }
    } catch (error) {
      console.error('[ePrescribe] Error loading pharmacies:', error);

      // Check if it's a "not available" error
      if (error.message && (error.message.includes('501') || error.message.includes('migration 015'))) {
        addNotification('alert', 'Pharmacy network requires migration 015. Please contact your administrator.');
      } else {
        addNotification('alert', `Failed to load pharmacies: ${error.message}`);
      }

      setPharmacies([]);
    } finally {
      setLoading(false);
    }
  };

  // Submit prescription
  const handleSubmitPrescription = async () => {
    console.log('[ePrescribe] Submitting prescription...');
    console.log('[ePrescribe] Using provider:', normalizedProvider);

    if (!selectedMedication) {
      addNotification('alert', 'Please select a medication first');
      return;
    }

    setLoading(true);
    try {
      // Create prescription using api service
      const prescriptionPayload = {
        patientId: patient.id,
        providerId: normalizedProvider.id,
        medicationName: selectedMedication.drugName || selectedMedication.drug_name,
        ndcCode: selectedMedication.ndcCode || selectedMedication.ndc_code,
        dosage: prescriptionDetails.dosage,
        frequency: prescriptionDetails.frequency,
        duration: prescriptionDetails.duration,
        quantity: parseInt(prescriptionDetails.quantity) || 0,
        refills: parseInt(prescriptionDetails.refills) || 0,
        instructions: prescriptionDetails.instructions,
        substitutionAllowed: prescriptionDetails.substitutionAllowed,
        status: 'Active',
        prescribedDate: new Date().toISOString().split('T')[0]
      };

      // Add pharmacy info if selected
      if (selectedPharmacy) {
        prescriptionPayload.pharmacyId = selectedPharmacy.id;
        prescriptionPayload.prescriberDeaNumber = normalizedProvider?.deaNumber || normalizedProvider?.dea_number || '';
      }

      console.log('[ePrescribe] Prescription payload:', prescriptionPayload);

      const prescription = await api.createPrescription(prescriptionPayload);
      console.log('[ePrescribe] Prescription created:', prescription);

      // Send electronically to pharmacy if selected
      if (selectedPharmacy) {
        console.log('[ePrescribe] Sending to pharmacy:', selectedPharmacy);
        try {
          await api.sendErx(prescription.id);
          console.log('[ePrescribe] Successfully sent to pharmacy');
          addNotification('success', 'Prescription sent to pharmacy successfully');
        } catch (erxError) {
          console.error('[ePrescribe] Failed to send eRx:', erxError);

          // Check if it's a "not available" error
          if (erxError.message && erxError.message.includes('501')) {
            addNotification('alert', 'Prescription created but electronic sending is not available. Migration 015 required.');
          } else {
            addNotification('alert', 'Prescription created but failed to send electronically');
          }
        }
      } else {
        console.log('[ePrescribe] No pharmacy selected, prescription created only');
        addNotification('success', 'Prescription created successfully');
      }

      if (onSuccess) onSuccess(prescription);
      onClose();
    } catch (error) {
      console.error('[ePrescribe] Error submitting prescription:', error);
      addNotification('alert', `Failed to submit prescription: ${error.message}`);
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
              ePrescribe for {patient.firstName || patient.first_name || 'Patient'} {patient.lastName || patient.last_name || ''}
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
                <div className={`text-center py-8 rounded-lg border-2 border-dashed ${theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-gray-300 bg-gray-50'}`}>
                  <Pill className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
                  <p className={`font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    No medications found matching "{searchQuery}"
                  </p>
                  <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Try a different search term or NDC code
                  </p>
                  <div className={`mt-4 p-3 rounded text-left ${theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-gray-200'}`}>
                    <p className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                      <strong className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Troubleshooting:</strong>
                    </p>
                    <ul className={`text-xs mt-2 space-y-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                      <li>• Check browser console (F12) for error details</li>
                      <li>• Ensure migration 015 has been run on the database</li>
                      <li>• Verify backend server is running on port 3001</li>
                      <li>• Try common medications: lisinopril, metformin, atorvastatin</li>
                    </ul>
                  </div>
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
              {safetyCheckLoading && safetyWarnings.length === 0 && (
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
                  onClick={() => {
                    setSelectedMedication(null);
                    setSafetyWarnings([]);
                    setStep(1);
                  }}
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
                  className="flex-1 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
          {step === 4 && selectedMedication && (
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
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{selectedMedication?.drugName || 'N/A'}</span>
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
