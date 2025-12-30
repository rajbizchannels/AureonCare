import React, { useState, useEffect } from 'react';
import { DollarSign, X, Save, FileText } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewPaymentPostingForm = ({ theme, api, patients, claims, insurancePayers, onClose, onSuccess, addNotification }) => {
  const [formData, setFormData] = useState({
    patientId: '',
    claimId: '',
    insurance_payer_id: '',
    check_number: '',
    check_date: '',
    payment_amount: '',
    allowed_amount: '',
    deductible_amount: '0',
    coinsurance_amount: '0',
    copay_amount: '0',
    adjustment_amount: '0',
    adjustment_reason: '',
    adjustment_code: '',
    posting_date: new Date().toISOString().split('T')[0],
    payment_method: 'check',
    era_number: '',
    eob_number: '',
    notes: ''
  });

  const [processing, setProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [filteredClaims, setFilteredClaims] = useState([]);

  const paymentMethods = [
    { id: 'check', name: 'Check' },
    { id: 'eft', name: 'Electronic Funds Transfer (EFT)' },
    { id: 'credit_card', name: 'Credit Card' },
    { id: 'cash', name: 'Cash' },
    { id: 'other', name: 'Other' }
  ];

  const adjustmentReasons = [
    { code: 'CO', description: 'Contractual Obligation' },
    { code: 'PR', description: 'Patient Responsibility' },
    { code: 'OA', description: 'Other Adjustment' },
    { code: 'PI', description: 'Payer Initiated Reduction' },
    { code: 'CR', description: 'Correction and Reversal' }
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

  // Auto-populate insurance payer from selected claim
  useEffect(() => {
    if (formData.claimId) {
      const selectedClaim = claims.find(c => c.id.toString() === formData.claimId);
      if (selectedClaim) {
        // Find insurance payer by payer_id from claim
        const payer = insurancePayers.find(ip =>
          ip.payer_id === selectedClaim.payer_id || ip.name === selectedClaim.payer
        );
        if (payer) {
          setFormData(prev => ({ ...prev, insurance_payer_id: payer.id }));
        }

        // Auto-populate allowed amount with claim amount
        if (selectedClaim.amount) {
          setFormData(prev => ({ ...prev, allowed_amount: selectedClaim.amount.toString() }));
        }
      }
    }
  }, [formData.claimId, claims, insurancePayers]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.patientId || !formData.claimId || !formData.payment_amount || !formData.posting_date) {
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
      const payer = insurancePayers.find(ip => ip.id === formData.insurance_payer_id);

      const postingData = {
        claim_id: formData.claimId,
        patient_id: formData.patientId,
        insurance_payer_id: formData.insurance_payer_id,
        check_number: formData.check_number,
        check_date: formData.check_date || null,
        payment_amount: parseFloat(formData.payment_amount),
        allowed_amount: parseFloat(formData.allowed_amount) || null,
        deductible_amount: parseFloat(formData.deductible_amount) || 0,
        coinsurance_amount: parseFloat(formData.coinsurance_amount) || 0,
        copay_amount: parseFloat(formData.copay_amount) || 0,
        adjustment_amount: parseFloat(formData.adjustment_amount) || 0,
        adjustment_reason: formData.adjustment_reason,
        adjustment_code: formData.adjustment_code,
        posting_date: formData.posting_date,
        status: 'posted',
        payment_method: formData.payment_method,
        era_number: formData.era_number,
        eob_number: formData.eob_number,
        notes: formData.notes,
        posted_by: 'Current User' // This should come from auth context
      };

      await api.createPaymentPosting(postingData);

      addNotification(
        `Payment posting created successfully for ${patient?.first_name} ${patient?.last_name}`,
        'success'
      );

      setShowConfirmation(false);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating payment posting:', error);
      addNotification(error.message || 'Failed to create payment posting', 'error');
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
            <div className={`p-3 rounded-xl ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-50'}`}>
              <DollarSign className="text-emerald-500" size={24} />
            </div>
            <div>
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                New Payment Posting
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Post insurance payment to claim
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
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
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
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50`}
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
                ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500'
            } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
          >
            <option value="">Select insurance payer...</option>
            {insurancePayers.map((payer) => (
              <option key={payer.id} value={payer.id}>
                {payer.name} ({payer.payer_id})
              </option>
            ))}
          </select>
        </div>

        {/* Payment Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Check Number
            </label>
            <input
              type="text"
              value={formData.check_number}
              onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
              placeholder="CHK-123456"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Check Date
            </label>
            <input
              type="date"
              value={formData.check_date}
              onChange={(e) => setFormData({ ...formData, check_date: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Posting Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.posting_date}
              onChange={(e) => setFormData({ ...formData, posting_date: e.target.value })}
              required
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
            />
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            Payment Method
          </label>
          <select
            value={formData.payment_method}
            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
            className={`w-full px-4 py-3 rounded-lg border ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500'
            } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
          >
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </div>

        {/* Amount Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Payment Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.payment_amount}
                onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                required
                className={`w-full pl-8 pr-4 py-3 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Allowed Amount
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.allowed_amount}
                onChange={(e) => setFormData({ ...formData, allowed_amount: e.target.value })}
                className={`w-full pl-8 pr-4 py-3 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Patient Responsibility */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Deductible
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.deductible_amount}
                onChange={(e) => setFormData({ ...formData, deductible_amount: e.target.value })}
                className={`w-full pl-8 pr-4 py-3 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Coinsurance
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.coinsurance_amount}
                onChange={(e) => setFormData({ ...formData, coinsurance_amount: e.target.value })}
                className={`w-full pl-8 pr-4 py-3 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Copay
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.copay_amount}
                onChange={(e) => setFormData({ ...formData, copay_amount: e.target.value })}
                className={`w-full pl-8 pr-4 py-3 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Adjustment */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Adjustment Amount
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.adjustment_amount}
                onChange={(e) => setFormData({ ...formData, adjustment_amount: e.target.value })}
                className={`w-full pl-8 pr-4 py-3 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Adjustment Code
            </label>
            <select
              value={formData.adjustment_code}
              onChange={(e) => {
                const selected = adjustmentReasons.find(r => r.code === e.target.value);
                setFormData({
                  ...formData,
                  adjustment_code: e.target.value,
                  adjustment_reason: selected ? selected.description : ''
                });
              }}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
            >
              <option value="">Select code...</option>
              {adjustmentReasons.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.code} - {reason.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Adjustment Reason
            </label>
            <input
              type="text"
              value={formData.adjustment_reason}
              onChange={(e) => setFormData({ ...formData, adjustment_reason: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
              placeholder="Reason for adjustment"
            />
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
              } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
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
              } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
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
            } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
            placeholder="Additional notes about this payment posting..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={processing}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save size={20} />
            {processing ? 'Creating...' : 'Create Payment Posting'}
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
          title="Confirm Payment Posting"
          message={
            <div className="space-y-2">
              <p>Please review the payment posting details:</p>
              <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <p><strong>Payment Amount:</strong> ${formData.payment_amount}</p>
                <p><strong>Allowed Amount:</strong> ${formData.allowed_amount || 'N/A'}</p>
                <p><strong>Adjustment:</strong> ${formData.adjustment_amount || '0.00'}</p>
                <p><strong>Patient Responsibility:</strong> ${(
                  parseFloat(formData.deductible_amount || 0) +
                  parseFloat(formData.coinsurance_amount || 0) +
                  parseFloat(formData.copay_amount || 0)
                ).toFixed(2)}</p>
                <p><strong>Posting Date:</strong> {formData.posting_date}</p>
              </div>
            </div>
          }
          onConfirm={handleActualSubmit}
          onCancel={() => setShowConfirmation(false)}
          confirmText="Post Payment"
          confirmButtonClass="bg-emerald-500 hover:bg-emerald-600"
        />
      )}
    </>
  );
};

export default NewPaymentPostingForm;
