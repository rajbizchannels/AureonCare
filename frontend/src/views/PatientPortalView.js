import React, { useState, useEffect } from 'react';
import { Calendar, FileText, User, Edit, Check, X, Lock, Trash2 } from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';
import { getTranslations } from '../config/translations';
import { useApp } from '../context/AppContext';
import ConfirmationModal from '../components/modals/ConfirmationModal';

const PatientPortalView = ({ theme, api, addNotification, user }) => {
  const { language, setLanguage, setTheme } = useApp();
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
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Appointment booking state
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    type: 'General Consultation',
    providerId: '',
    reason: ''
  });

  // Appointment editing state
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [editAppointmentData, setEditAppointmentData] = useState({
    date: '',
    time: '',
    type: '',
    providerId: '',
    reason: ''
  });
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);

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

      // Convert language code to full name for display
      const codeToNameMap = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'ar': 'Arabic'
      };
      if (parsedUser.language && codeToNameMap[parsedUser.language]) {
        parsedUser.language = codeToNameMap[parsedUser.language];
      } else if (!parsedUser.language) {
        parsedUser.language = 'English'; // Default
      }

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
      addNotification('alert', t.failedToLoadProviders);
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
      addNotification('alert', t.pleaseSelectPharmacy);
      return;
    }

    try {
      await api.addPreferredPharmacy(user.id, selectedPharmacyId, true);
      addNotification('success', t.preferredPharmacyUpdated);

      // Refresh preferred pharmacies list
      await fetchPharmacyData();

      // Show success confirmation
      setConfirmationMessage('Your preferred pharmacy has been updated successfully!');
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error adding preferred pharmacy:', error);
      addNotification('alert', t.failedToUpdatePharmacy);
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

        // Convert language code to full name for display
        const codeToNameMap = {
          'en': 'English',
          'es': 'Spanish',
          'fr': 'French',
          'de': 'German',
          'ar': 'Arabic'
        };
        if (updatedProfile.language && codeToNameMap[updatedProfile.language]) {
          updatedProfile.language = codeToNameMap[updatedProfile.language];
        } else if (!updatedProfile.language) {
          updatedProfile.language = 'English'; // Default
        }

        setProfileData(updatedProfile);
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      addNotification('alert', t.failedToLoadPatientData);
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

      addNotification('success', t.appointmentBookedSuccessfully);

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

  const handleEditAppointment = (appointment) => {
    // Parse the start_time to get date and time
    const startTime = new Date(appointment.start_time);
    const date = startTime.toISOString().split('T')[0];
    const time = startTime.toTimeString().slice(0, 5);

    setEditingAppointment(appointment);
    setEditAppointmentData({
      date: date,
      time: time,
      type: appointment.appointment_type || 'General Consultation',
      providerId: appointment.provider_id || '',
      reason: appointment.reason || ''
    });
  };

  const handleUpdateAppointment = async (e) => {
    e.preventDefault();
    try {
      // Combine date and time into start_time timestamp
      const startTime = `${editAppointmentData.date.split('T')[0]}T${editAppointmentData.time}:00`;
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + 30 * 60000); // Default 30 minutes duration

      const appointmentData = {
        startTime: startDate.toISOString().slice(0, 19).replace('T', ' '),
        endTime: endDate.toISOString().slice(0, 19).replace('T', ' '),
        appointmentType: editAppointmentData.type,
        providerId: editAppointmentData.providerId || null,
        reason: editAppointmentData.reason
      };

      await api.updatePatientAppointment(user.id, editingAppointment.id, appointmentData);

      addNotification('success', t.appointmentUpdatedSuccessfully || 'Appointment updated successfully');

      // Show success confirmation
      setConfirmationMessage('Your appointment has been updated successfully!');
      setShowConfirmation(true);

      // Reset editing state and refresh data
      setEditingAppointment(null);
      setEditAppointmentData({ date: '', time: '', type: '', providerId: '', reason: '' });
      fetchPatientData();
    } catch (error) {
      console.error('Error updating appointment:', error);
      addNotification('alert', t.failedToUpdateAppointment || 'Failed to update appointment');
    }
  };

  const handleDeleteAppointment = async () => {
    if (!appointmentToDelete) return;

    try {
      await api.deletePatientAppointment(user.id, appointmentToDelete.id);

      addNotification('success', t.appointmentDeletedSuccessfully || 'Appointment deleted successfully');

      // Show success confirmation
      setConfirmationMessage('Your appointment has been deleted successfully!');
      setShowConfirmation(true);

      // Reset state and refresh data
      setAppointmentToDelete(null);
      fetchPatientData();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      addNotification('alert', t.failedToDeleteAppointment || 'Failed to delete appointment');
      setAppointmentToDelete(null);
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
        first_name: profileData.first_name,
        last_name: profileData.last_name,
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
        current_medications: profileData.current_medications,
        language: profileData.language,
        email_notifications: profileData.email_notifications || false,
        sms_notifications: profileData.sms_notifications || false
      });

      // Convert language code to full name for display (in case backend returns code)
      const codeToNameMap = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'ar': 'Arabic'
      };
      let updatedProfile = { ...updated };
      if (updatedProfile.language && codeToNameMap[updatedProfile.language]) {
        updatedProfile.language = codeToNameMap[updatedProfile.language];
      } else if (!updatedProfile.language) {
        updatedProfile.language = profileData.language || 'English'; // Preserve the language that was set
      }

      setProfileData(updatedProfile);
      setEditingProfile(false);
      addNotification('success', t.profileUpdatedSuccessfully);

      // Update language in AppContext if it changed
      if (profileData.language) {
        const languageMap = {
          'English': 'en',
          'Spanish': 'es',
          'French': 'fr',
          'German': 'de',
          'Arabic': 'ar'
        };
        const languageCode = languageMap[profileData.language] || profileData.language;
        setLanguage(languageCode);
      }

      // Show success confirmation
      setConfirmationMessage('Your profile has been updated successfully!');
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error updating profile:', error);
      addNotification('alert', t.failedToUpdateProfile);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      addNotification('alert', t.passwordsDoNotMatch || 'Passwords do not match');
      return;
    }

    // Validate password length
    if (passwordData.newPassword.length < 6) {
      addNotification('alert', t.passwordTooShort || 'Password must be at least 6 characters');
      return;
    }

    try {
      await api.changePassword(user.id, passwordData.currentPassword, passwordData.newPassword);

      addNotification('success', t.passwordChangedSuccessfully || 'Password changed successfully');
      setShowChangePassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });

      // Show success confirmation
      setConfirmationMessage('Your password has been changed successfully!');
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error changing password:', error);
      addNotification('alert', error.response?.data?.error || t.failedToChangePassword || 'Failed to change password');
    }
  };

  const handleNotificationToggle = async (notificationType) => {
    const updatedValue = !profileData[notificationType];

    try {
      // Optimistically update UI
      setProfileData({
        ...profileData,
        [notificationType]: updatedValue
      });

      // Save to backend
      await api.updatePatient(user.id, {
        [notificationType]: updatedValue
      });

      addNotification('success', `${notificationType === 'email_notifications' ? 'Email' : 'SMS'} notifications ${updatedValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating notification preference:', error);
      // Revert on error
      setProfileData({
        ...profileData,
        [notificationType]: !updatedValue
      });
      addNotification('alert', 'Failed to update notification preference');
    }
  };

  // Dashboard View
  const renderDashboard = () => (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {t.welcomeBack}, {profileData?.first_name || user?.first_name} {profileData?.last_name || user?.last_name}!
        </h2>
        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          {t.email}: {profileData?.email || user?.email}
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
              {editingAppointment?.id === apt.id ? (
                // Edit mode
                <form onSubmit={handleUpdateAppointment} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {t.dateRequired}
                      </label>
                      <input
                        type="date"
                        value={editAppointmentData.date}
                        onChange={(e) => setEditAppointmentData({...editAppointmentData, date: e.target.value})}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {t.timeRequired}
                      </label>
                      <input
                        type="time"
                        value={editAppointmentData.time}
                        onChange={(e) => setEditAppointmentData({...editAppointmentData, time: e.target.value})}
                        required
                        className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {t.appointmentTypeRequired}
                      </label>
                      <select
                        value={editAppointmentData.type}
                        onChange={(e) => setEditAppointmentData({...editAppointmentData, type: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      >
                        <option value="General Consultation">{t.generalConsultation}</option>
                        <option value="Follow-up">{t.followUp}</option>
                        <option value="Check-up">{t.checkUp}</option>
                        <option value="Physical Exam">{t.physicalExam}</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {t.selectProvider}
                      </label>
                      <select
                        value={editAppointmentData.providerId}
                        onChange={(e) => setEditAppointmentData({...editAppointmentData, providerId: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      >
                        <option value="">{t.anyAvailableProvider}</option>
                        {providers.map(provider => (
                          <option key={provider.id} value={provider.id}>
                            Dr. {provider.firstName} {provider.lastName} {provider.specialization ? `- ${provider.specialization}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {t.reasonForVisit}
                      </label>
                      <textarea
                        value={editAppointmentData.reason}
                        onChange={(e) => setEditAppointmentData({...editAppointmentData, reason: e.target.value})}
                        placeholder={t.describeSymptoms}
                        rows="3"
                        className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-white font-medium transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      {t.saveChanges}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAppointment(null);
                        setEditAppointmentData({ date: '', time: '', type: '', providerId: '', reason: '' });
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                    >
                      <X className="w-4 h-4" />
                      {t.cancel}
                    </button>
                  </div>
                </form>
              ) : (
                // View mode
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                      {t.provider || 'Provider'}
                    </p>
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
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      apt.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                      apt.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {apt.status === 'scheduled' ? t.scheduled : apt.status}
                    </span>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleEditAppointment(apt)}
                        className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-cyan-400' : 'bg-gray-200 hover:bg-gray-300 text-cyan-600'}`}
                        title="Edit appointment"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setAppointmentToDelete(apt)}
                        className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-red-400' : 'bg-gray-200 hover:bg-gray-300 text-red-600'}`}
                        title="Delete appointment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                {t.firstName}
              </label>
              <input
                type="text"
                value={profileData.first_name || ''}
                onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.lastName}
              </label>
              <input
                type="text"
                value={profileData.last_name || ''}
                onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
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
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.streetAddress}</label>
              <input
                type="text"
                value={profileData.address_street || ''}
                onChange={(e) => setProfileData({ ...profileData, address_street: e.target.value })}
                placeholder="123 Main Street"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.city}</label>
              <input
                type="text"
                value={profileData.address_city || ''}
                onChange={(e) => setProfileData({ ...profileData, address_city: e.target.value })}
                placeholder="City"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.state}</label>
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
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.zipCode}</label>
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
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.dateOfBirth}</label>
              <input
                type="date"
                value={((profileData.date_of_birth || profileData.dob) || '').split('T')[0]}
                onChange={(e) => setProfileData({ ...profileData, date_of_birth: e.target.value, dob: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.height}</label>
              <input
                type="text"
                value={profileData.height || ''}
                onChange={(e) => setProfileData({...profileData, height: e.target.value})}
                placeholder="e.g., 5'10&quot;"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.weight}</label>
              <input
                type="text"
                value={profileData.weight || ''}
                onChange={(e) => setProfileData({...profileData, weight: e.target.value})}
                placeholder="e.g., 180 lbs"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.bloodType}</label>
              <input
                type="text"
                value={profileData.blood_type || ''}
                onChange={(e) => setProfileData({...profileData, blood_type: e.target.value})}
                placeholder="e.g., O+"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.languagePreference}</label>
              <select
                value={profileData.language || 'English'}
                onChange={(e) => setProfileData({...profileData, language: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Arabic">Arabic</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.allergies}</label>
              <textarea
                value={profileData.allergies || ''}
                onChange={(e) => setProfileData({...profileData, allergies: e.target.value})}
                placeholder="List any allergies..."
                rows="3"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div className="col-span-2">
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.pastHistory}</label>
              <textarea
                value={profileData.past_history || ''}
                onChange={(e) => setProfileData({...profileData, past_history: e.target.value})}
                placeholder="Previous medical conditions..."
                rows="3"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div className="col-span-2">
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.familyHistory}</label>
              <textarea
                value={profileData.family_history || ''}
                onChange={(e) => setProfileData({...profileData, family_history: e.target.value})}
                placeholder="Family medical history..."
                rows="3"
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div className="col-span-2">
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.currentMedications}</label>
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
          <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.personalInformation}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.firstName}</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {profileData?.first_name || user?.first_name || t.notProvided}
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.lastName}</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {profileData?.last_name || user?.last_name || t.notProvided}
              </p>
            </div>
          </div>

          <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.contactInformation}</h4>
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
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.address}</p>
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
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.dateOfBirth}</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {profileData?.date_of_birth ? formatDate(profileData.date_of_birth) : profileData?.dob ? formatDate(profileData.dob) : user?.date_of_birth ? formatDate(user.date_of_birth) : user?.dob ? formatDate(user.dob) : t.notProvided}
              </p>
            </div>
          </div>

          {/* Medical Information Section */}
          <div className={`mt-6 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.medicalInformation}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.height}</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.height || user?.height || t.notProvided}</p>
              </div>
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.weight}</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.weight || user?.weight || t.notProvided}</p>
              </div>
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.bloodType}</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.blood_type || user?.blood_type || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.allergies}</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.allergies || user?.allergies || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.pastHistory}</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.past_history || user?.past_history || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.familyHistory}</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.family_history || user?.family_history || t.notProvided}</p>
              </div>
              <div className="col-span-2">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.currentMedications}</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{profileData?.current_medications || user?.current_medications || t.notProvided}</p>
              </div>
            </div>
          </div>

          {/* Preferred Pharmacy Section */}
          <div className={`mt-6 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.preferredPharmacy}</h4>

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
                        <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">{t.primary}</span>
                      )}
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {pharmacy.addressLine1 || pharmacy.address_line1}, {pharmacy.city}, {pharmacy.state} {pharmacy.zipCode || pharmacy.zip_code}
                    </p>
                    {pharmacy.phone && (
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {t.phone}: {pharmacy.phone}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.noPreferredPharmacy}
              </p>
            )}

            {/* Change Preferred Pharmacy (shown when editing) */}
            {editingProfile && (
              <div className="space-y-3">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {preferredPharmacies.length > 0 ? t.changePreferredPharmacy : t.selectPreferredPharmacy}
                  </label>
                  <select
                    value={selectedPharmacyId}
                    onChange={(e) => setSelectedPharmacyId(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  >
                    <option value="">{t.selectPharmacyPrompt}</option>
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
                  {preferredPharmacies.length > 0 ? t.updatePreferredPharmacy : t.setPreferredPharmacy}
                </button>
              </div>
            )}
          </div>

          {/* Settings Section */}
          <div className={`mt-6 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.settings || 'Settings'}</h4>
            <div className="space-y-4">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.languagePreference || 'Language Preference'}</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {profileData?.language || user?.language || 'English'}
                </p>
              </div>

              {/* Theme Preference */}
              <div className="pt-4 border-t border-slate-600/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Theme</p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {theme === 'dark' ? t.darkMode || 'Dark Mode' : t.lightMode || 'Light Mode'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newTheme = theme === 'dark' ? 'light' : 'dark';
                      setTheme(newTheme);
                      localStorage.setItem('theme', newTheme);
                      if (editingProfile) {
                        setProfileData({
                          ...profileData,
                          theme: newTheme
                        });
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      theme === 'dark' ? 'bg-cyan-500' : 'bg-gray-300'
                    } cursor-pointer`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="pt-4 border-t border-slate-600/50">
                <div className="mb-3">
                  <h5 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.notifications || 'Notifications'}</h5>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                    Toggle to enable or disable notifications (changes save automatically)
                  </p>
                </div>

                {/* Email Notifications Toggle */}
                <div className="flex items-center justify-between mb-3">
                  <label className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.emailNotifications || 'Email Notifications'}
                  </label>
                  <button
                    onClick={() => handleNotificationToggle('email_notifications')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      profileData.email_notifications
                        ? 'bg-cyan-500'
                        : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        profileData.email_notifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* SMS Notifications Toggle */}
                <div className="flex items-center justify-between">
                  <label className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.smsAlerts || 'SMS Alerts'}
                  </label>
                  <button
                    onClick={() => handleNotificationToggle('sms_notifications')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      profileData.sms_notifications
                        ? 'bg-cyan-500'
                        : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        profileData.sms_notifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className={`mt-6 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.security || 'Security'}</h4>
              <button
                onClick={() => {
                  setShowChangePassword(!showChangePassword);
                  if (!showChangePassword) {
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  showChangePassword
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                    : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400'
                }`}
              >
                {showChangePassword ? (t.cancel || 'Cancel') : (t.changePassword || 'Change Password')}
              </button>
            </div>

            {showChangePassword && (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.currentPassword || 'Current Password'}
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${
                      theme === 'dark'
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.newPassword || 'New Password'}
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${
                      theme === 'dark'
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.confirmNewPassword || 'Confirm New Password'}
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${
                      theme === 'dark'
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                    minLength={6}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg font-medium transition-colors text-white flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  {t.updatePassword || 'Update Password'}
                </button>
              </form>
            )}

            {!showChangePassword && (
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.passwordLastChanged || 'Click "Change Password" to update your password'}
              </p>
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
        {t.myPrescriptions}
      </h2>
      {prescriptions.length === 0 ? (
        <div className={`text-center py-12 rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <FileText className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.noPrescriptionsFound}</p>
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
                    {t.dosage}: {rx.dosage}
                  </p>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.frequency}: {rx.frequency}
                  </p>
                  {rx.duration && (
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.duration}: {rx.duration}
                    </p>
                  )}
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.quantity}: {rx.quantity || t.notApplicable}
                  </p>
                  {rx.instructions && (
                    <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t.instructions}: {rx.instructions}
                    </p>
                  )}
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.refills}: {rx.refills || rx.refillsRemaining || t.notApplicable}
                  </p>
                  {(rx.pharmacyName || rx.pharmacy_name) && (
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.pharmacy}: {rx.pharmacyName || rx.pharmacy_name}
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
        {t.bookAppointmentTab}
      </h2>
      <form onSubmit={handleBookAppointment} className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              {t.dateRequired}
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
              {t.timeRequired}
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
              {t.appointmentTypeRequired}
            </label>
            <select
              value={bookingData.type}
              onChange={(e) => setBookingData({...bookingData, type: e.target.value})}
              className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              <option value="General Consultation">{t.generalConsultation}</option>
              <option value="Follow-up">{t.followUp}</option>
              <option value="Check-up">{t.checkUp}</option>
              <option value="Physical Exam">{t.physicalExam}</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              {t.selectProvider}
            </label>
            <select
              value={bookingData.providerId}
              onChange={(e) => setBookingData({...bookingData, providerId: e.target.value})}
              className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              <option value="">{t.anyAvailableProvider}</option>
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  Dr. {provider.firstName} {provider.lastName} {provider.specialization ? `- ${provider.specialization}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              {t.reasonForVisit}
            </label>
            <textarea
              value={bookingData.reason}
              onChange={(e) => setBookingData({...bookingData, reason: e.target.value})}
              placeholder={t.describeSymptoms}
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
            {t.bookAppointmentTab}
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
          >
            <X className="w-4 h-4" />
            {t.cancel}
          </button>
        </div>
      </form>
    </div>
  );

  // Main Portal Layout
  return (
    <>
      {/* Delete Appointment Confirmation Modal */}
      <ConfirmationModal
        theme={theme}
        isOpen={!!appointmentToDelete}
        onClose={() => setAppointmentToDelete(null)}
        onConfirm={handleDeleteAppointment}
        title={t.confirmDelete || "Confirm Delete"}
        message={`Are you sure you want to delete this appointment${appointmentToDelete ? ` with ${appointmentToDelete.provider_first_name ? `Dr. ${appointmentToDelete.provider_first_name} ${appointmentToDelete.provider_last_name}` : 'the provider'} on ${formatDate(appointmentToDelete.start_time)}?` : '?'}`}
        type="warning"
        confirmText={t.delete || "Delete"}
        cancelText={t.cancel || "Cancel"}
        showCancel={true}
      />

      {/* Success Confirmation Modal */}
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
          {t.bookAppointmentTab}
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
          {t.prescriptionsTab}
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
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.dosage}</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.dosage || t.notApplicable}</p>
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.frequency}</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.frequency || t.notApplicable}</p>
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.duration}</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.duration || t.notApplicable}</p>
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.quantity}</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.quantity || t.notApplicable}</p>
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.refills}</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.refills || selectedPrescription.refillsRemaining || t.notApplicable}</p>
                </div>
                {(selectedPrescription.pharmacyName || selectedPrescription.pharmacy_name) && (
                  <div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.pharmacy}</p>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.pharmacyName || selectedPrescription.pharmacy_name}</p>
                  </div>
                )}
              </div>

              {selectedPrescription.instructions && (
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.instructions}</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.instructions}</p>
                </div>
              )}

              {selectedPrescription.prescribedDate && (
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.prescribedDate}</p>
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
