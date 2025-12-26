import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, AlertCircle, CheckCircle, Pill, Building2, Send, Printer } from 'lucide-react';

const EPrescribeModal = ({
  theme,
  patient,
  provider,
  api,
  prescription,
  onClose,
  onSuccess,
  addNotification,
  inline = false
}) => {
  // Normalize provider ID early - accept both 'id' and 'user_id'
  const normalizedProvider = React.useMemo(() => {
    if (!provider) return null;
    return {
      ...provider,
      id: provider.id || provider.user_id
    };
  }, [provider]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [addedMedications, setAddedMedications] = useState([]); // Array of medications with their details
  const [currentMedication, setCurrentMedication] = useState(null); // Currently selected medication to add
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pharmaciesLoading, setPharmaciesLoading] = useState(false);
  const [safetyCheckLoading, setSafetyCheckLoading] = useState(false);
  const [safetyWarnings, setSafetyWarnings] = useState([]);
  const [generalInstructions, setGeneralInstructions] = useState('');

  // Current medication details (for adding new medication to list)
  const [currentDetails, setCurrentDetails] = useState({
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

  // ESC key handler (only in modal mode)
  useEffect(() => {
    if (inline) return; // Skip ESC handler in inline mode

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose, inline]);

  // Debug: Log render state
  useEffect(() => {
    console.log('[ePrescribe] ===== RENDER STATE =====');
    console.log('[ePrescribe] currentMedication:', currentMedication ? {
      id: currentMedication.id,
      drugName: currentMedication.drugName || currentMedication.drug_name,
      ndcCode: currentMedication.ndcCode || currentMedication.ndc_code
    } : 'NULL');
    console.log('[ePrescribe] addedMedications count:', addedMedications.length);
    console.log('[ePrescribe] ======================');
  }, [currentMedication, addedMedications]);

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
    setSearchResults([]); // Clear previous results

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
        setSearchResults(data);

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
        setSearchResults([]);
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

      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, api, addNotification]);

  // Auto-search as user types (debounced)
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearchMedications();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearchMedications]);

  // Auto-calculate quantity based on frequency and duration for current medication
  useEffect(() => {
    const { frequency, duration, quantity } = currentDetails;

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
      setCurrentDetails(prev => ({
        ...prev,
        quantity: calculatedQuantity.toString()
      }));
    }
  }, [currentDetails.frequency, currentDetails.duration, currentDetails.quantity]);

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

      // Update current details with dosage
      console.log('[ePrescribe] Updating current details...');
      setCurrentDetails(prev => ({
        ...prev,
        dosage: dosage
      }));

      // Set current medication
      console.log('[ePrescribe] Setting current medication...');
      setCurrentMedication(medication);

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
      console.log('[ePrescribe] ========================================');
    } catch (error) {
      console.error('[ePrescribe] CRITICAL ERROR in handleSelectMedication:', error);
      console.error('[ePrescribe] Error stack:', error.stack);

      // Even if there's an error, still set the current medication
      console.log('[ePrescribe] Setting medication despite error...');
      setCurrentMedication(medication);

      addNotification('alert', `Error processing medication: ${error.message}. Please check the details.`);
    }
  }, [patient, api, addNotification]);

  // Add medication to the list
  const handleAddMedication = useCallback(() => {
    if (!currentMedication) {
      addNotification('alert', 'Please select a medication first');
      return;
    }

    if (!currentDetails.dosage || !currentDetails.frequency || !currentDetails.duration) {
      addNotification('alert', 'Please fill in dosage, frequency, and duration');
      return;
    }

    // Add to medications list
    const newMedication = {
      id: Date.now(), // Temporary ID for the list
      medication: currentMedication,
      details: { ...currentDetails }
    };

    setAddedMedications(prev => [...prev, newMedication]);

    // Reset current medication and details
    setCurrentMedication(null);
    setCurrentDetails({
      dosage: '',
      frequency: '',
      duration: '',
      quantity: '',
      refills: 0,
      instructions: '',
      substitutionAllowed: true
    });
    setSearchQuery('');
    setSearchResults([]);

    addNotification('success', 'Medication added to prescription');
  }, [currentMedication, currentDetails, addNotification]);

  // Remove medication from the list
  const handleRemoveMedication = useCallback((id) => {
    setAddedMedications(prev => prev.filter(med => med.id !== id));
    addNotification('success', 'Medication removed');
  }, [addNotification]);

  // Load patient's preferred pharmacies
  const loadPharmacies = useCallback(async () => {
    console.log('[ePrescribe] Loading pharmacies for patient:', patient.id);
    setPharmaciesLoading(true);
    try {
      // First try to get patient's preferred pharmacies using api service
      let data = await api.getPatientPreferredPharmacies(patient.id);
      let isPreferredList = data && data.length > 0;

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
      // First try to find explicitly preferred pharmacy
      const preferred = data?.find(p => p.isPreferred || p.is_preferred);
      if (preferred) {
        console.log('[ePrescribe] Auto-selecting explicitly preferred pharmacy:', preferred);
        setSelectedPharmacy(preferred);
      } else if (isPreferredList && data && data.length > 0) {
        // If we loaded pharmacies from patient's preferred list, auto-select the first one
        console.log('[ePrescribe] Auto-selecting first pharmacy from patient preferred list:', data[0]);
        setSelectedPharmacy(data[0]);
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
      setPharmaciesLoading(false);
    }
  }, [patient.id, api, addNotification]);

  // Load pharmacies on mount
  useEffect(() => {
    loadPharmacies();
  }, [loadPharmacies]);

  // Submit all prescriptions
  const handleSubmitPrescriptions = async () => {
    console.log('[ePrescribe] Submitting prescriptions...');
    console.log('[ePrescribe] Using provider:', normalizedProvider);
    console.log('[ePrescribe] Number of medications:', addedMedications.length);

    if (addedMedications.length === 0) {
      addNotification('alert', 'Please add at least one medication to the prescription');
      return;
    }

    setLoading(true);
    try {
      const createdPrescriptions = [];

      // Create a prescription for each medication
      for (const med of addedMedications) {
        const prescriptionPayload = {
          patientId: patient.id,
          providerId: normalizedProvider.id,
          medicationName: med.medication.drugName || med.medication.drug_name,
          ndcCode: med.medication.ndcCode || med.medication.ndc_code,
          dosage: med.details.dosage,
          frequency: med.details.frequency,
          duration: med.details.duration,
          quantity: parseInt(med.details.quantity) || 0,
          refills: parseInt(med.details.refills) || 0,
          instructions: med.details.instructions || generalInstructions,
          substitutionAllowed: med.details.substitutionAllowed,
          status: 'Active',
          prescribedDate: new Date().toISOString().split('T')[0]
        };

        // Add pharmacy info if selected
        if (selectedPharmacy) {
          prescriptionPayload.pharmacyId = selectedPharmacy.id;
          prescriptionPayload.prescriberDeaNumber = normalizedProvider?.deaNumber || normalizedProvider?.dea_number || '';
        }

        console.log('[ePrescribe] Creating prescription for:', med.medication.drugName);
        const resultPrescription = await api.createPrescription(prescriptionPayload);
        createdPrescriptions.push(resultPrescription);

        // Send electronically to pharmacy if selected
        if (selectedPharmacy) {
          try {
            await api.sendErx(resultPrescription.id);
            console.log('[ePrescribe] Successfully sent to pharmacy');
          } catch (erxError) {
            console.error('[ePrescribe] Failed to send eRx:', erxError);
          }
        }
      }

      if (selectedPharmacy) {
        addNotification('success', `${createdPrescriptions.length} prescription(s) sent to pharmacy successfully`);
      } else {
        addNotification('success', `${createdPrescriptions.length} prescription(s) created successfully`);
      }

      if (onSuccess) onSuccess(createdPrescriptions);
      onClose();
    } catch (error) {
      console.error('[ePrescribe] Error submitting prescriptions:', error);
      addNotification('alert', `Failed to submit prescriptions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Print prescriptions
  const handlePrintPrescriptions = async () => {
    console.log('[ePrescribe] Printing prescriptions...');

    if (addedMedications.length === 0) {
      addNotification('alert', 'Please add at least one medication to print');
      return;
    }

    // For now, just create the prescriptions and notify
    await handleSubmitPrescriptions();
    addNotification('info', 'Print functionality will be enhanced in a future update');
  };

  // Old print function (keeping for reference, will be updated later)
  const handlePrintPrescriptionOld = async () => {
    setLoading(true);
    try {
      // Create prescription using api service (old implementation)
      const prescriptionPayload = {
        patientId: patient.id,
        providerId: normalizedProvider.id,
        medicationName: currentMedication.drugName || selectedMedication.drug_name,
        ndcCode: selectedMedication.ndcCode || selectedMedication.ndc_code,
        dosage: currentDetails.dosage,
        frequency: currentDetails.frequency,
        duration: currentDetails.duration,
        quantity: parseInt(currentDetails.quantity) || 0,
        refills: parseInt(currentDetails.refills) || 0,
        instructions: currentDetails.instructions,
        substitutionAllowed: currentDetails.substitutionAllowed,
        status: 'Active',
        prescribedDate: new Date().toISOString().split('T')[0]
      };

      // Add pharmacy info if selected
      if (selectedPharmacy) {
        prescriptionPayload.pharmacyId = selectedPharmacy.id;
        prescriptionPayload.prescriberDeaNumber = normalizedProvider?.deaNumber || normalizedProvider?.dea_number || '';
      }

      console.log('[ePrescribe] Creating prescription before printing:', prescriptionPayload);

      const prescription = await api.createPrescription(prescriptionPayload);
      console.log('[ePrescribe] Prescription created successfully:', prescription);

      // Now generate the print document
      const printWindow = window.open('', '_blank');

      if (!printWindow) {
        addNotification('alert', 'Pop-up blocked. Please allow pop-ups to print prescriptions.');
        setLoading(false);
        return;
      }

      const patientName = `${patient.firstName || patient.first_name || ''} ${patient.lastName || patient.last_name || ''}`.trim();
      const providerName = normalizedProvider ? `Dr. ${normalizedProvider.firstName || normalizedProvider.first_name || ''} ${normalizedProvider.lastName || normalizedProvider.last_name || ''}`.trim() : 'N/A';
      const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prescription - ${patientName}</title>
          <style>
            @page {
              size: letter;
              margin: 0.5in;
            }

            body {
              font-family: 'Arial', 'Helvetica', sans-serif;
              margin: 0;
              padding: 20px;
              color: #000;
              background: #fff;
              font-size: 12pt;
            }

            .prescription-container {
              max-width: 7.5in;
              margin: 0 auto;
              border: 2px solid #000;
              padding: 30px;
            }

            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
              margin-bottom: 20px;
            }

            .header h1 {
              margin: 0 0 10px 0;
              font-size: 24pt;
              font-weight: bold;
            }

            .header p {
              margin: 5px 0;
              font-size: 11pt;
            }

            .section {
              margin: 20px 0;
              padding: 15px;
              border: 1px solid #ccc;
              background: #f9f9f9;
            }

            .section-title {
              font-weight: bold;
              font-size: 14pt;
              margin-bottom: 10px;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
            }

            .info-row {
              display: flex;
              margin: 8px 0;
              padding: 5px 0;
            }

            .info-label {
              font-weight: bold;
              width: 150px;
              flex-shrink: 0;
            }

            .info-value {
              flex: 1;
            }

            .medication-box {
              background: #fff;
              border: 2px solid #000;
              padding: 20px;
              margin: 20px 0;
              font-size: 13pt;
            }

            .rx-symbol {
              font-size: 36pt;
              font-weight: bold;
              margin-bottom: 10px;
            }

            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #000;
              font-size: 10pt;
            }

            .signature-line {
              margin-top: 40px;
              border-top: 2px solid #000;
              width: 300px;
              padding-top: 10px;
            }

            @media print {
              body {
                padding: 0;
              }

              .prescription-container {
                border: none;
              }

              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="prescription-container">
            <div class="header">
              <h1>℞ PRESCRIPTION</h1>
              <p><strong>Date:</strong> ${currentDate}</p>
            </div>

            <div class="section">
              <div class="section-title">Patient Information</div>
              <div class="info-row">
                <span class="info-label">Patient Name:</span>
                <span class="info-value">${patientName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Date of Birth:</span>
                <span class="info-value">${patient.dateOfBirth || patient.date_of_birth || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Address:</span>
                <span class="info-value">${patient.address || patient.addressLine1 || 'N/A'}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Prescriber Information</div>
              <div class="info-row">
                <span class="info-label">Prescriber:</span>
                <span class="info-value">${providerName}</span>
              </div>
              ${normalizedProvider?.deaNumber || normalizedProvider?.dea_number ? `
              <div class="info-row">
                <span class="info-label">DEA Number:</span>
                <span class="info-value">${normalizedProvider.deaNumber || normalizedProvider.dea_number}</span>
              </div>
              ` : ''}
            </div>

            <div class="medication-box">
              <div class="rx-symbol">℞</div>
              <div class="info-row">
                <span class="info-label">Medication:</span>
                <span class="info-value"><strong>${selectedMedication?.genericName || selectedMedication?.brandName || selectedMedication?.drugName || 'N/A'}</strong></span>
              </div>
              ${selectedMedication?.ndcCode || selectedMedication?.ndc_code ? `
              <div class="info-row">
                <span class="info-label">NDC Code:</span>
                <span class="info-value">${selectedMedication.ndcCode || selectedMedication.ndc_code}</span>
              </div>
              ` : ''}
              <div class="info-row">
                <span class="info-label">Dosage:</span>
                <span class="info-value"><strong>${currentDetails.dosage}</strong></span>
              </div>
              <div class="info-row">
                <span class="info-label">Frequency:</span>
                <span class="info-value"><strong>${currentDetails.frequency}</strong></span>
              </div>
              <div class="info-row">
                <span class="info-label">Duration:</span>
                <span class="info-value"><strong>${currentDetails.duration}</strong></span>
              </div>
              <div class="info-row">
                <span class="info-label">Quantity:</span>
                <span class="info-value"><strong>${currentDetails.quantity}</strong></span>
              </div>
              <div class="info-row">
                <span class="info-label">Refills:</span>
                <span class="info-value"><strong>${currentDetails.refills}</strong></span>
              </div>
              ${currentDetails.instructions ? `
              <div class="info-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc;">
                <span class="info-label">Instructions:</span>
                <span class="info-value">${currentDetails.instructions}</span>
              </div>
              ` : ''}
              <div class="info-row" style="margin-top: 10px;">
                <span class="info-label">Generic Substitution:</span>
                <span class="info-value">${currentDetails.substitutionAllowed ? 'Allowed' : 'Not Allowed (Dispense as Written)'}</span>
              </div>
            </div>

            ${selectedPharmacy ? `
            <div class="section">
              <div class="section-title">Pharmacy Information</div>
              <div class="info-row">
                <span class="info-label">Pharmacy Name:</span>
                <span class="info-value">${selectedPharmacy.pharmacyName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Address:</span>
                <span class="info-value">${selectedPharmacy.addressLine1}, ${selectedPharmacy.city}, ${selectedPharmacy.state} ${selectedPharmacy.zipCode}</span>
              </div>
              ${selectedPharmacy.phone ? `
              <div class="info-row">
                <span class="info-label">Phone:</span>
                <span class="info-value">${selectedPharmacy.phone}</span>
              </div>
              ` : ''}
            </div>
            ` : ''}

            <div class="signature-line">
              <strong>Provider Signature</strong>
            </div>

            <div class="footer">
              <p style="margin: 5px 0; font-size: 9pt; color: #666;">
                <strong>Note:</strong> This prescription is valid for ${currentDetails.refills > 0 ? `${currentDetails.refills} refill(s)` : 'no refills'}.
                Contact your healthcare provider if you have any questions or concerns about this medication.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      // Wait for content to load, then print
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        // Close window after printing (optional - user may want to keep it open)
        // printWindow.close();
      };

      console.log('[ePrescribe] Print window opened successfully');
      addNotification('success', 'Prescription saved and printed successfully');

      // Call onSuccess callback and close modal
      if (onSuccess) onSuccess(prescription);
      onClose();
    } catch (error) {
      console.error('[ePrescribe] Error creating prescription for print:', error);
      addNotification('alert', `Failed to save prescription: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Content component (shared between modal and inline modes)
  const content = (
    <div className={`rounded-xl border max-w-5xl w-full ${inline ? '' : 'max-h-[90vh]'} overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => inline ? null : e.stopPropagation()}>
      <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-purple-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        <div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            New ePrescription for {patient.firstName || patient.first_name || 'Patient'} {patient.lastName || patient.last_name || ''}
          </h2>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            {addedMedications.length > 0 ? `${addedMedications.length} medication(s) added` : 'Search and add medications below'}
          </p>
        </div>
        <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
          <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        </button>
      </div>

      <div className={`p-6 overflow-y-auto ${inline ? 'max-h-[800px]' : 'max-h-[calc(90vh-180px)]'}`}>
          {/* Added Medications List */}
          {addedMedications.length > 0 && (
            <div className="mb-6">
              <h3 className={`text-lg font-semibold mb-4 pb-2 border-b ${theme === 'dark' ? 'text-white border-slate-700' : 'text-gray-900 border-gray-300'}`}>
                Medications in Prescription
              </h3>
              <div className="space-y-3">
                {addedMedications.map((med) => (
                  <div key={med.id} className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-300'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {med.medication.genericName || med.medication.brandName || med.medication.drugName}
                        </h4>
                        <div className={`text-sm mt-2 space-y-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                          <p><strong>Dosage:</strong> {med.details.dosage}</p>
                          <p><strong>Frequency:</strong> {med.details.frequency}</p>
                          <p><strong>Duration:</strong> {med.details.duration}</p>
                          <p><strong>Quantity:</strong> {med.details.quantity}</p>
                          {med.details.instructions && <p><strong>Instructions:</strong> {med.details.instructions}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveMedication(med.id)}
                        className={`p-2 rounded-lg hover:bg-red-100 transition-colors ${theme === 'dark' ? 'hover:bg-red-900/20' : ''}`}
                        title="Remove medication"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search and Add Medication */}
          <div className="mb-8">
            <h3 className={`text-lg font-semibold mb-4 pb-2 border-b ${theme === 'dark' ? 'text-white border-slate-700' : 'text-gray-900 border-gray-300'}`}>
              {addedMedications.length > 0 ? 'Add Another Medication' : 'Search Medication'}
            </h3>
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

              {!loading && searchQuery && searchQuery.length >= 2 && searchResults.length === 0 && (
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

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Found {searchResults.length} medication{searchResults.length !== 1 ? 's' : ''} - Click to select:
                  </p>
                  {searchResults.map((med) => (
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
                              {med.genericName || med.brandName || med.drugName}
                            </h4>
                            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                              {med.brandName && med.genericName && med.brandName !== med.genericName && `Brand: ${med.brandName} • `}
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
          </div>

          {/* Medication Details Form */}
          {currentMedication && (
            <div className="mb-8">
              <h3 className={`text-lg font-semibold mb-4 pb-2 border-b ${theme === 'dark' ? 'text-white border-slate-700' : 'text-gray-900 border-gray-300'}`}>
                Medication Details
              </h3>
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
                  {currentMedication.genericName || currentMedication.brandName || currentMedication.drugName} - {currentMedication.strength}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Dosage *
                  </label>
                  <input
                    type="text"
                    value={currentDetails.dosage}
                    onChange={(e) => setCurrentDetails({ ...prescriptionDetails, dosage: e.target.value })}
                    placeholder="e.g., 500mg"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Frequency *
                  </label>
                  <select
                    value={currentDetails.frequency}
                    onChange={(e) => setCurrentDetails({ ...prescriptionDetails, frequency: e.target.value })}
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
                    value={currentDetails.duration}
                    onChange={(e) => setCurrentDetails({ ...prescriptionDetails, duration: e.target.value })}
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
                    value={currentDetails.quantity}
                    onChange={(e) => setCurrentDetails({ ...prescriptionDetails, quantity: e.target.value })}
                    placeholder="30"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Refills
                  </label>
                  <select
                    value={currentDetails.refills}
                    onChange={(e) => setCurrentDetails({ ...prescriptionDetails, refills: e.target.value })}
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
                    value={currentDetails.instructions}
                    onChange={(e) => setCurrentDetails({ ...prescriptionDetails, instructions: e.target.value })}
                    placeholder="Take with food. Avoid alcohol."
                    rows="3"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div className="col-span-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Allow generic substitution
                    </span>
                    <button
                      onClick={() => setCurrentDetails({ ...prescriptionDetails, substitutionAllowed: !currentDetails.substitutionAllowed })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        currentDetails.substitutionAllowed
                          ? 'bg-blue-500'
                          : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          currentDetails.substitutionAllowed ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Add to Prescription Button */}
              <div className="flex justify-end mt-6">
                <button
                  onClick={handleAddMedication}
                  disabled={!currentDetails.dosage || !currentDetails.frequency || !currentDetails.duration}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add to Prescription
                </button>
              </div>
              </div>
            </div>
          )}

          {/* Pharmacy Selection */}
          <div className="mb-8">
            <h3 className={`text-lg font-semibold mb-4 pb-2 border-b ${theme === 'dark' ? 'text-white border-slate-700' : 'text-gray-900 border-gray-300'}`}>
              Select Pharmacy (Optional)
            </h3>
            <div className="space-y-4">
              {pharmaciesLoading && (
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
                              {(pharmacy.isPreferred || pharmacy.is_preferred) && (
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
            </div>
          </div>

          {/* Submit Actions */}
          {addedMedications.length > 0 && (
            <div className="mb-8">
              <h3 className={`text-lg font-semibold mb-4 pb-2 border-b ${theme === 'dark' ? 'text-white border-slate-700' : 'text-gray-900 border-gray-300'}`}>
                Submit Prescription
              </h3>
              <div className={`p-4 rounded-lg mb-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50'}`}>
                <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Prescription Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Total Medications:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{addedMedications.length}</span>
                  </div>
                  {selectedPharmacy && (
                    <div className="flex justify-between pt-2 border-t border-slate-700">
                      <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Pharmacy:</span>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{selectedPharmacy.pharmacyName}</span>
                    </div>
                  )}
                  {!selectedPharmacy && (
                    <p className={`text-xs italic pt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                      No pharmacy selected - prescriptions will be created but not sent electronically
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handlePrintPrescriptions}
                  disabled={loading}
                  className={`px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
                  title="Print Prescriptions"
                >
                  <Printer className="w-5 h-5" />
                  Print All
                </button>
                <button
                  onClick={handleSubmitPrescriptions}
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                  {selectedPharmacy ? `Send ${addedMedications.length} Prescription(s) to Pharmacy` : `Create ${addedMedications.length} Prescription(s)`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );

  // Return inline or modal version based on prop
  if (inline) {
    return content;
  }

  return (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
      {content}
    </div>
  );
};

export default EPrescribeModal;
