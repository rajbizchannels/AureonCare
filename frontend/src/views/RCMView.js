import React, { useState } from 'react';
import { Plus, Eye, Edit, Trash2, CreditCard, ArrowLeft, Shield } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import NewPaymentForm from '../components/forms/NewPaymentForm';
import NewClaimForm from '../components/forms/NewClaimForm';
import NewInsurancePayerForm from '../components/forms/NewInsurancePayerForm';

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
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [showInsurancePayerForm, setShowInsurancePayerForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title="Back to Dashboard"
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Revenue Cycle Management</h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowInsurancePayerForm(true)}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            <Shield className="w-4 h-4" />
            Add Insurance Payer
          </button>
          <button
            onClick={() => setShowPaymentForm(true)}
            className={`flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            <CreditCard className="w-4 h-4" />
            Process Payment
          </button>
          <button
            onClick={() => setShowClaimForm(true)}
            className={`flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            <Plus className="w-4 h-4" />
            New Claim
          </button>
        </div>
      </div>

      {/* Inline Forms - Between buttons and list */}
      {showInsurancePayerForm && (
        <div className="mb-6">
          <NewInsurancePayerForm
            theme={theme}
            api={api}
            onClose={() => setShowInsurancePayerForm(false)}
            onSuccess={() => {
              setShowInsurancePayerForm(false);
              addNotification('success', t.insurancePayerAdded || 'Insurance payer added successfully');
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {showPaymentForm && (
        <div className="mb-6">
          <NewPaymentForm
            theme={theme}
            api={api}
            patients={patients}
            claims={claims}
            onClose={() => setShowPaymentForm(false)}
            onSuccess={(newPayment) => {
              setShowPaymentForm(false);
              addNotification('success', t.paymentRecordedSuccessfully || 'Payment recorded successfully');
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {showClaimForm && (
        <div className="mb-6">
          <NewClaimForm
            theme={theme}
            api={api}
            patients={patients}
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
              {claims.map((claim, idx) => {
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
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RCMView;
