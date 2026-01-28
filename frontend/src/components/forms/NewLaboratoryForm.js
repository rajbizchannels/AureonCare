import React, { useState, useEffect } from 'react';
import { Microscope, X, Save } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';
import { useAudit } from '../../hooks/useAudit';

const NewLaboratoryForm = ({ theme, api, editingLaboratory, onClose, onSuccess, addNotification, t }) => {
  const { logFormView, logCreate, logUpdate, logError, startAction } = useAudit();
  const [formData, setFormData] = useState({
    labName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    fax: '',
    email: '',
    website: '',
    cliaNumber: '',
    npi: '',
    specialty: '',
    isActive: true,
    acceptsElectronicOrders: true
  });
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Log form view on mount
  useEffect(() => {
    startAction();
    logFormView('NewLaboratoryForm', {
      module: 'EHR',
      metadata: {
        mode: editingLaboratory ? 'edit' : 'create',
        laboratory_id: editingLaboratory?.id,
      },
    });
  }, []);

  // Preload form data when editing
  useEffect(() => {
    if (editingLaboratory) {
      setFormData({
        labName: editingLaboratory.labName || '',
        addressLine1: editingLaboratory.addressLine1 || '',
        addressLine2: editingLaboratory.addressLine2 || '',
        city: editingLaboratory.city || '',
        state: editingLaboratory.state || '',
        zipCode: editingLaboratory.zipCode || '',
        phone: editingLaboratory.phone || '',
        fax: editingLaboratory.fax || '',
        email: editingLaboratory.email || '',
        website: editingLaboratory.website || '',
        cliaNumber: editingLaboratory.cliaNumber || '',
        npi: editingLaboratory.npi || '',
        specialty: editingLaboratory.specialty || '',
        isActive: editingLaboratory.isActive !== undefined ? editingLaboratory.isActive : true,
        acceptsElectronicOrders: editingLaboratory.acceptsElectronicOrders !== undefined ? editingLaboratory.acceptsElectronicOrders : true
      });
    }
  }, [editingLaboratory]);

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
      let laboratory;
      if (editingLaboratory) {
        // Update existing laboratory
        laboratory = await api.updateLaboratory(editingLaboratory.id, formData);
        await addNotification('success', `Laboratory updated: ${laboratory.labName}`);

        // Log successful update
        logUpdate('NewLaboratoryForm', editingLaboratory, formData, {
          module: 'EHR',
          resource_id: editingLaboratory.id,
          metadata: {
            labName: formData.labName,
            cliaNumber: formData.cliaNumber,
          },
        });
      } else {
        // Create new laboratory
        laboratory = await api.createLaboratory(formData);
        await addNotification('success', `New laboratory added: ${laboratory.labName}`);

        // Log successful creation
        logCreate('NewLaboratoryForm', formData, {
          module: 'EHR',
          resource_id: laboratory.id,
          metadata: {
            labName: formData.labName,
            cliaNumber: formData.cliaNumber,
          },
        });
      }
      onSuccess(laboratory);
      onClose();
    } catch (err) {
      console.error(`Error ${editingLaboratory ? 'updating' : 'creating'} laboratory:`, err);
      addNotification('alert', `Failed to ${editingLaboratory ? 'update' : 'create'} laboratory`);

      // Log error
      logError('NewLaboratoryForm', 'form', err.message || 'Failed to save laboratory', {
        module: 'EHR',
        metadata: { formData },
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
        title={editingLaboratory ? "Update Laboratory" : "Add Laboratory"}
        message={editingLaboratory ? "Are you sure you want to update this laboratory?" : "Are you sure you want to add this laboratory?"}
        type="confirm"
        confirmText={editingLaboratory ? "Update Laboratory" : "Add Laboratory"}
        cancelText="Cancel"
      />
      <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
          <div className={`p-6 border-b flex items-center justify-between ${
            theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Microscope className="w-5 h-5 text-white" />
              </div>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t?.newLaboratory || 'New Laboratory'}
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
                      Laboratory Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.labName}
                      onChange={(e) => setFormData({...formData, labName: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="Enter laboratory name"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      CLIA Number
                    </label>
                    <input
                      type="text"
                      value={formData.cliaNumber}
                      onChange={(e) => setFormData({...formData, cliaNumber: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="Enter CLIA number"
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
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="Enter NPI"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Specialty
                    </label>
                    <input
                      type="text"
                      value={formData.specialty}
                      onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="e.g., Clinical Chemistry, Hematology, Microbiology"
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
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
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
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
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
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
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
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
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
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
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
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
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
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
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
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="contact@laboratory.com"
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
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}
                      placeholder="https://www.laboratory.com"
                    />
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {t?.settings || 'Settings'}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Active</span>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        formData.isActive
                          ? 'bg-blue-500'
                          : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Accepts Electronic Orders</span>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, acceptsElectronicOrders: !formData.acceptsElectronicOrders})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        formData.acceptsElectronicOrders
                          ? 'bg-blue-500'
                          : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.acceptsElectronicOrders ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
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
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Add Laboratory
                </button>
              </div>
            </div>
          </form>
      </div>
    </>
  );
};

export default NewLaboratoryForm;
