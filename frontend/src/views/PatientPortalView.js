import React, { useState, useEffect } from 'react';
import { Calendar, FileText, User, Edit, Check, X, Lock } from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';
import { getTranslations } from '../config/translations';
import { useApp } from '../context/AppContext';
import ConfirmationModal from '../components/modals/ConfirmationModal';

const PatientPortalView = ({ theme, api, addNotification, user }) => {
  const { language } = useApp();
  const t = getTranslations(language);
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, appointments, records, profile, prescriptions, bookAppointment, payments

  // Data states
  const [appointments, setAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState(user || {});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');

  // Appointment booking state
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    type: 'General Consultation',
    reason: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData(user);
      fetchPatientData();
    }
  }, [user]);

  const fetchPatientData = async () => {
    try {
      // The user object from patient portal login is the patient record itself
      const patientId = user.id;

      console.log('Fetching patient data for ID:', patientId);

      // Fetch appointments, medical records, and prescriptions for the patient
      const [appts, records, presc] = await Promise.all([
        api.getAppointments().then(all => {
          console.log('All appointments:', all);
          const filtered = all.filter(a => a.patient_id?.toString() === patientId?.toString());
          console.log('Filtered appointments for patient:', filtered);
          return filtered;
        }),
        api.getMedicalRecords ? api.getMedicalRecords(patientId) : Promise.resolve([]),
        fetch(`/api/prescriptions?patient_id=${patientId}`).then(r => r.json()).catch(() => [])
      ]);
      setAppointments(appts);
      setMedicalRecords(records);
      setPrescriptions(presc);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      addNotification('alert', 'Failed to load patient data');
    }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    try {
      // Combine date and time into start_time timestamp
      const startTime = `${bookingData.date.split('T')[0]}T${bookingData.time}:00`;
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + 30 * 60000); // Default 30 minutes duration

      const appointmentData = {
        // Send the user's id as both patient_id and user_id for backend to resolve
        patient_id: user.id,
        user_id: user.id,
        start_time: startDate.toISOString().slice(0, 19).replace('T', ' '),
        end_time: endDate.toISOString().slice(0, 19).replace('T', ' '),
        duration_minutes: 30,
        appointment_type: bookingData.type,
        reason: bookingData.reason,
        status: 'Scheduled'
      };

      console.log('Booking appointment with data:', appointmentData);
      await api.createAppointment(appointmentData);
      addNotification('success', 'Appointment booked successfully');

      // Show success confirmation
      setConfirmationMessage('Your appointment has been booked successfully!');
      setShowConfirmation(true);

      // Auto-navigate to appointments view after confirmation
      setTimeout(() => {
        setCurrentView('appointments');
        setBookingData({ date: '', time: '', type: 'General Consultation', reason: '' });
        fetchPatientData();
      }, 2000);
    } catch (error) {
      console.error('Error booking appointment:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to book appointment';
      addNotification('alert', errorMsg);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const updated = await api.updatePatient(user.id, {
        phone: profileData.phone,
        email: profileData.email,
        height: profileData.height,
        weight: profileData.weight,
        blood_type: profileData.blood_type,
        allergies: profileData.allergies,
        past_history: profileData.past_history,
        family_history: profileData.family_history,
        current_medications: profileData.current_medications
      });
      setProfileData(updated);
      setEditingProfile(false);
      addNotification('success', 'Profile updated successfully');

      // Show success confirmation
      setConfirmationMessage('Your profile has been updated successfully!');
      setShowConfirmation(true);
    } catch (error) {
      addNotification('alert', 'Failed to update profile');
    }
  };

  // Dashboard View
  const renderDashboard = () => (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {t.welcomeBack}, {user?.first_name || user?.name}!
        </h2>
        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          {t.email}: {user?.email}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => setCurrentView('appointments')}
          className={`bg-gradient-to-br rounded-xl p-6 border cursor-pointer hover:shadow-lg transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-cyan-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-cyan-600/50'}`}
        >
          <Calendar className={`w-8 h-8 mb-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`} />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.myAppointments}
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
            {t.medicalRecords}
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
            {t.myProfile}
          </h3>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            {t.viewAndEdit}
          </p>
        </div>
      </div>
    </div>
  );

  // Appointments View
  const renderAppointments = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        {t.myAppointments}
      </h2>
      {appointments.length === 0 ? (
        <div className={`text-center py-12 rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <Calendar className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.noAppointmentsFound}</p>
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
                    {apt.provider ? `Dr. ${apt.provider.first_name} ${apt.provider.last_name}` : t.providerTBD}
                  </h3>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {formatDate(apt.start_time)} at {formatTime(apt.start_time)}
                  </p>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.type}: {apt.appointment_type || t.generalConsultation}
                  </p>
                  {apt.reason && (
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.reason}: {apt.reason}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  apt.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                  apt.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {apt.status === 'scheduled' ? t.scheduled : apt.status}
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
        {t.medicalRecords}
      </h2>
      {medicalRecords.length === 0 ? (
        <div className={`text-center py-12 rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <FileText className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.noMedicalRecordsFound}</p>
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
                {t.date}: {formatDate(record.record_date)}
              </p>
              {record.provider && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  {t.provider}: Dr. {record.provider.first_name} {record.provider.last_name}
                </p>
              )}
              {record.description && (
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {record.description}
                </p>
              )}
              {record.diagnosis && (
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  <strong>{t.diagnosis}:</strong> {record.diagnosis}
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
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xl font-bold text-white`}>
            {user?.avatar || `${user?.first_name?.charAt(0) || ''}${user?.last_name?.charAt(0) || ''}`.toUpperCase()}
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {user?.first_name} {user?.last_name}
            </h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{user?.email}</p>
          </div>
        </div>
        {!editingProfile && (
          <button
            onClick={() => setEditingProfile(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white font-medium transition-colors"
          >
            <Edit className="w-4 h-4" />
            {t.editProfile}
          </button>
        )}
      </div>

      {editingProfile ? (
        <form onSubmit={handleUpdateProfile} className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.phone}
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
                {t.email}
              </label>
              <input
                type="email"
                value={profileData.email || ''}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Height</label>
              <input
                type="text"
                value={profileData.height || ''}
                onChange={(e) => setProfileData({...profileData, height: e.target.value})}
                placeholder="e.g., 5'10&quot;"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Weight</label>
              <input
                type="text"
                value={profileData.weight || ''}
                onChange={(e) => setProfileData({...profileData, weight: e.target.value})}
                placeholder="e.g., 180 lbs"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Blood Type</label>
              <input
                type="text"
                value={profileData.blood_type || ''}
                onChange={(e) => setProfileData({...profileData, blood_type: e.target.value})}
                placeholder="e.g., O+"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div className="col-span-2">
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Allergies</label>
              <textarea
                value={profileData.allergies || ''}
                onChange={(e) => setProfileData({...profileData, allergies: e.target.value})}
                placeholder="List any allergies..."
                rows="3"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div className="col-span-2">
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Past Medical History</label>
              <textarea
                value={profileData.past_history || ''}
                onChange={(e) => setProfileData({...profileData, past_history: e.target.value})}
                placeholder="Previous medical conditions..."
                rows="3"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div className="col-span-2">
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Family Medical History</label>
              <textarea
                value={profileData.family_history || ''}
                onChange={(e) => setProfileData({...profileData, family_history: e.target.value})}
                placeholder="Family medical history..."
                rows="3"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div className="col-span-2">
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Current Medications</label>
              <textarea
                value={profileData.current_medications || ''}
                onChange={(e) => setProfileData({...profileData, current_medications: e.target.value})}
                placeholder="List current medications..."
                rows="3"
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
              {t.saveChanges}
            </button>
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
            >
              <X className="w-4 h-4" />
              {t.cancel}
            </button>
          </div>
        </form>
      ) : (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
          <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Contact Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.email}</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {user?.email || t.notProvided}
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.phone}</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {user?.phone || t.notProvided}
              </p>
            </div>
          </div>

          {/* Medical Information Section */}
          <div className={`mt-6 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Medical Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Height</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user?.height || t.notProvided}</p>
              </div>
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Weight</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user?.weight || t.notProvided}</p>
              </div>
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Blood Type</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user?.blood_type || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Allergies</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user?.allergies || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Past Medical History</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user?.past_history || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Family Medical History</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user?.family_history || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Current Medications</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user?.current_medications || t.notProvided}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Prescriptions View
  const renderPrescriptions = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        My Prescriptions
      </h2>
      {prescriptions.length === 0 ? (
        <div className={`text-center py-12 rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <FileText className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>No prescriptions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <div
              key={rx.id}
              className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {rx.medicationName}
                  </h3>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Dosage: {rx.dosage}
                  </p>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Frequency: {rx.frequency}
                  </p>
                  {rx.duration && (
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      Duration: {rx.duration}
                    </p>
                  )}
                  {rx.instructions && (
                    <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Instructions: {rx.instructions}
                    </p>
                  )}
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Refills: {rx.refills}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  rx.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {rx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Book Appointment View
  const renderBookAppointment = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Book Appointment
      </h2>
      <form onSubmit={handleBookAppointment} className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Date *
            </label>
            <input
              type="date"
              value={bookingData.date}
              onChange={(e) => setBookingData({...bookingData, date: e.target.value})}
              required
              min={new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>
          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Time *
            </label>
            <input
              type="time"
              value={bookingData.time}
              onChange={(e) => setBookingData({...bookingData, time: e.target.value})}
              required
              className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>
          <div className="col-span-2">
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Appointment Type *
            </label>
            <select
              value={bookingData.type}
              onChange={(e) => setBookingData({...bookingData, type: e.target.value})}
              className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              <option value="General Consultation">General Consultation</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Check-up">Check-up</option>
              <option value="Physical Exam">Physical Exam</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Reason for Visit
            </label>
            <textarea
              value={bookingData.reason}
              onChange={(e) => setBookingData({...bookingData, reason: e.target.value})}
              placeholder="Describe your symptoms or reason for visit..."
              rows="4"
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
            Book Appointment
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  // Main Portal Layout
  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={() => setShowConfirmation(false)}
        title="Success!"
        message={confirmationMessage}
        type="success"
        confirmText="OK"
        showCancel={false}
      />
      <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {t.patientPortal}
        </h2>
        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          {t.patientPortalDescription}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCurrentView('dashboard')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentView === 'dashboard'
              ? 'bg-cyan-500 text-white'
              : theme === 'dark'
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {t.dashboardTab}
        </button>
        <button
          onClick={() => setCurrentView('appointments')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentView === 'appointments'
              ? 'bg-cyan-500 text-white'
              : theme === 'dark'
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {t.appointmentsTab}
        </button>
        <button
          onClick={() => setCurrentView('bookAppointment')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentView === 'bookAppointment'
              ? 'bg-cyan-500 text-white'
              : theme === 'dark'
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Book Appointment
        </button>
        <button
          onClick={() => setCurrentView('prescriptions')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentView === 'prescriptions'
              ? 'bg-cyan-500 text-white'
              : theme === 'dark'
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Prescriptions
        </button>
        <button
          onClick={() => setCurrentView('records')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentView === 'records'
              ? 'bg-cyan-500 text-white'
              : theme === 'dark'
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {t.recordsTab}
        </button>
        <button
          onClick={() => setCurrentView('profile')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentView === 'profile'
              ? 'bg-cyan-500 text-white'
              : theme === 'dark'
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {t.profileTab}
        </button>
      </div>

      {/* Content */}
      {currentView === 'dashboard' && renderDashboard()}
      {currentView === 'appointments' && renderAppointments()}
      {currentView === 'bookAppointment' && renderBookAppointment()}
      {currentView === 'prescriptions' && renderPrescriptions()}
      {currentView === 'records' && renderMedicalRecords()}
      {currentView === 'profile' && renderProfile()}
    </div>
    </>
  );
};

export default PatientPortalView;
