import React, { useState, useEffect } from 'react';
import { Users, X, Save } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewPatientForm = ({ theme, api, patients, onClose, onSuccess, addNotification, t }) => {
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
    emergencyPhone: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [insurancePayers, setInsurancePayers] = useState([]);
  const [loadingPayers, setLoadingPayers] = useState(true);

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

  const handleActualSubmit = async () => {
    try {
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
        status: 'Active'
      };

      const newPatient = await api.createPatient(patientData);
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
                  <select
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="">{t.selectGender || 'Select Gender'}</option>
                    <option value="Male">{t.male || 'Male'}</option>
                    <option value="Female">{t.female || 'Female'}</option>
                    <option value="Other">{t.other || 'Other'}</option>
                    <option value="Prefer not to say">{t.preferNotToSay || 'Prefer not to say'}</option>
                  </select>
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
                  <select
                    value={formData.insurancePayerId}
                    onChange={(e) => setFormData({...formData, insurancePayerId: e.target.value})}
                    disabled={loadingPayers}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="">{loadingPayers ? 'Loading insurance payers...' : (t.selectInsurancePayer || 'Select Insurance Payer')}</option>
                    {insurancePayers.map(payer => (
                      <option key={payer.id} value={payer.id}>
                        {payer.name} ({payer.payer_id})
                      </option>
                    ))}
                  </select>
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
