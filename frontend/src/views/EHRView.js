import React, { useState, useEffect } from 'react';
import { Plus, FileText, Calendar, Phone, Mail, Edit, ArrowLeft, History, Pill, User, Search, Video } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import NewPatientForm from '../components/forms/NewPatientForm';
import ViewEditModal from '../components/modals/ViewEditModal';
import { useAudit } from '../hooks/useAudit';

const EHRView = ({
  theme,
  patients,
  users,
  showForm,
  setShowForm,
  editingItem,
  setEditingItem,
  currentView,
  setCurrentView,
  setCurrentModule,
  setPatients,
  setAppointments,
  setClaims,
  setUsers,
  setUser,
  api,
  addNotification,
  user,
  t,
  onViewHistory,
  onViewPrescriptions,
  onViewTelehealth
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const { logViewAccess } = useAudit();

  useEffect(() => {
    logViewAccess('EHRView', {
      module: 'EHR',
    });
  }, []);

  // Filter patients based on search
  const filteredPatients = patients.filter(patient => {
    const searchLower = searchTerm.toLowerCase();
    const firstName = (patient.first_name || '').toLowerCase();
    const lastName = (patient.last_name || '').toLowerCase();
    const mrn = (patient.mrn || '').toLowerCase();
    const email = (patient.email || '').toLowerCase();
    const phone = (patient.phone || '').toLowerCase();

    return firstName.includes(searchLower) ||
           lastName.includes(searchLower) ||
           mrn.includes(searchLower) ||
           email.includes(searchLower) ||
           phone.includes(searchLower);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title="Back to Dashboard"
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Patient Records</h2>
        </div>
        <button
          onClick={() => setShowForm('patient')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors text-white font-medium"
        >
          <Plus className="w-4 h-4" />
          New Patient
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
        <input
          type="text"
          placeholder="Search patients by name, MRN, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none transition-colors ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-500 focus:border-purple-500'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500'
          }`}
        />
      </div>

      {/* Patient Form */}
      {showForm === 'patient' && (
        <div className="mb-6">
          <NewPatientForm
            theme={theme}
            api={api}
            onClose={() => setShowForm(null)}
            onSuccess={(newPatient) => {
              setPatients([...patients, newPatient]);
              setShowForm(null);
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {/* Edit Patient Form */}
      {editingItem && editingItem.type === 'patient' && (
        <div className="mb-6">
          <ViewEditModal
            theme={theme}
            editingItem={editingItem}
            currentView={currentView}
            onClose={() => {
              setEditingItem(null);
              setCurrentView('list');
            }}
            patients={patients}
            users={users}
            api={api}
            addNotification={addNotification}
            setAppointments={setAppointments}
            setPatients={setPatients}
            setClaims={setClaims}
            setUsers={setUsers}
            setUser={setUser}
            user={user}
            t={t}
          />
        </div>
      )}

      {/* Patient List */}
      <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
        {filteredPatients.length === 0 ? (
          <div className={`text-center py-12 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            <User className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
            <p>{searchTerm ? 'No patients found matching your search' : 'No patients found'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Patient
                  </th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    MRN
                  </th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    DOB
                  </th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Contact
                  </th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Status
                  </th>
                  <th className={`px-6 py-4 text-right text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-gray-200'}`}>
                {filteredPatients.map((patient) => {
                  const displayName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
                  const initials = displayName.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase();

                  return (
                    <tr
                      key={patient.id}
                      className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'}`}
                    >
                      {/* Patient Name with Avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {initials}
                          </div>
                          <div>
                            <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {displayName || 'N/A'}
                            </div>
                            <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                              {patient.email || 'No email'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* MRN */}
                      <td className={`px-6 py-4 text-sm font-mono ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        {patient.mrn || 'N/A'}
                      </td>

                      {/* DOB */}
                      <td className={`px-6 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        {formatDate(patient.date_of_birth || patient.dob) || 'N/A'}
                      </td>

                      {/* Contact */}
                      <td className={`px-6 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <span>{patient.phone || 'N/A'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          patient.status === 'Active' || patient.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {patient.status || 'Active'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit Chart */}
                          <button
                            onClick={() => {
                              setCurrentView('edit');
                              setEditingItem({ type: 'patient', data: patient });
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'hover:bg-blue-500/20 text-blue-400'
                                : 'hover:bg-blue-100 text-blue-600'
                            }`}
                            title="Edit Patient Chart"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* View History */}
                          <button
                            onClick={() => {
                              if (onViewHistory) {
                                onViewHistory(patient);
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'hover:bg-teal-500/20 text-teal-400'
                                : 'hover:bg-teal-100 text-teal-600'
                            }`}
                            title="View Patient History"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* View Prescriptions */}
                          <button
                            onClick={() => {
                              if (onViewPrescriptions) {
                                onViewPrescriptions(patient);
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'hover:bg-green-500/20 text-green-400'
                                : 'hover:bg-green-100 text-green-600'
                            }`}
                            title="View Prescriptions"
                          >
                            <Pill className="w-4 h-4" />
                          </button>

                          {/* Telehealth */}
                          <button
                            onClick={() => {
                              if (onViewTelehealth) {
                                onViewTelehealth(patient);
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'hover:bg-purple-500/20 text-purple-400'
                                : 'hover:bg-purple-100 text-purple-600'
                            }`}
                            title="Start Telehealth Session"
                          >
                            <Video className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {filteredPatients.length > 0 && (
        <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          Showing {filteredPatients.length} of {patients.length} patients
        </div>
      )}
    </div>
  );
};

export default EHRView;
