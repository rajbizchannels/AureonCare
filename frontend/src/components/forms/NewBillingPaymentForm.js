import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, X } from 'lucide-react';
import ThemedSelect from './ThemedSelect';

const NewBillingPaymentForm = ({ theme, api, patients, onClose, onSuccess, addNotification, editingPayment, t }) => {
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    invoice_id: editingPayment?.invoice_id?.toString() || '',
    patient_id: editingPayment?.patient_id?.toString() || '',
    amount: editingPayment?.amount?.toString() || '',
    payment_method: editingPayment?.payment_method || 'credit_card',
    payment_date: editingPayment?.payment_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    status: editingPayment?.status || 'completed',
    transaction_id: editingPayment?.transaction_id || '',
    reference_number: editingPayment?.reference_number || '',
    notes: editingPayment?.notes || ''
  });

  const paymentMethods = [
    { id: 'cash', name: t?.cash || 'Cash' },
    { id: 'credit_card', name: t?.creditCard || 'Credit Card' },
    { id: 'debit_card', name: t?.debitCard || 'Debit Card' },
    { id: 'check', name: t?.check || 'Check' },
    { id: 'ach', name: t?.ach || 'ACH' },
    { id: 'wire', name: t?.wire || 'Wire Transfer' },
    { id: 'insurance', name: t?.insurance || 'Insurance' },
    { id: 'other', name: t?.other || 'Other' }
  ];

  const statusOptions = [
    { id: 'pending', name: t?.pending || 'Pending' },
    { id: 'completed', name: t?.completed || 'Completed' }
  ];

  // Load invoices on mount
  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const data = await api.getBillingInvoices();
        setInvoices(data || []);
      } catch (error) {
        console.error('Error loading invoices:', error);
        addNotification('alert', t?.failedToLoadInvoices || 'Failed to load invoices');
      } finally {
        setLoadingInvoices(false);
      }
    };
    loadInvoices();
  }, [api, addNotification, t]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !submitting) {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose, submitting]);

  // Auto-fill patient and amount when invoice is selected
  useEffect(() => {
    if (formData.invoice_id) {
      const selectedInvoice = invoices.find(inv => inv.id?.toString() === formData.invoice_id);
      if (selectedInvoice) {
        setFormData(prev => ({
          ...prev,
          patient_id: selectedInvoice.patient_id?.toString() || prev.patient_id,
          amount: selectedInvoice.balance_due != null ? selectedInvoice.balance_due.toString() : prev.amount
        }));
      }
    }
  }, [formData.invoice_id, invoices]);

  const getPatientName = (patientId) => {
    const patient = patients.find(p => p.id?.toString() === patientId?.toString());
    if (patient) {
      return `${patient.first_name} ${patient.last_name}`;
    }
    return '';
  };

  const getInvoicePatientName = (invoice) => {
    if (invoice.patient_name) return invoice.patient_name;
    return getPatientName(invoice.patient_id);
  };

  // Filter invoices to show only non-paid (unless editing, in which case include the current invoice)
  const availableInvoices = invoices.filter(inv => {
    if (editingPayment && inv.id?.toString() === editingPayment.invoice_id?.toString()) {
      return true;
    }
    return inv.status !== 'paid';
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.patient_id) {
      addNotification('alert', t?.selectPatientRequired || 'Please select a patient');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      addNotification('alert', t?.validAmountRequired || 'Please enter a valid payment amount');
      return;
    }

    setSubmitting(true);

    const paymentData = {
      invoice_id: formData.invoice_id || null,
      patient_id: formData.patient_id,
      amount: parseFloat(formData.amount),
      payment_method: formData.payment_method,
      payment_date: formData.payment_date,
      status: formData.status,
      transaction_id: formData.transaction_id || null,
      reference_number: formData.reference_number || null,
      notes: formData.notes || ''
    };

    try {
      let result;
      if (editingPayment) {
        result = await api.updateBillingPayment(editingPayment.id, paymentData);
        const patientName = getPatientName(formData.patient_id);
        addNotification('success', `${t?.paymentUpdated || 'Payment updated successfully'}${patientName ? ` for ${patientName}` : ''}`);
      } else {
        result = await api.createBillingPayment(paymentData);
        const patientName = getPatientName(formData.patient_id);
        addNotification('success', `${t?.paymentCreated || 'Payment created successfully'}${patientName ? ` for ${patientName}` : ''}`);
      }

      onSuccess(result);
      onClose();
    } catch (error) {
      console.error('Error saving billing payment:', error);
      addNotification(
        'alert',
        editingPayment
          ? (t?.failedToUpdatePayment || 'Failed to update payment. Please try again.')
          : (t?.failedToCreatePayment || 'Failed to create payment. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClassName = `w-full px-4 py-2 rounded-lg border ${
    theme === 'dark'
      ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  } focus:ring-2 focus:ring-blue-500 focus:border-transparent`;

  const labelClassName = `block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`;

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {editingPayment
              ? (t?.editBillingPayment || 'Edit Billing Payment')
              : (t?.newBillingPayment || 'New Billing Payment')}
          </h2>
        </div>
        {!submitting && (
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
          >
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {/* Invoice Selection */}
          <div>
            <label className={labelClassName}>
              {t?.invoice || 'Invoice'}
            </label>
            <ThemedSelect
              theme={theme}
              value={formData.invoice_id}
              onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value })}
              disabled={submitting || loadingInvoices}
            >
              <option value="">
                {loadingInvoices
                  ? (t?.loadingInvoices || 'Loading invoices...')
                  : (t?.selectInvoice || 'Select Invoice (optional)')}
              </option>
              {availableInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} - {getInvoicePatientName(inv)}
                  {inv.balance_due != null ? ` - $${parseFloat(inv.balance_due).toFixed(2)} due` : ''}
                </option>
              ))}
            </ThemedSelect>
          </div>

          {/* Patient Selection */}
          <div>
            <label className={labelClassName}>
              {t?.patient || 'Patient'} <span className="text-red-400">*</span>
            </label>
            <ThemedSelect
              theme={theme}
              required
              value={formData.patient_id}
              onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
              disabled={submitting}
            >
              <option value="">{t?.selectPatient || 'Select Patient'}</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}{p.mrn ? ` - ${p.mrn}` : ''}
                </option>
              ))}
            </ThemedSelect>
          </div>

          {/* Amount */}
          <div>
            <label className={labelClassName}>
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {t?.amount || 'Amount'} <span className="text-red-400">*</span>
              </span>
            </label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              disabled={submitting}
              placeholder="0.00"
              className={inputClassName}
            />
          </div>

          {/* Payment Method and Payment Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>
                {t?.paymentMethod || 'Payment Method'} <span className="text-red-400">*</span>
              </label>
              <ThemedSelect
                theme={theme}
                required
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                disabled={submitting}
              >
                {paymentMethods.map(method => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </ThemedSelect>
            </div>

            <div>
              <label className={labelClassName}>
                {t?.paymentDate || 'Payment Date'} <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                disabled={submitting}
                className={inputClassName}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className={labelClassName}>
              {t?.status || 'Status'} <span className="text-red-400">*</span>
            </label>
            <ThemedSelect
              theme={theme}
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              disabled={submitting}
            >
              {statusOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </ThemedSelect>
          </div>

          {/* Transaction ID and Reference Number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>
                {t?.transactionId || 'Transaction ID'}
              </label>
              <input
                type="text"
                value={formData.transaction_id}
                onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                disabled={submitting}
                placeholder={t?.transactionIdPlaceholder || 'e.g., TXN-123456'}
                className={inputClassName}
              />
            </div>

            <div>
              <label className={labelClassName}>
                {t?.referenceNumber || 'Reference Number'}
              </label>
              <input
                type="text"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                disabled={submitting}
                placeholder={t?.referenceNumberPlaceholder || 'e.g., REF-789012'}
                className={inputClassName}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClassName}>
              {t?.notes || 'Notes'}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={submitting}
              rows="3"
              placeholder={t?.notesPlaceholder || 'Add any additional notes about this payment...'}
              className={`${inputClassName} resize-none`}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`px-6 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {t?.cancel || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 ${
              submitting ? 'opacity-75 cursor-wait' : ''
            }`}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {editingPayment
                  ? (t?.updating || 'Updating...')
                  : (t?.saving || 'Saving...')}
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                {editingPayment
                  ? (t?.updatePayment || 'Update Payment')
                  : (t?.savePayment || 'Save Payment')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewBillingPaymentForm;
