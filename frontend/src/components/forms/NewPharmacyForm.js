import React, { useState, useEffect } from 'react';
import { Pill, X, Save } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';
import Toggle from '../Toggle';

const NewPharmacyForm = ({ theme, api, onClose, onSuccess, addNotification, t }) => {
  const [formData, setFormData] = useState({
    pharmacyName: '',
    chainName: '',
    ncpdpId: '',
    npi: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    fax: '',
    email: '',
    website: '',
    is24Hours: false,
    acceptsErx: true,
    deliveryAvailable: false,
    driveThrough: false,
    acceptsInsurance: true,
    preferredNetwork: false,
    isActive: true
  });
  const [showConfirmation, setShowConfirmation] = useState(false);

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
    setShowConfirmation(true);
  };

  const handleActualSubmit = async () => {
    try {
      const newPharmacy = await api.createPharmacy(formData);
      await addNotification('alert', `New pharmacy added: ${newPharmacy.pharmacyName}`);
      onSuccess(newPharmacy);
      onClose();
    } catch (err) {
      console.error('Error creating pharmacy:', err);
      addNotification('alert', 'Failed to create pharmacy');
    }
  };

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleActualSubmit}
        title="Add Pharmacy"
        message="Are you sure you want to add this pharmacy?"
        type="confirm"
        confirmText="Add Pharmacy"
        cancelText="Cancel"
      />
      <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
          <div className={`p-6 border-b flex items-center justify-between ${
            theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <Pill className="w-5 h-5 text-white" />
              </div>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t?.newPharmacy || 'New Pharmacy'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'
              }`}
            >
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {t?.basicInformation || 'Basic Information'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Pharmacy Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.pharmacyName}
                      onChange={(e) => setFormData({...formData, pharmacyName: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="Enter pharmacy name"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Chain Name
                    </label>
                    <input
                      type="text"
                      value={formData.chainName}
                      onChange={(e) => setFormData({...formData, chainName: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="e.g., CVS, Walgreens"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      NCPDP ID
                    </label>
                    <input
                      type="text"
                      value={formData.ncpdpId}
                      onChange={(e) => setFormData({...formData, ncpdpId: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="Enter NCPDP ID"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      NPI
                    </label>
                    <input
                      type="text"
                      value={formData.npi}
                      onChange={(e) => setFormData({...formData, npi: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="Enter NPI"
                    />
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {t?.addressInformation || 'Address Information'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={formData.addressLine1}
                      onChange={(e) => setFormData({...formData, addressLine1: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="Street address"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.addressLine2}
                      onChange={(e) => setFormData({...formData, addressLine2: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="Suite, unit, building, floor, etc."
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      State
                    </label>
                    <input
                      type="text"
                      maxLength="2"
                      value={formData.state}
                      onChange={(e) => setFormData({...formData, state: e.target.value.toUpperCase()})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="CA"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="12345"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {t?.contactInformation || 'Contact Information'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Fax
                    </label>
                    <input
                      type="tel"
                      value={formData.fax}
                      onChange={(e) => setFormData({...formData, fax: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="(555) 123-4568"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="contact@pharmacy.com"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="https://www.pharmacy.com"
                    />
                  </div>
                </div>
              </div>

              {/* Services & Settings */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {t?.servicesAndSettings || 'Services & Settings'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Toggle
                    checked={formData.isActive}
                    onChange={(checked) => setFormData({...formData, isActive: checked})}
                    label="Active"
                    theme={theme}
                  />
                  <Toggle
                    checked={formData.acceptsErx}
                    onChange={(checked) => setFormData({...formData, acceptsErx: checked})}
                    label="Accepts eRx (Electronic Prescriptions)"
                    theme={theme}
                  />
                  <Toggle
                    checked={formData.acceptsInsurance}
                    onChange={(checked) => setFormData({...formData, acceptsInsurance: checked})}
                    label="Accepts Insurance"
                    theme={theme}
                  />
                  <Toggle
                    checked={formData.preferredNetwork}
                    onChange={(checked) => setFormData({...formData, preferredNetwork: checked})}
                    label="Preferred Network"
                    theme={theme}
                  />
                  <Toggle
                    checked={formData.is24Hours}
                    onChange={(checked) => setFormData({...formData, is24Hours: checked})}
                    label="24 Hours"
                    theme={theme}
                  />
                  <Toggle
                    checked={formData.deliveryAvailable}
                    onChange={(checked) => setFormData({...formData, deliveryAvailable: checked})}
                    label="Delivery Available"
                    theme={theme}
                  />
                  <Toggle
                    checked={formData.driveThrough}
                    onChange={(checked) => setFormData({...formData, driveThrough: checked})}
                    label="Drive Through"
                    theme={theme}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800 hover:bg-slate-700 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Add Pharmacy
                </button>
              </div>
            </div>
          </form>
      </div>
    </>
  );
};

export default NewPharmacyForm;
