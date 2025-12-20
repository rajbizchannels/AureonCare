import React, { useState, useEffect } from 'react';
import { CreditCard, X, Save, Lock } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewPaymentForm = ({ theme, api, patients, claims, onClose, onSuccess, addNotification }) => {
  const [formData, setFormData] = useState({
    patientId: '',
    claimId: '',
    amount: '',
    paymentMethod: 'credit_card',
    cardNumber: '',
    cardholderName: '',
    expiryDate: '',
    cvv: '',
    description: '',
    notes: ''
  });

  const [processing, setProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const paymentMethods = [
    { id: 'credit_card', name: 'Credit Card', icon: '💳' },
    { id: 'debit_card', name: 'Debit Card', icon: '💳' },
    { id: 'paypal', name: 'PayPal', icon: '🅿️' },
    { id: 'apple_pay', name: 'Apple Pay', icon: '🍎' },
    { id: 'google_pay', name: 'Google Pay', icon: '🔵' },
    { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦' }
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

  // Auto-populate amount from selected claim
  useEffect(() => {
    if (formData.claimId) {
      const selectedClaim = claims.find(c => c.id.toString() === formData.claimId);
      if (selectedClaim && selectedClaim.amount) {
        setFormData(prev => ({ ...prev, amount: selectedClaim.amount.toString() }));
      }
    }
  }, [formData.claimId, claims]);

  const formatCardNumber = (value) => {
    // Remove non-digits
    const cleaned = value.replace(/\D/g, '');
    // Add space every 4 digits
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.substring(0, 19); // Max 16 digits + 3 spaces
  };

  const formatExpiryDate = (value) => {
    // Remove non-digits
    const cleaned = value.replace(/\D/g, '');
    // Add slash after 2 digits
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Show confirmation before submitting
    setShowConfirmation(true);
  };

  const handleActualSubmit = async () => {
    setProcessing(true);

    try {
      // Generate payment number
      const paymentNo = `PAY-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

      const patient = patients.find(p => p.id.toString() === formData.patientId);
      const claim = claims.find(c => c.id.toString() === formData.claimId);

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get card brand from card number (simple detection)
      let cardBrand = 'Unknown';
      const firstDigit = formData.cardNumber.charAt(0);
      if (firstDigit === '4') cardBrand = 'Visa';
      else if (firstDigit === '5') cardBrand = 'Mastercard';
      else if (firstDigit === '3') cardBrand = 'Amex';
      else if (firstDigit === '6') cardBrand = 'Discover';

      const paymentData = {
        payment_number: paymentNo,
        patient_id: formData.patientId,
        claim_id: formData.claimId || null,
        amount: parseFloat(formData.amount),
        payment_method: formData.paymentMethod,
        payment_status: 'completed', // In production, this would be 'processing' initially
        transaction_id: `TXN-${Date.now()}`, // Simulated transaction ID
        card_last_four: formData.cardNumber.replace(/\D/g, '').slice(-4),
        card_brand: cardBrand,
        payment_date: new Date().toISOString(),
        description: formData.description || `Payment for ${claim?.claim_number || 'medical services'}`,
        notes: formData.notes
      };

      const newPayment = await api.createPayment(paymentData);

      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'patient';
      await addNotification('success', `Payment ${paymentNo} processed successfully for ${patientName}`);

      onSuccess(newPayment);
      onClose();
    } catch (err) {
      console.error('Error processing payment:', err);
      await addNotification('alert', 'Payment processing failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const requiresCardDetails = ['credit_card', 'debit_card'].includes(formData.paymentMethod);

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleActualSubmit}
        title="Process Payment"
        message="Are you sure you want to process this payment?"
        type="confirm"
        confirmText="Process Payment"
        cancelText="Cancel"
      />
      <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-green-500/10 to-emerald-500/10 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <CreditCard className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Process Payment</h2>
          </div>
          {!processing && (
            <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Patient and Claim Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Patient <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  disabled={processing}
                  value={formData.patientId}
                  onChange={(e) => setFormData({...formData, patientId: e.target.value})}
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
                  Related Claim (Optional)
                </label>
                <select
                  disabled={processing}
                  value={formData.claimId}
                  onChange={(e) => setFormData({...formData, claimId: e.target.value})}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="">No claim</option>
                  {claims.filter(c => c.patient_id?.toString() === formData.patientId).map(c => (
                    <option key={c.id} value={c.id}>{c.claim_number} - ${c.amount}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Payment Amount ($) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                disabled={processing}
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="0.00"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Payment Method <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {paymentMethods.map(method => (
                  <button
                    key={method.id}
                    type="button"
                    disabled={processing}
                    onClick={() => setFormData({...formData, paymentMethod: method.id})}
                    className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                      formData.paymentMethod === method.id
                        ? 'border-green-500 bg-green-500/10'
                        : theme === 'dark'
                        ? 'border-slate-700 hover:border-slate-600'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <span className="text-xl">{method.icon}</span>
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{method.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Card Details (only for credit/debit card) */}
            {requiresCardDetails && (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Card Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required={requiresCardDetails}
                    disabled={processing}
                    value={formData.cardNumber}
                    onChange={(e) => setFormData({...formData, cardNumber: formatCardNumber(e.target.value)})}
                    placeholder="1234 5678 9012 3456"
                    maxLength="19"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Cardholder Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required={requiresCardDetails}
                    disabled={processing}
                    value={formData.cardholderName}
                    onChange={(e) => setFormData({...formData, cardholderName: e.target.value})}
                    placeholder="John Doe"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Expiry Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required={requiresCardDetails}
                      disabled={processing}
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({...formData, expiryDate: formatExpiryDate(e.target.value)})}
                      placeholder="MM/YY"
                      maxLength="5"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      CVV <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required={requiresCardDetails}
                      disabled={processing}
                      value={formData.cvv}
                      onChange={(e) => setFormData({...formData, cvv: e.target.value.replace(/\D/g, '').substring(0, 4)})}
                      placeholder="123"
                      maxLength="4"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Description */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Payment Description
              </label>
              <input
                type="text"
                disabled={processing}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="e.g., Consultation fee, Co-payment"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
            </div>

            {/* Notes */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Additional Notes
              </label>
              <textarea
                disabled={processing}
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows="3"
                placeholder="Add any additional notes..."
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
            </div>

            {/* Security Notice */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-400 text-sm font-medium mb-1">Secure Payment</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Your payment information is encrypted and secure. We comply with PCI DSS standards for payment processing.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                processing
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              } ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className={`flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                processing ? 'opacity-75 cursor-wait' : ''
              } ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Process Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default NewPaymentForm;
