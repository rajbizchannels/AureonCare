import React from 'react';
import { X, Clock, UserCheck } from 'lucide-react';
import { formatTime } from '../../utils/formatters';

const AppointmentsQuickView = ({ theme, appointments, patients, onClose, onViewAll }) => (
  <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
    <div className={`rounded-xl border max-w-4xl w-full max-h-[80vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
      <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Today's Appointments</h2>
        <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
          <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
        <div className="space-y-3">
          {appointments.map(apt => {
            const patient = patients.find(p => p.id === apt.patient_id);
            const patientName = apt.patient || patient?.name || 'Unknown Patient';
            const initials = patientName.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase();

            return (
              <div key={apt.id} className={`p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {initials}
                    </div>
                    <div>
                      <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{patientName}</h3>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{apt.type}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    apt.status === 'Confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {apt.status}
                  </span>
                </div>
                <div className={`flex items-center gap-4 text-sm ml-13 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatTime(apt.time)}
                  </div>
                  <div className="flex items-center gap-1">
                    <UserCheck className="w-4 h-4" />
                    {apt.doctor || 'Dr. Sarah Chen'}
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
          className={`w-full mt-6 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          View All Appointments
        </button>
      </div>
    </div>
  </div>
);

export default AppointmentsQuickView;
