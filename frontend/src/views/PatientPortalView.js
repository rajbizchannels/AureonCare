import React, { useState, useEffect } from 'react';
import { Calendar, FileText, User, Edit, Check, X, Lock } from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';

const PatientPortalView = ({ theme, api, addNotification, user }) => {
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, appointments, records, profile

  // Data states
  const [appointments, setAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState(user || {});

  useEffect(() => {
    if (user) {
      setProfileData(user);
      fetchPatientData();
    }
  }, [user]);

  const fetchPatientData = async () => {
    try {
      // Fetch appointments and medical records for the patient user
      const [appts, records] = await Promise.all([
        api.getAppointments().then(all => all.filter(a => a.patient_id === user.id)),
        api.getMedicalRecords ? api.getMedicalRecords(user.id) : Promise.resolve([])
      ]);
      setAppointments(appts);
      setMedicalRecords(records);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      addNotification('alert', 'Failed to load patient data');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const updated = await api.updateUser(user.id, {
        phone: profileData.phone,
        email: profileData.email
      });
      setProfileData(updated);
      setEditingProfile(false);
      addNotification('success', 'Profile updated successfully');
    } catch (error) {
      addNotification('alert', 'Failed to update profile');
    }
  };

  // Dashboard View
  const renderDashboard = () => (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Welcome, {user?.firstName || user?.name}!
        </h2>
        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          Email: {user?.email}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => setCurrentView('appointments')}
          className={`bg-gradient-to-br rounded-xl p-6 border cursor-pointer hover:shadow-lg transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-cyan-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-cyan-600/50'}`}
        >
          <Calendar className={`w-8 h-8 mb-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`} />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            My Appointments
          </h3>
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {appointments.length}
          </p>
        </div>

        <div
          onClick={() => setCurrentView('records')}
          className={`bg-gradient-to-br rounded-xl p-6 border cursor-pointer hover:shadow-lg transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-cyan-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-cyan-600/50'}`}
        >
          <FileText className={`w-8 h-8 mb-4 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Medical Records
          </h3>
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {medicalRecords.length}
          </p>
        </div>

        <div
          onClick={() => setCurrentView('profile')}
          className={`bg-gradient-to-br rounded-xl p-6 border cursor-pointer hover:shadow-lg transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-cyan-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-cyan-600/50'}`}
        >
          <User className={`w-8 h-8 mb-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            My Profile
          </h3>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            View & Edit
          </p>
        </div>
      </div>
    </div>
  );

  // Appointments View
  const renderAppointments = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        My Appointments
      </h2>
      {appointments.length === 0 ? (
        <div className={`text-center py-12 rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <Calendar className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>No appointments found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {apt.provider ? `Dr. ${apt.provider.first_name} ${apt.provider.last_name}` : 'Provider TBD'}
                  </h3>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {formatDate(apt.start_time)} at {formatTime(apt.start_time)}
                  </p>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Type: {apt.appointment_type || 'General Consultation'}
                  </p>
                  {apt.reason && (
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      Reason: {apt.reason}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  apt.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                  apt.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {apt.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Medical Records View
  const renderMedicalRecords = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        My Medical Records
      </h2>
      {medicalRecords.length === 0 ? (
        <div className={`text-center py-12 rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <FileText className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>No medical records found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {medicalRecords.map((record) => (
            <div
              key={record.id}
              className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}
            >
              <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {record.title || record.record_type}
              </h3>
              <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Date: {formatDate(record.record_date)}
              </p>
              {record.provider && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Provider: Dr. {record.provider.first_name} {record.provider.last_name}
                </p>
              )}
              {record.description && (
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {record.description}
                </p>
              )}
              {record.diagnosis && (
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  <strong>Diagnosis:</strong> {record.diagnosis}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Profile View
  const renderProfile = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          My Profile
        </h2>
        {!editingProfile && (
          <button
            onClick={() => setEditingProfile(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white font-medium transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit Profile
          </button>
        )}
      </div>

      {editingProfile ? (
        <form onSubmit={handleUpdateProfile} className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Phone
              </label>
              <input
                type="tel"
                value={profileData.phone || ''}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Email
              </label>
              <input
                type="email"
                value={profileData.email || ''}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-white font-medium transition-colors"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Name</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {user?.firstName} {user?.lastName}
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Role</p>
              <p className={`font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {user?.role}
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Email</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {user?.email || 'Not provided'}
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Phone</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {user?.phone || 'Not provided'}
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Practice</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {user?.practice || 'Not specified'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Main Portal Layout
  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Patient Portal
        </h2>
        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          Access your medical information and appointments
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-4">
        {['dashboard', 'appointments', 'records', 'profile'].map((view) => (
          <button
            key={view}
            onClick={() => setCurrentView(view)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
              currentView === view
                ? 'bg-cyan-500 text-white'
                : theme === 'dark'
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {view}
          </button>
        ))}
      </div>

      {/* Content */}
      {currentView === 'dashboard' && renderDashboard()}
      {currentView === 'appointments' && renderAppointments()}
      {currentView === 'records' && renderMedicalRecords()}
      {currentView === 'profile' && renderProfile()}
    </div>
  );
};

export default PatientPortalView;
