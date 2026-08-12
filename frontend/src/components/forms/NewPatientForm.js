import React, { useState, useEffect } from 'react';
import { Users, X, Save, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';
import { useAudit } from '../../hooks/useAudit';
import { FORM_TEMPLATES } from '../../data/formTemplates';
import ThemedSelect from './ThemedSelect';

const NewPatientForm = ({ theme, api, patients, onClose, onSuccess, addNotification, t }) => {
  const { logFormView, logCreate, logError, startAction } = useAudit();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    insurance: '',
    insuranceId: '',
    insurancePayerId: '',
    emergencyContact: '',
    emergencyPhone: '',
    allergies: '',
    pastHistory: '',
    familyHistory: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [insurancePayers, setInsurancePayers] = useState([]);
  const [loadingPayers, setLoadingPayers] = useState(true);
  const [showAdditionalForms, setShowAdditionalForms] = useState(false);
  const [additionalForms, setAdditionalForms] = useState([]);

  const OPTIONAL_FORM_TEMPLATES = FORM_TEMPLATES.filter(t =>
    ['onboarding', 'consent', 'medical', 'clinical', 'billing'].includes(t.category_slug)
  ).slice(0, 15);

  // Log form view on mount
  useEffect(() => {
    startAction();
    logFormView('NewPatientForm', {
      module: 'EHR',
      metadata: {
        mode: 'create',
      },
    });
  }, [logFormView, startAction]);

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

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Show confirmation before submitting
    setShowConfirmation(true);
  };

  const DEFAULT_INTAKE_FORMS = [
    { name: 'New Patient Registration', slug: 'new-patient-registration', version: '1.0' },
    { name: 'Patient Intake Questionnaire', slug: 'patient-intake-questionnaire', version: '1.0' },
    { name: 'HIPAA Authorization', slug: 'hipaa-authorization', version: '1.0' },
    { name: 'Consent for Treatment', slug: 'consent-for-treatment', version: '1.0' }
  ];

  const triggerIntakeForms = async (patientId, extraForms = []) => {
    const allForms = [
      ...DEFAULT_INTAKE_FORMS,
      ...extraForms.map(f => ({ name: f.name, slug: f.id || f.slug, version: f.version || '1.0' }))
    ];
    const seen = new Set();
    for (const form of allForms) {
      if (seen.has(form.slug)) continue;
      seen.add(form.slug);
      try {
        await api.createFormSubmission({
          template_name: form.name,
          template_version: form.version,
          patient_id: patientId,
          form_data: {},
          status: 'draft',
          language: 'en',
          metadata: {
            trigger: extraForms.find(f => (f.id || f.slug) === form.slug) ? 'practice_sent' : 'patient_registration',
            template_slug: form.slug
          }
        });
      } catch (err) {
        console.error('Non-critical: Could not trigger form:', form.name, err);
      }
    }
  };

  const handleActualSubmit = async () => {
    // Generate MRN
    const mrn = `MRN${String(patients.length + 1).padStart(6, '0')}`;

    const patientData = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      mrn: mrn,
      dob: formData.dob,
      gender: formData.gender,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zip: formData.zip,
      insurance: formData.insurance,
      insurance_id: formData.insuranceId,
      insurance_payer_id: formData.insurancePayerId || null,
      allergies: formData.allergies,
      past_history: formData.pastHistory,
      family_history: formData.familyHistory,
      status: 'Active'
    };

    try {
      const newPatient = await api.createPatient(patientData);

      // Log successful creation
      logCreate('NewPatientForm', patientData, {
        module: 'EHR',
        resource_id: newPatient.id,
        patient_id: newPatient.id,
        metadata: {
          mrn: mrn,
          name: `${formData.firstName} ${formData.lastName}`,
          insurance_payer_id: formData.insurancePayerId,
        },
      });

      // Trigger intake forms (defaults + any additionally selected ones)
      await triggerIntakeForms(newPatient.id, additionalForms);

      // Add computed 'name' field for compatibility
      const patientWithName = {
        ...newPatient,
        name: `${newPatient.first_name} ${newPatient.last_name}`
      };

      await addNotification('alert', `${t.newPatientAdded || 'New patient added'}: ${newPatient.first_name} ${newPatient.last_name}`);

      onSuccess(patientWithName);
      onClose();
    } catch (err) {
      console.error('Error creating patient:', err);
      addNotification('alert', t.failedToCreatePatient);

      // Log error
      logError('NewPatientForm', 'form', err.message || 'Failed to create patient', {
        module: 'EHR',
        metadata: { formData: patientData },
      });
    }
  };

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleActualSubmit}
        title="Add Patient"
        message="Are you sure you want to add this patient?"
        type="confirm"
        confirmText="Add Patient"
        cancelText="Cancel"
      />
      <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-pink-500/10 ${theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-gray-300 bg-white'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Users className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.newPatient || 'New Patient'}</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.personalInformation || 'Personal Information'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.firstName || 'First Name'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.lastName || 'Last Name'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.dateOfBirth || 'Date of Birth'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dob}
                    onChange={(e) => setFormData({...formData, dob: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.gender || 'Gender'} <span className="text-red-400">*</span>
                  </label>
                  <ThemedSelect
                    theme={theme}
                    focusClass="focus:border-purple-500"
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  >
                    <option value="">{t.selectGender || 'Select Gender'}</option>
                    <option value="Male">{t.male || 'Male'}</option>
                    <option value="Female">{t.female || 'Female'}</option>
                    <option value="Other">{t.other || 'Other'}</option>
                    <option value="Prefer not to say">{t.preferNotToSay || 'Prefer not to say'}</option>
                  </ThemedSelect>
                </div>
              </div>
            </div>

            <div>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.contactInformation || 'Contact Information'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.phone || 'Phone'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder={t.phonePlaceholder || '+1-555-0100'}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.email || 'Email'}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder={t.emailPlaceholder || 'patient@example.com'}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.address || 'Address'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder={t.addressPlaceholder || '123 Main Street'}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.city || 'City'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.state || 'State'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength="2"
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value.toUpperCase()})}
                    placeholder={t.statePlaceholder || 'MA'}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.zipCode || 'ZIP Code'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.zip}
                    onChange={(e) => setFormData({...formData, zip: e.target.value})}
                    placeholder={t.zipCodePlaceholder || '02101'}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.insuranceInformation || 'Insurance Information'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.insurancePayer || 'Insurance Payer'}
                  </label>
                  <ThemedSelect
                    theme={theme}
                    focusClass="focus:border-purple-500"
                    value={formData.insurancePayerId}
                    onChange={(e) => setFormData({...formData, insurancePayerId: e.target.value})}
                    disabled={loadingPayers}
                  >
                    <option value="">{loadingPayers ? 'Loading insurance payers...' : (t.selectInsurancePayer || 'Select Insurance Payer')}</option>
                    {insurancePayers.map(payer => (
                      <option key={payer.id} value={payer.id}>
                        {payer.name} ({payer.payer_id})
                      </option>
                    ))}
                  </ThemedSelect>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.insuranceProvider || 'Insurance Provider'}
                  </label>
                  <input
                    type="text"
                    value={formData.insurance}
                    onChange={(e) => setFormData({...formData, insurance: e.target.value})}
                    placeholder={t.insuranceProviderPlaceholder || 'Blue Cross'}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.insuranceId || 'Insurance ID'}
                  </label>
                  <input
                    type="text"
                    value={formData.insuranceId}
                    onChange={(e) => setFormData({...formData, insuranceId: e.target.value})}
                    placeholder={t.insuranceIdPlaceholder || 'BC123456'}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.emergencyContact || 'Emergency Contact'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.emergencyContactName || 'Emergency Contact Name'}
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                    placeholder={t.emergencyContactNamePlaceholder || 'Jane Doe (Spouse)'}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.emergencyContactPhone || 'Emergency Contact Phone'}
                  </label>
                  <input
                    type="tel"
                    value={formData.emergencyPhone}
                    onChange={(e) => setFormData({...formData, emergencyPhone: e.target.value})}
                    placeholder={t.emergencyContactPhonePlaceholder || '+1-555-0200'}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.medicalHistory || 'Medical History'}</h3>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.allergies || 'Allergies'}
                  </label>
                  <textarea
                    value={formData.allergies}
                    onChange={(e) => setFormData({...formData, allergies: e.target.value})}
                    placeholder={t.allergiesPlaceholder || 'List any known allergies (medications, food, environmental, etc.)'}
                    rows="3"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.pastHistory || 'Past Medical History'}
                  </label>
                  <textarea
                    value={formData.pastHistory}
                    onChange={(e) => setFormData({...formData, pastHistory: e.target.value})}
                    placeholder={t.pastHistoryPlaceholder || 'Previous illnesses, surgeries, hospitalizations, etc.'}
                    rows="3"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.familyHistory || 'Family History'}
                  </label>
                  <textarea
                    value={formData.familyHistory}
                    onChange={(e) => setFormData({...formData, familyHistory: e.target.value})}
                    placeholder={t.familyHistoryPlaceholder || 'Family medical history (e.g., diabetes, heart disease, cancer, etc.)'}
                    rows="3"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>
              </div>
            </div>
          </div>

            {/* Additional Forms (Optional) */}
            <div className={`rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <button
                type="button"
                onClick={() => setShowAdditionalForms(p => !p)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-teal-500" />
                  <span className="text-sm font-medium">Additional Forms to Send <span className={`text-xs font-normal ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>(Optional){additionalForms.length > 0 ? ` · ${additionalForms.length} selected` : ''}</span></span>
                </div>
                {showAdditionalForms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showAdditionalForms && (
                <div className={`px-4 pb-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-100'}`}>
                  <p className={`text-xs mt-3 mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    Select additional forms to send to this patient after registration. Default intake forms will always be included.
                  </p>
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {OPTIONAL_FORM_TEMPLATES.map(tmpl => {
                      const isDefault = DEFAULT_INTAKE_FORMS.some(d => d.slug === (tmpl.id || tmpl.slug));
                      const isSelected = additionalForms.some(f => (f.id || f.slug) === (tmpl.id || tmpl.slug));
                      return (
                        <label
                          key={tmpl.id || tmpl.slug}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            isDefault
                              ? theme === 'dark' ? 'bg-slate-700/40 opacity-60' : 'bg-gray-100 opacity-60'
                              : isSelected
                                ? theme === 'dark' ? 'bg-teal-900/30 border border-teal-700/50' : 'bg-teal-50 border border-teal-200'
                                : theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isDefault}
                            checked={isDefault || isSelected}
                            onChange={e => {
                              if (isDefault) return;
                              setAdditionalForms(prev =>
                                e.target.checked ? [...prev, tmpl] : prev.filter(f => (f.id || f.slug) !== (tmpl.id || tmpl.slug))
                              );
                            }}
                            className="w-4 h-4 rounded text-teal-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>{tmpl.name}</p>
                            <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{tmpl.subcategory || tmpl.template_type}</p>
                          </div>
                          {isDefault && <span className="text-xs text-teal-500 font-medium flex-shrink-0">Default</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
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
              className={`flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              <Save className="w-5 h-5" />
              {t.addPatient || 'Add Patient'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default NewPatientForm;
