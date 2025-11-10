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
  const [providers, setProviders] = useState([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState(user || {});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [pharmacies, setPharmacies] = useState([]);
  const [preferredPharmacies, setPreferredPharmacies] = useState([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState(null);

  // Appointment booking state
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    type: 'General Consultation',
    providerId: '',
    reason: ''
  });

  useEffect(() => {
    if (user) {
      // Parse address if it's a string
      let parsedUser = { ...user };
      if (user.address && typeof user.address === 'string') {
        // Try to parse address string into components
        const addressParts = user.address.split(',').map(p => p.trim());
        parsedUser.address_street = addressParts[0] || '';
        parsedUser.address_city = addressParts[1] || '';
        const stateZip = (addressParts[2] || '').split(' ');
        parsedUser.address_state = stateZip[0] || '';
        parsedUser.address_zip = stateZip[1] || '';
      }
      // Always preserve the original address field (even if null/empty)
      parsedUser.address = user.address || '';
      setProfileData(parsedUser);
      fetchPatientData();
      fetchProviders();
      fetchPharmacyData();
    }
  }, [user]);

  // Handle ESC key to close prescription modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && selectedPrescription) {
        setSelectedPrescription(null);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [selectedPrescription]);

  const fetchProviders = async () => {
    try {
      const providersList = await api.getProviders();
      setProviders(providersList);
    } catch (error) {
      console.error('Error fetching providers:', error);
      addNotification('alert', 'Failed to load providers');
    }
  };

  const fetchPharmacyData = async () => {
    try {
      // Fetch all pharmacies for selection
      const allPharmacies = await api.getPharmacies();
      setPharmacies(allPharmacies || []);

      // Fetch patient's preferred pharmacies
      if (user?.id) {
        const patientPreferred = await api.getPatientPreferredPharmacies(user.id);
        setPreferredPharmacies(patientPreferred || []);

        // Set the primary preferred pharmacy as selected
        const primary = patientPreferred?.find(p => p.isPreferred || p.is_preferred);
        if (primary) {
          setSelectedPharmacyId(primary.id || primary.pharmacyId);
        }
      }
    } catch (error) {
      console.error('Error fetching pharmacy data:', error);
      setPharmacies([]);
      setPreferredPharmacies([]);
    }
  };

  const handleAddPreferredPharmacy = async () => {
    if (!selectedPharmacyId || !user?.id) {
      addNotification('alert', 'Please select a pharmacy');
      return;
    }

    try {
      await api.addPreferredPharmacy(user.id, selectedPharmacyId, true);
      addNotification('success', 'Preferred pharmacy updated successfully');

      // Refresh preferred pharmacies list
      await fetchPharmacyData();

      // Show success confirmation
      setConfirmationMessage('Your preferred pharmacy has been updated successfully!');
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error adding preferred pharmacy:', error);
      addNotification('alert', 'Failed to update preferred pharmacy');
    }
  };

  const fetchPatientData = async () => {
    try {
      // The user object from patient portal login is the patient record itself
      const patientId = user.id;

      console.log('Fetching patient data for ID:', patientId);

      // Fetch appointments, medical records, prescriptions, and full profile for the patient
      const [appts, records, presc, profile] = await Promise.all([
        api.getAppointments().then(all => {
          console.log('All appointments:', all);
          console.log('Looking for appointments with patient_id:', patientId);

          // Filter appointments by patient_id
          const filtered = all.filter(a => {
            const appointmentPatientId = a.patient_id?.toString();
            const userPatientId = patientId?.toString();
            const matches = appointmentPatientId === userPatientId;

            console.log(`Checking appointment ${a.id}: patient_id=${appointmentPatientId} vs user.id=${userPatientId} - ${matches ? 'MATCH ✓' : 'no match'}`);

            return matches;
          });

          console.log('Filtered appointments for patient:', filtered);
          console.log(`Total: ${filtered.length} appointments found`);
          return filtered;
        }),
        api.getMedicalRecords ? api.getMedicalRecords(patientId) : Promise.resolve([]),
        api.getPatientActivePrescriptions(patientId).catch(() => []),
        api.getPatientProfile(patientId).catch(() => null)
      ]);
      setAppointments(appts);
      setMedicalRecords(records);
      setPrescriptions(presc);

      // Update profileData with the full profile from database
      if (profile) {
        let updatedProfile = { ...profile };
        // Parse address if it's a string
        if (profile.address && typeof profile.address === 'string') {
          const addressParts = profile.address.split(',').map(p => p.trim());
          updatedProfile.address_street = addressParts[0] || '';
          updatedProfile.address_city = addressParts[1] || '';
          const stateZip = (addressParts[2] || '').split(' ');
          updatedProfile.address_state = stateZip[0] || '';
          updatedProfile.address_zip = stateZip[1] || '';
        }
        updatedProfile.address = profile.address || '';
        setProfileData(updatedProfile);
      }
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
        provider_id: bookingData.providerId || null,
        start_time: startDate.toISOString().slice(0, 19).replace('T', ' '),
        end_time: endDate.toISOString().slice(0, 19).replace('T', ' '),
        duration_minutes: 30,
        appointment_type: bookingData.type,
        reason: bookingData.reason,
        status: 'Scheduled'
      };

      console.log('Booking appointment with data:', appointmentData);
      console.log('User object:', user);

      const result = await api.createAppointment(appointmentData);
      console.log('Appointment created successfully:', result);

      addNotification('success', 'Appointment booked successfully');

      // Show success confirmation
      setConfirmationMessage('Your appointment has been booked successfully!');
      setShowConfirmation(true);

      // Auto-navigate to appointments view after confirmation
      setTimeout(() => {
        setCurrentView('appointments');
        setBookingData({ date: '', time: '', type: 'General Consultation', providerId: '', reason: '' });
        fetchPatientData();
      }, 2000);
    } catch (error) {
      console.error('Error booking appointment:', error);
      console.error('Full error details:', error.response?.data);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to book appointment';
      const errorDetails = error.response?.data?.details;

      // Show detailed error message
      addNotification('alert', errorDetails ? `${errorMsg}\n${errorDetails}` : errorMsg);

      // Don't show confirmation popup on error
      setShowConfirmation(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      // Combine address fields into a single string
      const addressParts = [
        profileData.address_street,
        profileData.address_city,
        `${profileData.address_state || ''} ${profileData.address_zip || ''}`.trim()
      ].filter(part => part && part.trim());

      const combinedAddress = addressParts.join(', ');

      const updated = await api.updatePatient(user.id, {
        phone: profileData.phone,
        email: profileData.email,
        address: combinedAddress || profileData.address, // Use combined or fall back to original
        date_of_birth: profileData.date_of_birth || profileData.dob,
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
      console.error('Error updating profile:', error);
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
                    {apt.provider_first_name && apt.provider_last_name
                      ? `Dr. ${apt.provider_first_name} ${apt.provider_last_name}`
                      : apt.provider?.first_name && apt.provider?.last_name
                      ? `Dr. ${apt.provider.first_name} ${apt.provider.last_name}`
                      : apt.doctor || t.providerTBD}
                  </h3>
                  {apt.provider_specialization && (
                    <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                      {apt.provider_specialization}
                    </p>
                  )}
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
            <div className="col-span-2">
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Street Address</label>
              <input
                type="text"
                value={profileData.address_street || ''}
                onChange={(e) => setProfileData({ ...profileData, address_street: e.target.value })}
                placeholder="123 Main Street"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>City</label>
              <input
                type="text"
                value={profileData.address_city || ''}
                onChange={(e) => setProfileData({ ...profileData, address_city: e.target.value })}
                placeholder="City"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>State</label>
              <input
                type="text"
                value={profileData.address_state || ''}
                onChange={(e) => setProfileData({ ...profileData, address_state: e.target.value })}
                placeholder="State"
                maxLength="2"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>ZIP Code</label>
              <input
                type="text"
                value={profileData.address_zip || ''}
                onChange={(e) => setProfileData({ ...profileData, address_zip: e.target.value })}
                placeholder="12345"
                maxLength="10"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Date of Birth</label>
              <input
                type="date"
                value={((profileData.date_of_birth || profileData.dob) || '').split('T')[0]}
                onChange={(e) => setProfileData({ ...profileData, date_of_birth: e.target.value, dob: e.target.value })}
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
                {profileData?.email || user?.email || t.notProvided}
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.phone}</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {profileData?.phone || user?.phone || t.notProvided}
              </p>
            </div>
            <div className="col-span-2">
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Address</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {(() => {
                  // If there's a full address string, use it
                  if (profileData.address) {
                    return profileData.address;
                  }
                  // Otherwise, build from components
                  const parts = [
                    profileData.address_street,
                    profileData.address_city,
                    [profileData.address_state, profileData.address_zip].filter(Boolean).join(' ')
                  ].filter(part => part && part.trim());

                  return parts.length > 0 ? parts.join(', ') : t.notProvided;
                })()}
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Date of Birth</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {profileData?.date_of_birth ? formatDate(profileData.date_of_birth) : profileData?.dob ? formatDate(profileData.dob) : user?.date_of_birth ? formatDate(user.date_of_birth) : user?.dob ? formatDate(user.dob) : t.notProvided}
              </p>
            </div>
          </div>

          {/* Medical Information Section */}
          <div className={`mt-6 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Medical Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Height</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.height || user?.height || t.notProvided}</p>
              </div>
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Weight</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.weight || user?.weight || t.notProvided}</p>
              </div>
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Blood Type</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.blood_type || user?.blood_type || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Allergies</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.allergies || user?.allergies || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Past Medical History</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.past_history || user?.past_history || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Family Medical History</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.family_history || user?.family_history || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Current Medications</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.current_medications || user?.current_medications || t.notProvided}</p>
              </div>
            </div>
          </div>

          {/* Preferred Pharmacy Section */}
          <div className={`mt-6 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Preferred Pharmacy</h4>

            {/* Current Preferred Pharmacy */}
            {preferredPharmacies.length > 0 ? (
              <div className="space-y-2 mb-4">
                {preferredPharmacies.map((pharmacy) => (
                  <div
                    key={pharmacy.id || pharmacy.pharmacyId}
                    className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'}`}
                  >
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {pharmacy.pharmacyName || pharmacy.pharmacy_name}
                      {(pharmacy.isPreferred || pharmacy.is_preferred) && (
                        <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Primary</span>
                      )}
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {pharmacy.addressLine1 || pharmacy.address_line1}, {pharmacy.city}, {pharmacy.state} {pharmacy.zipCode || pharmacy.zip_code}
                    </p>
                    {pharmacy.phone && (
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Phone: {pharmacy.phone}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                No preferred pharmacy set.
              </p>
            )}

            {/* Change Preferred Pharmacy (shown when editing) */}
            {editingProfile && (
              <div className="space-y-3">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {preferredPharmacies.length > 0 ? 'Change Preferred Pharmacy' : 'Select Preferred Pharmacy'}
                  </label>
                  <select
                    value={selectedPharmacyId}
                    onChange={(e) => setSelectedPharmacyId(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  >
                    <option value="">Select a pharmacy...</option>
                    {pharmacies.map((pharmacy) => (
                      <option key={pharmacy.id} value={pharmacy.id}>
                        {pharmacy.pharmacyName || pharmacy.pharmacy_name} - {pharmacy.city}, {pharmacy.state}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAddPreferredPharmacy}
                  disabled={!selectedPharmacyId}
                  type="button"
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedPharmacyId
                      ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {preferredPharmacies.length > 0 ? 'Update Preferred Pharmacy' : 'Set Preferred Pharmacy'}
                </button>
              </div>
            )}
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
              onClick={() => setSelectedPrescription(rx)}
              className={`p-6 rounded-xl border cursor-pointer transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50' : 'bg-gray-100/50 border-gray-300 hover:bg-gray-200/50'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {rx.medicationName || rx.medication_name}
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
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Quantity: {rx.quantity || 'N/A'}
                  </p>
                  {rx.instructions && (
                    <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Instructions: {rx.instructions}
                    </p>
                  )}
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Refills: {rx.refills || rx.refillsRemaining || 'N/A'}
                  </p>
                  {(rx.pharmacyName || rx.pharmacy_name) && (
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      Pharmacy: {rx.pharmacyName || rx.pharmacy_name}
                    </p>
                  )}
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
              Select Provider
            </label>
            <select
              value={bookingData.providerId}
              onChange={(e) => setBookingData({...bookingData, providerId: e.target.value})}
              className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              <option value="">Any Available Provider</option>
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  Dr. {provider.firstName} {provider.lastName} {provider.specialization ? `- ${provider.specialization}` : ''}
                </option>
              ))}
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

      {/* Prescription Details Modal */}
      {selectedPrescription && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedPrescription(null)}>
          <div
            className={`max-w-2xl w-full rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {selectedPrescription.medicationName || selectedPrescription.medication_name}
                </h3>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                  selectedPrescription.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {selectedPrescription.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedPrescription(null)}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Dosage</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.dosage || 'N/A'}</p>
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Frequency</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.frequency || 'N/A'}</p>
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Duration</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.duration || 'N/A'}</p>
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Quantity</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.quantity || 'N/A'}</p>
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Refills</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.refills || selectedPrescription.refillsRemaining || 'N/A'}</p>
                </div>
                {(selectedPrescription.pharmacyName || selectedPrescription.pharmacy_name) && (
                  <div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Pharmacy</p>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.pharmacyName || selectedPrescription.pharmacy_name}</p>
                  </div>
                )}
              </div>

              {selectedPrescription.instructions && (
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Instructions</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.instructions}</p>
                </div>
              )}

              {selectedPrescription.prescribedDate && (
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Prescribed Date</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatDate(selectedPrescription.prescribedDate || selectedPrescription.prescribed_date)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default PatientPortalView;
