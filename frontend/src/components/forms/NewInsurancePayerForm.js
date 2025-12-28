import React, { useState, useEffect } from 'react';
import { Shield, X, Save } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewInsurancePayerForm = ({ theme, api, onClose, onSuccess, addNotification, t, editPayer = null }) => {
  const [formData, setFormData] = useState({
    payerId: editPayer?.payer_id || '',
    name: editPayer?.name || '',
    payerType: editPayer?.payer_type || 'insurance',
    phone: editPayer?.phone || '',
    email: editPayer?.email || '',
    website: editPayer?.website || '',
    address: editPayer?.address || '',
    city: editPayer?.city || '',
    state: editPayer?.state || '',
    zipCode: editPayer?.zip_code || '',
    contactPerson: editPayer?.contact_person || '',
    contactPhone: editPayer?.contact_phone || '',
    contactEmail: editPayer?.contact_email || '',
    claimSubmissionMethod: editPayer?.claim_submission_method || 'electronic',
    claimSubmissionAddress: editPayer?.claim_submission_address || '',
    electronicPayerId: editPayer?.electronic_payer_id || '',
    timelyFilingLimit: editPayer?.timely_filing_limit?.toString() || '365',
    priorAuthorizationRequired: editPayer?.prior_authorization_required || false,
    acceptsAssignment: editPayer?.accepts_assignment !== false,
    notes: editPayer?.notes || ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const isEditing = !!editPayer;

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

    // Show confirmation before submitting
    setShowConfirmation(true);
  };

  const handleActualSubmit = async () => {
    try {
      const payerData = {
        payer_id: formData.payerId,
        name: formData.name,
        payer_type: formData.payerType,
        phone: formData.phone,
        email: formData.email,
        website: formData.website,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zipCode,
        contact_person: formData.contactPerson,
        contact_phone: formData.contactPhone,
        contact_email: formData.contactEmail,
        claim_submission_method: formData.claimSubmissionMethod,
        claim_submission_address: formData.claimSubmissionAddress,
        electronic_payer_id: formData.electronicPayerId,
        timely_filing_limit: parseInt(formData.timelyFilingLimit) || 365,
        prior_authorization_required: formData.priorAuthorizationRequired,
        accepts_assignment: formData.acceptsAssignment,
        notes: formData.notes,
        is_active: true
      };

      let savedPayer;
      if (isEditing) {
        savedPayer = await api.updateInsurancePayer(editPayer.id, payerData);
        await addNotification('success', `${t.insurancePayerUpdated || 'Insurance payer updated'}: ${savedPayer.name}`);
      } else {
        savedPayer = await api.createInsurancePayer(payerData);
        await addNotification('success', `${t.newInsurancePayerAdded || 'New insurance payer added'}: ${savedPayer.name}`);
      }

      onSuccess(savedPayer);
      onClose();
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} insurance payer:`, err);
      addNotification('alert', isEditing ? (t.failedToUpdateInsurancePayer || 'Failed to update insurance payer. Please try again.') : (t.failedToCreateInsurancePayer || 'Failed to create insurance payer. Please try again.'));
    }
  };

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleActualSubmit}
        title={isEditing ? "Update Insurance Payer" : "Add Insurance Payer"}
        message={isEditing ? "Are you sure you want to update this insurance payer?" : "Are you sure you want to add this insurance payer?"}
        type="confirm"
        confirmText={isEditing ? "Update Payer" : "Add Payer"}
        cancelText="Cancel"
      />
      <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Shield className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {isEditing ? (t.editInsurancePayer || 'Edit Insurance Payer') : (t.newInsurancePayer || 'New Insurance Payer')}
            </h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.basicInformation || 'Basic Information'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.payerId || 'Payer ID'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.payerId}
                    onChange={(e) => setFormData({...formData, payerId: e.target.value.toUpperCase()})}
                    placeholder="BC001"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.payerName || 'Payer Name'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Blue Cross Blue Shield"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.payerType || 'Payer Type'} <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.payerType}
                    onChange={(e) => setFormData({...formData, payerType: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="insurance">{t.insurance || 'Insurance'}</option>
                    <option value="government">{t.government || 'Government'}</option>
                    <option value="self-pay">{t.selfPay || 'Self-Pay'}</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.phone || 'Phone'}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="1-800-123-4567"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
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
                    placeholder="contact@payer.com"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.website || 'Website'}
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    placeholder="www.payer.com"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.addressInformation || 'Address Information'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.address || 'Address'}
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="123 Main Street"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.city || 'City'}
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.state || 'State'}
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value.toUpperCase()})}
                    placeholder="MA"
                    maxLength="2"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.zipCode || 'ZIP Code'}
                  </label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                    placeholder="02101"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.contactInformation || 'Contact Information'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.contactPerson || 'Contact Person'}
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                    placeholder="John Doe"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.contactPhone || 'Contact Phone'}
                  </label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                    placeholder="1-800-123-4567"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.contactEmail || 'Contact Email'}
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
                    placeholder="contact@payer.com"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>
              </div>
            </div>

            {/* Claim Submission Details */}
            <div>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.claimSubmissionDetails || 'Claim Submission Details'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.claimSubmissionMethod || 'Claim Submission Method'}
                  </label>
                  <select
                    value={formData.claimSubmissionMethod}
                    onChange={(e) => setFormData({...formData, claimSubmissionMethod: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="electronic">{t.electronic || 'Electronic'}</option>
                    <option value="paper">{t.paper || 'Paper'}</option>
                    <option value="portal">{t.portal || 'Portal'}</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.electronicPayerId || 'Electronic Payer ID (EDI)'}
                  </label>
                  <input
                    type="text"
                    value={formData.electronicPayerId}
                    onChange={(e) => setFormData({...formData, electronicPayerId: e.target.value})}
                    placeholder="12345"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.claimSubmissionAddress || 'Claim Submission Address'}
                  </label>
                  <textarea
                    value={formData.claimSubmissionAddress}
                    onChange={(e) => setFormData({...formData, claimSubmissionAddress: e.target.value})}
                    placeholder="P.O. Box 1234, City, State, ZIP"
                    rows="2"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.timelyFilingLimit || 'Timely Filing Limit (days)'}
                  </label>
                  <input
                    type="number"
                    value={formData.timelyFilingLimit}
                    onChange={(e) => setFormData({...formData, timelyFilingLimit: e.target.value})}
                    placeholder="365"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t.priorAuthorizationRequired || 'Prior Authorization Required'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, priorAuthorizationRequired: !formData.priorAuthorizationRequired})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        formData.priorAuthorizationRequired ? 'bg-blue-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.priorAuthorizationRequired ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t.acceptsAssignment || 'Accepts Assignment'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, acceptsAssignment: !formData.acceptsAssignment})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        formData.acceptsAssignment ? 'bg-blue-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.acceptsAssignment ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.notes || 'Notes'}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder={t.notesPlaceholder || 'Additional notes...'}
                rows="3"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              />
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
              className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              <Save className="w-5 h-5" />
              {t.addInsurancePayer || 'Add Insurance Payer'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default NewInsurancePayerForm;
