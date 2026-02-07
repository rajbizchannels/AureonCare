import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Bell, X } from 'lucide-react';

const NewInvoiceForm = ({ theme, api, patients, onClose, onSuccess, addNotification, editingInvoice, t }) => {
  const [loading, setLoading] = useState(false);
  const [diagnoses, setDiagnoses] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [loadingDiagnoses, setLoadingDiagnoses] = useState(true);
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  const [patientId, setPatientId] = useState(editingInvoice?.patient_id?.toString() || '');
  const [dueDate, setDueDate] = useState(editingInvoice?.due_date?.split('T')[0] || '');
  const [status, setStatus] = useState(editingInvoice?.status || 'draft');
  const [notes, setNotes] = useState(editingInvoice?.notes || '');
  const [terms, setTerms] = useState(editingInvoice?.terms || '');
  const [taxRate, setTaxRate] = useState(editingInvoice?.tax_rate?.toString() || '0');

  const [lineItems, setLineItems] = useState(() => {
    if (editingInvoice?.line_items && Array.isArray(editingInvoice.line_items)) {
      return editingInvoice.line_items.map((item, idx) => ({
        id: idx,
        description: item.description || '',
        quantity: item.quantity?.toString() || '1',
        unitPrice: item.unit_price?.toString() || '0',
        discount: item.discount?.toString() || '0',
        diagnosisId: item.diagnosis_id?.toString() || '',
        offeringId: item.offering_id?.toString() || ''
      }));
    }
    return [{ id: 0, description: '', quantity: '1', unitPrice: '0', discount: '0', diagnosisId: '', offeringId: '' }];
  });
  const [nextItemId, setNextItemId] = useState(() => {
    if (editingInvoice?.line_items && Array.isArray(editingInvoice.line_items)) {
      return editingInvoice.line_items.length;
    }
    return 1;
  });

  // Coupon state
  const [couponCode, setCouponCode] = useState(editingInvoice?.coupon_code || '');
  const [couponDiscount, setCouponDiscount] = useState(editingInvoice?.coupon_discount || 0);
  const [couponValid, setCouponValid] = useState(editingInvoice?.coupon_code ? true : false);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Payment reminder task state
  const [createReminder, setCreateReminder] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderPriority, setReminderPriority] = useState('Medium');

  // Load diagnoses and offerings on mount
  useEffect(() => {
    const loadDiagnoses = async () => {
      try {
        const data = await api.getDiagnoses();
        setDiagnoses(data || []);
      } catch (error) {
        console.error('Error loading diagnoses:', error);
      } finally {
        setLoadingDiagnoses(false);
      }
    };

    const loadOfferings = async () => {
      try {
        const data = await api.getOfferings();
        setOfferings(data || []);
      } catch (error) {
        console.error('Error loading offerings:', error);
      } finally {
        setLoadingOfferings(false);
      }
    };

    loadDiagnoses();
    loadOfferings();
  }, [api]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !loading) {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose, loading]);

  // Auto-fill reminder title when patient or due date changes
  useEffect(() => {
    if (createReminder && patientId) {
      const patient = patients.find(p => p.id.toString() === patientId);
      if (patient) {
        setReminderTitle(`Payment reminder for ${patient.first_name} ${patient.last_name}`);
      }
    }
  }, [createReminder, patientId, patients]);

  // Auto-set reminder date to 3 days before due date
  useEffect(() => {
    if (createReminder && dueDate) {
      const due = new Date(dueDate);
      due.setDate(due.getDate() - 3);
      setReminderDate(due.toISOString().split('T')[0]);
    }
  }, [createReminder, dueDate]);

  // --- Line item helpers ---

  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      id: nextItemId,
      description: '',
      quantity: '1',
      unitPrice: '0',
      discount: '0',
      diagnosisId: '',
      offeringId: ''
    }]);
    setNextItemId(prev => prev + 1);
  };

  const removeLineItem = (id) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const updateLineItem = (id, field, value) => {
    setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDiagnosisSelect = (itemId, diagnosisId) => {
    const diagnosis = diagnoses.find(d => d.id?.toString() === diagnosisId);
    if (diagnosis) {
      setLineItems(prev => prev.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            diagnosisId,
            description: diagnosis.diagnosisName || diagnosis.diagnosis_name || item.description
          };
        }
        return item;
      }));
    } else {
      updateLineItem(itemId, 'diagnosisId', diagnosisId);
    }
  };

  const handleOfferingSelect = (itemId, offeringId) => {
    const offering = offerings.find(o => o.id?.toString() === offeringId);
    if (offering) {
      setLineItems(prev => prev.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            offeringId,
            description: offering.name || item.description,
            unitPrice: offering.price?.toString() || offering.base_price?.toString() || item.unitPrice
          };
        }
        return item;
      }));
    } else {
      updateLineItem(itemId, 'offeringId', offeringId);
    }
  };

  // --- Calculations ---

  const calcLineTotal = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const disc = parseFloat(item.discount) || 0;
    const subtotal = qty * price;
    return subtotal - (subtotal * disc / 100);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + calcLineTotal(item), 0);
  const totalDiscount = couponValid ? couponDiscount : 0;
  const afterDiscount = Math.max(subtotal - totalDiscount, 0);
  const tax = afterDiscount * (parseFloat(taxRate) || 0) / 100;
  const total = afterDiscount + tax;

  // --- Coupon validation ---

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError(t?.couponCodeRequired || 'Please enter a coupon code');
      return;
    }

    setValidatingCoupon(true);
    setCouponError('');
    setCouponValid(false);
    setCouponDiscount(0);

    try {
      const result = await api.validateBillingCoupon(couponCode.trim(), subtotal);
      setCouponDiscount(result.discount_amount || result.discount || 0);
      setCouponValid(true);
      addNotification('success', t?.couponApplied || 'Coupon applied successfully');
    } catch (error) {
      console.error('Error validating coupon:', error);
      setCouponError(error.message || (t?.invalidCoupon || 'Invalid coupon code'));
      setCouponValid(false);
      setCouponDiscount(0);
    } finally {
      setValidatingCoupon(false);
    }
  };

  // --- Form submission ---

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!patientId) {
      addNotification('alert', t?.selectPatientRequired || 'Please select a patient');
      return;
    }

    if (!dueDate) {
      addNotification('alert', t?.dueDateRequired || 'Please select a due date');
      return;
    }

    const hasValidItem = lineItems.some(item => item.description.trim() && parseFloat(item.quantity) > 0);
    if (!hasValidItem) {
      addNotification('alert', t?.atLeastOneLineItem || 'Please add at least one line item with a description and quantity');
      return;
    }

    setLoading(true);

    const invoiceData = {
      patient_id: patientId,
      due_date: dueDate,
      status,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
      tax_rate: parseFloat(taxRate) || 0,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(totalDiscount.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      coupon_code: couponValid ? couponCode.trim() : null,
      coupon_discount: couponValid ? couponDiscount : 0,
      line_items: lineItems.map(item => ({
        description: item.description.trim(),
        quantity: parseFloat(item.quantity) || 0,
        unit_price: parseFloat(item.unitPrice) || 0,
        discount: parseFloat(item.discount) || 0,
        line_total: parseFloat(calcLineTotal(item).toFixed(2)),
        diagnosis_id: item.diagnosisId || null,
        offering_id: item.offeringId || null
      }))
    };

    try {
      let result;
      if (editingInvoice) {
        result = await api.updateBillingInvoice(editingInvoice.id, invoiceData);
        addNotification('success', t?.invoiceUpdated || 'Invoice updated successfully');
      } else {
        result = await api.createBillingInvoice(invoiceData);
        addNotification('success', t?.invoiceCreated || 'Invoice created successfully');
      }

      // Create payment reminder task if checked
      if (createReminder && reminderTitle.trim()) {
        try {
          await api.createTask({
            title: reminderTitle.trim(),
            description: `Payment reminder for invoice${result.invoice_number ? ` #${result.invoice_number}` : ''}. Total: $${total.toFixed(2)}.`,
            priority: reminderPriority,
            due_date: reminderDate || null,
            status: 'Pending'
          });
          addNotification('success', t?.reminderTaskCreated || 'Payment reminder task created');
        } catch (taskErr) {
          console.error('Error creating reminder task:', taskErr);
          addNotification('alert', t?.reminderTaskFailed || 'Invoice saved, but failed to create reminder task');
        }
      }

      onSuccess(result);
      onClose();
    } catch (err) {
      console.error('Error saving invoice:', err);
      addNotification('alert', editingInvoice
        ? (t?.failedToUpdateInvoice || 'Failed to update invoice. Please try again.')
        : (t?.failedToCreateInvoice || 'Failed to create invoice. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  // --- Theme helpers ---

  const inputClass = `w-full px-4 py-2 rounded-lg border ${
    theme === 'dark'
      ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  } focus:ring-2 focus:ring-blue-500 focus:border-transparent`;

  const labelClass = `block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`;

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-indigo-500/10 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
            <Tag className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
          </div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {editingInvoice ? (t?.editInvoice || 'Edit Invoice') : (t?.newInvoice || 'New Invoice')}
          </h2>
        </div>
        {!loading && (
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">

          {/* Patient & Due Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                {t?.patient || 'Patient'} <span className="text-red-400">*</span>
              </label>
              <select
                required
                disabled={loading}
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className={inputClass}
              >
                <option value="">{t?.selectPatient || 'Select Patient'}</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} - {p.mrn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                {t?.dueDate || 'Due Date'} <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                disabled={loading}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className={labelClass}>
              {t?.status || 'Status'}
            </label>
            <select
              disabled={loading}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              <option value="draft">{t?.draft || 'Draft'}</option>
              <option value="sent">{t?.sent || 'Sent'}</option>
            </select>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t?.lineItems || 'Line Items'}
              </label>
              <button
                type="button"
                onClick={addLineItem}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t?.addItem || 'Add Item'}
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                      {t?.item || 'Item'} #{index + 1}
                    </span>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        disabled={loading}
                        className="p-1 rounded transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>

                  {/* Description */}
                  <div className="mb-3">
                    <label className={labelClass}>
                      {t?.description || 'Description'} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={loading}
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      placeholder={t?.itemDescription || 'Item description'}
                      className={inputClass}
                    />
                  </div>

                  {/* Quantity, Unit Price, Discount, Total */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className={labelClass}>
                        {t?.quantity || 'Quantity'}
                      </label>
                      <input
                        type="number"
                        disabled={loading}
                        min="0"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t?.unitPrice || 'Unit Price ($)'}
                      </label>
                      <input
                        type="number"
                        disabled={loading}
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(item.id, 'unitPrice', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t?.discountPercent || 'Discount (%)'}
                      </label>
                      <input
                        type="number"
                        disabled={loading}
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.discount}
                        onChange={(e) => updateLineItem(item.id, 'discount', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t?.lineTotal || 'Line Total'}
                      </label>
                      <div className={`w-full px-4 py-2 rounded-lg border ${
                        theme === 'dark'
                          ? 'bg-slate-600 border-slate-500 text-white'
                          : 'bg-gray-100 border-gray-300 text-gray-900'
                      }`}>
                        ${calcLineTotal(item).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Link Diagnosis & Offering */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>
                        {t?.linkDiagnosis || 'Link Diagnosis'}
                      </label>
                      <select
                        disabled={loading || loadingDiagnoses}
                        value={item.diagnosisId}
                        onChange={(e) => handleDiagnosisSelect(item.id, e.target.value)}
                        className={inputClass}
                      >
                        <option value="">
                          {loadingDiagnoses ? (t?.loading || 'Loading...') : (t?.noneDiagnosis || 'None')}
                        </option>
                        {diagnoses.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.diagnosisCode || d.diagnosis_code || ''} - {d.diagnosisName || d.diagnosis_name || ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t?.linkOffering || 'Link Offering'}
                      </label>
                      <select
                        disabled={loading || loadingOfferings}
                        value={item.offeringId}
                        onChange={(e) => handleOfferingSelect(item.id, e.target.value)}
                        className={inputClass}
                      >
                        <option value="">
                          {loadingOfferings ? (t?.loading || 'Loading...') : (t?.noneOffering || 'None')}
                        </option>
                        {offerings.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.name}{o.price != null ? ` - $${parseFloat(o.price).toFixed(2)}` : (o.base_price != null ? ` - $${parseFloat(o.base_price).toFixed(2)}` : '')}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coupon Code */}
          <div>
            <label className={labelClass}>
              <Tag className="w-4 h-4 inline mr-1" />
              {t?.couponCode || 'Coupon Code'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                disabled={loading || validatingCoupon}
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value);
                  if (couponValid) {
                    setCouponValid(false);
                    setCouponDiscount(0);
                  }
                  setCouponError('');
                }}
                placeholder={t?.enterCouponCode || 'Enter coupon code'}
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleValidateCoupon}
                disabled={loading || validatingCoupon || !couponCode.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {validatingCoupon ? (t?.validating || 'Validating...') : (t?.validate || 'Validate')}
              </button>
            </div>
            {couponError && (
              <p className="mt-1 text-sm text-red-500">{couponError}</p>
            )}
            {couponValid && (
              <p className="mt-1 text-sm text-green-500">
                {t?.couponAppliedDiscount || 'Coupon applied'}: -${couponDiscount.toFixed(2)}
              </p>
            )}
          </div>

          {/* Tax Rate */}
          <div>
            <label className={labelClass}>
              {t?.taxRate || 'Tax Rate (%)'}
            </label>
            <input
              type="number"
              disabled={loading}
              min="0"
              max="100"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Totals Summary */}
          <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-gray-100 border-gray-200'}`}>
            <h4 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t?.summary || 'Summary'}
            </h4>
            <div className="space-y-2">
              <div className={`flex justify-between text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                <span>{t?.subtotal || 'Subtotal'}</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-500">
                  <span>{t?.couponDiscount || 'Coupon Discount'}</span>
                  <span>-${totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {parseFloat(taxRate) > 0 && (
                <div className={`flex justify-between text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  <span>{t?.tax || 'Tax'} ({taxRate}%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              )}
              <div className={`flex justify-between font-bold text-lg pt-2 border-t ${theme === 'dark' ? 'border-slate-600 text-white' : 'border-gray-300 text-gray-900'}`}>
                <span>{t?.total || 'Total'}</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                {t?.notes || 'Notes'}
              </label>
              <textarea
                disabled={loading}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="3"
                placeholder={t?.invoiceNotes || 'Add any notes for this invoice...'}
                className={`${inputClass} resize-none`}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t?.terms || 'Terms'}
              </label>
              <textarea
                disabled={loading}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows="3"
                placeholder={t?.invoiceTerms || 'Payment terms and conditions...'}
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          {/* Payment Reminder Task */}
          <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-gray-100 border-gray-200'}`}>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="createReminder"
                checked={createReminder}
                onChange={(e) => setCreateReminder(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="createReminder" className={`flex items-center gap-2 text-sm font-medium cursor-pointer ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                <Bell className="w-4 h-4" />
                {t?.createPaymentReminder || 'Create payment reminder task'}
              </label>
            </div>

            {createReminder && (
              <div className="space-y-3 mt-3">
                <div>
                  <label className={labelClass}>
                    {t?.reminderTitle || 'Reminder Title'}
                  </label>
                  <input
                    type="text"
                    disabled={loading}
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    placeholder={t?.enterReminderTitle || 'Enter reminder title'}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>
                      {t?.reminderDate || 'Reminder Date'}
                    </label>
                    <input
                      type="date"
                      disabled={loading}
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      {t?.priority || 'Priority'}
                    </label>
                    <select
                      disabled={loading}
                      value={reminderPriority}
                      onChange={(e) => setReminderPriority(e.target.value)}
                      className={inputClass}
                    >
                      <option value="High">{t?.high || 'High'}</option>
                      <option value="Medium">{t?.medium || 'Medium'}</option>
                      <option value="Low">{t?.low || 'Low'}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={`px-6 py-2 rounded-lg border ${theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
          >
            {t?.cancel || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading
              ? (editingInvoice ? (t?.updating || 'Updating...') : (t?.creating || 'Creating...'))
              : (editingInvoice ? (t?.updateInvoice || 'Update Invoice') : (t?.createInvoice || 'Create Invoice'))
            }
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewInvoiceForm;
