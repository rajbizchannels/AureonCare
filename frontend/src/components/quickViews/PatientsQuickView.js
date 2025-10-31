import React from 'react';
import { X, Calendar, Phone } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

const PatientsQuickView = ({ theme, t, patients, onClose, onViewAll, setEditingItem, setCurrentView }) => (
  <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
    <div className={`rounded-xl border max-w-4xl w-full max-h-[80vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
      <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Active Patients</h2>
        <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
          <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patients.map(patient => {
            const displayName = patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
            const initials = displayName.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase();

            return (
              <div
                key={patient.id}
                onClick={() => {
                  if (setEditingItem && setCurrentView) {
                    setEditingItem({ type: 'patient', data: patient });
                    setCurrentView('view');
                    onClose();
                  }
                }}
                className={`p-4 rounded-lg transition-colors cursor-pointer ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {initials}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{displayName}</h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{patient.mrn}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    <Calendar className="w-4 h-4" />
                    <span>DOB: {formatDate(patient.date_of_birth || patient.dob)}</span>
                  </div>
                  <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    <Phone className="w-4 h-4" />
                    <span>{patient.phone || 'No phone'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => {
            onClose();
            if (onViewAll) onViewAll();
          }}
          className={`w-full mt-6 px-4 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          {t.viewAllPatients}
        </button>
      </div>
    </div>
  </div>
);

export default PatientsQuickView;
