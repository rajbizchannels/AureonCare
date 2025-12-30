import React, { useState, useEffect } from 'react';
import { AlertCircle, X, Save, Flag } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewDenialForm = ({ theme, api, patients, claims, insurancePayers, onClose, onSuccess, addNotification }) => {
  const [formData, setFormData] = useState({
    patientId: '',
    claimId: '',
    insurance_payer_id: '',
    denial_date: new Date().toISOString().split('T')[0],
    denial_amount: '',
    denied_service_date: '',
    denial_reason_code: '',
    denial_reason_description: '',
    denial_category: 'Other',
    appeal_deadline: '',
    priority: 'medium',
    eob_number: '',
    era_number: '',
    notes: ''
  });

  const [processing, setProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [filteredClaims, setFilteredClaims] = useState([]);

  const denialCategories = [
    'Medical Necessity',
    'Prior Authorization Required',
    'Timely Filing',
    'Coordination of Benefits',
    'Duplicate Claim',
    'Invalid/Missing Information',
    'Non-Covered Service',
    'Patient Eligibility',
    'Coding Error',
    'Other'
  ];

  const priorities = [
    { id: 'low', name: 'Low', color: 'text-gray-500' },
    { id: 'medium', name: 'Medium', color: 'text-yellow-500' },
    { id: 'high', name: 'High', color: 'text-orange-500' },
    { id: 'urgent', name: 'Urgent', color: 'text-red-500' }
  ];

  // Common denial reason codes
  const denialReasonCodes = [
    { code: 'CO-16', description: 'Claim/service lacks information' },
    { code: 'CO-18', description: 'Duplicate claim/service' },
    { code: 'CO-22', description: 'Payment adjusted because this care may be covered by another payer' },
    { code: 'CO-45', description: 'Charge exceeds fee schedule/maximum allowable' },
    { code: 'CO-50', description: 'Non-covered service' },
    { code: 'CO-96', description: 'Non-covered charges' },
    { code: 'CO-109', description: 'Claim not covered by this payer' },
    { code: 'CO-197', description: 'Precertification/authorization/notification absent' },
    { code: 'PR-1', description: 'Deductible amount' },
    { code: 'PR-2', description: 'Coinsurance amount' },
    { code: 'PR-3', description: 'Copayment amount' },
    { code: 'OA-23', description: 'Indication of medical necessity missing' },
    { code: 'OA-109', description: 'Claim not covered by this payer' }
  ];

  // ESC key handler
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

  // Filter claims when patient is selected
  useEffect(() => {
    if (formData.patientId) {
      const patientClaims = claims.filter(c => c.patient_id?.toString() === formData.patientId);
      setFilteredClaims(patientClaims);
    } else {
      setFilteredClaims(claims);
    }
  }, [formData.patientId, claims]);

  // Auto-populate insurance payer and amounts from selected claim
  useEffect(() => {
    if (formData.claimId) {
      const selectedClaim = claims.find(c => c.id.toString() === formData.claimId);
      if (selectedClaim) {
        // Find insurance payer
        const payer = insurancePayers.find(ip =>
          ip.payer_id === selectedClaim.payer_id || ip.name === selectedClaim.payer
        );
        if (payer) {
          setFormData(prev => ({ ...prev, insurance_payer_id: payer.id }));
        }

        // Auto-populate denial amount with claim amount
        if (selectedClaim.amount) {
          setFormData(prev => ({ ...prev, denial_amount: selectedClaim.amount.toString() }));
        }

        // Auto-populate service date
        if (selectedClaim.service_date) {
          setFormData(prev => ({ ...prev, denied_service_date: selectedClaim.service_date }));
        }
      }
    }
  }, [formData.claimId, claims, insurancePayers]);

  // Auto-calculate appeal deadline (90 days from denial date)
  useEffect(() => {
    if (formData.denial_date) {
      const denialDate = new Date(formData.denial_date);
      denialDate.setDate(denialDate.getDate() + 90);
      const appealDeadline = denialDate.toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, appeal_deadline: appealDeadline }));
    }
  }, [formData.denial_date]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.patientId || !formData.claimId || !formData.denial_amount || !formData.denial_date) {
      addNotification('Please fill in all required fields', 'error');
      return;
    }

    // Show confirmation before submitting
    setShowConfirmation(true);
  };

  const handleActualSubmit = async () => {
    setProcessing(true);

    try {
      const patient = patients.find(p => p.id.toString() === formData.patientId);
      const claim = claims.find(c => c.id.toString() === formData.claimId);

      const denialData = {
        claim_id: formData.claimId,
        patient_id: formData.patientId,
        insurance_payer_id: formData.insurance_payer_id,
        denial_date: formData.denial_date,
        denial_amount: parseFloat(formData.denial_amount),
        denied_service_date: formData.denied_service_date || null,
        denial_reason_code: formData.denial_reason_code,
        denial_reason_description: formData.denial_reason_description,
        denial_category: formData.denial_category,
        appeal_status: 'not_appealed',
        appeal_deadline: formData.appeal_deadline,
        status: 'open',
        eob_number: formData.eob_number,
        era_number: formData.era_number,
        priority: formData.priority,
        notes: formData.notes,
        created_by: 'Current User' // This should come from auth context
      };

      await api.createDenial(denialData);

      addNotification(
        `Denial created successfully for ${patient?.first_name} ${patient?.last_name} - ${claim?.claim_number}`,
        'success'
      );

      setShowConfirmation(false);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating denial:', error);
      addNotification(error.message || 'Failed to create denial', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${isDark ? 'bg-red-500/20' : 'bg-red-50'}`}>
              <AlertCircle className="text-red-500" size={24} />
            </div>
            <div>
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                New Denial
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Record claim denial for appeal management
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Patient & Claim Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Patient <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.patientId}
              onChange={(e) => setFormData({ ...formData, patientId: e.target.value, claimId: '' })}
              required
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-red-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-red-500'
              } focus:outline-none focus:ring-2 focus:ring-red-500/20`}
            >
              <option value="">Select patient...</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.first_name} {patient.last_name} - {patient.date_of_birth}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Claim <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.claimId}
              onChange={(e) => setFormData({ ...formData, claimId: e.target.value })}
              required
              disabled={!formData.patientId}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-red-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-red-500'
              } focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50`}
            >
              <option value="">Select claim...</option>
              {filteredClaims.map((claim) => (
                <option key={claim.id} value={claim.id}>
                  {claim.claim_number} - ${claim.amount} - {claim.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Insurance Payer (Auto-populated) */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            Insurance Payer
          </label>
          <select
            value={formData.insurance_payer_id}
            onChange={(e) => setFormData({ ...formData, insurance_payer_id: e.target.value })}
            className={`w-full px-4 py-3 rounded-lg border ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white focus:border-red-500'
                : 'bg-white border-gray-300 text-gray-900 focus:border-red-500'
            } focus:outline-none focus:ring-2 focus:ring-red-500/20`}
          >
            <option value="">Select insurance payer...</option>
            {insurancePayers.map((payer) => (
              <option key={payer.id} value={payer.id}>
                {payer.name} ({payer.payer_id})
              </option>
            ))}
          </select>
        </div>

        {/* Denial Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Denial Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.denial_date}
              onChange={(e) => setFormData({ ...formData, denial_date: e.target.value })}
              required
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Denial Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.denial_amount}
                onChange={(e) => setFormData({ ...formData, denial_amount: e.target.value })}
                required
                className={`w-full pl-8 pr-4 py-3 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500`}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Service Date
            </label>
            <input
              type="date"
              value={formData.denied_service_date}
              onChange={(e) => setFormData({ ...formData, denied_service_date: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500`}
            />
          </div>
        </div>

        {/* Denial Reason */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Denial Reason Code
            </label>
            <select
              value={formData.denial_reason_code}
              onChange={(e) => {
                const selected = denialReasonCodes.find(r => r.code === e.target.value);
                setFormData({
                  ...formData,
                  denial_reason_code: e.target.value,
                  denial_reason_description: selected ? selected.description : formData.denial_reason_description
                });
              }}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-red-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-red-500'
              } focus:outline-none focus:ring-2 focus:ring-red-500/20`}
            >
              <option value="">Select reason code...</option>
              {denialReasonCodes.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.code} - {reason.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Denial Category
            </label>
            <select
              value={formData.denial_category}
              onChange={(e) => setFormData({ ...formData, denial_category: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-red-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-red-500'
              } focus:outline-none focus:ring-2 focus:ring-red-500/20`}
            >
              {denialCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Denial Reason Description */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            Denial Reason Description
          </label>
          <textarea
            value={formData.denial_reason_description}
            onChange={(e) => setFormData({ ...formData, denial_reason_description: e.target.value })}
            rows={2}
            className={`w-full px-4 py-3 rounded-lg border ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500`}
            placeholder="Detailed reason for denial..."
          />
        </div>

        {/* Appeal Deadline & Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Appeal Deadline <span className="text-xs text-gray-400">(Auto-calculated: 90 days)</span>
            </label>
            <input
              type="date"
              value={formData.appeal_deadline}
              onChange={(e) => setFormData({ ...formData, appeal_deadline: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-red-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-red-500'
              } focus:outline-none focus:ring-2 focus:ring-red-500/20`}
            >
              {priorities.map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ERA/EOB Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              ERA Number
            </label>
            <input
              type="text"
              value={formData.era_number}
              onChange={(e) => setFormData({ ...formData, era_number: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500`}
              placeholder="Electronic Remittance Advice #"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              EOB Number
            </label>
            <input
              type="text"
              value={formData.eob_number}
              onChange={(e) => setFormData({ ...formData, eob_number: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500`}
              placeholder="Explanation of Benefits #"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className={`w-full px-4 py-3 rounded-lg border ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500`}
            placeholder="Additional notes about this denial..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={processing}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save size={20} />
            {processing ? 'Creating...' : 'Create Denial'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <ConfirmationModal
          theme={theme}
          title="Confirm Denial"
          message={
            <div className="space-y-2">
              <p>Please review the denial details:</p>
              <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <p><strong>Denial Amount:</strong> ${formData.denial_amount}</p>
                <p><strong>Denial Date:</strong> {formData.denial_date}</p>
                <p><strong>Appeal Deadline:</strong> {formData.appeal_deadline}</p>
                <p><strong>Category:</strong> {formData.denial_category}</p>
                <p><strong>Priority:</strong> {formData.priority}</p>
              </div>
            </div>
          }
          onConfirm={handleActualSubmit}
          onCancel={() => setShowConfirmation(false)}
          confirmText="Create Denial"
          confirmButtonClass="bg-red-500 hover:bg-red-600"
        />
      )}
    </>
  );
};

export default NewDenialForm;
