import React from 'react';
import { X } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

const RevenueQuickView = ({ theme, claims, patients, onClose, onViewAll, setEditingItem, setCurrentView }) => (
  <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
    <div className={`rounded-xl border max-w-4xl w-full max-h-[80vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
      <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Revenue Overview</h2>
        <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
          <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div
            onClick={() => {
              if (onViewAll) {
                onClose();
                onViewAll();
              }
            }}
            className={`p-4 rounded-lg cursor-pointer transition-all hover:scale-105 ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-200'}`}
          >
            <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Total Billed</p>
            <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {formatCurrency(claims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0))}
            </p>
          </div>
          <div
            onClick={() => {
              if (onViewAll) {
                onClose();
                onViewAll();
              }
            }}
            className={`p-4 rounded-lg cursor-pointer transition-all hover:scale-105 ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-200'}`}
          >
            <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Collected</p>
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(claims.filter(c => c.status === 'Approved' || c.status === 'Paid').reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0))}
            </p>
          </div>
          <div
            onClick={() => {
              if (onViewAll) {
                onClose();
                onViewAll();
              }
            }}
            className={`p-4 rounded-lg cursor-pointer transition-all hover:scale-105 ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-200'}`}
          >
            <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Pending</p>
            <p className="text-2xl font-bold text-yellow-400">
              {formatCurrency(claims.filter(c => c.status === 'Pending' || c.status === 'Submitted').reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0))}
            </p>
          </div>
        </div>

        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Recent Claims</h3>
        <div className="space-y-3">
          {claims.map(claim => {
            const patient = patients.find(p => p.id === claim.patient_id);
            const patientName = claim.patient || patient?.name || 'Unknown Patient';

            return (
              <div
                key={claim.id}
                onClick={() => {
                  if (setEditingItem && setCurrentView) {
                    setEditingItem({ type: 'claim', data: claim });
                    setCurrentView('view');
                    onClose();
                  }
                }}
                className={`p-4 rounded-lg transition-colors cursor-pointer ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{claim.claim_number || claim.claimNumber || claim.claimNo || claim.claim_no || 'N/A'}</h4>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{patientName}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(claim.amount)}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      claim.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
                      claim.status === 'Submitted' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {claim.status}
                    </span>
                  </div>
                </div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>{claim.payer} • {formatDate(claim.service_date || claim.serviceDate || claim.date)}</p>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => {
            onClose();
            if (onViewAll) onViewAll();
          }}
          className={`w-full mt-6 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          View All Claims
        </button>
      </div>
    </div>
  </div>
);

export default RevenueQuickView;
