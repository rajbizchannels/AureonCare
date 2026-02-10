import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, X } from 'lucide-react';

const emptyLineItem = () => ({
  id: Date.now() + Math.random(),
  description: '',
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  diagnosisId: '',
  offeringId: '',
});

const NewQuoteForm = ({ theme, api, patients, onClose, onSuccess, addNotification, editingQuote, t }) => {
  const [formData, setFormData] = useState({
    patientId: editingQuote?.patient_id?.toString() || '',
    notes: editingQuote?.notes || '',
    terms: editingQuote?.terms || '',
    expiryDate: editingQuote?.expiry_date?.split('T')[0] || '',
    couponCode: '',
    taxPercent: editingQuote?.tax_percent?.toString() || '0',
  });

  const [lineItems, setLineItems] = useState(() => {
    if (editingQuote?.line_items && Array.isArray(editingQuote.line_items)) {
      return editingQuote.line_items.map((item) => ({
        id: item.id || Date.now() + Math.random(),
        description: item.description || '',
        quantity: item.quantity ?? 1,
        unitPrice: item.unit_price ?? 0,
        discountPercent: item.discount_percent ?? 0,
        diagnosisId: item.diagnosis_id?.toString() || '',
        offeringId: item.offering_id?.toString() || '',
      }));
    }
    return [emptyLineItem()];
  });

  const [diagnoses, setDiagnoses] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [loadingDiagnoses, setLoadingDiagnoses] = useState(true);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState(() => {
    if (editingQuote?.coupon_code) {
      return {
        valid: true,
        code: editingQuote.coupon_code,
        discount_amount: editingQuote.coupon_discount || 0,
      };
    }
    return null;
  });

  // Load diagnoses on mount
  useEffect(() => {
    const loadDiagnoses = async () => {
      try {
        const data = await api.getDiagnoses();
        setDiagnoses(data || []);
      } catch (error) {
        console.error('Error loading diagnoses:', error);
        addNotification('alert', t?.failedToLoadDiagnoses || 'Failed to load diagnoses');
      } finally {
        setLoadingDiagnoses(false);
      }
    };
    loadDiagnoses();
  }, [api, addNotification, t]);

  // Load offerings on mount
  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const data = await api.getOfferings();
        setOfferings(data || []);
      } catch (error) {
        console.error('Error loading offerings:', error);
        addNotification('alert', t?.failedToLoadOfferings || 'Failed to load offerings');
      } finally {
        setLoadingOfferings(false);
      }
    };
    loadOfferings();
  }, [api, addNotification, t]);

  // Populate coupon code field when editing
  useEffect(() => {
    if (editingQuote?.coupon_code) {
      setFormData((prev) => ({ ...prev, couponCode: editingQuote.coupon_code }));
    }
  }, [editingQuote]);

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

  // ---- Line item helpers ----

  const handleLineItemChange = (id, field, value) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [...prev, emptyLineItem()]);
  };

  const handleRemoveLineItem = (id) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDiagnosisSelect = (itemId, diagnosisId) => {
    const diagnosis = diagnoses.find((d) => d.id?.toString() === diagnosisId);
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (!diagnosis) return { ...item, diagnosisId: '' };
        return {
          ...item,
          diagnosisId,
          description: diagnosis.diagnosisName || diagnosis.name || item.description,
          unitPrice: diagnosis.cost != null ? parseFloat(diagnosis.cost) : item.unitPrice,
        };
      })
    );
  };

  const handleOfferingSelect = (itemId, offeringId) => {
    const offering = offerings.find((o) => o.id?.toString() === offeringId);
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (!offering) return { ...item, offeringId: '' };
        return {
          ...item,
          offeringId,
          description: offering.name || item.description,
          unitPrice: offering.price != null ? parseFloat(offering.price) : item.unitPrice,
        };
      })
    );
  };

  // ---- Calculations ----

  const calculateLineTotal = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const disc = parseFloat(item.discountPercent) || 0;
    const gross = qty * price;
    return gross - gross * (disc / 100);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);

  const couponDiscount = couponResult?.valid ? parseFloat(couponResult.discount_amount) || 0 : 0;

  const afterDiscount = Math.max(0, subtotal - couponDiscount);

  const taxPercent = parseFloat(formData.taxPercent) || 0;
  const taxAmount = afterDiscount * (taxPercent / 100);

  const total = afterDiscount + taxAmount;

  // ---- Coupon validation ----

  const handleValidateCoupon = async () => {
    const code = formData.couponCode.trim();
    if (!code) {
      addNotification('alert', t?.enterCouponCode || 'Please enter a coupon code');
      return;
    }

    setCouponValidating(true);
    setCouponResult(null);
    try {
      const result = await api.validateBillingCoupon(code, subtotal);
      setCouponResult(result);
      if (result?.valid) {
        addNotification('success', t?.couponApplied || 'Coupon applied successfully');
      } else {
        addNotification('alert', result?.message || t?.invalidCoupon || 'Invalid coupon code');
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      addNotification('alert', t?.couponValidationFailed || 'Failed to validate coupon');
      setCouponResult({ valid: false, message: 'Validation failed' });
    } finally {
      setCouponValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponResult(null);
    setFormData((prev) => ({ ...prev, couponCode: '' }));
  };

  // ---- Submit ----

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.patientId) {
      addNotification('alert', t?.selectPatientRequired || 'Please select a patient');
      return;
    }

    const validItems = lineItems.filter((item) => item.description.trim() !== '');
    if (validItems.length === 0) {
      addNotification('alert', t?.addLineItemRequired || 'Please add at least one line item with a description');
      return;
    }

    setSubmitting(true);

    const quoteData = {
      patient_id: formData.patientId,
      line_items: validItems.map((item) => ({
        description: item.description.trim(),
        quantity: parseFloat(item.quantity) || 1,
        unit_price: parseFloat(item.unitPrice) || 0,
        discount_percent: parseFloat(item.discountPercent) || 0,
        diagnosis_id: item.diagnosisId || null,
        offering_id: item.offeringId || null,
      })),
      notes: formData.notes.trim() || null,
      terms: formData.terms.trim() || null,
      expiry_date: formData.expiryDate || null,
      coupon_code: couponResult?.valid ? formData.couponCode.trim() : null,
      coupon_discount: couponResult?.valid ? couponDiscount : 0,
      tax_percent: taxPercent,
      subtotal,
      tax_amount: taxAmount,
      total,
    };

    try {
      let result;
      if (editingQuote) {
        result = await api.updateBillingQuote(editingQuote.id, quoteData);
        addNotification('success', t?.quoteUpdated || 'Quote updated successfully');
      } else {
        result = await api.createBillingQuote(quoteData);
        addNotification('success', t?.quoteCreated || 'Quote created successfully');
      }
      onSuccess(result);
    } catch (error) {
      console.error('Error saving quote:', error);
      addNotification(
        'alert',
        editingQuote
          ? (t?.failedToUpdateQuote || 'Failed to update quote. Please try again.')
          : (t?.failedToCreateQuote || 'Failed to create quote. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Shared style helpers ----

  const inputClass = `w-full px-4 py-2 rounded-lg border ${
    theme === 'dark'
      ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  } focus:ring-2 focus:ring-blue-500 focus:border-transparent`;

  const labelClass = `block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`;

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div
        className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-indigo-500/10 ${
          theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {editingQuote ? (t?.editQuote || 'Edit Quote') : (t?.newQuote || 'New Quote')}
          </h2>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
        >
          <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        </button>
      </div>

      {/* Form body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Patient Selection */}
          <div>
            <label className={labelClass}>
              {t?.patient || 'Patient'} <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={formData.patientId}
              onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
              className={inputClass}
              disabled={submitting}
            >
              <option value="">{t?.selectPatient || 'Select Patient'}</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name} - {p.mrn}
                </option>
              ))}
            </select>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t?.lineItems || 'Line Items'} <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={handleAddLineItem}
                disabled={submitting}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t?.addItem || 'Add Item'}
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
                      {t?.item || 'Item'} #{index + 1}
                    </span>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(item.id)}
                        disabled={submitting}
                        className={`p-1.5 rounded-lg transition-colors ${
                          theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>

                  {/* Diagnosis & Offering selectors */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                        {t?.linkDiagnosis || 'Link Diagnosis'}
                      </label>
                      <select
                        value={item.diagnosisId}
                        onChange={(e) => handleDiagnosisSelect(item.id, e.target.value)}
                        disabled={submitting || loadingDiagnoses}
                        className={inputClass}
                      >
                        <option value="">
                          {loadingDiagnoses
                            ? (t?.loading || 'Loading...')
                            : (t?.noneDiagnosis || 'None')}
                        </option>
                        {diagnoses.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.diagnosisCode || d.code} - {d.diagnosisName || d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                        {t?.linkOffering || 'Link Offering'}
                      </label>
                      <select
                        value={item.offeringId}
                        onChange={(e) => handleOfferingSelect(item.id, e.target.value)}
                        disabled={submitting || loadingOfferings}
                        className={inputClass}
                      >
                        <option value="">
                          {loadingOfferings
                            ? (t?.loading || 'Loading...')
                            : (t?.noneOffering || 'None')}
                        </option>
                        {offerings.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}{o.price != null ? ` - $${parseFloat(o.price).toFixed(2)}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mb-3">
                    <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                      {t?.description || 'Description'} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                      placeholder={t?.itemDescription || 'Item description'}
                      disabled={submitting}
                      className={inputClass}
                    />
                  </div>

                  {/* Quantity, Unit Price, Discount, Total */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                        {t?.quantity || 'Qty'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(item.id, 'quantity', e.target.value)}
                        disabled={submitting}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                        {t?.unitPrice || 'Unit Price ($)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => handleLineItemChange(item.id, 'unitPrice', e.target.value)}
                        disabled={submitting}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                        {t?.discount || 'Discount (%)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.discountPercent}
                        onChange={(e) => handleLineItemChange(item.id, 'discountPercent', e.target.value)}
                        disabled={submitting}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                        {t?.lineTotal || 'Line Total'}
                      </label>
                      <div
                        className={`w-full px-4 py-2 rounded-lg border font-medium ${
                          theme === 'dark'
                            ? 'bg-slate-600 border-slate-500 text-white'
                            : 'bg-gray-100 border-gray-300 text-gray-900'
                        }`}
                      >
                        ${calculateLineTotal(item).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coupon Code */}
          <div>
            <label className={labelClass}>{t?.couponCode || 'Coupon Code'}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.couponCode}
                onChange={(e) => {
                  setFormData({ ...formData, couponCode: e.target.value });
                  if (couponResult) setCouponResult(null);
                }}
                placeholder={t?.enterCouponCode || 'Enter coupon code'}
                disabled={submitting || (couponResult?.valid === true)}
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              {couponResult?.valid ? (
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm"
                >
                  {t?.remove || 'Remove'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleValidateCoupon}
                  disabled={submitting || couponValidating || !formData.couponCode.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm disabled:opacity-50"
                >
                  {couponValidating
                    ? (t?.validating || 'Validating...')
                    : (t?.validate || 'Validate')}
                </button>
              )}
            </div>
            {couponResult?.valid && (
              <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                {t?.couponAppliedDiscount || 'Coupon applied'}: -${couponDiscount.toFixed(2)}
              </p>
            )}
            {couponResult && !couponResult.valid && (
              <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                {couponResult.message || t?.invalidCoupon || 'Invalid coupon code'}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>{t?.notes || 'Notes'}</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              placeholder={t?.quoteNotesPlaceholder || 'Add any notes for this quote...'}
              disabled={submitting}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Terms */}
          <div>
            <label className={labelClass}>{t?.terms || 'Terms & Conditions'}</label>
            <textarea
              value={formData.terms}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              rows="3"
              placeholder={t?.quoteTermsPlaceholder || 'Enter terms and conditions...'}
              disabled={submitting}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Expiry Date and Tax */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t?.expiryDate || 'Expiry Date'}</label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                disabled={submitting}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t?.taxPercent || 'Tax Rate (%)'}</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.taxPercent}
                onChange={(e) => setFormData({ ...formData, taxPercent: e.target.value })}
                disabled={submitting}
                className={inputClass}
              />
            </div>
          </div>

          {/* Totals Summary */}
          <div
            className={`p-4 rounded-lg border ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <h4 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t?.quoteSummary || 'Quote Summary'}
            </h4>
            <div className="space-y-2">
              <div className={`flex justify-between text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                <span>{t?.subtotal || 'Subtotal'}</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className={`flex justify-between text-sm ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                  <span>{t?.couponDiscount || 'Coupon Discount'}</span>
                  <span>-${couponDiscount.toFixed(2)}</span>
                </div>
              )}
              {taxPercent > 0 && (
                <div className={`flex justify-between text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  <span>{t?.tax || 'Tax'} ({taxPercent}%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div
                className={`flex justify-between font-bold text-base pt-2 mt-2 border-t ${
                  theme === 'dark' ? 'border-slate-600 text-white' : 'border-gray-300 text-gray-900'
                }`}
              >
                <span>{t?.total || 'Total'}</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`px-6 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {t?.cancel || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting
              ? (editingQuote ? (t?.updating || 'Updating...') : (t?.creating || 'Creating...'))
              : (editingQuote ? (t?.updateQuote || 'Update Quote') : (t?.createQuote || 'Create Quote'))}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewQuoteForm;
