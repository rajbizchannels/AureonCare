import React, { useState, useEffect } from 'react';
import { GitBranch, X, Save } from 'lucide-react';

const NewIntakeFlowForm = ({ theme, api, patients, editingFlow, onClose, onSuccess, addNotification }) => {
  const [formData, setFormData] = useState({
    patient_id: editingFlow?.patient_id || '',
    flow_type: editingFlow?.flow_type || 'new_patient',
    flow_name: editingFlow?.flow_name || '',
    total_steps: editingFlow?.total_steps || 5,
    current_step: editingFlow?.current_step || 1,
    status: editingFlow?.status || 'in_progress',
    notes: editingFlow?.notes || ''
  });

  const [processing, setProcessing] = useState(false);

  const flowTypes = [
    { id: 'new_patient', name: 'New Patient Onboarding' },
    { id: 'annual_checkup', name: 'Annual Checkup' },
    { id: 'pre_surgery', name: 'Pre-Surgery Preparation' },
    { id: 'custom', name: 'Custom Workflow' }
  ];

  const statusOptions = [
    { id: 'in_progress', name: 'In Progress' },
    { id: 'completed', name: 'Completed' },
    { id: 'abandoned', name: 'Abandoned' },
    { id: 'expired', name: 'Expired' }
  ];

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !processing) {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose, processing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      const patient = patients.find(p => p.id?.toString() === formData.patient_id);

      const flowData = {
        patient_id: formData.patient_id,
        flow_type: formData.flow_type,
        flow_name: formData.flow_name,
        total_steps: parseInt(formData.total_steps),
        current_step: parseInt(formData.current_step),
        status: formData.status,
        notes: formData.notes
      };

      let result;
      if (editingFlow) {
        result = await api.updateIntakeFlow(editingFlow.id, flowData);
        const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'patient';
        await addNotification('success', `Intake flow updated successfully for ${patientName}`);
      } else {
        result = await api.createIntakeFlow(flowData);
        const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'patient';
        await addNotification('success', `Intake flow created successfully for ${patientName}`);
      }

      onSuccess(result);
    } catch (err) {
      console.error('Error saving intake flow:', err);
      await addNotification('error', editingFlow ? 'Failed to update intake flow' : 'Failed to create intake flow');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-green-500/10 to-emerald-500/10 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
            <GitBranch className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
          </div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {editingFlow ? 'Edit Intake Flow' : 'New Intake Flow'}
          </h2>
        </div>
        {!processing && (
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Patient <span className="text-red-400">*</span>
              </label>
              <select
                required
                disabled={processing}
                value={formData.patient_id}
                onChange={(e) => setFormData({...formData, patient_id: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              >
                <option value="">Select Patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} - {p.mrn}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Flow Type <span className="text-red-400">*</span>
              </label>
              <select
                required
                disabled={processing}
                value={formData.flow_type}
                onChange={(e) => setFormData({...formData, flow_type: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              >
                {flowTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              Flow Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              disabled={processing}
              value={formData.flow_name}
              onChange={(e) => setFormData({...formData, flow_name: e.target.value})}
              placeholder="e.g., New Patient Onboarding - John Doe"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Total Steps <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                disabled={processing}
                min="1"
                max="20"
                value={formData.total_steps}
                onChange={(e) => setFormData({...formData, total_steps: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Current Step <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                disabled={processing}
                min="1"
                max={formData.total_steps}
                value={formData.current_step}
                onChange={(e) => setFormData({...formData, current_step: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Status <span className="text-red-400">*</span>
              </label>
              <select
                required
                disabled={processing}
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
              >
                {statusOptions.map(status => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              Notes
            </label>
            <textarea
              disabled={processing}
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows="4"
              placeholder="Add notes about the workflow progress..."
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
            />
          </div>
        </div>

        <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
              processing ? 'opacity-50 cursor-not-allowed' : ''
            } ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={processing}
            className={`flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              processing ? 'opacity-75 cursor-wait' : ''
            } text-white`}
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {editingFlow ? 'Update Flow' : 'Create Flow'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewIntakeFlowForm;
