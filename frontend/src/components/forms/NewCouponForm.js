import React, { useState, useEffect } from 'react';
import { Tag, Percent, X } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';
import { useAudit } from '../../hooks/useAudit';
import ThemedSelect from './ThemedSelect';

const NewCouponForm = ({ theme, api, onClose, onSuccess, addNotification, t, editingCoupon = null }) => {
  const { logFormView, logCreate, logUpdate, logError, startAction } = useAudit();
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState([]);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage',
    discountValue: '',
    minimumAmount: '',
    maximumDiscount: '',
    usageLimit: '',
    startDate: '',
    endDate: '',
    isActive: true,
    applicableOfferings: []
  });

  // Log form view on mount
  useEffect(() => {
    startAction();
    logFormView('NewCouponForm', {
      module: 'Billing',
      metadata: {
        mode: editingCoupon ? 'edit' : 'create',
        coupon_id: editingCoupon?.id || null,
      },
    });
  }, [editingCoupon, logFormView, startAction]);

  // Load offerings for multi-select
  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const data = await api.getOfferings();
        setOfferings(data || []);
      } catch (error) {
        console.error('Error loading offerings:', error);
        addNotification('alert', t.failedToLoadOfferings || 'Failed to load offerings');
      } finally {
        setLoadingOfferings(false);
      }
    };
    loadOfferings();
  }, [api, addNotification, t.failedToLoadOfferings]);

  // Populate form when editing
  useEffect(() => {
    if (editingCoupon) {
      setFormData({
        code: editingCoupon.code || '',
        name: editingCoupon.name || '',
        description: editingCoupon.description || '',
        discountType: editingCoupon.discountType || 'percentage',
        discountValue: editingCoupon.discountValue ?? '',
        minimumAmount: editingCoupon.minimumAmount ?? '',
        maximumDiscount: editingCoupon.maximumDiscount ?? '',
        usageLimit: editingCoupon.usageLimit ?? '',
        startDate: editingCoupon.startDate || '',
        endDate: editingCoupon.endDate || '',
        isActive: editingCoupon.isActive !== undefined ? editingCoupon.isActive : true,
        applicableOfferings: editingCoupon.applicableOfferings || []
      });
    }
  }, [editingCoupon]);

  const handleOfferingToggle = (offeringId) => {
    setFormData(prev => {
      const current = prev.applicableOfferings;
      if (current.includes(offeringId)) {
        return { ...prev, applicableOfferings: current.filter(id => id !== offeringId) };
      }
      return { ...prev, applicableOfferings: [...current, offeringId] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      addNotification('alert', t.pleaseEnterCouponCode || 'Please enter a coupon code');
      return;
    }

    if (!formData.name.trim()) {
      addNotification('alert', t.pleaseEnterCouponName || 'Please enter a coupon name');
      return;
    }

    if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
      addNotification('alert', t.pleaseEnterValidDiscount || 'Please enter a valid discount value');
      return;
    }

    if (formData.discountType === 'percentage' && parseFloat(formData.discountValue) > 100) {
      addNotification('alert', t.percentageCannotExceed100 || 'Percentage discount cannot exceed 100');
      return;
    }

    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      addNotification('alert', t.endDateMustBeAfterStartDate || 'End date must be after start date');
      return;
    }

    setShowConfirmation(true);
  };

  const handleActualSubmit = async () => {
    setLoading(true);
    setShowConfirmation(false);

    const couponData = {
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      discountType: formData.discountType,
      discountValue: parseFloat(formData.discountValue),
      minimumAmount: formData.minimumAmount ? parseFloat(formData.minimumAmount) : null,
      maximumDiscount: formData.discountType === 'percentage' && formData.maximumDiscount
        ? parseFloat(formData.maximumDiscount)
        : null,
      usageLimit: formData.usageLimit ? parseInt(formData.usageLimit, 10) : null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      isActive: formData.isActive,
      applicableOfferings: formData.applicableOfferings.length > 0 ? formData.applicableOfferings : null
    };

    try {
      let result;
      if (editingCoupon) {
        result = await api.updateBillingCoupon(editingCoupon.id, couponData);

        logUpdate('NewCouponForm', editingCoupon, couponData, {
          module: 'Billing',
          resource_id: editingCoupon.id,
          metadata: {
            code: couponData.code,
            discountType: couponData.discountType,
            discountValue: couponData.discountValue,
          },
        });

        addNotification('success', t.couponUpdatedSuccessfully || 'Coupon updated successfully');
      } else {
        result = await api.createBillingCoupon(couponData);

        logCreate('NewCouponForm', couponData, {
          module: 'Billing',
          resource_id: result.id,
          metadata: {
            code: couponData.code,
            discountType: couponData.discountType,
            discountValue: couponData.discountValue,
          },
        });

        addNotification('success', t.couponCreatedSuccessfully || 'Coupon created successfully');
      }
      onSuccess(result);
    } catch (error) {
      console.error(`Error ${editingCoupon ? 'updating' : 'creating'} coupon:`, error);
      addNotification('alert', error.message || `Failed to ${editingCoupon ? 'update' : 'create'} coupon`);

      logError('NewCouponForm', 'form', error.message || `Failed to ${editingCoupon ? 'update' : 'create'} coupon`, {
        module: 'Billing',
        metadata: { formData: couponData, mode: editingCoupon ? 'edit' : 'create' },
      });
    } finally {
      setLoading(false);
    }
  };

  const inputClassName = `w-full px-4 py-2 rounded-lg border ${
    theme === 'dark'
      ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  } focus:ring-2 focus:ring-blue-500 focus:border-transparent`;

  const labelClassName = `block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`;

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleActualSubmit}
        title={editingCoupon ? (t.updateCoupon || 'Update Coupon') : (t.createCoupon || 'Create Coupon')}
        message={editingCoupon
          ? (t.confirmUpdateCoupon || 'Are you sure you want to update this coupon?')
          : (t.confirmCreateCoupon || 'Are you sure you want to create this coupon?')
        }
        type="confirm"
        confirmText={editingCoupon ? (t.updateCoupon || 'Update Coupon') : (t.createCoupon || 'Create Coupon')}
        cancelText={t.cancel || 'Cancel'}
      />

      <div className={`flex items-center justify-between p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <Tag className="w-6 h-6 text-blue-400" />
          <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {editingCoupon ? (t.editCoupon || 'Edit Coupon') : (t.createCoupon || 'Create Coupon')}
          </h3>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
        >
          <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
        <div className="space-y-6">
          {/* Coupon Code & Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>
                {t.couponCode || 'Coupon Code'} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className={inputClassName}
                placeholder={t.enterCouponCode || 'e.g. SUMMER2025'}
                required
              />
              <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                {t.couponCodeHelp || 'Auto-converted to uppercase. Must be unique.'}
              </p>
            </div>

            <div>
              <label className={labelClassName}>
                {t.couponName || 'Name'} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClassName}
                placeholder={t.enterCouponName || 'Enter coupon name'}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClassName}>
              {t.description || 'Description'}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={inputClassName}
              placeholder={t.enterCouponDescription || 'Enter coupon description'}
              rows={3}
            />
          </div>

          {/* Discount Type & Value */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>
                <Percent className="w-4 h-4 inline mr-1" />
                {t.discountType || 'Discount Type'} <span className="text-red-400">*</span>
              </label>
              <ThemedSelect
                theme={theme}
                value={formData.discountType}
                onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
              >
                <option value="percentage">{t.percentage || 'Percentage (%)'}</option>
                <option value="fixed">{t.fixedAmount || 'Fixed Amount ($)'}</option>
              </ThemedSelect>
            </div>

            <div>
              <label className={labelClassName}>
                {t.discountValue || 'Discount Value'} <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                className={inputClassName}
                placeholder={formData.discountType === 'percentage' ? '0 - 100' : '0.00'}
                min="0"
                max={formData.discountType === 'percentage' ? '100' : undefined}
                step={formData.discountType === 'percentage' ? '1' : '0.01'}
                required
              />
            </div>
          </div>

          {/* Minimum Amount & Maximum Discount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>
                {t.minimumAmount || 'Minimum Amount'} ({t.optional || 'optional'})
              </label>
              <input
                type="number"
                value={formData.minimumAmount}
                onChange={(e) => setFormData({ ...formData, minimumAmount: e.target.value })}
                className={inputClassName}
                placeholder={t.enterMinimumAmount || 'No minimum'}
                min="0"
                step="0.01"
              />
              <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                {t.minimumAmountHelp || 'Minimum order amount required to use this coupon'}
              </p>
            </div>

            {formData.discountType === 'percentage' && (
              <div>
                <label className={labelClassName}>
                  {t.maximumDiscount || 'Maximum Discount'} ({t.optional || 'optional'})
                </label>
                <input
                  type="number"
                  value={formData.maximumDiscount}
                  onChange={(e) => setFormData({ ...formData, maximumDiscount: e.target.value })}
                  className={inputClassName}
                  placeholder={t.enterMaximumDiscount || 'No cap'}
                  min="0"
                  step="0.01"
                />
                <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                  {t.maximumDiscountHelp || 'Cap the maximum discount amount for percentage coupons'}
                </p>
              </div>
            )}
          </div>

          {/* Usage Limit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>
                {t.usageLimit || 'Usage Limit'} ({t.optional || 'optional'})
              </label>
              <input
                type="number"
                value={formData.usageLimit}
                onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                className={inputClassName}
                placeholder={t.enterUsageLimit || 'Unlimited'}
                min="1"
                step="1"
              />
              <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                {t.usageLimitHelp || 'Maximum number of times this coupon can be used'}
              </p>
            </div>
          </div>

          {/* Start Date & End Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>
                {t.startDate || 'Start Date'} <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label className={labelClassName}>
                {t.endDate || 'End Date'} <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className={inputClassName}
              />
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              {t.active || 'Active'}
            </span>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                formData.isActive ? 'bg-blue-600' : theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Applicable Offerings */}
          <div>
            <label className={labelClassName}>
              {t.applicableOfferings || 'Applicable Offerings'} ({t.optional || 'optional'})
            </label>
            <p className={`mb-3 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
              {t.applicableOfferingsHelp || 'Select the offerings this coupon applies to. Leave empty to apply to all.'}
            </p>
            {loadingOfferings ? (
              <div className="flex items-center gap-2 py-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                  {t.loadingOfferings || 'Loading offerings...'}
                </span>
              </div>
            ) : offerings.length === 0 ? (
              <p className={`text-sm py-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                {t.noOfferingsAvailable || 'No offerings available'}
              </p>
            ) : (
              <div className={`max-h-48 overflow-y-auto rounded-lg border ${
                theme === 'dark' ? 'border-slate-600 bg-slate-700' : 'border-gray-300 bg-white'
              }`}>
                {offerings.map(offering => (
                  <label
                    key={offering.id}
                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                      theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-gray-50'
                    } ${
                      formData.applicableOfferings.includes(offering.id)
                        ? theme === 'dark' ? 'bg-slate-600' : 'bg-blue-50'
                        : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.applicableOfferings.includes(offering.id)}
                      onChange={() => handleOfferingToggle(offering.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {offering.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {formData.applicableOfferings.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.applicableOfferings.map(offeringId => {
                  const offering = offerings.find(o => o.id === offeringId);
                  if (!offering) return null;
                  return (
                    <span
                      key={offeringId}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                        theme === 'dark'
                          ? 'bg-blue-900 text-blue-200'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {offering.name}
                      <button
                        type="button"
                        onClick={() => handleOfferingToggle(offeringId)}
                        className="hover:opacity-75"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-6 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
            disabled={loading}
          >
            {t.cancel || 'Cancel'}
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {editingCoupon ? (t.updating || 'Updating...') : (t.creating || 'Creating...')}
              </>
            ) : (
              <>
                <Tag className="w-4 h-4" />
                {editingCoupon ? (t.updateCoupon || 'Update Coupon') : (t.createCoupon || 'Create Coupon')}
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
};

export default NewCouponForm;
