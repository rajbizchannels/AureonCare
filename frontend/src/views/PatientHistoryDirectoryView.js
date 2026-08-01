import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Search, User } from 'lucide-react';

import { formatDate } from '../utils/formatters';
import PatientHistoryView from './PatientHistoryView';

/**
 * Patient History — the roster first, one chart at a time.
 *
 * Opening a chart used to require arriving from somewhere else with a patient
 * already in context, which left the module empty when reached from the nav.
 * Here every patient is listed and a row expands in place, so the list stays on
 * screen and there is nothing to navigate back from.
 */
const PatientHistoryDirectoryView = ({
  theme,
  api,
  patients = [],
  addNotification,
  user,
  t = {},
  initialPatientId = null,
  initialTab = 'overview',
}) => {
  const dark = theme === 'dark';

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(initialPatientId);

  // Arriving here with a patient already chosen (global search, a quick view)
  // opens that row, even if the module was already on screen.
  useEffect(() => {
    if (initialPatientId) setExpandedId(initialPatientId);
  }, [initialPatientId]);

  const term = search.trim().toLowerCase();
  const filtered = patients.filter((patient) => {
    if (!term) return true;
    return ['first_name', 'last_name', 'mrn', 'email', 'phone']
      .map((field) => (patient[field] || '').toString().toLowerCase())
      .some((value) => value.includes(term));
  });

  const nameOf = (patient) =>
    `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unnamed patient';

  const initialsOf = (patient) =>
    nameOf(patient)
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${dark ? 'text-slate-400' : 'text-gray-400'}`} />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.searchPatientsPlaceholder || 'Search patients by name, MRN, email, or phone...'}
          className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none transition-colors ${
            dark
              ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-cyan-500'
          }`}
        />
      </div>

      {filtered.length === 0 ? (
        <div className={`rounded-xl border p-12 text-center ${dark ? 'bg-slate-900/50 border-slate-800 text-slate-400' : 'bg-white border-gray-200 text-gray-600'}`}>
          <User className={`w-12 h-12 mx-auto mb-4 ${dark ? 'text-slate-600' : 'text-gray-300'}`} />
          <p>{term ? 'No patients found matching your search' : 'No patients found'}</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden divide-y ${dark ? 'bg-slate-800/50 border-slate-700 divide-slate-700' : 'bg-white border-gray-300 divide-gray-200'}`}>
          {filtered.map((patient) => {
            const expanded = expandedId === patient.id;

            return (
              <div key={patient.id}>
                <button
                  onClick={() => setExpandedId(expanded ? null : patient.id)}
                  aria-expanded={expanded}
                  className={`w-full flex items-center gap-4 px-4 sm:px-6 py-4 text-left transition-colors ${
                    expanded
                      ? dark ? 'bg-slate-700/40' : 'bg-gray-50'
                      : dark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'
                  }`}
                >
                  {expanded
                    ? <ChevronDown className={`w-4 h-4 flex-shrink-0 ${dark ? 'text-slate-400' : 'text-gray-500'}`} />
                    : <ChevronRight className={`w-4 h-4 flex-shrink-0 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />}

                  <span className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {initialsOf(patient)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={`block font-medium truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
                      {nameOf(patient)}
                    </span>
                    <span className={`block text-sm truncate ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                      {patient.email || patient.phone || 'No contact details'}
                    </span>
                  </span>

                  <span className={`hidden sm:block text-sm flex-shrink-0 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {patient.mrn ? `MRN ${patient.mrn}` : ''}
                  </span>

                  <span className={`hidden md:block text-sm flex-shrink-0 w-28 text-right ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {patient.date_of_birth ? formatDate(patient.date_of_birth) : ''}
                  </span>
                </button>

                {expanded && (
                  <div className={`px-4 sm:px-6 pb-6 ${dark ? 'bg-slate-900/40' : 'bg-gray-50/60'}`}>
                    <PatientHistoryView
                      theme={theme}
                      api={api}
                      addNotification={addNotification}
                      user={user}
                      patient={patient}
                      initialTab={initialTab}
                      embedded
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PatientHistoryDirectoryView;
