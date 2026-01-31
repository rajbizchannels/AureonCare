import React, { useState, useEffect } from 'react';
import { X, Save, Ruler, Scale, Droplet, Users, Pill } from 'lucide-react';
import MedicationMultiSelect from './MedicationMultiSelect';

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
    height: patient?.height || '',
    weight: patient?.weight || '',
    blood_type: patient?.blood_type || '',
    social_history: patient?.social_history || '',
    previous_medications: []
  });
  const [saving, setSaving] = useState(false);

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

      setFormData({
        height: patient.height || '',
        weight: patient.weight || '',
        blood_type: patient.blood_type || '',
        social_history: patient.social_history || '',
        previous_medications: Array.isArray(prevMeds) ? prevMeds : []
      });
    }
  }, [patient]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.updatePatient(patient.id, {
        height: formData.height,
        weight: formData.weight,
        blood_type: formData.blood_type,
        social_history: formData.social_history,
        previous_medications: formData.previous_medications
      });

      addNotification('success', 'Health metrics updated successfully');
      onSuccess();
    } catch (error) {
      console.error('Error updating health metrics:', error);
      addNotification('error', 'Failed to update health metrics');
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

  return (
    <div className={`rounded-xl ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-white'}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Edit Patient Health Metrics
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Physical Measurements */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Height */}
          <div>
            <label className={labelClass}>
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4" />
                Height
              </div>
            </label>
            <input
              type="text"
              value={formData.height}
              onChange={(e) => handleChange('height', e.target.value)}
              placeholder="e.g., 5'10&quot; or 178 cm"
              className={inputClass}
            />
          </div>

          {/* Weight */}
          <div>
            <label className={labelClass}>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Weight
              </div>
            </label>
            <input
              type="text"
              value={formData.weight}
              onChange={(e) => handleChange('weight', e.target.value)}
              placeholder="e.g., 165 lbs or 75 kg"
              className={inputClass}
            />
          </div>

          {/* Blood Type */}
          <div>
            <label className={labelClass}>
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4" />
                Blood Group
              </div>
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
        <div>
          <label className={labelClass}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Social History
            </div>
          </label>
          <textarea
            value={formData.social_history}
            onChange={(e) => handleChange('social_history', e.target.value)}
            placeholder="Smoking status, alcohol use, occupation, living situation, etc."
            rows={4}
            className={inputClass}
          />
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            Include relevant lifestyle factors such as tobacco/alcohol use, occupation, exercise habits, and living arrangements.
          </p>
        </div>

        {/* Previous Medications */}
        <div>
          <label className={labelClass}>
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4" />
              Previous Medications
            </div>
          </label>
          <MedicationMultiSelect
            theme={theme}
            api={api}
            value={formData.previous_medications}
            onChange={(meds) => handleChange('previous_medications', meds)}
            placeholder="Search for previous medications..."
          />
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            Search and add medications the patient has taken in the past.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-600">
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
