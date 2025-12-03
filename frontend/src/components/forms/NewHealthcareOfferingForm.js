import React, { useState, useEffect } from 'react';
import { X, Heart, Clock, Tag, Shield, AlertCircle } from 'lucide-react';
import MedicalCodeMultiSelect from './MedicalCodeMultiSelect';

const NewHealthcareOfferingForm = ({ theme, api, onClose, onSuccess, addNotification, t, editingOffering = null }) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    durationMinutes: 30,
    requiresPreparation: false,
    preparationInstructions: '',
    isActive: true,
    isFeatured: false,
    availableOnline: true,
    requiresReferral: false,
    cptCodes: [],
    icdCodes: [],
    minAge: '',
    maxAge: '',
    genderRestriction: 'any',
    contraindications: '',
    imageUrl: '',
    consentFormRequired: false,
    consentFormUrl: ''
  });

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await api.getOfferingCategories();
        setCategories(cats || []);
      } catch (error) {
        console.error('Error loading service categories:', error);
        addNotification('alert', 'Failed to load service categories');
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, [api, addNotification]);

  // Populate form when editing
  useEffect(() => {
    const loadOfferingData = async () => {
      if (editingOffering) {
        // Load ICD and CPT codes as code objects
        const icdCodeObjects = [];
        const cptCodeObjects = [];

        if (editingOffering.icdCodes && Array.isArray(editingOffering.icdCodes)) {
          for (const code of editingOffering.icdCodes) {
            try {
              const codeData = await api.getMedicalCodeByCode(code);
              if (codeData) icdCodeObjects.push(codeData);
            } catch (err) {
              console.warn(`Could not load ICD code ${code}:`, err);
            }
          }
        }

        if (editingOffering.cptCodes && Array.isArray(editingOffering.cptCodes)) {
          for (const code of editingOffering.cptCodes) {
            try {
              const codeData = await api.getMedicalCodeByCode(code);
              if (codeData) cptCodeObjects.push(codeData);
            } catch (err) {
              console.warn(`Could not load CPT code ${code}:`, err);
            }
          }
        }

        setFormData({
          name: editingOffering.name || '',
          description: editingOffering.description || '',
          categoryId: editingOffering.categoryId || '',
          durationMinutes: editingOffering.durationMinutes || 30,
          requiresPreparation: editingOffering.requiresPreparation || false,
          preparationInstructions: editingOffering.preparationInstructions || '',
          isActive: editingOffering.isActive !== undefined ? editingOffering.isActive : true,
          isFeatured: editingOffering.isFeatured || false,
          availableOnline: editingOffering.availableOnline !== undefined ? editingOffering.availableOnline : true,
          requiresReferral: editingOffering.requiresReferral || false,
          cptCodes: cptCodeObjects,
          icdCodes: icdCodeObjects,
          minAge: editingOffering.minAge || '',
          maxAge: editingOffering.maxAge || '',
          genderRestriction: editingOffering.genderRestriction || 'any',
          contraindications: editingOffering.contraindications || '',
          imageUrl: editingOffering.imageUrl || '',
          consentFormRequired: editingOffering.consentFormRequired || false,
          consentFormUrl: editingOffering.consentFormUrl || ''
        });
      }
    };
    loadOfferingData();
  }, [editingOffering, api]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      addNotification('alert', 'Please enter offering name');
      return;
    }

    setLoading(true);
    try {
      // Extract code strings from code objects
      const cptCodesArray = formData.cptCodes.map(code => code.code);
      const icdCodesArray = formData.icdCodes.map(code => code.code);

      const offeringData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        categoryId: formData.categoryId || null,
        durationMinutes: parseInt(formData.durationMinutes) || 30,
        requiresPreparation: formData.requiresPreparation,
        preparationInstructions: formData.requiresPreparation ? formData.preparationInstructions.trim() || null : null,
        isActive: formData.isActive,
        isFeatured: formData.isFeatured,
        availableOnline: formData.availableOnline,
        requiresReferral: formData.requiresReferral,
        cptCodes: cptCodesArray.length > 0 ? cptCodesArray : null,
        icdCodes: icdCodesArray.length > 0 ? icdCodesArray : null,
        minAge: formData.minAge ? parseInt(formData.minAge) : null,
        maxAge: formData.maxAge ? parseInt(formData.maxAge) : null,
        genderRestriction: formData.genderRestriction || 'any',
        contraindications: formData.contraindications.trim() || null,
        imageUrl: formData.imageUrl.trim() || null,
        consentFormRequired: formData.consentFormRequired,
        consentFormUrl: formData.consentFormRequired ? formData.consentFormUrl.trim() || null : null
      };

      let result;
      if (editingOffering) {
        result = await api.updateOffering(editingOffering.id, offeringData);
        addNotification('success', t.offeringUpdatedSuccessfully || 'Healthcare offering updated successfully');
      } else {
        result = await api.createOffering(offeringData);
        addNotification('success', t.offeringCreatedSuccessfully || 'Healthcare offering created successfully');
      }
      onSuccess(result);
    } catch (error) {
      console.error(`Error ${editingOffering ? 'updating' : 'creating'} healthcare offering:`, error);
      addNotification('alert', error.message || `Failed to ${editingOffering ? 'update' : 'create'} healthcare offering`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={`rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-teal-400" />
            <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {editingOffering ? (t.editHealthcareOffering || 'Edit Healthcare Offering') : (t.addHealthcareOffering || 'Add Healthcare Offering')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
          >
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t.basicInformation || 'Basic Information'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.offeringName || 'Offering Name'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder={t.enterOfferingName || 'Enter offering name'}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.description || 'Description'}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder={t.enterDescription || 'Enter description'}
                    rows={3}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.serviceCategory || 'Service Category'}
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({...formData, categoryId: e.target.value})}
                    className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    disabled={loadingCategories}
                  >
                    <option value="">{loadingCategories ? t.loading || 'Loading...' : t.selectCategory || 'Select category'}</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    <Clock className="w-4 h-4 inline mr-1" />
                    {t.durationMinutes || 'Duration (minutes)'}
                  </label>
                  <input
                    type="number"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({...formData, durationMinutes: e.target.value})}
                    className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    min="5"
                    step="5"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.imageUrl || 'Image URL'}
                  </label>
                  <input
                    type="text"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                    className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder={t.enterImageUrl || 'Enter image URL (optional)'}
                  />
                </div>
              </div>
            </div>

            {/* Medical Codes */}
            <div>
              <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <Tag className="w-5 h-5 inline mr-2" />
                {t.medicalCodes || 'Medical Codes'}
              </h4>
              <div className="space-y-4">
                <MedicalCodeMultiSelect
                  theme={theme}
                  api={api}
                  value={formData.cptCodes}
                  onChange={(codes) => setFormData({...formData, cptCodes: codes})}
                  codeType="cpt"
                  label={t.cptCodes || 'CPT Procedure Codes'}
                  placeholder={t.searchCptCodes || 'Search for CPT codes by code or description...'}
                />

                <MedicalCodeMultiSelect
                  theme={theme}
                  api={api}
                  value={formData.icdCodes}
                  onChange={(codes) => setFormData({...formData, icdCodes: codes})}
                  codeType="icd"
                  label={t.icdCodes || 'ICD-10 Diagnosis Codes'}
                  placeholder={t.searchIcdCodes || 'Search for ICD codes by code or description...'}
                />
              </div>
            </div>

            {/* Eligibility & Requirements */}
            <div>
              <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <Shield className="w-5 h-5 inline mr-2" />
                {t.eligibilityRequirements || 'Eligibility & Requirements'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.minimumAge || 'Minimum Age'}
                  </label>
                  <input
                    type="number"
                    value={formData.minAge}
                    onChange={(e) => setFormData({...formData, minAge: e.target.value})}
                    className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    min="0"
                    placeholder={t.anyAge || 'Any'}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.maximumAge || 'Maximum Age'}
                  </label>
                  <input
                    type="number"
                    value={formData.maxAge}
                    onChange={(e) => setFormData({...formData, maxAge: e.target.value})}
                    className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    min="0"
                    placeholder={t.anyAge || 'Any'}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.genderRestriction || 'Gender Restriction'}
                  </label>
                  <select
                    value={formData.genderRestriction}
                    onChange={(e) => setFormData({...formData, genderRestriction: e.target.value})}
                    className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  >
                    <option value="any">{t.any || 'Any'}</option>
                    <option value="male">{t.male || 'Male'}</option>
                    <option value="female">{t.female || 'Female'}</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    {t.contraindications || 'Contraindications'}
                  </label>
                  <textarea
                    value={formData.contraindications}
                    onChange={(e) => setFormData({...formData, contraindications: e.target.value})}
                    className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder={t.enterContraindications || 'List any contraindications or restrictions'}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Preparation */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.requiresPreparation || 'Requires Preparation'}
                </span>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, requiresPreparation: !formData.requiresPreparation})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                    formData.requiresPreparation ? 'bg-teal-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.requiresPreparation ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {formData.requiresPreparation && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.preparationInstructions || 'Preparation Instructions'}
                  </label>
                  <textarea
                    value={formData.preparationInstructions}
                    onChange={(e) => setFormData({...formData, preparationInstructions: e.target.value})}
                    className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder={t.enterPreparationInstructions || 'Enter preparation instructions'}
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* Consent Form */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.consentFormRequired || 'Consent Form Required'}
                </span>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, consentFormRequired: !formData.consentFormRequired})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                    formData.consentFormRequired ? 'bg-teal-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.consentFormRequired ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {formData.consentFormRequired && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.consentFormUrl || 'Consent Form URL'}
                  </label>
                  <input
                    type="text"
                    value={formData.consentFormUrl}
                    onChange={(e) => setFormData({...formData, consentFormUrl: e.target.value})}
                    className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder={t.enterConsentFormUrl || 'Enter consent form URL'}
                  />
                </div>
              )}
            </div>

            {/* Toggles */}
            <div>
              <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t.availability || 'Availability'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.active || 'Active'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                      formData.isActive ? 'bg-teal-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
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
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.featured || 'Featured'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, isFeatured: !formData.isFeatured})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                      formData.isFeatured ? 'bg-teal-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isFeatured ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.availableOnline || 'Available Online'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, availableOnline: !formData.availableOnline})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                      formData.availableOnline ? 'bg-teal-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.availableOnline ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.requiresReferral || 'Requires Referral'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, requiresReferral: !formData.requiresReferral})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                      formData.requiresReferral ? 'bg-teal-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.requiresReferral ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`flex justify-end gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-6 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              disabled={loading}
            >
              {t.cancel || 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading
                ? (editingOffering ? (t.updating || 'Updating...') : (t.creating || 'Creating...'))
                : (editingOffering ? (t.updateOffering || 'Update Offering') : (t.createOffering || 'Create Offering'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewHealthcareOfferingForm;
