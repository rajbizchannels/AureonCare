import React, { useState, useEffect } from 'react';
import { Search, X, Users, Calendar } from 'lucide-react';
import { formatDate, formatTime } from '../../utils/formatters';

const SearchPanel = ({
  theme,
  patients,
  appointments,
  onClose,
  onSelectResult
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose]);

  const searchResults = [
    ...patients.filter(p => {
      const name = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    }).map(p => ({ type: 'patient', ...p })),
    ...appointments.filter(a => {
      const patient = patients.find(p => p.id === a.patient_id);
      const patientName = a.patient || patient?.name || '';
      return patientName.toLowerCase().includes(searchQuery.toLowerCase());
    }).map(a => ({ type: 'appointment', ...a }))
  ].slice(0, 5);

  return (
    <div className={`fixed top-16 left-1/2 transform -translate-x-1/2 w-full max-w-2xl rounded-xl border shadow-2xl z-50 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
      <div className="p-4">
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patients, appointments, records..."
            className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
            autoFocus
          />
          <button onClick={onClose} className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}>
            <X className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>
      </div>
      {searchQuery && (
        <div className={`border-t max-h-96 overflow-y-auto ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          {searchResults.length > 0 ? (
            searchResults.map((result, idx) => {
              let displayName;
              if (result.type === 'patient') {
                displayName = result.name || `${result.first_name || ''} ${result.last_name || ''}`.trim();
              } else {
                const patient = patients.find(p => p.id === result.patient_id);
                displayName = result.patient || patient?.name || 'Unknown Patient';
              }

              // Parse appointment date/time from start_time
              let appointmentDateTime = '';
              if (result.type === 'appointment' && result.start_time) {
                const startTimeStr = result.start_time.replace(' ', 'T');
                const startDate = new Date(startTimeStr);
                if (!isNaN(startDate.getTime())) {
                  appointmentDateTime = `${formatDate(startDate)} ${formatTime(startDate)}`;
                }
              }

              return (
              <div
                key={idx}
                onClick={() => {
                  onSelectResult(result);
                  onClose();
                }}
                className={`p-4 transition-colors cursor-pointer border-b last:border-b-0 ${theme === 'dark' ? 'hover:bg-slate-800 border-slate-800' : 'hover:bg-gray-100 border-gray-200'}`}
              >
                <div className="flex items-center gap-3">
                  {result.type === 'patient' && <Users className="w-5 h-5 text-purple-400" />}
                  {result.type === 'appointment' && <Calendar className="w-5 h-5 text-blue-400" />}
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{displayName}</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {result.type === 'patient' ? result.mrn : appointmentDateTime}
                    </p>
                  </div>
                </div>
              </div>
            );
            })
          ) : (
            <div className={`p-8 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPanel;
