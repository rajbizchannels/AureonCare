/**
 * useClinicSettings Hook
 * Manages clinic settings with validation, error handling, and persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { validateClinicSettings, safeLocalStorageLoad, safeLocalStorageSave } from '../utils/validators';
import { STORAGE_KEYS } from '../constants/adminConstants';

const DEFAULT_CLINIC_SETTINGS = {
  name: 'MedFlow Medical Center',
  address: '123 Healthcare Ave, Medical City, MC 12345',
  phone: '(555) 123-4567',
  email: 'info@medflowclinic.com',
  website: 'www.medflowclinic.com',
  taxId: '',
  npi: '',
};

/**
 * Hook for managing clinic settings
 * @param {Function} addNotification - Notification handler function
 * @returns {Object} - Clinic settings state and handlers
 */
export const useClinicSettings = (addNotification) => {
  const [clinicSettings, setClinicSettings] = useState(DEFAULT_CLINIC_SETTINGS);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Load clinic settings from localStorage on mount
  useEffect(() => {
    const savedSettings = safeLocalStorageLoad(STORAGE_KEYS.CLINIC_SETTINGS);
    if (savedSettings) {
      setClinicSettings(savedSettings);
    }
  }, []);

  /**
   * Updates a single clinic setting field
   */
  const updateClinicSetting = useCallback((field, value) => {
    setClinicSettings(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [validationErrors]);

  /**
   * Saves clinic settings with validation
   */
  const saveClinicSettings = useCallback(async () => {
    setIsSaving(true);

    // Validate all settings
    const validation = validateClinicSettings(clinicSettings);

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      if (addNotification) {
        await addNotification('alert', 'Please fix validation errors before saving');
      }
      setIsSaving(false);
      return { success: false, errors: validation.errors };
    }

    // Save to localStorage (temporary until backend API is implemented)
    // TODO: Replace with proper backend API call
    const saveResult = safeLocalStorageSave(STORAGE_KEYS.CLINIC_SETTINGS, clinicSettings);

    if (!saveResult.success) {
      if (addNotification) {
        await addNotification('alert', saveResult.error);
      }
      setIsSaving(false);
      return { success: false, error: saveResult.error };
    }

    if (addNotification) {
      await addNotification('success', 'Clinic settings saved successfully');
    }

    setValidationErrors({});
    setIsSaving(false);
    return { success: true };
  }, [clinicSettings, addNotification]);

  return {
    clinicSettings,
    updateClinicSetting,
    saveClinicSettings,
    validationErrors,
    isSaving,
  };
};
