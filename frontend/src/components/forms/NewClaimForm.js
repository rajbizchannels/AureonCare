import React, { useState } from 'react';
import { DollarSign, X, Save, Bot } from 'lucide-react';

const NewClaimForm = ({ theme, api, patients, claims, onClose, onSuccess, addNotification }) => {
  const [formData, setFormData] = useState({
    patientId: '',
    payerId: '',
    serviceDate: '',
    diagnosisCodes: '',
    procedureCodes: '',
    amount: '',
    notes: ''
  });

  const payers = [
    { id: 'BC001', name: 'Blue Cross' },
    { id: 'AE001', name: 'Aetna' },
    { id: 'UH001', name: 'UnitedHealth' },
    { id: 'CG001', name: 'Cigna' },
    { id: 'HU001', name: 'Humana' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const claimNo = `CLM-2024-${String(claims.length + 1).padStart(3, '0')}`;
      const patient = patients.find(p => p.id.toString() === formData.patientId);
      const payer = payers.find(p => p.id === formData.payerId);

      const claimData = {
        claim_no: claimNo,
        patient_id: formData.patientId,
        payer: payer?.name || 'Unknown',
        payer_id: formData.payerId,
        amount: parseFloat(formData.amount),
        status: 'Pending',
        date: new Date().toISOString().split('T')[0],
        service_date: formData.serviceDate,
        diagnosis_codes: formData.diagnosisCodes.split(',').map(c => c.trim()),
        procedure_codes: formData.procedureCodes.split(',').map(c => c.trim()),
        notes: formData.notes
      };

      const newClaim = await api.createClaim(claimData);

      await addNotification('claim', `New claim ${claimNo} created for ${patient?.name || patient?.first_name + ' ' + patient?.last_name}`);

      onSuccess(newClaim);
      onClose();
    } catch (err) {
      console.error('Error creating claim:', err);
      alert('Failed to create claim. Please try again.');
    }
  };

  return (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
      <div className={`rounded-xl border max-w-3xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-yellow-500/10 to-orange-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
              <DollarSign className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>New Claim</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Patient <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.patientId}
                  onChange={(e) => setFormData({...formData, patientId: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="">Select Patient</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - {p.mrn}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Insurance Payer <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.payerId}
                  onChange={(e) => setFormData({...formData, payerId: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="">Select Payer</option>
                  {payers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Service Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.serviceDate}
                  onChange={(e) => setFormData({...formData, serviceDate: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Claim Amount ($) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  placeholder="0.00"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Diagnosis Codes (ICD-10) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.diagnosisCodes}
                onChange={(e) => setFormData({...formData, diagnosisCodes: e.target.value})}
                placeholder="e.g., Z00.00, I10 (comma-separated)"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>Enter multiple codes separated by commas</p>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Procedure Codes (CPT) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.procedureCodes}
                onChange={(e) => setFormData({...formData, procedureCodes: e.target.value})}
                placeholder="e.g., 99213, 99214 (comma-separated)"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>Enter multiple codes separated by commas</p>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Clinical Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows="4"
                placeholder="Add any relevant clinical documentation or notes..."
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
            </div>

            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Bot className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-cyan-400 text-sm font-medium mb-1">AI Coding Assistant</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Based on the selected patient and service date, AI can suggest appropriate diagnosis and procedure codes.
                  </p>
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
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              <Save className="w-5 h-5" />
              Create Claim
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewClaimForm;
