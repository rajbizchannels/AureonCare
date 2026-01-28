/**
 * useClinicSettings Hook
 * Manages clinic settings with validation, error handling, and persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { validateClinicSettings } from '../utils/validators';
import api from '../api/apiService';

const DEFAULT_CLINIC_SETTINGS = {
  name: 'AureonCare Medical Center',
  address: '123 Healthcare Ave, Medical City, MC 12345',
  phone: '(555) 123-4567',
  email: 'info@aureoncareclinic.com',
  website: 'www.aureoncareclinic.com',
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

  // Load clinic settings from database on mount
  useEffect(() => {
    const fetchClinicSettings = async () => {
      try {
        const settings = await api.getClinicSettings();
        if (settings && Object.keys(settings).length > 0) {
          setClinicSettings({ ...DEFAULT_CLINIC_SETTINGS, ...settings });
        }
      } catch (error) {
        console.error('Error fetching clinic settings:', error);
        // Keep default settings if fetch fails
      }
    };

    fetchClinicSettings();
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

    try {
      // Save to database via API
      const result = await api.saveClinicSettings(clinicSettings);

      if (addNotification) {
        await addNotification('success', result.message || 'Clinic settings saved successfully');
      }

      setValidationErrors({});
      setIsSaving(false);
      return { success: true };
    } catch (error) {
      console.error('Error saving clinic settings:', error);
      if (addNotification) {
        await addNotification('alert', error.message || 'Failed to save clinic settings');
      }
      setIsSaving(false);
      return { success: false, error: error.message };
    }
  }, [clinicSettings, addNotification]);

  return {
    clinicSettings,
    updateClinicSetting,
    saveClinicSettings,
    validationErrors,
    isSaving,
  };
};
