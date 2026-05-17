import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Edit, Trash2, CreditCard, ArrowLeft, Shield, FileCheck, DollarSign, Search, AlertCircle, TrendingUp, X, Receipt, FileText, Tag, Bell, ArrowRightLeft, Percent } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import NewPaymentForm from '../components/forms/NewPaymentForm';
import NewClaimForm from '../components/forms/NewClaimForm';
import NewInsurancePayerForm from '../components/forms/NewInsurancePayerForm';
import NewPreapprovalForm from '../components/forms/NewPreapprovalForm';
import NewPaymentPostingForm from '../components/forms/NewPaymentPostingForm';
import NewDenialForm from '../components/forms/NewDenialForm';
import NewQuoteForm from '../components/forms/NewQuoteForm';
import NewInvoiceForm from '../components/forms/NewInvoiceForm';
import NewCouponForm from '../components/forms/NewCouponForm';
import NewBillingPaymentForm from '../components/forms/NewBillingPaymentForm';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import { useAudit } from '../hooks/useAudit';

const RCMView = ({
  theme,
  claims,
  patients,
  setShowForm,
  setEditingItem,
  setCurrentView,
  setClaims,
  addNotification,
  api,
  setCurrentModule,
  tasks,
  setTasks,
  t = {},
  currency = 'USD',
}) => {
  const [activeTab, setActiveTab] = useState('claims');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [showInsurancePayerForm, setShowInsurancePayerForm] = useState(false);
  const [showPreapprovalForm, setShowPreapprovalForm] = useState(false);
  const [showPaymentPostingForm, setShowPaymentPostingForm] = useState(false);
  const [showDenialForm, setShowDenialForm] = useState(false);
  const [editingPayer, setEditingPayer] = useState(null);
  const [viewingClaim, setViewingClaim] = useState(null);
  const [editingClaim, setEditingClaim] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);

  // Billing state
  const [billingSubTab, setBillingSubTab] = useState('quotes');
  const [billingQuotes, setBillingQuotes] = useState([]);
  const [billingInvoices, setBillingInvoices] = useState([]);
  const [billingCoupons, setBillingCoupons] = useState([]);
  const [billingPayments, setBillingPayments] = useState([]);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [showBillingPaymentForm, setShowBillingPaymentForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [editingBillingPayment, setEditingBillingPayment] = useState(null);
  const [quoteSearch, setQuoteSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [couponSearch, setCouponSearch] = useState('');
  const [billingPaymentSearch, setBillingPaymentSearch] = useState('');
  const [reminderSearch, setReminderSearch] = useState('');

  // Confirmation modal states
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'confirm'
  });

  // Data states
  const [preapprovals, setPreapprovals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentPostings, setPaymentPostings] = useState([]);
  const [denials, setDenials] = useState([]);
  const [insurancePayers, setInsurancePayers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search states
  const [claimSearch, setClaimSearch] = useState('');
  const [preapprovalSearch, setPreapprovalSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentPostingSearch, setPaymentPostingSearch] = useState('');
  const [denialSearch, setDenialSearch] = useState('');
  const [payerSearch, setPayerSearch] = useState('');

  const { logViewAccess } = useAudit();

  useEffect(() => {
    logViewAccess('RCMView', {
      module: 'RCM',
    });
  }, [logViewAccess]);

  // Close all forms when tab changes
  useEffect(() => {
    setShowClaimForm(false);
    setShowPreapprovalForm(false);
    setShowPaymentForm(false);
    setShowPaymentPostingForm(false);
    setShowDenialForm(false);
    setShowInsurancePayerForm(false);
    setShowQuoteForm(false);
    setShowInvoiceForm(false);
    setShowCouponForm(false);
    setShowBillingPaymentForm(false);
    setEditingPayer(null);
    setViewingClaim(null);
    setEditingClaim(null);
    setEditingPayment(null);
    setEditingQuote(null);
    setEditingInvoice(null);
    setEditingCoupon(null);
    setEditingBillingPayment(null);
  }, [activeTab]);

  // Close billing forms when billing sub-tab changes
  useEffect(() => {
    setShowQuoteForm(false);
    setShowInvoiceForm(false);
    setShowCouponForm(false);
    setShowBillingPaymentForm(false);
    setEditingQuote(null);
    setEditingInvoice(null);
    setEditingCoupon(null);
    setEditingBillingPayment(null);
  }, [billingSubTab]);

  // Fetch all RCM data
  const fetchRCMData = useCallback(async () => {
    setLoading(true);
    try {
      const [preapprovalsData, paymentsData, paymentPostingsData, denialsData, payersData, quotesData, invoicesData, couponsData, billingPaymentsData] = await Promise.all([
        api.getPreapprovals().catch(() => []),
        api.getPayments().catch(() => []),
        api.getPaymentPostings().catch(() => []),
        api.getDenials().catch(() => []),
        api.getInsurancePayers().catch(() => []),
        api.getBillingQuotes().catch(() => []),
        api.getBillingInvoices().catch(() => []),
        api.getBillingCoupons().catch(() => []),
        api.getBillingPayments().catch(() => [])
      ]);

      setPreapprovals(preapprovalsData || []);
      setPayments(paymentsData || []);
      setPaymentPostings(paymentPostingsData || []);
      setDenials(denialsData || []);
      setInsurancePayers(payersData || []);
      setBillingQuotes(quotesData || []);
      setBillingInvoices(invoicesData || []);
      setBillingCoupons(couponsData || []);
      setBillingPayments(billingPaymentsData || []);
    } catch (error) {
      console.error('Error fetching RCM data:', error);
      addNotification('error', 'Failed to load RCM data');
    } finally {
      setLoading(false);
    }
  }, [api, addNotification]);

  // Filter functions
  const filteredClaims = claims.filter(claim => {
    if (!claimSearch) return true;
    const searchLower = claimSearch.toLowerCase();
    const patient = patients.find(p => p.id === claim.patient_id);
    const patientName = patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.toLowerCase() : '';
    return (
      claim.claim_number?.toLowerCase().includes(searchLower) ||
      patientName.includes(searchLower) ||
      claim.payer?.toLowerCase().includes(searchLower) ||
      claim.status?.toLowerCase().includes(searchLower)
    );
  });

  const filteredPreapprovals = preapprovals.filter(pa => {
    if (!preapprovalSearch) return true;
    const searchLower = preapprovalSearch.toLowerCase();
    return (
      pa.preapproval_number?.toLowerCase().includes(searchLower) ||
      pa.patient_name?.toLowerCase().includes(searchLower) ||
      pa.requested_service?.toLowerCase().includes(searchLower) ||
      pa.status?.toLowerCase().includes(searchLower)
    );
  });

  const filteredPayments = payments.filter(payment => {
    if (!paymentSearch) return true;
    const searchLower = paymentSearch.toLowerCase();
    const patient = patients.find(p => p.id === payment.patient_id);
    const patientName = patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.toLowerCase() : '';
    return (
      patientName.includes(searchLower) ||
      payment.payment_method?.toLowerCase().includes(searchLower) ||
      payment.status?.toLowerCase().includes(searchLower)
    );
  });

  const filteredInsurancePayers = insurancePayers.filter(payer => {
    if (!payerSearch) return true;
    const searchLower = payerSearch.toLowerCase();
    return (
      payer.name?.toLowerCase().includes(searchLower) ||
      payer.payer_id?.toLowerCase().includes(searchLower) ||
      payer.payer_type?.toLowerCase().includes(searchLower)
    );
  });

  const filteredPaymentPostings = paymentPostings.filter(posting => {
    if (!paymentPostingSearch) return true;
    const searchLower = paymentPostingSearch.toLowerCase();
    return (
      posting.posting_number?.toLowerCase().includes(searchLower) ||
      posting.patient_name?.toLowerCase().includes(searchLower) ||
      posting.claim_number?.toLowerCase().includes(searchLower) ||
      posting.insurance_payer_name?.toLowerCase().includes(searchLower) ||
      posting.status?.toLowerCase().includes(searchLower)
    );
  });

  const filteredDenials = denials.filter(denial => {
    if (!denialSearch) return true;
    const searchLower = denialSearch.toLowerCase();
    return (
      denial.denial_number?.toLowerCase().includes(searchLower) ||
      denial.patient_name?.toLowerCase().includes(searchLower) ||
      denial.claim_number?.toLowerCase().includes(searchLower) ||
      denial.insurance_payer_name?.toLowerCase().includes(searchLower) ||
      denial.denial_category?.toLowerCase().includes(searchLower) ||
      denial.status?.toLowerCase().includes(searchLower) ||
      denial.appeal_status?.toLowerCase().includes(searchLower)
    );
  });

  const renderClaims = () => (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            value={claimSearch}
            onChange={(e) => setClaimSearch(e.target.value)}
            placeholder="Search claims by claim #, patient, payer, or status..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
      </div>

      {/* Inline New Claim Form - Between Search and List */}
      {showClaimForm && (
        <div className={`mb-4 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewClaimForm
            theme={theme}
            api={api}
            patients={patients}
            claims={claims}
            onClose={() => setShowClaimForm(false)}
            onSuccess={(newClaim) => {
              setShowClaimForm(false);
              setClaims([...claims, newClaim]);
              addNotification('success', t.claimCreated || 'Claim created successfully');
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {/* Claims Table */}
      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Claim #</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Amount</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Payer</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Date</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan="7" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {claimSearch ? 'No claims found matching your search' : 'No claims yet'}
                  </td>
                </tr>
              ) : (
                filteredClaims.map((claim, idx) => {
                  const patient = patients.find(p => p.id === claim.patient_id);
                  const patientName = patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : 'Unknown Patient';

                  return (
                    <tr key={claim.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                      <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{claim.claim_number || 'N/A'}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{patientName}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatCurrency(claim.amount, currency)}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{claim.payer}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(claim.service_date || claim.serviceDate || claim.date)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          claim.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
                          claim.status === 'Submitted' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setViewingClaim(viewingClaim?.id === claim.id ? null : claim);
                              setShowClaimForm(false);
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title="View"
                          >
                            <Eye className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingClaim(claim);
                              setShowClaimForm(true);
                              setViewingClaim(null);
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title="Edit"
                          >
                            <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                // Try to submit to clearinghouse first
                                try {
                                  const result = await api.submit837ToClearinghouse(claim.id);
                                  addNotification('success', result.message);
                                  // Refresh claims to update status
                                  const updatedClaims = await api.getClaims();
                                  setClaims(updatedClaims);
                                } catch (submitError) {
                                  // If clearinghouse submission fails, offer to download
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Clearinghouse Submission Failed',
                                    message: `${submitError.message}\n\nWould you like to download the EDI 837 file instead?`,
                                    type: 'confirm',
                                    onConfirm: async () => {
                                      try {
                                        const result = await api.generate837File(claim.id);

                                        // Create a download link
                                        const blob = new Blob([result.ediContent], { type: 'text/plain' });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = result.fileName;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);

                                        addNotification('success', 'EDI 837 file downloaded successfully');
                                      } catch (err) {
                                        addNotification('error', 'Failed to generate EDI 837 file');
                                      }
                                      setConfirmModal({ ...confirmModal, isOpen: false });
                                    }
                                  });
                                }
                              } catch (error) {
                                console.error('Error with EDI 837:', error);
                                addNotification('error', error.message || 'Failed to process EDI 837');
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title="Submit EDI 837 / Download"
                          >
                            <svg className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: 'Delete Claim',
                                message: 'Are you sure you want to delete this claim? This action cannot be undone.',
                                type: 'danger',
                                onConfirm: async () => {
                                  try {
                                    await api.deleteClaim(claim.id);
                                    setClaims(prev => prev.filter(c => c.id !== claim.id));
                                    await addNotification('alert', 'Claim deleted successfully');
                                  } catch (err) {
                                    console.error('Error deleting claim:', err);
                                    addNotification('error', 'Failed to delete claim');
                                  }
                                  setConfirmModal({ ...confirmModal, isOpen: false });
                                }
                              });
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPreapprovals = () => (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            value={preapprovalSearch}
            onChange={(e) => setPreapprovalSearch(e.target.value)}
            placeholder="Search pre-authorizations by number, patient, service, or status..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
      </div>

      {/* Inline Pre-Authorization Form - Between Search and List */}
      {showPreapprovalForm && (
        <div className={`mb-4 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewPreapprovalForm
            theme={theme}
            api={api}
            patients={patients}
            onClose={() => setShowPreapprovalForm(false)}
            onSuccess={(newPreapproval) => {
              setShowPreapprovalForm(false);
              setPreapprovals([...preapprovals, newPreapproval]);
              addNotification('success', t.preauthorizationCreated || 'Pre-authorization request created successfully');
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {/* PreAuthorizations Table */}
      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>PA Number</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Service</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Payer</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Date</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPreapprovals.length === 0 ? (
                <tr>
                  <td colSpan="7" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {preapprovalSearch ? 'No pre-authorizations found matching your search' : 'No pre-authorizations yet'}
                  </td>
                </tr>
              ) : (
                filteredPreapprovals.map((pa, idx) => (
                  <tr key={pa.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                    <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{pa.preapproval_number}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{pa.patient_name || 'N/A'}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{pa.requested_service}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{pa.insurance_payer_name || 'N/A'}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(pa.created_at)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        pa.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
                        pa.status === 'Submitted' ? 'bg-blue-500/20 text-blue-400' :
                        pa.status === 'Denied' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {pa.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Delete Pre-Authorization',
                              message: 'Are you sure you want to delete this pre-authorization? This action cannot be undone.',
                              type: 'danger',
                              onConfirm: async () => {
                                try {
                                  await api.deletePreapproval(pa.id);
                                  setPreapprovals(prev => prev.filter(p => p.id !== pa.id));
                                  await addNotification('success', 'Pre-authorization deleted successfully');
                                } catch (err) {
                                  console.error('Error deleting pre-authorization:', err);
                                  addNotification('error', 'Failed to delete pre-authorization');
                                }
                                setConfirmModal({ ...confirmModal, isOpen: false });
                              }
                            });
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPayments = () => (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            value={paymentSearch}
            onChange={(e) => setPaymentSearch(e.target.value)}
            placeholder="Search payments by patient, payment method, or status..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
      </div>

      {/* Inline Payment Form - Between Search and List */}
      {showPaymentForm && (
        <div className={`mb-4 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewPaymentForm
            theme={theme}
            api={api}
            patients={patients}
            claims={claims}
            onClose={() => setShowPaymentForm(false)}
            onSuccess={(newPayment) => {
              setShowPaymentForm(false);
              setPayments([...payments, newPayment]);
              addNotification('success', t.paymentRecordedSuccessfully || 'Payment recorded successfully');
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {/* Payments Table */}
      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Amount</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Method</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Date</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="6" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {paymentSearch ? 'No payments found matching your search' : 'No payments yet'}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment, idx) => {
                  const patient = patients.find(p => p.id === payment.patient_id);
                  const patientName = patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : 'Unknown Patient';

                  return (
                    <tr key={payment.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{patientName}</td>
                      <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(payment.amount, currency)}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{payment.payment_method || 'N/A'}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(payment.payment_date)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          payment.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          payment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingPayment(payment);
                              setShowPaymentForm(true);
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title="Edit"
                          >
                            <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          </button>
                          <button
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: 'Delete Payment',
                                message: 'Are you sure you want to delete this payment? This action cannot be undone.',
                                type: 'danger',
                                onConfirm: async () => {
                                  try {
                                    await api.deletePayment(payment.id);
                                    setPayments(prev => prev.filter(p => p.id !== payment.id));
                                    await addNotification('success', 'Payment deleted successfully');
                                  } catch (err) {
                                    console.error('Error deleting payment:', err);
                                    addNotification('error', 'Failed to delete payment');
                                  }
                                  setConfirmModal({ ...confirmModal, isOpen: false });
                                }
                              });
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderInsurancePayers = () => (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            value={payerSearch}
            onChange={(e) => setPayerSearch(e.target.value)}
            placeholder="Search payers by name, payer ID, or type..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
      </div>

      {/* Inline Insurance Payer Form - Between Search and List */}
      {showInsurancePayerForm && (
        <div className={`mb-4 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewInsurancePayerForm
            theme={theme}
            api={api}
            editPayer={editingPayer}
            onClose={() => {
              setShowInsurancePayerForm(false);
              setEditingPayer(null);
            }}
            onSuccess={(savedPayer) => {
              setShowInsurancePayerForm(false);
              if (editingPayer) {
                // Update existing payer in list
                setInsurancePayers(insurancePayers.map(p => p.id === savedPayer.id ? savedPayer : p));
                addNotification('success', t.insurancePayerUpdated || 'Insurance payer updated successfully');
              } else {
                // Add new payer to list
                setInsurancePayers([...insurancePayers, savedPayer]);
                addNotification('success', t.insurancePayerAdded || 'Insurance payer added successfully');
              }
              setEditingPayer(null);
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {/* Insurance Payers Table */}
      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Payer Name</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Payer ID</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Type</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Contact</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Prior Auth</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInsurancePayers.length === 0 ? (
                <tr>
                  <td colSpan="6" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {payerSearch ? 'No insurance payers found matching your search' : 'No insurance payers yet'}
                  </td>
                </tr>
              ) : (
                filteredInsurancePayers.map((payer, idx) => (
                  <tr key={payer.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                    <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{payer.name}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{payer.payer_id}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{payer.payer_type || 'N/A'}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{payer.phone || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        payer.prior_authorization_required ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {payer.prior_authorization_required ? 'Required' : 'Not Required'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingPayer(payer);
                            setShowInsurancePayerForm(true);
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                          title="Edit"
                        >
                          <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Delete Insurance Payer',
                              message: 'Are you sure you want to delete this insurance payer? This action cannot be undone.',
                              type: 'danger',
                              onConfirm: async () => {
                                try {
                                  await api.deleteInsurancePayer(payer.id);
                                  setInsurancePayers(prev => prev.filter(p => p.id !== payer.id));
                                  await addNotification('success', 'Insurance payer deleted successfully');
                                } catch (err) {
                                  console.error('Error deleting payer:', err);
                                  addNotification('error', 'Failed to delete insurance payer');
                                }
                                setConfirmModal({ ...confirmModal, isOpen: false });
                              }
                            });
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPaymentPostings = () => (
    <div>
      {/* Upload EDI 835 Button */}
      <div className="mb-4 flex gap-2">
        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
          theme === 'dark'
            ? 'border-emerald-500/50 hover:border-emerald-500 hover:bg-emerald-500/10'
            : 'border-emerald-500 hover:bg-emerald-50'
        }`}>
          <input
            type="file"
            accept=".txt,.edi,.835,.x12"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;

              try {
                addNotification('info', 'Uploading and processing EDI 835 file...');
                const result = await api.upload835File(file);

                addNotification('success', result.message);
                fetchRCMData(); // Refresh data
              } catch (error) {
                console.error('Error uploading 835 file:', error);
                addNotification('error', error.message || 'Failed to upload 835 file');
              }

              // Reset file input
              e.target.value = '';
            }}
          />
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className={`font-medium ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
            Upload EDI 835 (ERA)
          </span>
        </label>

        <div className={`flex-1 relative`}>
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            value={paymentPostingSearch}
            onChange={(e) => setPaymentPostingSearch(e.target.value)}
            placeholder="Search payment postings by posting #, patient, claim, or payer..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
      </div>

      {/* Payment Postings Table */}
      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Posting #</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Claim #</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Payer</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Payment Amount</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Posting Date</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPaymentPostings.length === 0 ? (
                <tr>
                  <td colSpan="8" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {paymentPostingSearch ? 'No payment postings found matching your search' : 'No payment postings yet'}
                  </td>
                </tr>
              ) : (
                filteredPaymentPostings.map((posting, idx) => (
                  <tr key={posting.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                    <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{posting.posting_number}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{posting.patient_name}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{posting.claim_number || 'N/A'}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{posting.insurance_payer_name || 'N/A'}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatCurrency(posting.payment_amount, currency)}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(posting.posting_date)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        posting.status === 'posted' ? 'bg-green-500/20 text-green-400' :
                        posting.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        posting.status === 'reversed' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {posting.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const result = await api.generate835File(posting.id);

                              if (result.downloadRequired || !result.clearinghouseEnabled) {
                                // Download the file
                                const blob = new Blob([result.ediContent], { type: 'text/plain' });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = result.fileName;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);

                                addNotification('success', 'EDI 835 file downloaded successfully');
                              } else {
                                addNotification('success', result.message);
                              }
                            } catch (error) {
                              console.error('Error generating EDI 835:', error);
                              addNotification('error', error.message || 'Failed to generate EDI 835 file');
                            }
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                          title="Download EDI 835"
                        >
                          <svg className={`w-4 h-4 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Delete Payment Posting',
                              message: 'Are you sure you want to delete this payment posting? This action cannot be undone.',
                              type: 'danger',
                              onConfirm: async () => {
                                try {
                                  await api.deletePaymentPosting(posting.id);
                                  setPaymentPostings(prev => prev.filter(p => p.id !== posting.id));
                                  addNotification('success', 'Payment posting deleted successfully');
                                } catch (err) {
                                  console.error('Error deleting posting:', err);
                                  addNotification('error', 'Failed to delete payment posting');
                                }
                                setConfirmModal({ ...confirmModal, isOpen: false });
                              }
                            });
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDenials = () => (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            value={denialSearch}
            onChange={(e) => setDenialSearch(e.target.value)}
            placeholder="Search denials by denial #, patient, claim, category, or status..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
      </div>

      {/* Denials Table */}
      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Denial #</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Claim #</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Category</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Amount</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Appeal Deadline</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Priority</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDenials.length === 0 ? (
                <tr>
                  <td colSpan="9" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {denialSearch ? 'No denials found matching your search' : 'No denials yet'}
                  </td>
                </tr>
              ) : (
                filteredDenials.map((denial, idx) => (
                  <tr key={denial.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                    <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{denial.denial_number}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{denial.patient_name}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{denial.claim_number || 'N/A'}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{denial.denial_category}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatCurrency(denial.denial_amount, currency)}</td>
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(denial.appeal_deadline)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        denial.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                        denial.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        denial.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {denial.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        denial.status === 'open' ? 'bg-red-500/20 text-red-400' :
                        denial.status === 'under_review' ? 'bg-yellow-500/20 text-yellow-400' :
                        denial.status === 'appealing' ? 'bg-blue-500/20 text-blue-400' :
                        denial.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {denial.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Delete Denial',
                              message: 'Are you sure you want to delete this denial? This action cannot be undone.',
                              type: 'danger',
                              onConfirm: async () => {
                                try {
                                  await api.deleteDenial(denial.id);
                                  setDenials(prev => prev.filter(d => d.id !== denial.id));
                                  addNotification('success', 'Denial deleted successfully');
                                } catch (err) {
                                  console.error('Error deleting denial:', err);
                                  addNotification('error', 'Failed to delete denial');
                                }
                                setConfirmModal({ ...confirmModal, isOpen: false });
                              }
                            });
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Billing filter functions
  const filteredBillingQuotes = billingQuotes.filter(q => {
    if (!quoteSearch) return true;
    const s = quoteSearch.toLowerCase();
    return (
      q.quoteNumber?.toLowerCase().includes(s) ||
      q.patientName?.toLowerCase().includes(s) ||
      q.status?.toLowerCase().includes(s)
    );
  });

  const filteredBillingInvoices = billingInvoices.filter(i => {
    if (!invoiceSearch) return true;
    const s = invoiceSearch.toLowerCase();
    return (
      i.invoiceNumber?.toLowerCase().includes(s) ||
      i.patientName?.toLowerCase().includes(s) ||
      i.status?.toLowerCase().includes(s)
    );
  });

  const filteredBillingCoupons = billingCoupons.filter(c => {
    if (!couponSearch) return true;
    const s = couponSearch.toLowerCase();
    return (
      c.code?.toLowerCase().includes(s) ||
      c.name?.toLowerCase().includes(s) ||
      c.discountType?.toLowerCase().includes(s)
    );
  });

  const filteredBillingPayments = billingPayments.filter(p => {
    if (!billingPaymentSearch) return true;
    const s = billingPaymentSearch.toLowerCase();
    return (
      p.paymentNumber?.toLowerCase().includes(s) ||
      p.patientName?.toLowerCase().includes(s) ||
      p.invoiceNumber?.toLowerCase().includes(s) ||
      p.paymentMethod?.toLowerCase().includes(s) ||
      p.status?.toLowerCase().includes(s)
    );
  });

  // Filter tasks that are billing reminders
  const billingReminderTasks = (tasks || []).filter(task => {
    const title = (task.title || '').toLowerCase();
    if (!reminderSearch) return title.includes('payment reminder') || title.includes('invoice reminder') || title.includes('billing reminder');
    const s = reminderSearch.toLowerCase();
    return (title.includes('payment reminder') || title.includes('invoice reminder') || title.includes('billing reminder')) && (
      task.title?.toLowerCase().includes(s) ||
      task.status?.toLowerCase().includes(s) ||
      task.priority?.toLowerCase().includes(s)
    );
  });

  const statusBadge = (status) => {
    const colors = {
      draft: 'bg-gray-500/20 text-gray-400',
      sent: 'bg-blue-500/20 text-blue-400',
      accepted: 'bg-green-500/20 text-green-400',
      declined: 'bg-red-500/20 text-red-400',
      expired: 'bg-orange-500/20 text-orange-400',
      converted: 'bg-purple-500/20 text-purple-400',
      paid: 'bg-green-500/20 text-green-400',
      partially_paid: 'bg-yellow-500/20 text-yellow-400',
      overdue: 'bg-red-500/20 text-red-400',
      cancelled: 'bg-gray-500/20 text-gray-400',
      refunded: 'bg-orange-500/20 text-orange-400',
      completed: 'bg-green-500/20 text-green-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      failed: 'bg-red-500/20 text-red-400',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400';
  };

  const renderBillingQuotes = () => (
    <div>
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input type="text" value={quoteSearch} onChange={(e) => setQuoteSearch(e.target.value)}
            placeholder="Search quotes by number, patient, or status..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`} />
        </div>
      </div>

      {showQuoteForm && (
        <div className={`mb-4 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewQuoteForm theme={theme} api={api} patients={patients} editingQuote={editingQuote}
            onClose={() => { setShowQuoteForm(false); setEditingQuote(null); }}
            onSuccess={(quote) => {
              setShowQuoteForm(false);
              if (editingQuote) {
                setBillingQuotes(billingQuotes.map(q => q.id === quote.id ? quote : q));
                addNotification('success', 'Quote updated successfully');
              } else {
                setBillingQuotes([quote, ...billingQuotes]);
                addNotification('success', 'Quote created successfully');
              }
              setEditingQuote(null);
            }}
            addNotification={addNotification} t={t} />
        </div>
      )}

      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Quote #</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Total</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Issue Date</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Expiry</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBillingQuotes.length === 0 ? (
                <tr><td colSpan="7" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{quoteSearch ? 'No quotes found matching your search' : 'No quotes yet'}</td></tr>
              ) : filteredBillingQuotes.map((quote, idx) => (
                <tr key={quote.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                  <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{quote.quoteNumber}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{quote.patientName || 'N/A'}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatCurrency(quote.totalAmount, currency)}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(quote.issueDate)}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(quote.expiryDate)}</td>
                  <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge(quote.status)}`}>{quote.status?.replace('_', ' ')}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingQuote(quote); setShowQuoteForm(true); }} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} title="Edit">
                        <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                      </button>
                      {(quote.status === 'accepted' || quote.status === 'sent') && (
                        <button onClick={async () => {
                          try {
                            const invoice = await api.convertQuoteToInvoice(quote.id);
                            setBillingInvoices([invoice, ...billingInvoices]);
                            setBillingQuotes(billingQuotes.map(q => q.id === quote.id ? { ...q, status: 'converted' } : q));
                            addNotification('success', 'Quote converted to invoice successfully');
                          } catch (err) { addNotification('error', 'Failed to convert quote'); }
                        }} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} title="Convert to Invoice">
                          <ArrowRightLeft className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                        </button>
                      )}
                      <button onClick={() => {
                        setConfirmModal({ isOpen: true, title: 'Delete Quote', message: 'Are you sure you want to delete this quote?', type: 'danger',
                          onConfirm: async () => {
                            try { await api.deleteBillingQuote(quote.id); setBillingQuotes(prev => prev.filter(q => q.id !== quote.id)); addNotification('success', 'Quote deleted'); } catch (err) { addNotification('error', 'Failed to delete quote'); }
                            setConfirmModal({ ...confirmModal, isOpen: false });
                          }
                        });
                      }} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} title="Delete">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBillingInvoices = () => (
    <div>
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input type="text" value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)}
            placeholder="Search invoices by number, patient, or status..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`} />
        </div>
      </div>

      {showInvoiceForm && (
        <div className={`mb-4 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewInvoiceForm theme={theme} api={api} patients={patients} editingInvoice={editingInvoice}
            onClose={() => { setShowInvoiceForm(false); setEditingInvoice(null); }}
            onSuccess={(invoice) => {
              setShowInvoiceForm(false);
              if (editingInvoice) {
                setBillingInvoices(billingInvoices.map(i => i.id === invoice.id ? invoice : i));
                addNotification('success', 'Invoice updated successfully');
              } else {
                setBillingInvoices([invoice, ...billingInvoices]);
                addNotification('success', 'Invoice created successfully');
              }
              setEditingInvoice(null);
            }}
            addNotification={addNotification} t={t} />
        </div>
      )}

      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Invoice #</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Total</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Paid</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Balance</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Due Date</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBillingInvoices.length === 0 ? (
                <tr><td colSpan="8" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{invoiceSearch ? 'No invoices found matching your search' : 'No invoices yet'}</td></tr>
              ) : filteredBillingInvoices.map((invoice, idx) => (
                <tr key={invoice.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                  <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{invoice.invoiceNumber}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{invoice.patientName || 'N/A'}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatCurrency(invoice.totalAmount, currency)}</td>
                  <td className={`px-6 py-4 text-green-400`}>{formatCurrency(invoice.amountPaid, currency)}</td>
                  <td className={`px-6 py-4 ${parseFloat(invoice.balanceDue) > 0 ? 'text-red-400' : 'text-green-400'}`}>{formatCurrency(invoice.balanceDue, currency)}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(invoice.dueDate)}</td>
                  <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge(invoice.status)}`}>{invoice.status?.replace('_', ' ')}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingInvoice(invoice); setShowInvoiceForm(true); }} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} title="Edit">
                        <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                      </button>
                      <button onClick={() => {
                        setConfirmModal({ isOpen: true, title: 'Delete Invoice', message: 'Are you sure you want to delete this invoice?', type: 'danger',
                          onConfirm: async () => {
                            try { await api.deleteBillingInvoice(invoice.id); setBillingInvoices(prev => prev.filter(i => i.id !== invoice.id)); addNotification('success', 'Invoice deleted'); } catch (err) { addNotification('error', 'Failed to delete invoice'); }
                            setConfirmModal({ ...confirmModal, isOpen: false });
                          }
                        });
                      }} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} title="Delete">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBillingCoupons = () => (
    <div>
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input type="text" value={couponSearch} onChange={(e) => setCouponSearch(e.target.value)}
            placeholder="Search coupons by code, name, or type..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`} />
        </div>
      </div>

      {showCouponForm && (
        <div className={`mb-4 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewCouponForm theme={theme} api={api} editingCoupon={editingCoupon}
            onClose={() => { setShowCouponForm(false); setEditingCoupon(null); }}
            onSuccess={(coupon) => {
              setShowCouponForm(false);
              if (editingCoupon) {
                setBillingCoupons(billingCoupons.map(c => c.id === coupon.id ? coupon : c));
                addNotification('success', 'Coupon updated successfully');
              } else {
                setBillingCoupons([coupon, ...billingCoupons]);
                addNotification('success', 'Coupon created successfully');
              }
              setEditingCoupon(null);
            }}
            addNotification={addNotification} t={t} />
        </div>
      )}

      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Code</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Name</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Discount</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Usage</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Valid Period</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBillingCoupons.length === 0 ? (
                <tr><td colSpan="7" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{couponSearch ? 'No coupons found matching your search' : 'No coupons yet'}</td></tr>
              ) : filteredBillingCoupons.map((coupon, idx) => (
                <tr key={coupon.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                  <td className={`px-6 py-4 font-medium font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{coupon.code}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{coupon.name}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue, currency)}
                  </td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {coupon.usedCount || 0}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ' / unlimited'}
                  </td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {coupon.startDate ? formatDate(coupon.startDate) : 'Any'} - {coupon.endDate ? formatDate(coupon.endDate) : 'No end'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${coupon.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {coupon.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingCoupon(coupon); setShowCouponForm(true); }} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} title="Edit">
                        <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                      </button>
                      <button onClick={() => {
                        setConfirmModal({ isOpen: true, title: 'Delete Coupon', message: 'Are you sure you want to delete this coupon?', type: 'danger',
                          onConfirm: async () => {
                            try { await api.deleteBillingCoupon(coupon.id); setBillingCoupons(prev => prev.filter(c => c.id !== coupon.id)); addNotification('success', 'Coupon deleted'); } catch (err) { addNotification('error', 'Failed to delete coupon'); }
                            setConfirmModal({ ...confirmModal, isOpen: false });
                          }
                        });
                      }} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} title="Delete">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBillingPaymentsTab = () => (
    <div>
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input type="text" value={billingPaymentSearch} onChange={(e) => setBillingPaymentSearch(e.target.value)}
            placeholder="Search payments by number, patient, invoice, or method..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`} />
        </div>
      </div>

      {showBillingPaymentForm && (
        <div className={`mb-4 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewBillingPaymentForm theme={theme} api={api} patients={patients} editingPayment={editingBillingPayment}
            onClose={() => { setShowBillingPaymentForm(false); setEditingBillingPayment(null); }}
            onSuccess={(payment) => {
              setShowBillingPaymentForm(false);
              if (editingBillingPayment) {
                setBillingPayments(billingPayments.map(p => p.id === payment.id ? payment : p));
                addNotification('success', 'Payment updated successfully');
              } else {
                setBillingPayments([payment, ...billingPayments]);
                addNotification('success', 'Payment recorded successfully');
              }
              setEditingBillingPayment(null);
              fetchRCMData();
            }}
            addNotification={addNotification} t={t} />
        </div>
      )}

      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Payment #</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Invoice</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Amount</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Method</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Date</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBillingPayments.length === 0 ? (
                <tr><td colSpan="8" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{billingPaymentSearch ? 'No payments found matching your search' : 'No billing payments yet'}</td></tr>
              ) : filteredBillingPayments.map((payment, idx) => (
                <tr key={payment.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                  <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{payment.paymentNumber}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{payment.patientName || 'N/A'}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{payment.invoiceNumber || 'N/A'}</td>
                  <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(payment.amount, currency)}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{payment.paymentMethod?.replace('_', ' ') || 'N/A'}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(payment.paymentDate)}</td>
                  <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge(payment.status)}`}>{payment.status}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingBillingPayment(payment); setShowBillingPaymentForm(true); }} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} title="Edit">
                        <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                      </button>
                      <button onClick={() => {
                        setConfirmModal({ isOpen: true, title: 'Delete Payment', message: 'Are you sure you want to delete this billing payment?', type: 'danger',
                          onConfirm: async () => {
                            try { await api.deleteBillingPayment(payment.id); setBillingPayments(prev => prev.filter(p => p.id !== payment.id)); addNotification('success', 'Payment deleted'); } catch (err) { addNotification('error', 'Failed to delete payment'); }
                            setConfirmModal({ ...confirmModal, isOpen: false });
                          }
                        });
                      }} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} title="Delete">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBillingReminders = () => (
    <div>
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input type="text" value={reminderSearch} onChange={(e) => setReminderSearch(e.target.value)}
            placeholder="Search reminders by title, status, or priority..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`} />
        </div>
      </div>

      <div className={`mb-4 p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-blue-50 border-blue-200'}`}>
        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-blue-700'}`}>
          Payment reminder tasks are automatically created when you check "Create Payment Reminder" on the Invoice form. You can also create them manually from the Tasks module.
        </p>
      </div>

      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Title</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Priority</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Due Date</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {billingReminderTasks.length === 0 ? (
                <tr><td colSpan="5" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{reminderSearch ? 'No reminders found matching your search' : 'No billing reminder tasks yet'}</td></tr>
              ) : billingReminderTasks.map((task, idx) => (
                <tr key={task.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                  <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{task.title}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      task.priority === 'High' ? 'bg-red-500/20 text-red-400' :
                      task.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>{task.priority}</span>
                  </td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(task.dueDate)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      task.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                      task.status === 'In Progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>{task.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {task.status !== 'Completed' && (
                        <button onClick={async () => {
                          try {
                            const updated = await api.updateTask(task.id, { ...task, status: 'Completed' });
                            if (setTasks) setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
                            addNotification('success', 'Reminder marked as completed');
                          } catch (err) { addNotification('error', 'Failed to update reminder'); }
                        }} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} title="Mark Complete">
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                      )}
                      <button onClick={() => {
                        setConfirmModal({ isOpen: true, title: 'Delete Reminder', message: 'Are you sure you want to delete this reminder task?', type: 'danger',
                          onConfirm: async () => {
                            try { await api.deleteTask(task.id); if (setTasks) setTasks(prev => prev.filter(t => t.id !== task.id)); addNotification('success', 'Reminder deleted'); } catch (err) { addNotification('error', 'Failed to delete reminder'); }
                            setConfirmModal({ ...confirmModal, isOpen: false });
                          }
                        });
                      }} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} title="Delete">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBilling = () => (
    <div>
      {/* Billing Sub-Tabs */}
      <div className={`flex gap-1 mb-4 p-1 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100'}`}>
        {[
          { id: 'quotes', label: 'Quotes', icon: FileText, count: billingQuotes.length },
          { id: 'invoices', label: 'Invoices', icon: Receipt, count: billingInvoices.length },
          { id: 'coupons', label: 'Coupons', icon: Tag, count: billingCoupons.length },
          { id: 'billing-payments', label: 'Payments', icon: CreditCard, count: billingPayments.length },
          { id: 'reminders', label: 'Reminders', icon: Bell, count: billingReminderTasks.length },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setBillingSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                billingSubTab === tab.id
                  ? `${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'}`
                  : `${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                billingSubTab === tab.id
                  ? 'bg-white/20 text-white'
                  : `${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-700'}`
              }`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* Billing Add Button */}
      <div className="flex justify-end mb-4">
        {billingSubTab === 'quotes' && (
          <button onClick={() => { setEditingQuote(null); setShowQuoteForm(!showQuoteForm); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Quote
          </button>
        )}
        {billingSubTab === 'invoices' && (
          <button onClick={() => { setEditingInvoice(null); setShowInvoiceForm(!showInvoiceForm); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors">
            <Receipt className="w-4 h-4" /> New Invoice
          </button>
        )}
        {billingSubTab === 'coupons' && (
          <button onClick={() => { setEditingCoupon(null); setShowCouponForm(!showCouponForm); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors">
            <Tag className="w-4 h-4" /> New Coupon
          </button>
        )}
        {billingSubTab === 'billing-payments' && (
          <button onClick={() => { setEditingBillingPayment(null); setShowBillingPaymentForm(!showBillingPaymentForm); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
            <CreditCard className="w-4 h-4" /> Record Payment
          </button>
        )}
      </div>

      {/* Billing Sub-Tab Content */}
      {billingSubTab === 'quotes' && renderBillingQuotes()}
      {billingSubTab === 'invoices' && renderBillingInvoices()}
      {billingSubTab === 'coupons' && renderBillingCoupons()}
      {billingSubTab === 'billing-payments' && renderBillingPaymentsTab()}
      {billingSubTab === 'reminders' && renderBillingReminders()}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title="Back to Dashboard"
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
          <div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Revenue Cycle Management
            </h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Manage claims, pre-authorizations, payments, insurance payers, and billing
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        {[
          { id: 'claims', label: 'Claims', icon: DollarSign, count: claims.length },
          { id: 'preapprovals', label: 'Pre-Authorizations', icon: FileCheck, count: preapprovals.length },
          { id: 'payments', label: 'Payments', icon: CreditCard, count: payments.length },
          { id: 'payment-postings', label: 'Payment Postings', icon: TrendingUp, count: paymentPostings.length },
          { id: 'denials', label: 'Denials', icon: AlertCircle, count: denials.length },
          { id: 'payers', label: 'Insurance Payers', icon: Shield, count: insurancePayers.length },
          { id: 'billing', label: 'Billing', icon: Receipt, count: billingQuotes.length + billingInvoices.length }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? `border-b-2 ${theme === 'dark' ? 'border-blue-500 text-blue-500' : 'border-blue-600 text-blue-600'}`
                  : `${theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-gray-600 hover:text-gray-900'}`
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== null && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? `${theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`
                    : `${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-700'}`
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add Button for Active Tab */}
      <div className="flex justify-end">
        {activeTab === 'claims' && (
          <button
            onClick={() => setShowClaimForm(!showClaimForm)}
            className={`flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors`}
          >
            <Plus className="w-4 h-4" />
            New Claim
          </button>
        )}
        {activeTab === 'preapprovals' && (
          <button
            onClick={() => setShowPreapprovalForm(!showPreapprovalForm)}
            className={`flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors`}
          >
            <FileCheck className="w-4 h-4" />
            Request Pre-Authorization
          </button>
        )}
        {activeTab === 'payments' && (
          <button
            onClick={() => setShowPaymentForm(!showPaymentForm)}
            className={`flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors`}
          >
            <CreditCard className="w-4 h-4" />
            Process Payment
          </button>
        )}
        {activeTab === 'payment-postings' && (
          <button
            onClick={() => setShowPaymentPostingForm(!showPaymentPostingForm)}
            className={`flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors`}
          >
            <TrendingUp className="w-4 h-4" />
            Post Payment
          </button>
        )}
        {activeTab === 'denials' && (
          <button
            onClick={() => setShowDenialForm(!showDenialForm)}
            className={`flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors`}
          >
            <AlertCircle className="w-4 h-4" />
            Record Denial
          </button>
        )}
        {activeTab === 'payers' && (
          <button
            onClick={() => {
              setEditingPayer(null);
              setShowInsurancePayerForm(!showInsurancePayerForm);
            }}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors`}
          >
            <Shield className="w-4 h-4" />
            Add Insurance Payer
          </button>
        )}
      </div>

      {/* Inline Forms - Between button and list */}
      {activeTab === 'claims' && viewingClaim && (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Claim Details - {viewingClaim.claim_number}
            </h3>
            <button
              onClick={() => setViewingClaim(null)}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Patient
              </label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50 text-slate-200' : 'bg-gray-100 text-gray-900'}`}>
                {patients.find(p => p.id === viewingClaim.patient_id) ?
                  `${patients.find(p => p.id === viewingClaim.patient_id).first_name} ${patients.find(p => p.id === viewingClaim.patient_id).last_name}` :
                  'Unknown Patient'}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Payer
              </label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50 text-slate-200' : 'bg-gray-100 text-gray-900'}`}>
                {viewingClaim.payer || 'N/A'}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Service Date
              </label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50 text-slate-200' : 'bg-gray-100 text-gray-900'}`}>
                {formatDate(viewingClaim.service_date)}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Amount
              </label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50 text-slate-200' : 'bg-gray-100 text-gray-900'}`}>
                {formatCurrency(viewingClaim.amount, currency)}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Status
              </label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50 text-slate-200' : 'bg-gray-100 text-gray-900'}`}>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  viewingClaim.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
                  viewingClaim.status === 'Submitted' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {viewingClaim.status}
                </span>
              </div>
            </div>
            {viewingClaim.preapproval_id && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Pre-approval
                </label>
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50 text-slate-200' : 'bg-gray-100 text-gray-900'}`}>
                  {viewingClaim.preapproval_id}
                </div>
              </div>
            )}
            {viewingClaim.notes && (
              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Notes
                </label>
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50 text-slate-200' : 'bg-gray-100 text-gray-900'}`}>
                  {viewingClaim.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'claims' && showClaimForm && (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewClaimForm
            theme={theme}
            api={api}
            patients={patients}
            claims={claims}
            editingClaim={editingClaim}
            onClose={() => {
              setShowClaimForm(false);
              setEditingClaim(null);
            }}
            onSuccess={(claim) => {
              setShowClaimForm(false);
              if (editingClaim) {
                // Update existing claim
                setClaims(claims.map(c => c.id === claim.id ? claim : c));
                addNotification('success', 'Claim updated successfully');
              } else {
                // Add new claim
                setClaims([...claims, claim]);
                addNotification('success', t.claimCreated || 'Claim created successfully');
              }
              setEditingClaim(null);
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {activeTab === 'preapprovals' && showPreapprovalForm && (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewPreapprovalForm
            theme={theme}
            api={api}
            patients={patients}
            onClose={() => setShowPreapprovalForm(false)}
            onSuccess={(newPreapproval) => {
              setShowPreapprovalForm(false);
              setPreapprovals([...preapprovals, newPreapproval]);
              addNotification('success', t.preauthorizationCreated || 'Pre-authorization request created successfully');
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {activeTab === 'payments' && showPaymentForm && (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewPaymentForm
            theme={theme}
            api={api}
            patients={patients}
            claims={claims}
            editingPayment={editingPayment}
            onClose={() => {
              setShowPaymentForm(false);
              setEditingPayment(null);
            }}
            onSuccess={(payment) => {
              setShowPaymentForm(false);
              if (editingPayment) {
                // Update existing payment
                setPayments(payments.map(p => p.id === payment.id ? payment : p));
                addNotification('success', 'Payment updated successfully');
              } else {
                // Add new payment
                setPayments([...payments, payment]);
                addNotification('success', t.paymentRecordedSuccessfully || 'Payment recorded successfully');
              }
              setEditingPayment(null);
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {activeTab === 'payment-postings' && showPaymentPostingForm && (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewPaymentPostingForm
            theme={theme}
            api={api}
            patients={patients}
            claims={claims}
            insurancePayers={insurancePayers}
            onClose={() => setShowPaymentPostingForm(false)}
            onSuccess={(newPosting) => {
              setShowPaymentPostingForm(false);
              setPaymentPostings([...paymentPostings, newPosting]);
              fetchRCMData(); // Refresh data
              addNotification('success', 'Payment posting created successfully');
            }}
            addNotification={addNotification}
          />
        </div>
      )}

      {activeTab === 'denials' && showDenialForm && (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewDenialForm
            theme={theme}
            api={api}
            patients={patients}
            claims={claims}
            insurancePayers={insurancePayers}
            onClose={() => setShowDenialForm(false)}
            onSuccess={(newDenial) => {
              setShowDenialForm(false);
              setDenials([...denials, newDenial]);
              fetchRCMData(); // Refresh data
              addNotification('success', 'Denial created successfully');
            }}
            addNotification={addNotification}
          />
        </div>
      )}

      {activeTab === 'payers' && showInsurancePayerForm && (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewInsurancePayerForm
            theme={theme}
            api={api}
            editPayer={editingPayer}
            onClose={() => {
              setShowInsurancePayerForm(false);
              setEditingPayer(null);
            }}
            onSuccess={(savedPayer) => {
              setShowInsurancePayerForm(false);
              if (editingPayer) {
                // Update existing payer in list
                setInsurancePayers(insurancePayers.map(p => p.id === savedPayer.id ? savedPayer : p));
                addNotification('success', t.insurancePayerUpdated || 'Insurance payer updated successfully');
              } else {
                // Add new payer to list
                setInsurancePayers([...insurancePayers, savedPayer]);
                addNotification('success', t.insurancePayerAdded || 'Insurance payer added successfully');
              }
              setEditingPayer(null);
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {/* Content Area - Based on Active Tab */}
      <div className="mt-6">
        {activeTab === 'claims' && renderClaims()}
        {activeTab === 'preapprovals' && renderPreapprovals()}
        {activeTab === 'payments' && renderPayments()}
        {activeTab === 'payment-postings' && renderPaymentPostings()}
        {activeTab === 'denials' && renderDenials()}
        {activeTab === 'payers' && renderInsurancePayers()}
        {activeTab === 'billing' && renderBilling()}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        theme={theme}
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.type === 'danger' ? 'Delete' : 'Confirm'}
        cancelText="Cancel"
      />
    </div>
  );
};

export default RCMView;
