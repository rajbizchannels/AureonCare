import React, { useState, useEffect } from 'react';
import { Calendar, X, Save } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewAppointmentTypeForm = ({ theme, api, onClose, onSuccess, addNotification, t }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    durationMinutes: '30',
    color: '#3B82F6',
    isActive: true,
    displayOrder: '0'
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccessConfirmation, setShowSuccessConfirmation] = useState(false);

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

    // Validation - form is already validated by HTML5 required attributes
    // Show confirmation modal before submitting
    setShowConfirmation(true);
  };

  const handleActualSubmit = async () => {
    setShowConfirmation(false);

    try {
      const appointmentTypeData = {
        name: formData.name,
        description: formData.description,
        durationMinutes: parseInt(formData.durationMinutes) || 30,
        color: formData.color,
        isActive: formData.isActive,
        displayOrder: parseInt(formData.displayOrder) || 0
      };

      const newAppointmentType = await api.createAppointmentType(appointmentTypeData);
      await addNotification('success', `${t.newAppointmentTypeAdded || 'New appointment type added'}: ${newAppointmentType.name}`);

      // Show success confirmation
      setShowSuccessConfirmation(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onSuccess(newAppointmentType);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error creating appointment type:', err);
      addNotification('alert', err.message || t.failedToCreateAppointmentType || 'Failed to create appointment type. Please try again.');
    }
  };

  const colorPresets = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Orange', value: '#F59E0B' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Indigo', value: '#6366F1' }
  ];

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleActualSubmit}
        title="Add Appointment Type"
        message="Are you sure you want to add this appointment type?"
        type="confirm"
        confirmText="Add"
        cancelText="Cancel"
      />
      <ConfirmationModal
        theme={theme}
        isOpen={showSuccessConfirmation}
        onClose={() => setShowSuccessConfirmation(false)}
        onConfirm={() => {
          setShowSuccessConfirmation(false);
          onClose();
        }}
        title={t.success || 'Success!'}
        message={t.appointmentTypeAddedSuccess || 'Appointment type has been added successfully.'}
        type="success"
        confirmText={t.ok || 'OK'}
        showCancel={false}
      />
      <div className={`rounded-xl shadow-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`}>
        <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Calendar className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.newAppointmentType || 'New Appointment Type'}</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.appointmentTypeName || 'Appointment Type Name'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="General Consultation"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.description || 'Description'}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Brief description of this appointment type..."
                  rows="3"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.durationMinutes || 'Duration (minutes)'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="5"
                    step="5"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({...formData, durationMinutes: e.target.value})}
                    placeholder="30"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.displayOrder || 'Display Order'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({...formData, displayOrder: e.target.value})}
                    placeholder="0"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.color || 'Color'}
                </label>
                <div className="flex gap-2 mb-2">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setFormData({...formData, color: preset.value})}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${formData.color === preset.value ? 'border-white shadow-lg scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                      style={{ backgroundColor: preset.value }}
                      title={preset.name}
                    />
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    className="w-20 h-10 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    placeholder="#3B82F6"
                    className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.activeStatus || 'Active (visible to patients when booking)'}
                </span>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                    formData.isActive ? 'bg-purple-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
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
              {t.addAppointmentType || 'Add Appointment Type'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default NewAppointmentTypeForm;
