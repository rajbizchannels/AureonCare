import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Ruler, Scale, Droplet, Users, Pill, User, Phone, Mail, MapPin, Calendar, Search } from 'lucide-react';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const PatientHealthMetricsForm = ({
  theme,
  api,
  patient,
  onClose,
  onSuccess,
  addNotification
}) => {
  const [formData, setFormData] = useState({
    // Personal Information
    first_name: patient?.first_name || '',
    last_name: patient?.last_name || '',
    date_of_birth: patient?.date_of_birth || patient?.dob || '',
    gender: patient?.gender || '',
    // Contact Information
    email: patient?.email || '',
    phone: patient?.phone || '',
    address: patient?.address || '',
    city: patient?.city || '',
    state: patient?.state || '',
    zip: patient?.zip || '',
    country: patient?.country || '',
    // Health Metrics
    height: patient?.height || '',
    weight: patient?.weight || '',
    blood_type: patient?.blood_type || '',
    social_history: patient?.social_history || '',
    // Medical History
    allergies: patient?.allergies || '',
    past_history: patient?.past_history || '',
    family_history: patient?.family_history || '',
    current_medications: patient?.current_medications || '',
    // Previous Medications (structured)
    previous_medications: [],
    // Preferences
    telehealth_preference: patient?.telehealth_preference || ''
  });
  const [enabledProviders, setEnabledProviders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');

  // Previous medications search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Current medications state
  const [activePrescriptions, setActivePrescriptions] = useState([]);
  const [additionalCurrentMeds, setAdditionalCurrentMeds] = useState([]);
  const [currentMedSearchQuery, setCurrentMedSearchQuery] = useState('');
  const [currentMedSearchResults, setCurrentMedSearchResults] = useState([]);
  const [currentMedSearchLoading, setCurrentMedSearchLoading] = useState(false);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const currentMedSearchTimeoutRef = useRef(null);

  // Fetch enabled telehealth providers for preference dropdown
  useEffect(() => {
    if (api.getEnabledTelehealthProviders) {
      api.getEnabledTelehealthProviders()
        .then(providers => setEnabledProviders(providers || []))
        .catch(() => {});
    }
  }, [api]);

  useEffect(() => {
    if (patient) {
      // Parse previous_medications if it's a string
      let prevMeds = patient.previous_medications || [];
      if (typeof prevMeds === 'string') {
        try {
          prevMeds = JSON.parse(prevMeds);
        } catch (e) {
          prevMeds = [];
        }
      }

      // Parse additional_current_medications if stored
      let additionalMeds = patient.additional_current_medications || [];
      if (typeof additionalMeds === 'string') {
        try {
          additionalMeds = JSON.parse(additionalMeds);
        } catch (e) {
          additionalMeds = [];
        }
      }
      setAdditionalCurrentMeds(Array.isArray(additionalMeds) ? additionalMeds : []);

      // Format date for input
      let dob = patient.date_of_birth || patient.dob || '';
      if (dob && dob.includes('T')) {
        dob = dob.split('T')[0];
      }

      setFormData({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        date_of_birth: dob,
        gender: patient.gender || '',
        email: patient.email || '',
        phone: patient.phone || '',
        address: patient.address || '',
        city: patient.city || '',
        state: patient.state || '',
        zip: patient.zip || '',
        country: patient.country || '',
        height: patient.height || '',
        weight: patient.weight || '',
        blood_type: patient.blood_type || '',
        social_history: patient.social_history || '',
        allergies: patient.allergies || '',
        past_history: patient.past_history || '',
        family_history: patient.family_history || '',
        current_medications: patient.current_medications || '',
        previous_medications: Array.isArray(prevMeds) ? prevMeds : [],
        telehealth_preference: patient.telehealth_preference || ''
      });

      // Load active prescriptions
      loadActivePrescriptions();
    }
  }, [patient, loadActivePrescriptions]);

  // Load active prescriptions for the patient
  const loadActivePrescriptions = useCallback(async () => {
    if (!patient?.id) return;

    setLoadingPrescriptions(true);
    try {
      const prescriptions = await api.getPatientActivePrescriptions(patient.id);
      if (prescriptions && Array.isArray(prescriptions)) {
        // Map prescriptions to medication format
        const meds = prescriptions.map(rx => ({
          id: rx.id,
          ndc_code: rx.ndc_code || rx.ndcCode,
          drug_name: rx.medicationName || rx.medication || rx.drug_name || 'Unknown',
          strength: rx.dosage || rx.strength || '',
          dosage_form: rx.dosage_form || '',
          frequency: rx.frequency || '',
          isPrescription: true // Flag to identify as prescription
        }));
        setActivePrescriptions(meds);
      }
    } catch (error) {
      console.error('Error loading prescriptions:', error);
      setActivePrescriptions([]);
    } finally {
      setLoadingPrescriptions(false);
    }
  }, [api, patient]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Medication search - same pattern as ePrescribe
  const handleSearchMedications = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const data = await api.searchMedications(query, null, null, 20);
      if (data && Array.isArray(data)) {
        // Filter out already selected medications
        const selectedNdcCodes = new Set(formData.previous_medications.map(m => m.ndc_code || m.ndcCode));
        const filtered = data.filter(med => !selectedNdcCodes.has(med.ndc_code || med.ndcCode));
        setSearchResults(filtered);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching medications:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [api, formData.previous_medications]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearchMedications(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, handleSearchMedications]);

  const handleSelectMedication = (medication) => {
    const newMed = {
      ndc_code: medication.ndcCode || medication.ndc_code,
      drug_name: medication.drugName || medication.drug_name || medication.genericName,
      strength: medication.strength || '',
      dosage_form: medication.dosageForm || medication.dosage_form || '',
      generic_name: medication.genericName || medication.generic_name || '',
      drug_class: medication.drugClass || medication.drug_class || ''
    };

    setFormData(prev => ({
      ...prev,
      previous_medications: [...prev.previous_medications, newMed]
    }));
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveMedication = (ndcCode) => {
    setFormData(prev => ({
      ...prev,
      previous_medications: prev.previous_medications.filter(
        m => (m.ndc_code || m.ndcCode) !== ndcCode
      )
    }));
  };

  // Current medication search - same pattern
  const handleSearchCurrentMedications = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setCurrentMedSearchResults([]);
      return;
    }

    setCurrentMedSearchLoading(true);
    try {
      const data = await api.searchMedications(query, null, null, 20);
      if (data && Array.isArray(data)) {
        // Filter out already selected medications (from prescriptions and additional)
        const prescriptionNdcCodes = new Set(activePrescriptions.map(m => m.ndc_code || m.ndcCode));
        const additionalNdcCodes = new Set(additionalCurrentMeds.map(m => m.ndc_code || m.ndcCode));
        const filtered = data.filter(med => {
          const ndcCode = med.ndc_code || med.ndcCode;
          return !prescriptionNdcCodes.has(ndcCode) && !additionalNdcCodes.has(ndcCode);
        });
        setCurrentMedSearchResults(filtered);
      } else {
        setCurrentMedSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching medications:', error);
      setCurrentMedSearchResults([]);
    } finally {
      setCurrentMedSearchLoading(false);
    }
  }, [api, activePrescriptions, additionalCurrentMeds]);

  // Debounced search for current medications
  useEffect(() => {
    if (currentMedSearchTimeoutRef.current) {
      clearTimeout(currentMedSearchTimeoutRef.current);
    }

    if (currentMedSearchQuery.length >= 2) {
      currentMedSearchTimeoutRef.current = setTimeout(() => {
        handleSearchCurrentMedications(currentMedSearchQuery);
      }, 300);
    } else {
      setCurrentMedSearchResults([]);
    }

    return () => {
      if (currentMedSearchTimeoutRef.current) {
        clearTimeout(currentMedSearchTimeoutRef.current);
      }
    };
  }, [currentMedSearchQuery, handleSearchCurrentMedications]);

  const handleSelectCurrentMedication = (medication) => {
    const newMed = {
      ndc_code: medication.ndcCode || medication.ndc_code,
      drug_name: medication.drugName || medication.drug_name || medication.genericName,
      strength: medication.strength || '',
      dosage_form: medication.dosageForm || medication.dosage_form || '',
      generic_name: medication.genericName || medication.generic_name || '',
      drug_class: medication.drugClass || medication.drug_class || ''
    };

    setAdditionalCurrentMeds(prev => [...prev, newMed]);
    setCurrentMedSearchQuery('');
    setCurrentMedSearchResults([]);
  };

  const handleRemoveCurrentMedication = (ndcCode) => {
    setAdditionalCurrentMeds(prev => prev.filter(
      m => (m.ndc_code || m.ndcCode) !== ndcCode
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Build current_medications text from prescriptions and additional meds
      const allCurrentMeds = [
        ...activePrescriptions.map(m => `${m.drug_name}${m.strength ? ` ${m.strength}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`),
        ...additionalCurrentMeds.map(m => `${m.drug_name}${m.strength ? ` ${m.strength}` : ''}`)
      ];

      await api.updatePatient(patient.id, {
        ...formData,
        current_medications: allCurrentMeds.join(', '),
        previous_medications: formData.previous_medications,
        additional_current_medications: additionalCurrentMeds,
        telehealth_preference: formData.telehealth_preference || null
      });

      addNotification('success', 'Patient information updated successfully');
      onSuccess();
    } catch (error) {
      console.error('Error updating patient:', error);
      addNotification('error', 'Failed to update patient information');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full px-4 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/20 ${
    theme === 'dark'
      ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-purple-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500'
  }`;

  const labelClass = `block text-sm font-medium mb-2 ${
    theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
  }`;

  const sectionButtonClass = (section) => `px-4 py-2 rounded-lg font-medium text-sm transition-all ${
    activeSection === section
      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
      : theme === 'dark'
        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
  }`;

  return (
    <div className={`rounded-xl ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-white'}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Edit Patient Chart
        </h3>
        <button
          type="button"
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${
            theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
          }`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button type="button" onClick={() => setActiveSection('personal')} className={sectionButtonClass('personal')}>
          <User className="w-4 h-4 inline mr-1" /> Personal Info
        </button>
        <button type="button" onClick={() => setActiveSection('contact')} className={sectionButtonClass('contact')}>
          <Phone className="w-4 h-4 inline mr-1" /> Contact
        </button>
        <button type="button" onClick={() => setActiveSection('physical')} className={sectionButtonClass('physical')}>
          <Ruler className="w-4 h-4 inline mr-1" /> Physical
        </button>
        <button type="button" onClick={() => setActiveSection('medical')} className={sectionButtonClass('medical')}>
          <Pill className="w-4 h-4 inline mr-1" /> Medical History
        </button>
        <button type="button" onClick={() => setActiveSection('preferences')} className={sectionButtonClass('preferences')}>
          <Calendar className="w-4 h-4 inline mr-1" /> Preferences
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information Section */}
        {activeSection === 'personal' && (
          <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              <User className="w-5 h-5 text-blue-500" />
              Personal Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name *</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => handleChange('date_of_birth', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Contact Information Section */}
        {activeSection === 'contact' && (
          <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              <Phone className="w-5 h-5 text-green-500" />
              Contact Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  maxLength={2}
                  placeholder="e.g., CA"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>ZIP Code</label>
                <input
                  type="text"
                  value={formData.zip}
                  onChange={(e) => handleChange('zip', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  maxLength={2}
                  placeholder="e.g., US"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {/* Physical Measurements Section */}
        {activeSection === 'physical' && (
          <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              <Ruler className="w-5 h-5 text-blue-500" />
              Physical Measurements
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>
                  <Ruler className="w-4 h-4 inline mr-1" />
                  Height
                </label>
                <input
                  type="text"
                  value={formData.height}
                  onChange={(e) => handleChange('height', e.target.value)}
                  placeholder="e.g., 5'10&quot; or 178 cm"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <Scale className="w-4 h-4 inline mr-1" />
                  Weight
                </label>
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  placeholder="e.g., 165 lbs or 75 kg"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <Droplet className="w-4 h-4 inline mr-1" />
                  Blood Group
                </label>
                <select
                  value={formData.blood_type}
                  onChange={(e) => handleChange('blood_type', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select blood group</option>
                  {BLOOD_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Social History */}
            <div className="mt-6">
              <label className={labelClass}>
                <Users className="w-4 h-4 inline mr-1" />
                Social History
              </label>
              <textarea
                value={formData.social_history}
                onChange={(e) => handleChange('social_history', e.target.value)}
                placeholder="Smoking status, alcohol use, occupation, living situation, etc."
                rows={3}
                className={inputClass}
              />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                Include relevant lifestyle factors such as tobacco/alcohol use, occupation, exercise habits, and living arrangements.
              </p>
            </div>

            {/* Current Medications with Prescriptions and Search */}
            <div className="mt-6">
              <label className={labelClass}>
                <Pill className="w-4 h-4 inline mr-1" />
                Current Medications
              </label>

              {/* Multi-select box with prescription chips and search */}
              <div className={`relative rounded-lg border transition-colors focus-within:ring-2 focus-within:ring-green-500/20 ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-600 focus-within:border-green-500'
                  : 'bg-white border-gray-300 focus-within:border-green-500'
              }`}>
                {/* Chips and input container */}
                <div className="flex flex-wrap gap-2 p-2 min-h-[42px]">
                  {/* Loading indicator */}
                  {loadingPrescriptions && (
                    <div className={`inline-flex items-center gap-2 px-2 py-1 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-500"></div>
                      Loading prescriptions...
                    </div>
                  )}

                  {/* Active prescription chips (read-only, green) */}
                  {activePrescriptions.map((med, index) => (
                    <div
                      key={`rx-${med.id || med.ndc_code || index}`}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                        theme === 'dark'
                          ? 'bg-green-900/40 text-green-300 border border-green-700'
                          : 'bg-green-100 text-green-800 border border-green-300'
                      }`}
                      title="From active prescription"
                    >
                      <Pill className="w-3 h-3" />
                      <span className="max-w-[150px] truncate font-medium">
                        {med.drug_name}
                      </span>
                      {med.strength && (
                        <span className={`text-xs ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                          {med.strength}
                        </span>
                      )}
                      <span className={`text-xs px-1 rounded ${theme === 'dark' ? 'bg-green-800/50 text-green-400' : 'bg-green-200 text-green-700'}`}>
                        Rx
                      </span>
                    </div>
                  ))}

                  {/* Additional current medication chips (editable, blue) */}
                  {additionalCurrentMeds.map((med, index) => (
                    <div
                      key={`add-${med.ndc_code || med.ndcCode || index}`}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                        theme === 'dark'
                          ? 'bg-blue-900/40 text-blue-300 border border-blue-700'
                          : 'bg-blue-100 text-blue-800 border border-blue-300'
                      }`}
                    >
                      <Pill className="w-3 h-3" />
                      <span className="max-w-[150px] truncate font-medium">
                        {med.drug_name}
                      </span>
                      {med.strength && (
                        <span className={`text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                          {med.strength}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveCurrentMedication(med.ndc_code || med.ndcCode)}
                        className={`ml-1 p-0.5 rounded-full transition-colors ${
                          theme === 'dark'
                            ? 'hover:bg-blue-700 text-blue-400 hover:text-blue-200'
                            : 'hover:bg-blue-200 text-blue-600 hover:text-blue-800'
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* Inline search input */}
                  <div className="flex-1 min-w-[150px] relative">
                    <input
                      type="text"
                      value={currentMedSearchQuery}
                      onChange={(e) => setCurrentMedSearchQuery(e.target.value)}
                      placeholder={activePrescriptions.length === 0 && additionalCurrentMeds.length === 0 ? "Search medications..." : "Add more..."}
                      className={`w-full px-2 py-1 bg-transparent border-none outline-none text-sm ${
                        theme === 'dark' ? 'text-white placeholder-slate-500' : 'text-gray-900 placeholder-gray-400'
                      }`}
                    />
                    {currentMedSearchLoading && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Search icon */}
                {!currentMedSearchLoading && !loadingPrescriptions && activePrescriptions.length === 0 && additionalCurrentMeds.length === 0 && !currentMedSearchQuery && (
                  <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                )}
              </div>

              {/* Search Results Dropdown */}
              {currentMedSearchResults.length > 0 && (
                <div className={`mt-1 max-h-48 overflow-y-auto rounded-lg border shadow-lg z-10 ${theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'}`}>
                  {currentMedSearchResults.map((med) => (
                    <div
                      key={med.ndcCode || med.ndc_code || med.id}
                      onClick={() => handleSelectCurrentMedication(med)}
                      className={`p-3 cursor-pointer transition-colors flex items-center gap-3 ${
                        theme === 'dark'
                          ? 'hover:bg-slate-700 border-b border-slate-700 last:border-b-0'
                          : 'hover:bg-gray-100 border-b border-gray-200 last:border-b-0'
                      }`}
                    >
                      <Pill className={`w-4 h-4 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {med.genericName || med.brandName || med.drugName}
                        </p>
                        <p className={`text-sm truncate ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          {med.strength} {med.dosageForm}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs mr-2 ${theme === 'dark' ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'}`}>
                  Rx
                </span>
                = From prescriptions (auto-loaded).
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs mx-2 ${theme === 'dark' ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                  Blue
                </span>
                = Additional medications you can add/remove.
              </p>
            </div>
          </div>
        )}

        {/* Medical History Section */}
        {activeSection === 'medical' && (
          <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              <Pill className="w-5 h-5 text-orange-500" />
              Medical History
            </h4>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Allergies</label>
                <textarea
                  value={formData.allergies}
                  onChange={(e) => handleChange('allergies', e.target.value)}
                  placeholder="List known allergies..."
                  rows={2}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Past Medical History</label>
                <textarea
                  value={formData.past_history}
                  onChange={(e) => handleChange('past_history', e.target.value)}
                  placeholder="Previous conditions, surgeries, hospitalizations..."
                  rows={2}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Family History</label>
                <textarea
                  value={formData.family_history}
                  onChange={(e) => handleChange('family_history', e.target.value)}
                  placeholder="Family medical history..."
                  rows={2}
                  className={inputClass}
                />
              </div>

              {/* Previous Medications with Search */}
              <div>
                <label className={labelClass}>
                  <Pill className="w-4 h-4 inline mr-1" />
                  Previous Medications
                </label>

                {/* Multi-select box with chips and search input */}
                <div className={`relative rounded-lg border transition-colors focus-within:ring-2 focus-within:ring-purple-500/20 ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-600 focus-within:border-purple-500'
                    : 'bg-white border-gray-300 focus-within:border-purple-500'
                }`}>
                  {/* Chips and input container */}
                  <div className="flex flex-wrap gap-2 p-2 min-h-[42px]">
                    {/* Selected medication chips */}
                    {formData.previous_medications.map((med, index) => (
                      <div
                        key={med.ndc_code || med.ndcCode || index}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                          theme === 'dark'
                            ? 'bg-purple-900/40 text-purple-300 border border-purple-700'
                            : 'bg-purple-100 text-purple-800 border border-purple-300'
                        }`}
                      >
                        <Pill className="w-3 h-3" />
                        <span className="max-w-[150px] truncate font-medium">
                          {med.drug_name}
                        </span>
                        {med.strength && (
                          <span className={`text-xs ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                            {med.strength}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveMedication(med.ndc_code || med.ndcCode)}
                          className={`ml-1 p-0.5 rounded-full transition-colors ${
                            theme === 'dark'
                              ? 'hover:bg-purple-700 text-purple-400 hover:text-purple-200'
                              : 'hover:bg-purple-200 text-purple-600 hover:text-purple-800'
                          }`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {/* Inline search input */}
                    <div className="flex-1 min-w-[150px] relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={formData.previous_medications.length === 0 ? "Search medications to add..." : "Add more..."}
                        className={`w-full px-2 py-1 bg-transparent border-none outline-none text-sm ${
                          theme === 'dark' ? 'text-white placeholder-slate-500' : 'text-gray-900 placeholder-gray-400'
                        }`}
                      />
                      {searchLoading && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Search icon */}
                  {!searchLoading && formData.previous_medications.length === 0 && !searchQuery && (
                    <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                  )}
                </div>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className={`mt-1 max-h-48 overflow-y-auto rounded-lg border shadow-lg z-10 ${theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'}`}>
                    {searchResults.map((med) => (
                      <div
                        key={med.ndcCode || med.ndc_code || med.id}
                        onClick={() => handleSelectMedication(med)}
                        className={`p-3 cursor-pointer transition-colors flex items-center gap-3 ${
                          theme === 'dark'
                            ? 'hover:bg-slate-700 border-b border-slate-700 last:border-b-0'
                            : 'hover:bg-gray-100 border-b border-gray-200 last:border-b-0'
                        }`}
                      >
                        <Pill className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {med.genericName || med.brandName || med.drugName}
                          </p>
                          <p className={`text-sm truncate ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                            {med.strength} {med.dosageForm}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                  Type to search and click to add medications. Click × on chips to remove.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Preferences Section */}
        {activeSection === 'preferences' && (
          <div className="space-y-6">
            <div>
              <h4 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <Calendar className="w-5 h-5 text-purple-500" /> Patient Preferences
              </h4>

              {/* Telehealth Platform Preference */}
              <div>
                <label className={labelClass}>Telehealth Platform Preference</label>
                {enabledProviders.length > 1 ? (
                  <>
                    <select
                      className={inputClass}
                      value={formData.telehealth_preference}
                      onChange={(e) => handleChange('telehealth_preference', e.target.value)}
                    >
                      <option value="">Clinic Default (no preference)</option>
                      {enabledProviders.map(p => (
                        <option key={p.provider_type} value={p.provider_type}>
                          {{zoom: 'Zoom', google_meet: 'Google Meet', microsoft_teams: 'Microsoft Teams', webex: 'Cisco Webex'}[p.provider_type] || p.provider_type}
                        </option>
                      ))}
                    </select>
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                      When multiple telehealth platforms are enabled, the patient's preferred platform will be used for session links.
                    </p>
                  </>
                ) : enabledProviders.length === 1 ? (
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Only one platform is enabled ({
                      {zoom: 'Zoom', google_meet: 'Google Meet', microsoft_teams: 'Microsoft Teams', webex: 'Cisco Webex'}[enabledProviders[0].provider_type] || enabledProviders[0].provider_type
                    }). All sessions will use this platform.
                  </p>
                ) : (
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    No telehealth platforms are configured. Contact your administrator to set up Zoom, Google Meet, Teams, or Webex.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={`flex items-center justify-end gap-3 pt-4 border-t ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PatientHealthMetricsForm;
