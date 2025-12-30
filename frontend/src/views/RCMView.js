import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, CreditCard, ArrowLeft, Shield, FileCheck, DollarSign, Search, AlertCircle, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import NewPaymentForm from '../components/forms/NewPaymentForm';
import NewClaimForm from '../components/forms/NewClaimForm';
import NewInsurancePayerForm from '../components/forms/NewInsurancePayerForm';
import NewPreapprovalForm from '../components/forms/NewPreapprovalForm';
import NewPaymentPostingForm from '../components/forms/NewPaymentPostingForm';
import NewDenialForm from '../components/forms/NewDenialForm';

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
  t = {}
}) => {
  const [activeTab, setActiveTab] = useState('claims');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [showInsurancePayerForm, setShowInsurancePayerForm] = useState(false);
  const [showPreapprovalForm, setShowPreapprovalForm] = useState(false);
  const [showPaymentPostingForm, setShowPaymentPostingForm] = useState(false);
  const [showDenialForm, setShowDenialForm] = useState(false);
  const [editingPayer, setEditingPayer] = useState(null);

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

  // Close all forms when tab changes
  useEffect(() => {
    setShowClaimForm(false);
    setShowPreapprovalForm(false);
    setShowPaymentForm(false);
    setShowPaymentPostingForm(false);
    setShowDenialForm(false);
    setShowInsurancePayerForm(false);
    setEditingPayer(null);
  }, [activeTab]);

  // Fetch all RCM data
  useEffect(() => {
    fetchRCMData();
  }, []);

  const fetchRCMData = async () => {
    setLoading(true);
    try {
      const [preapprovalsData, paymentsData, paymentPostingsData, denialsData, payersData] = await Promise.all([
        api.getPreapprovals().catch(() => []),
        api.getPayments().catch(() => []),
        api.getPaymentPostings().catch(() => []),
        api.getDenials().catch(() => []),
        api.getInsurancePayers().catch(() => [])
      ]);

      setPreapprovals(preapprovalsData || []);
      setPayments(paymentsData || []);
      setPaymentPostings(paymentPostingsData || []);
      setDenials(denialsData || []);
      setInsurancePayers(payersData || []);
    } catch (error) {
      console.error('Error fetching RCM data:', error);
      addNotification('error', 'Failed to load RCM data');
    } finally {
      setLoading(false);
    }
  };

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
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatCurrency(claim.amount)}</td>
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
                              setEditingItem({ type: 'claim', data: claim });
                              setCurrentView('view');
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title="View"
                          >
                            <Eye className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem({ type: 'claim', data: claim });
                              setCurrentView('edit');
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title="Edit"
                          >
                            <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this claim?')) {
                                try {
                                  await api.deleteClaim(claim.id);
                                  setClaims(prev => prev.filter(c => c.id !== claim.id));
                                  await addNotification('alert', 'Claim deleted successfully');
                                } catch (err) {
                                  console.error('Error deleting claim:', err);
                                  alert('Failed to delete claim');
                                }
                              }
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
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this pre-authorization?')) {
                              try {
                                await api.deletePreapproval(pa.id);
                                setPreapprovals(prev => prev.filter(p => p.id !== pa.id));
                                await addNotification('success', 'Pre-authorization deleted successfully');
                              } catch (err) {
                                console.error('Error deleting pre-authorization:', err);
                                alert('Failed to delete pre-authorization');
                              }
                            }
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
                      <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(payment.amount)}</td>
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
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this payment?')) {
                                try {
                                  await api.deletePayment(payment.id);
                                  setPayments(prev => prev.filter(p => p.id !== payment.id));
                                  await addNotification('success', 'Payment deleted successfully');
                                } catch (err) {
                                  console.error('Error deleting payment:', err);
                                  alert('Failed to delete payment');
                                }
                              }
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
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this insurance payer?')) {
                              try {
                                await api.deleteInsurancePayer(payer.id);
                                setInsurancePayers(prev => prev.filter(p => p.id !== payer.id));
                                await addNotification('success', 'Insurance payer deleted successfully');
                              } catch (err) {
                                console.error('Error deleting payer:', err);
                                alert('Failed to delete insurance payer');
                              }
                            }
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
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
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
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatCurrency(posting.payment_amount)}</td>
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
                            if (window.confirm('Are you sure you want to delete this payment posting?')) {
                              try {
                                await api.deletePaymentPosting(posting.id);
                                setPaymentPostings(prev => prev.filter(p => p.id !== posting.id));
                                addNotification('success', 'Payment posting deleted successfully');
                              } catch (err) {
                                console.error('Error deleting posting:', err);
                                alert('Failed to delete payment posting');
                              }
                            }
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
                    <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatCurrency(denial.denial_amount)}</td>
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
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this denial?')) {
                              try {
                                await api.deleteDenial(denial.id);
                                setDenials(prev => prev.filter(d => d.id !== denial.id));
                                addNotification('success', 'Denial deleted successfully');
                              } catch (err) {
                                console.error('Error deleting denial:', err);
                                alert('Failed to delete denial');
                              }
                            }
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
              Manage claims, pre-authorizations, payments, and insurance payers
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
          { id: 'payers', label: 'Insurance Payers', icon: Shield, count: insurancePayers.length }
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
      {activeTab === 'claims' && showClaimForm && (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
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
      </div>
    </div>
  );
};

export default RCMView;
