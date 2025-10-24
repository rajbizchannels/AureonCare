import React from 'react';
import { Plus, FileText, Calendar, Phone, Mail, Edit } from 'lucide-react';
import { formatDate } from '../utils/formatters';

const EHRView = ({
  theme,
  patients,
  setShowForm,
  setCurrentView,
  setEditingItem
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Patient Records</h2>
        <button
          onClick={() => setShowForm('patient')}
          className={`flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          <Plus className="w-4 h-4" />
          New Patient
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {patients.map(patient => {
          const displayName = patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
          const initials = displayName.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase();

          return (
            <div key={patient.id} className={`bg-gradient-to-br rounded-xl p-6 border transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-purple-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-purple-600/50'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {initials}
                </div>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                  {patient.status}
                </span>
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{displayName}</h3>
              <div className="space-y-2 text-sm">
                <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  <FileText className="w-4 h-4" />
                  <span>MRN: {patient.mrn}</span>
                </div>
                <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  <Calendar className="w-4 h-4" />
                  <span>DOB: {formatDate(patient.dob)}</span>
                </div>
                <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  <Phone className="w-4 h-4" />
                  <span>{patient.phone}</span>
                </div>
                <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{patient.email}</span>
                </div>
              </div>
              <div className={`mt-4 pt-4 border-t flex gap-2 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                <button
                  onClick={() => {
                    setCurrentView('view');
                    setEditingItem({ type: 'patient', data: patient });
                  }}
                  className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm transition-colors"
                >
                  View Chart
                </button>
                <button
                  onClick={() => {
                    setCurrentView('edit');
                    setEditingItem({ type: 'patient', data: patient });
                  }}
                  className={`px-3 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EHRView;
