import React, { useState, useEffect } from 'react';
import { Calendar, FileText, User, Edit, Check, X, Lock, Trash2, XCircle, Upload, Printer, MessageCircle } from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';
import { getTranslations } from '../config/translations';
import { useApp } from '../context/AppContext';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import MedicalRecordUploadForm from '../components/forms/MedicalRecordUploadForm';

const PatientPortalView = ({ theme, api, addNotification, user }) => {
  const { language, setLanguage, setTheme } = useApp();
  const t = getTranslations(language);
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, appointments, records, profile, prescriptions, bookAppointment, payments

  // Data states
  const [appointments, setAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providersError, setProvidersError] = useState(null);
  const [appointmentTypes, setAppointmentTypes] = useState([]);
  const [loadingAppointmentTypes, setLoadingAppointmentTypes] = useState(false);
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
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
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(true);
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState('');

  // Appointment booking state
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    type: 'General Consultation',
    providerId: '',
    reason: ''
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Appointment editing state
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [editAppointmentData, setEditAppointmentData] = useState({
    date: '',
    time: '',
    type: '',
    providerId: '',
    reason: ''
  });
  const [editAvailableSlots, setEditAvailableSlots] = useState([]);
  const [loadingEditSlots, setLoadingEditSlots] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editRecordData, setEditRecordData] = useState({ title: '', description: '', providerId: '' });

  useEffect(() => {
    if (user) {
      // Initialize profile data from user
      let parsedUser = { ...user };

      // Always preserve the original address field (even if null/empty)
      parsedUser.address = user.address || '';

      // Ensure country is preserved
      parsedUser.country = user.country || '';

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
      fetchWaitlist();
    }
    // Fetch appointment types on component mount (doesn't require user)
    fetchAppointmentTypes();
    // Load WhatsApp preference
    loadWhatsAppPreference();
  }, [user]);

  // Load WhatsApp notification preference
  const loadWhatsAppPreference = async () => {
    if (user && user.id) {
      try {
        const preferences = await api.getNotificationPreferences(user.id);
        const whatsappPref = preferences.find(p => p.channel_type === 'whatsapp');
        if (whatsappPref) {
          setWhatsappEnabled(whatsappPref.is_enabled);
          setWhatsappPhoneNumber(whatsappPref.contact_info || user.phone || '');
        } else {
          // Default to user's phone number if no preference exists
          setWhatsappPhoneNumber(user.phone || '');
        }
      } catch (error) {
        console.error('Error loading WhatsApp preference:', error);
        // Default to user's phone number on error
        setWhatsappPhoneNumber(user.phone || '');
      } finally {
        setLoadingWhatsApp(false);
      }
    } else {
      setLoadingWhatsApp(false);
    }
  };

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
    setLoadingProviders(true);
    setProvidersError(null);
    try {
      console.log('Fetching providers for patient portal...');
      console.log('User data:', { id: user?.id, role: user?.role });

      // Ensure user is in localStorage for authentication
      if (user && user.id) {
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        throw new Error('User not authenticated');
      }

      const providersList = await api.getProviders();
      console.log('Providers loaded:', providersList?.length || 0);
      setProviders(providersList || []);
      if (!providersList || providersList.length === 0) {
        setProvidersError('No providers available');
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
      const errorMsg = error.message || 'Failed to load providers';
      setProvidersError(errorMsg);
      addNotification('alert', t.failedToLoadProviders || errorMsg);
    } finally {
      setLoadingProviders(false);
    }
  };

  const fetchAppointmentTypes = async () => {
    setLoadingAppointmentTypes(true);
    try {
      const types = await api.getAppointmentTypes();
      setAppointmentTypes(types || []);
      // Set default type if types are loaded and current type is default
      if (types && types.length > 0 && bookingData.type === 'General Consultation') {
        const defaultType = types.find(t => t.name === 'General Consultation') || types[0];
        setBookingData(prev => ({ ...prev, type: defaultType.name }));
      }
    } catch (error) {
      console.error('Error fetching appointment types:', error);
      // Fallback to default types if API fails
      setAppointmentTypes([
        { id: 1, name: 'General Consultation' },
        { id: 2, name: 'Follow-up' },
        { id: 3, name: 'Check-up' },
        { id: 4, name: 'Physical Exam' }
      ]);
    } finally {
      setLoadingAppointmentTypes(false);
    }
  };

  const fetchWaitlist = async () => {
    setLoadingWaitlist(true);
    try {
      const entries = await api.getMyWaitlist();
      setWaitlistEntries(entries || []);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    } finally {
      setLoadingWaitlist(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!bookingData.date || !bookingData.providerId) {
      addNotification('alert', 'Please select a date and provider first');
      return;
    }

    try {
      const result = await api.addToWaitlist({
        providerId: bookingData.providerId,
        preferredDate: bookingData.date,
        appointmentType: bookingData.type,
        reason: bookingData.reason
      });

      addNotification('success', result.message || 'Added to waitlist successfully!');
      fetchWaitlist();

      // Optionally reset form
      setBookingData({ date: '', time: '', type: appointmentTypes[0]?.name || 'General Consultation', providerId: '', reason: '' });
      setAvailableSlots([]);
    } catch (error) {
      console.error('Error joining waitlist:', error);
      addNotification('alert', error.message || 'Failed to join waitlist');
    }
  };

  const handleRemoveFromWaitlist = async (id) => {
    try {
      const result = await api.removeFromWaitlist(id);
      addNotification('success', result.message || 'Removed from waitlist');
      fetchWaitlist();
    } catch (error) {
      console.error('Error removing from waitlist:', error);
      addNotification('alert', error.message || 'Failed to remove from waitlist');
    }
  };

  const fetchAvailableSlots = async (providerId, date) => {
    if (!providerId || !date) {
      setAvailableSlots([]);
      return;
    }

    setLoadingSlots(true);
    try {
      const response = await fetch(`/api/scheduling/slots/${providerId}?date=${date}`);
      if (response.ok) {
        const slots = await response.json();
        setAvailableSlots(slots);
      } else {
        console.error('Failed to fetch available slots');
        setAvailableSlots([]);
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Fetch available slots when provider or date changes (booking)
  useEffect(() => {
    if (bookingData.providerId && bookingData.date) {
      fetchAvailableSlots(bookingData.providerId, bookingData.date);
    } else {
      setAvailableSlots([]);
    }
  }, [bookingData.providerId, bookingData.date]);

  // Fetch available slots when provider or date changes (editing)
  useEffect(() => {
    if (editingAppointment && editAppointmentData.providerId && editAppointmentData.date) {
      fetchEditAvailableSlots(editAppointmentData.providerId, editAppointmentData.date);
    } else {
      setEditAvailableSlots([]);
    }
  }, [editAppointmentData.providerId, editAppointmentData.date, editingAppointment]);

  const fetchEditAvailableSlots = async (providerId, date) => {
    if (!providerId || !date) {
      setEditAvailableSlots([]);
      return;
    }

    setLoadingEditSlots(true);
    try {
      const response = await fetch(`/api/scheduling/slots/${providerId}?date=${date}`);
      if (response.ok) {
        const slots = await response.json();
        setEditAvailableSlots(slots);
      } else {
        console.error('Failed to fetch available slots for editing');
        setEditAvailableSlots([]);
      }
    } catch (error) {
      console.error('Error fetching available slots for editing:', error);
      setEditAvailableSlots([]);
    } finally {
      setLoadingEditSlots(false);
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
          setSelectedPharmacyId(primary.pharmacy_id || primary.pharmacyId || primary.id);
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

  const fetchMedicalRecords = async () => {
    try {
      const patientId = user.id;
      const records = await (api.getMedicalRecords ? api.getMedicalRecords(patientId) : Promise.resolve([]));
      setMedicalRecords(records);
    } catch (error) {
      console.error('Error fetching medical records:', error);
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

        // Ensure country is preserved
        updatedProfile.country = profile.country || '';

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
      // Format date and time without timezone conversion
      // User selects local time, we should send exactly what they selected
      const dateStr = bookingData.date.split('T')[0]; // YYYY-MM-DD
      const timeStr = bookingData.time; // HH:MM
      const startTimeStr = `${dateStr} ${timeStr}:00`; // YYYY-MM-DD HH:MM:SS

      // Calculate end time (30 minutes later) without timezone conversion
      const [hours, minutes] = timeStr.split(':').map(Number);
      const endMinutes = minutes + 30;
      const endHours = hours + Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const endTimeStr = `${dateStr} ${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;

      const appointmentData = {
        // Send the user's id as both patient_id and user_id for backend to resolve
        patient_id: user.id,
        user_id: user.id,
        provider_id: bookingData.providerId || null,
        start_time: startTimeStr,
        end_time: endTimeStr,
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
    // Prevent editing canceled or completed appointments
    if (appointment.status === 'cancelled' || appointment.status === 'canceled') {
      addNotification('alert', 'Cannot edit a cancelled appointment');
      return;
    }
    if (appointment.status === 'completed') {
      addNotification('alert', 'Cannot edit a completed appointment');
      return;
    }

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
      // Format date and time without timezone conversion
      // User selects local time, we should send exactly what they selected
      const dateStr = editAppointmentData.date.split('T')[0]; // YYYY-MM-DD
      const timeStr = editAppointmentData.time; // HH:MM
      const startTimeStr = `${dateStr} ${timeStr}:00`; // YYYY-MM-DD HH:MM:SS

      // Calculate end time (30 minutes later) without timezone conversion
      const [hours, minutes] = timeStr.split(':').map(Number);
      const endMinutes = minutes + 30;
      const endHours = hours + Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const endTimeStr = `${dateStr} ${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;

      const appointmentData = {
        startTime: startTimeStr,
        endTime: endTimeStr,
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
      setEditAvailableSlots([]);
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

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;

    try {
      const response = await fetch(`/api/patient-portal/${user.id}/medical-records/${recordToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete record');
      }

      addNotification('success', 'Medical record deleted successfully');
      setRecordToDelete(null);
      fetchMedicalRecords();
    } catch (error) {
      console.error('Error deleting medical record:', error);
      addNotification('alert', 'Failed to delete medical record');
      setRecordToDelete(null);
    }
  };

  const handleUpdateRecord = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;

    try {
      const response = await fetch(`/api/patient-portal/${user.id}/medical-records/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editRecordData.title,
          description: editRecordData.description,
          providerId: editRecordData.providerId || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update record');
      }

      addNotification('success', 'Medical record updated successfully');
      setEditingRecord(null);
      setEditRecordData({ title: '', description: '', providerId: '' });
      fetchMedicalRecords();
    } catch (error) {
      console.error('Error updating medical record:', error);
      addNotification('alert', 'Failed to update medical record');
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointmentToCancel) return;

    try {
      const response = await fetch(`/api/scheduling/cancel/${appointmentToCancel.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancellationReason: cancellationReason || 'Patient cancelled',
          cancelledBy: user.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel appointment');
      }

      const result = await response.json();

      addNotification('success', result.message || 'Appointment cancelled successfully');

      // Show success confirmation
      setConfirmationMessage('Your appointment has been cancelled successfully!');
      setShowConfirmation(true);

      // Reset state and refresh data
      setAppointmentToCancel(null);
      setCancellationReason('');
      fetchPatientData();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      addNotification('alert', error.message || 'Failed to cancel appointment');
      setAppointmentToCancel(null);
      setCancellationReason('');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const updated = await api.updatePatient(user.id, {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        phone: profileData.phone,
        email: profileData.email,
        address: profileData.address,
        date_of_birth: profileData.date_of_birth || profileData.dob,
        height: profileData.height,
        weight: profileData.weight,
        blood_type: profileData.blood_type,
        allergies: profileData.allergies,
        past_history: profileData.past_history,
        family_history: profileData.family_history,
        current_medications: profileData.current_medications,
        language: profileData.language,
        country: profileData.country,
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

      // Ensure country is preserved - use the value we just sent if backend doesn't return it
      if (!updatedProfile.country) {
        updatedProfile.country = profileData.country || '';
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

      // Refresh profile data from database to ensure all fields are up to date
      await fetchPatientData();

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

  const handleWhatsAppToggle = async () => {
    const newValue = !whatsappEnabled;
    setWhatsappEnabled(newValue);

    try {
      await api.updateNotificationPreference(user.id, 'whatsapp', newValue, whatsappPhoneNumber);
      addNotification('success', `WhatsApp notifications ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating WhatsApp preference:', error);
      setWhatsappEnabled(!newValue); // Revert on error
      addNotification('alert', 'Failed to update WhatsApp preference');
    }
  };

  const handleWhatsAppPhoneUpdate = async () => {
    try {
      await api.updateNotificationPreference(user.id, 'whatsapp', whatsappEnabled, whatsappPhoneNumber);
      addNotification('success', 'WhatsApp phone number updated');
    } catch (error) {
      console.error('Error updating WhatsApp phone:', error);
      addNotification('alert', 'Failed to update WhatsApp phone number');
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
                        onChange={(e) => setEditAppointmentData({...editAppointmentData, date: e.target.value, providerId: '', time: ''})}
                        required
                        min={new Date().toISOString().split('T')[0]}
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
                        {appointmentTypes.map(type => (
                          <option key={type.id} value={type.name}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Provider Selection - shown after date */}
                  {editAppointmentData.date && (
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {t.selectProvider}
                      </label>
                      {loadingProviders ? (
                        <div className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                          Loading providers...
                        </div>
                      ) : providersError ? (
                        <div className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-red-900/20 border-red-700 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>
                          {providersError}
                        </div>
                      ) : (
                        <select
                          value={editAppointmentData.providerId}
                          onChange={(e) => setEditAppointmentData({...editAppointmentData, providerId: e.target.value, time: ''})}
                          required
                          className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        >
                          <option value="">Select a provider</option>
                          {providers.map(provider => (
                            <option key={provider.id} value={provider.id}>
                              Dr. {provider.firstName || provider.first_name} {provider.lastName || provider.last_name} {(provider.specialization || provider.specialty) ? `- ${provider.specialization || provider.specialty}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Time Slot Selection - shown after provider */}
                  {editAppointmentData.providerId && editAppointmentData.date && (
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {t.timeRequired}
                      </label>
                      {loadingEditSlots ? (
                        <div className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                          Loading available times...
                        </div>
                      ) : editAvailableSlots.length > 0 ? (
                        <select
                          value={editAppointmentData.time}
                          onChange={(e) => setEditAppointmentData({...editAppointmentData, time: e.target.value})}
                          required
                          className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        >
                          <option value="">Select a time slot</option>
                          {editAvailableSlots.map((slot, index) => {
                            const startTime = new Date(slot.startTime);
                            const timeString = startTime.toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            });
                            const isoTime = startTime.toTimeString().substring(0, 5);
                            return (
                              <option key={index} value={isoTime}>
                                {timeString}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <div className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>
                          No available time slots for this date. Please select a different date or provider.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reason for Visit */}
                  <div>
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
                        setEditAvailableSlots([]);
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
                      apt.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {apt.status === 'scheduled' ? t.scheduled :
                       apt.status === 'cancelled' ? 'Cancelled' :
                       apt.status === 'completed' ? 'Completed' :
                       apt.status}
                    </span>
                    <div className="flex gap-2 mt-2">
                      {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                        <button
                          onClick={() => handleEditAppointment(apt)}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-cyan-400' : 'bg-gray-200 hover:bg-gray-300 text-cyan-600'}`}
                          title="Edit appointment"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                        <button
                          onClick={() => setAppointmentToCancel(apt)}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-orange-400' : 'bg-gray-200 hover:bg-gray-300 text-orange-600'}`}
                          title="Cancel appointment"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Waitlist Entries */}
      {waitlistEntries.length > 0 && (
        <div className="mt-8">
          <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Waitlist Requests
          </h3>
          <div className="space-y-3">
            {waitlistEntries.map((entry) => (
              <div
                key={entry.id}
                className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-orange-50/50 border-orange-200'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.status === 'active' ? 'bg-orange-500/20 text-orange-400' :
                        entry.status === 'notified' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {entry.status === 'active' ? 'Waiting' :
                         entry.status === 'notified' ? 'Notified' :
                         entry.status}
                      </span>
                    </div>
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {entry.providerFirstName && entry.providerLastName
                        ? `Dr. ${entry.providerFirstName} ${entry.providerLastName}`
                        : 'Any Available Provider'}
                    </p>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      Preferred Date: {formatDate(entry.preferredDate)}
                    </p>
                    {entry.appointmentType && (
                      <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Type: {entry.appointmentType}
                      </p>
                    )}
                    {entry.notifiedAt && (
                      <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                        Notified: {formatDate(entry.notifiedAt)}
                      </p>
                    )}
                  </div>
                  {entry.status === 'active' && (
                    <button
                      onClick={() => handleRemoveFromWaitlist(entry.id)}
                      className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-red-400' : 'bg-white hover:bg-gray-100 text-red-600'}`}
                      title="Remove from waitlist"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Medical Records View
  const renderMedicalRecords = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {t.medicalRecords}
        </h2>
        {!showUploadForm && (
          <button
            onClick={() => setShowUploadForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Record
          </button>
        )}
      </div>

      {showUploadForm && (
        <MedicalRecordUploadForm
          patientId={user.id}
          theme={theme}
          providers={providers}
          onSuccess={(record) => {
            setShowUploadForm(false);
            fetchMedicalRecords();
            addNotification('success', 'Medical record uploaded successfully!');
          }}
          onCancel={() => setShowUploadForm(false)}
        />
      )}

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
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {record.title || record.record_type}
                  </h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingRecord(record);
                      setEditRecordData({
                        title: record.title || '',
                        description: record.description || '',
                        providerId: record.provider?.id || '',
                      });
                    }}
                    className={`p-2 rounded-lg hover:bg-blue-100 transition-colors ${theme === 'dark' ? 'hover:bg-blue-900/20' : ''}`}
                    title="Edit record"
                  >
                    <Edit className="w-5 h-5 text-blue-500" />
                  </button>
                  <button
                    onClick={() => setRecordToDelete(record)}
                    className={`p-2 rounded-lg hover:bg-red-100 transition-colors ${theme === 'dark' ? 'hover:bg-red-900/20' : ''}`}
                    title="Delete record"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
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
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.address || 'Address'}</label>
              <textarea
                value={profileData.address || ''}
                onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                placeholder="Enter your full address"
                rows="3"
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
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Country</label>
              <select
                value={profileData.country || ''}
                onChange={(e) => setProfileData({...profileData, country: e.target.value})}
                className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                <option value="">Select Country</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="ES">Spain</option>
                <option value="IT">Italy</option>
                <option value="NL">Netherlands</option>
                <option value="BE">Belgium</option>
                <option value="CH">Switzerland</option>
                <option value="AT">Austria</option>
                <option value="SE">Sweden</option>
                <option value="NO">Norway</option>
                <option value="DK">Denmark</option>
                <option value="FI">Finland</option>
                <option value="IE">Ireland</option>
                <option value="PT">Portugal</option>
                <option value="PL">Poland</option>
                <option value="CZ">Czech Republic</option>
                <option value="GR">Greece</option>
                <option value="JP">Japan</option>
                <option value="CN">China</option>
                <option value="IN">India</option>
                <option value="BR">Brazil</option>
                <option value="MX">Mexico</option>
                <option value="AR">Argentina</option>
                <option value="ZA">South Africa</option>
                <option value="NZ">New Zealand</option>
                <option value="SG">Singapore</option>
                <option value="HK">Hong Kong</option>
                <option value="KR">South Korea</option>
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

          {/* Preferred Pharmacy Section */}
          <div className="mt-6 pt-6 border-t border-slate-600/50">
            <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.preferredPharmacy || 'Preferred Pharmacy'}</h4>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  {t.selectPharmacy || 'Select Pharmacy'}
                </label>
                <select
                  value={selectedPharmacyId}
                  onChange={(e) => setSelectedPharmacyId(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="">Select a pharmacy</option>
                  {pharmacies.map((pharmacy) => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.pharmacyName || pharmacy.name || pharmacy.chain_name} - {pharmacy.address}
                    </option>
                  ))}
                </select>
              </div>
              {selectedPharmacyId && (
                <button
                  type="button"
                  onClick={handleAddPreferredPharmacy}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                      : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                  }`}
                >
                  {preferredPharmacies.length > 0 ? t.updatePreferredPharmacy || 'Update Preferred Pharmacy' : t.setPreferredPharmacy || 'Set Preferred Pharmacy'}
                </button>
              )}
              {preferredPharmacies.length > 0 && (
                <div className="mt-4">
                  <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Current Preferred Pharmacy:</p>
                  {preferredPharmacies.map((pp) => {
                    const pharmacy = pharmacies.find(p => p.id === pp.pharmacy_id);
                    return pharmacy ? (
                      <div key={pp.id} className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{pharmacy.pharmacyName || pharmacy.name || pharmacy.chain_name}</p>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{pharmacy.address}</p>
                        {pharmacy.phone && <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{pharmacy.phone}</p>}
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Settings Section */}
          <div className="mt-6 pt-6 border-t border-slate-600/50">
            <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.settings || 'Settings'}</h4>

            {/* Notification Preferences */}
            <div className="space-y-3 mb-4">
              <h5 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.notifications || 'Notifications'}</h5>

              {/* Email Notifications Toggle */}
              <div className="flex items-center justify-between">
                <label className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {t.emailNotifications || 'Email Notifications'}
                </label>
                <button
                  type="button"
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
                  type="button"
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

              {/* WhatsApp Notifications Toggle */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-green-500" />
                    <label className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t.whatsappNotifications || 'WhatsApp Notifications'}
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={loadingWhatsApp}
                    onClick={handleWhatsAppToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      whatsappEnabled
                        ? 'bg-green-500'
                        : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                    } ${loadingWhatsApp ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        whatsappEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {whatsappEnabled && (
                  <div className="ml-6 animate-fadeIn">
                    <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.whatsappPhoneNumber || 'WhatsApp Phone Number'}
                    </label>
                    <input
                      type="tel"
                      value={whatsappPhoneNumber}
                      onChange={(e) => setWhatsappPhoneNumber(e.target.value)}
                      onBlur={handleWhatsAppPhoneUpdate}
                      placeholder="+1 (555) 123-4567"
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                        theme === 'dark'
                          ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="mt-6 pt-6 border-t border-slate-600/50">
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.security || 'Security'}</h4>
              <button
                type="button"
                onClick={() => {
                  setShowChangePassword(!showChangePassword);
                  if (!showChangePassword) {
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }
                }}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  showChangePassword
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                    : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400'
                }`}
              >
                {showChangePassword ? (t.cancel || 'Cancel') : (t.changePassword || 'Change Password')}
              </button>
            </div>

            {showChangePassword && (
              <div className="space-y-4 mb-4">
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
                    minLength={6}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg font-medium transition-colors text-white flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  {t.updatePassword || 'Update Password'}
                </button>
              </div>
            )}
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
                {profileData?.address || user?.address || t.notProvided}
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Country</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {(() => {
                  const countryMap = {
                    'US': 'United States',
                    'CA': 'Canada',
                    'GB': 'United Kingdom',
                    'AU': 'Australia',
                    'DE': 'Germany',
                    'FR': 'France',
                    'ES': 'Spain',
                    'IT': 'Italy',
                    'NL': 'Netherlands',
                    'BE': 'Belgium',
                    'CH': 'Switzerland',
                    'AT': 'Austria',
                    'SE': 'Sweden',
                    'NO': 'Norway',
                    'DK': 'Denmark',
                    'FI': 'Finland',
                    'IE': 'Ireland',
                    'PT': 'Portugal',
                    'PL': 'Poland',
                    'CZ': 'Czech Republic',
                    'GR': 'Greece',
                    'JP': 'Japan',
                    'CN': 'China',
                    'IN': 'India',
                    'BR': 'Brazil',
                    'MX': 'Mexico',
                    'AR': 'Argentina',
                    'ZA': 'South Africa',
                    'NZ': 'New Zealand',
                    'SG': 'Singapore',
                    'HK': 'Hong Kong',
                    'KR': 'South Korea'
                  };
                  const country = profileData?.country || user?.country;
                  return country ? (countryMap[country] || country) : t.notProvided;
                })()}
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.languagePreference || 'Language'}</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {profileData?.language || user?.language || t.notProvided}
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
        </div>
      )}
    </div>
  );

  // Print prescription handler
  const handlePrintPrescription = (rx) => {
    console.log('[PatientPortal] Printing prescription:', rx);

    // Create a print-friendly HTML document
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      addNotification('alert', 'Pop-up blocked. Please allow pop-ups to print prescriptions.');
      return;
    }

    const patientName = `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim();
    const providerName = rx.providerFirstName && rx.providerLastName
      ? `Dr. ${rx.providerFirstName} ${rx.providerLastName}`
      : rx.providerName
      ? `Dr. ${rx.providerName}`
      : 'N/A';
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const prescribedDate = rx.prescribedDate || rx.prescribed_date
      ? new Date(rx.prescribedDate || rx.prescribed_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : currentDate;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prescription - ${patientName}</title>
          <style>
            @page {
              size: letter;
              margin: 0.5in;
            }

            body {
              font-family: 'Arial', 'Helvetica', sans-serif;
              margin: 0;
              padding: 20px;
              color: #000;
              background: #fff;
              font-size: 12pt;
            }

            .prescription-container {
              max-width: 7.5in;
              margin: 0 auto;
              border: 2px solid #000;
              padding: 30px;
            }

            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
              margin-bottom: 20px;
            }

            .header h1 {
              margin: 0 0 10px 0;
              font-size: 24pt;
              font-weight: bold;
            }

            .header p {
              margin: 5px 0;
              font-size: 11pt;
            }

            .section {
              margin: 20px 0;
              padding: 15px;
              border: 1px solid #ccc;
              background: #f9f9f9;
            }

            .section-title {
              font-weight: bold;
              font-size: 14pt;
              margin-bottom: 10px;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
            }

            .info-row {
              display: flex;
              margin: 8px 0;
              padding: 5px 0;
            }

            .info-label {
              font-weight: bold;
              width: 150px;
              flex-shrink: 0;
            }

            .info-value {
              flex: 1;
            }

            .medication-box {
              background: #fff;
              border: 2px solid #000;
              padding: 20px;
              margin: 20px 0;
              font-size: 13pt;
            }

            .rx-symbol {
              font-size: 36pt;
              font-weight: bold;
              margin-bottom: 10px;
            }

            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #000;
              font-size: 10pt;
            }

            .signature-line {
              margin-top: 40px;
              border-top: 2px solid #000;
              width: 300px;
              padding-top: 10px;
            }

            .status-badge {
              display: inline-block;
              padding: 5px 10px;
              border-radius: 15px;
              font-size: 10pt;
              font-weight: bold;
              margin-top: 10px;
            }

            .status-active {
              background: #e8f5e9;
              color: #2e7d32;
            }

            .status-inactive {
              background: #f5f5f5;
              color: #666;
            }

            @media print {
              body {
                padding: 0;
              }

              .prescription-container {
                border: none;
              }

              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="prescription-container">
            <div class="header">
              <h1>℞ PRESCRIPTION</h1>
              <p><strong>Date Prescribed:</strong> ${prescribedDate}</p>
              <p><strong>Printed:</strong> ${currentDate}</p>
            </div>

            <div class="section">
              <div class="section-title">Patient Information</div>
              <div class="info-row">
                <span class="info-label">Patient Name:</span>
                <span class="info-value">${patientName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Date of Birth:</span>
                <span class="info-value">${user.dateOfBirth || user.date_of_birth || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Address:</span>
                <span class="info-value">${user.address || user.addressLine1 || 'N/A'}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Prescriber Information</div>
              <div class="info-row">
                <span class="info-label">Prescriber:</span>
                <span class="info-value">${providerName}</span>
              </div>
              ${rx.providerSpecialization ? `
              <div class="info-row">
                <span class="info-label">Specialization:</span>
                <span class="info-value">${rx.providerSpecialization}</span>
              </div>
              ` : ''}
            </div>

            <div class="medication-box">
              <div class="rx-symbol">℞</div>
              <div class="info-row">
                <span class="info-label">Medication:</span>
                <span class="info-value"><strong>${rx.medicationName || rx.medication_name || 'N/A'}</strong></span>
              </div>
              ${rx.ndcCode || rx.ndc_code ? `
              <div class="info-row">
                <span class="info-label">NDC Code:</span>
                <span class="info-value">${rx.ndcCode || rx.ndc_code}</span>
              </div>
              ` : ''}
              <div class="info-row">
                <span class="info-label">Dosage:</span>
                <span class="info-value"><strong>${rx.dosage || 'N/A'}</strong></span>
              </div>
              <div class="info-row">
                <span class="info-label">Frequency:</span>
                <span class="info-value"><strong>${rx.frequency || 'N/A'}</strong></span>
              </div>
              ${rx.duration ? `
              <div class="info-row">
                <span class="info-label">Duration:</span>
                <span class="info-value"><strong>${rx.duration}</strong></span>
              </div>
              ` : ''}
              <div class="info-row">
                <span class="info-label">Quantity:</span>
                <span class="info-value"><strong>${rx.quantity || 'N/A'}</strong></span>
              </div>
              <div class="info-row">
                <span class="info-label">Refills:</span>
                <span class="info-value"><strong>${rx.refills || rx.refillsRemaining || 0}</strong></span>
              </div>
              ${rx.instructions ? `
              <div class="info-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc;">
                <span class="info-label">Instructions:</span>
                <span class="info-value">${rx.instructions}</span>
              </div>
              ` : ''}
              ${rx.substitutionAllowed !== undefined ? `
              <div class="info-row" style="margin-top: 10px;">
                <span class="info-label">Generic Substitution:</span>
                <span class="info-value">${rx.substitutionAllowed || rx.substitution_allowed ? 'Allowed' : 'Not Allowed (Dispense as Written)'}</span>
              </div>
              ` : ''}
            </div>

            ${rx.pharmacyName || rx.pharmacy_name ? `
            <div class="section">
              <div class="section-title">Pharmacy Information</div>
              <div class="info-row">
                <span class="info-label">Pharmacy Name:</span>
                <span class="info-value">${rx.pharmacyName || rx.pharmacy_name}</span>
              </div>
              ${rx.pharmacyAddress ? `
              <div class="info-row">
                <span class="info-label">Address:</span>
                <span class="info-value">${rx.pharmacyAddress}</span>
              </div>
              ` : ''}
              ${rx.pharmacyPhone ? `
              <div class="info-row">
                <span class="info-label">Phone:</span>
                <span class="info-value">${rx.pharmacyPhone}</span>
              </div>
              ` : ''}
            </div>
            ` : ''}

            <div class="signature-line">
              <strong>Provider Signature</strong>
            </div>

            <div class="footer">
              <div class="status-badge ${rx.status === 'Active' ? 'status-active' : 'status-inactive'}">
                Status: ${rx.status || 'N/A'}
              </div>
              <p style="margin: 15px 0 5px 0; font-size: 9pt; color: #666;">
                <strong>Note:</strong> This prescription is valid for ${rx.refills || rx.refillsRemaining || 0} refill(s).
                Contact your healthcare provider if you have any questions or concerns about this medication.
              </p>
              <p style="margin: 5px 0; font-size: 8pt; color: #999;">
                This is a printed copy of your prescription. Please present this to your pharmacy as needed.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      // Close window after printing (optional - user may want to keep it open)
      // printWindow.close();
    };

    console.log('[PatientPortal] Print window opened successfully');
  };

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
                  {(rx.providerFirstName || rx.providerLastName || rx.providerName) && (
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                      {t.prescribedBy || 'Prescribed by'}: Dr. {rx.providerFirstName && rx.providerLastName ? `${rx.providerFirstName} ${rx.providerLastName}` : rx.providerName}
                      {rx.providerSpecialization && ` (${rx.providerSpecialization})`}
                    </p>
                  )}
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
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    rx.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {rx.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintPrescription(rx);
                    }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                    title="Print Prescription"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="text-xs font-medium">Print</span>
                  </button>
                </div>
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
        <div className="space-y-4">
          {/* Step 1: Date Selection */}
          <div>
            <label className={`block text-sm mb-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              1. {t.dateRequired}
            </label>
            <input
              type="date"
              value={bookingData.date}
              onChange={(e) => setBookingData({...bookingData, date: e.target.value, providerId: '', time: ''})}
              required
              min={new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>

          {/* Step 2: Provider Selection (only after date is selected) */}
          {bookingData.date && (
            <div>
              <label className={`block text-sm mb-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                2. {t.selectProvider}
              </label>
              {loadingProviders ? (
                <div className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                  Loading providers...
                </div>
              ) : providersError ? (
                <div className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-red-900/20 border-red-700 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>
                  {providersError}. Please refresh the page or contact support.
                </div>
              ) : (
                <select
                  value={bookingData.providerId}
                  onChange={(e) => setBookingData({...bookingData, providerId: e.target.value, time: ''})}
                  required
                  className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="">Select a provider</option>
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      Dr. {provider.firstName || provider.first_name} {provider.lastName || provider.last_name} {(provider.specialization || provider.specialty) ? `- ${provider.specialization || provider.specialty}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Step 3: Time Slot Selection (only after provider is selected) */}
          {bookingData.providerId && bookingData.date && (
            <div>
              <label className={`block text-sm mb-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                3. {t.timeRequired}
              </label>
              {loadingSlots ? (
                <div className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                  Loading available times...
                </div>
              ) : availableSlots.length > 0 ? (
                <select
                  value={bookingData.time}
                  onChange={(e) => setBookingData({...bookingData, time: e.target.value})}
                  required
                  className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="">Select a time slot</option>
                  {availableSlots.map((slot, index) => {
                    const startTime = new Date(slot.startTime);
                    const timeString = startTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });
                    const isoTime = startTime.toTimeString().substring(0, 5);
                    return (
                      <option key={index} value={isoTime}>
                        {timeString}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="space-y-3">
                  <div className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>
                    No available time slots for this date. Please select a different date or provider.
                  </div>
                  <button
                    type="button"
                    onClick={handleJoinWaitlist}
                    className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
                  >
                    Join Waitlist - Get notified when a slot opens
                  </button>
                  <p className={`text-xs text-center ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                    You'll be notified via email if this slot becomes available
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Appointment Type and Reason */}
          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              {t.appointmentTypeRequired}
            </label>
            <select
              value={bookingData.type}
              onChange={(e) => setBookingData({...bookingData, type: e.target.value})}
              className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {appointmentTypes.map(type => (
                <option key={type.id} value={type.name}>{type.name}</option>
              ))}
            </select>
          </div>
          <div>
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

      {/* Delete Record Confirmation Modal */}
      <ConfirmationModal
        theme={theme}
        isOpen={!!recordToDelete}
        onClose={() => setRecordToDelete(null)}
        onConfirm={handleDeleteRecord}
        title={t.confirmDelete || "Confirm Delete"}
        message={`Are you sure you want to delete this medical record${recordToDelete ? ` "${recordToDelete.title || recordToDelete.record_type}"?` : '?'} This action cannot be undone.`}
        type="warning"
        confirmText={t.delete || "Delete"}
        cancelText={t.cancel || "Cancel"}
        showCancel={true}
      />

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-2xl w-full rounded-xl shadow-xl ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="flex justify-between items-center">
                <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Edit Medical Record
                </h3>
                <button
                  onClick={() => {
                    setEditingRecord(null);
                    setEditRecordData({ title: '', description: '', providerId: '' });
                  }}
                  className={`p-2 rounded-lg hover:bg-gray-100 ${theme === 'dark' ? 'hover:bg-slate-700' : ''}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateRecord} className="p-6 space-y-4">
              <div>
                <label className={`block text-sm mb-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Title *
                </label>
                <input
                  type="text"
                  value={editRecordData.title}
                  onChange={(e) => setEditRecordData({ ...editRecordData, title: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg ${
                    theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm mb-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Description
                </label>
                <textarea
                  value={editRecordData.description}
                  onChange={(e) => setEditRecordData({ ...editRecordData, description: e.target.value })}
                  rows="4"
                  className={`w-full px-4 py-2 border rounded-lg ${
                    theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              {providers && providers.length > 0 && (
                <div>
                  <label className={`block text-sm mb-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Provider
                  </label>
                  <select
                    value={editRecordData.providerId}
                    onChange={(e) => setEditRecordData({ ...editRecordData, providerId: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg ${
                      theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">Select a provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        Dr. {provider.firstName || provider.first_name} {provider.lastName || provider.last_name}{(provider.specialty || provider.specialization) ? ` - ${provider.specialty || provider.specialization}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 rounded-lg font-medium transition-colors bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setEditRecordData({ title: '', description: '', providerId: '' });
                  }}
                  className={`px-6 py-2 rounded-lg font-medium ${
                    theme === 'dark'
                      ? 'bg-slate-700 hover:bg-slate-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Appointment Modal */}
      {appointmentToCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-md w-full rounded-xl shadow-xl ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Cancel Appointment
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Are you sure you want to cancel your appointment with{' '}
                {appointmentToCancel.provider_first_name ? (
                  `Dr. ${appointmentToCancel.provider_first_name} ${appointmentToCancel.provider_last_name}`
                ) : (
                  'the provider'
                )}{' '}
                on {formatDate(appointmentToCancel.start_time)} at {formatTime(appointmentToCancel.start_time)}?
              </p>
              <div>
                <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Reason for cancellation (optional)
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Please provide a reason for cancelling..."
                  rows="3"
                  className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>
            </div>
            <div className={`p-6 border-t flex gap-3 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <button
                onClick={handleCancelAppointment}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel Appointment
              </button>
              <button
                onClick={() => {
                  setAppointmentToCancel(null);
                  setCancellationReason('');
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
              >
                Keep Appointment
              </button>
            </div>
          </div>
        </div>
      )}

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
              {/* Provider Information */}
              {(selectedPrescription.providerFirstName || selectedPrescription.providerLastName || selectedPrescription.providerName) && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                  <p className={`text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.prescribedBy || 'Prescribed by'}
                  </p>
                  <p className={`text-base font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Dr. {selectedPrescription.providerFirstName && selectedPrescription.providerLastName
                      ? `${selectedPrescription.providerFirstName} ${selectedPrescription.providerLastName}`
                      : selectedPrescription.providerName}
                  </p>
                  {selectedPrescription.providerSpecialization && (
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {selectedPrescription.providerSpecialization}
                    </p>
                  )}
                </div>
              )}

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
