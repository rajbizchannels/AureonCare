import React, { useState, useEffect } from 'react';
import { X, Save, Pill } from 'lucide-react';
import { formatDate, formatTime, formatCurrency } from '../../utils/formatters';
import EPrescribeModal from './ePrescribeModal';
import { useApp } from '../../context/AppContext';
import ConfirmationModal from './ConfirmationModal';
import { useAudit } from '../../hooks/useAudit';

const ViewEditModal = ({
  theme,
  editingItem,
  currentView,
  onClose,
  onSave,
  patients,
  users,
  api,
  addNotification,
  setAppointments,
  setPatients,
  setClaims,
  setUsers,
  setUser,
  user,
  t
}) => {
  const { logModalOpen, logModalClose, logError, startAction } = useAudit();
  const [editData, setEditData] = useState(editingItem?.data || {});
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [showEPrescribe, setShowEPrescribe] = useState(false);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [pharmacies, setPharmacies] = useState([]);
  const [preferredPharmacies, setPreferredPharmacies] = useState([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [editingPrescription, setEditingPrescription] = useState(null);
  const [insurancePayers, setInsurancePayers] = useState([]);
  const [loadingInsurancePayers, setLoadingInsurancePayers] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [appointmentTypes, setAppointmentTypes] = useState([]);

  // Get setLanguage from AppContext for updating language preference
  const { setLanguage } = useApp();

  // Log modal open when editingItem changes
  useEffect(() => {
    if (editingItem?.data) {
      startAction();
      logModalOpen('ViewEditModal', {
        module: 'General',
        metadata: {
          type: editingItem?.type,
          mode: currentView,
        },
      });
    }
  }, [editingItem, currentView, logModalOpen, startAction]);

  // Update editData when editingItem changes
  useEffect(() => {
    if (editingItem?.data) {
      setEditData(editingItem.data);
    }
  }, [editingItem]);

  // Fetch available roles for user editing (including system roles for assignment)
  useEffect(() => {
    const fetchRoles = async () => {
      // Set system roles as default (must match database roles table)
      const systemRoles = [
        { id: 'admin', name: 'admin', display_name: 'Administrator', is_system: true },
        { id: 'doctor', name: 'doctor', display_name: 'Doctor/Provider', is_system: true },
        { id: 'patient', name: 'patient', display_name: 'Patient', is_system: true },
        { id: 'nurse', name: 'nurse', display_name: 'Nurse', is_system: true },
        { id: 'receptionist', name: 'receptionist', display_name: 'Receptionist', is_system: true },
        { id: 'billing_manager', name: 'billing_manager', display_name: 'Billing Manager', is_system: true },
        { id: 'crm_manager', name: 'crm_manager', display_name: 'CRM Manager', is_system: true },
        { id: 'staff', name: 'staff', display_name: 'Staff', is_system: true }
      ];

      try {
        const roles = await api.getRoles(false); // false = include all roles (system + custom)

        // If API returns roles, use them; otherwise use system roles as fallback
        if (roles && Array.isArray(roles) && roles.length > 0) {
          setAvailableRoles(roles);
        } else {
          // Use system roles as fallback
          setAvailableRoles(systemRoles);
        }
      } catch (error) {
        console.error('Error fetching roles:', error);
        // Use system roles as fallback on error
        setAvailableRoles(systemRoles);
      } finally {
        setLoadingRoles(false);
      }
    };

    if (editingItem?.type === 'user') {
      fetchRoles();
    } else {
      // If not editing a user, set loadingRoles to false to prevent infinite loading state
      setLoadingRoles(false);
    }
  }, [api, editingItem?.type]);

  // Fetch appointment types for appointment editing
  useEffect(() => {
    const fetchAppointmentTypes = async () => {
      try {
        const data = await api.getAppointmentTypes();
        if (data && data.length > 0) {
          setAppointmentTypes(data);
        } else {
          // Fallback to default appointment types if API returns empty
          setAppointmentTypes([
            { id: 1, name: 'General Consultation', durationMinutes: 30 },
            { id: 2, name: 'Follow-up', durationMinutes: 20 },
            { id: 3, name: 'Check-up', durationMinutes: 30 },
            { id: 4, name: 'Physical Exam', durationMinutes: 45 },
            { id: 5, name: 'Vaccination', durationMinutes: 15 },
            { id: 6, name: 'Lab Results', durationMinutes: 15 }
          ]);
        }
      } catch (error) {
        console.error('Error fetching appointment types:', error);
        // Fallback to default appointment types on error
        setAppointmentTypes([
          { id: 1, name: 'General Consultation', durationMinutes: 30 },
          { id: 2, name: 'Follow-up', durationMinutes: 20 },
          { id: 3, name: 'Check-up', durationMinutes: 30 },
          { id: 4, name: 'Physical Exam', durationMinutes: 45 },
          { id: 5, name: 'Vaccination', durationMinutes: 15 },
          { id: 6, name: 'Lab Results', durationMinutes: 15 }
        ]);
      }
    };

    if (editingItem?.type === 'appointment') {
      fetchAppointmentTypes();
    }
  }, [api, editingItem?.type]);

  // Fetch prescriptions for patient when viewing
  useEffect(() => {
    const fetchPrescriptions = async () => {
      if (currentView === 'view' && editingItem?.type === 'patient' && editingItem?.data?.id) {
        setLoadingPrescriptions(true);
        try {
          const patientPrescriptions = await api.getPatientActivePrescriptions(editingItem.data.id);
          setPrescriptions(patientPrescriptions);
        } catch (error) {
          console.error('Error fetching prescriptions:', error);
          setPrescriptions([]);
        } finally {
          setLoadingPrescriptions(false);
        }
      }
    };

    fetchPrescriptions();
  }, [api, currentView, editingItem?.type, editingItem?.data?.id]);

  // Fetch pharmacies and preferred pharmacies for patient
  useEffect(() => {
    const fetchPharmacyData = async () => {
      if (editingItem?.type === 'patient') {
        setLoadingPharmacies(true);
        try {
          // Fetch all pharmacies for selection
          const allPharmacies = await api.getPharmacies();
          setPharmacies(allPharmacies || []);

          // Fetch patient's preferred pharmacies
          if (editingItem?.data?.id) {
            const patientPreferred = await api.getPatientPreferredPharmacies(editingItem.data.id);
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
        } finally {
          setLoadingPharmacies(false);
        }
      }
    };

    fetchPharmacyData();
  }, [api, editingItem?.type, editingItem?.data?.id]);

  // Fetch insurance payers for patient
  useEffect(() => {
    const fetchInsurancePayers = async () => {
      if (editingItem?.type === 'patient') {
        setLoadingInsurancePayers(true);
        try {
          const payers = await api.getInsurancePayers(true); // active_only=true
          setInsurancePayers(payers || []);
        } catch (error) {
          console.error('Error fetching insurance payers:', error);
          setInsurancePayers([]);
        } finally {
          setLoadingInsurancePayers(false);
        }
      }
    };

    fetchInsurancePayers();
  }, [api, editingItem?.type]);

  // Update editData when editingItem changes
  useEffect(() => {
    if (editingItem?.data) {
      const data = { ...editingItem.data };

      // For patients, ensure address fields are properly mapped
      // The database has separate columns: address, city, state, zip
      // Don't parse the address string - use the separate fields directly
      if (editingItem.type === 'patient') {
        // If we have separate city/state/zip fields from database, use them directly
        // No need to parse anything - the fields are already separate in the database
        // The form fields already match: address, city, state, zip
      }

      // For appointments, extract date and time from start_time
      if (editingItem.type === 'appointment' && data.start_time) {
        try {
          // Handle both ISO format and SQL timestamp format
          const startTimeStr = data.start_time.replace(' ', 'T'); // Convert SQL timestamp to ISO
          const startDate = new Date(startTimeStr);

          if (!isNaN(startDate.getTime())) {
            // Format date as YYYY-MM-DD
            data.date = startDate.toISOString().split('T')[0];

            // Format time as HH:MM in local timezone
            const hours = String(startDate.getHours()).padStart(2, '0');
            const minutes = String(startDate.getMinutes()).padStart(2, '0');
            data.time = `${hours}:${minutes}`;

            // Calculate duration if we have end_time
            if (data.end_time) {
              const endTimeStr = data.end_time.replace(' ', 'T');
              const endDate = new Date(endTimeStr);
              if (!isNaN(endDate.getTime())) {
                data.duration = Math.round((endDate - startDate) / 60000);
              }
            }
          }
        } catch (error) {
          console.error('Error parsing appointment time:', error);
        }

        // Map appointment_type to type for the form
        data.type = data.appointment_type || data.type;
      }

      // For users, ensure we have first_name and last_name
      if (editingItem.type === 'user' || editingItem.type === 'userProfile') {
        // Check both camelCase and snake_case versions
        if (!data.first_name && data.firstName) {
          data.first_name = data.firstName;
        }
        if (!data.last_name && data.lastName) {
          data.last_name = data.lastName;
        }
        // If still missing and we have a name field, parse it
        if (!data.first_name && !data.last_name && data.name) {
          const nameParts = data.name.trim().split(/\s+/);
          data.first_name = nameParts[0] || '';
          data.last_name = nameParts.slice(1).join(' ') || '';
        }

        // Extract preferences from nested object if present
        if (data.preferences && typeof data.preferences === 'object') {
          data.emailNotifications = data.preferences.emailNotifications !== undefined
            ? data.preferences.emailNotifications
            : true;
          data.smsAlerts = data.preferences.smsAlerts !== undefined
            ? data.preferences.smsAlerts
            : true;
          data.darkMode = data.preferences.darkMode !== undefined
            ? data.preferences.darkMode
            : true;
        }
      }

      setEditData(data);
    }
  }, [editingItem]);

  // Handle close with audit logging
  const handleClose = () => {
    logModalClose('ViewEditModal', {
      module: 'General',
      metadata: {
        type: editingItem?.type,
        mode: currentView,
      },
    });
    onClose();
  };

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [handleClose]);

  // Auto-calculate quantity in edit prescription form based on frequency and duration
  useEffect(() => {
    if (!editingPrescription || !editingPrescription.frequency || !editingPrescription.duration) return;

    const { frequency, duration } = editingPrescription;

    // Parse frequency to get times per day
    let timesPerDay = 1;
    const frequencyLower = frequency.toLowerCase();
    if (frequencyLower.includes('once')) timesPerDay = 1;
    else if (frequencyLower.includes('twice') || frequencyLower.includes('bid')) timesPerDay = 2;
    else if (frequencyLower.includes('three') || frequencyLower.includes('tid')) timesPerDay = 3;
    else if (frequencyLower.includes('four') || frequencyLower.includes('qid')) timesPerDay = 4;
    else if (frequencyLower.includes('every 4 hours') || frequencyLower.includes('q4h')) timesPerDay = 6;
    else if (frequencyLower.includes('every 6 hours') || frequencyLower.includes('q6h')) timesPerDay = 4;
    else if (frequencyLower.includes('every 8 hours') || frequencyLower.includes('q8h')) timesPerDay = 3;
    else if (frequencyLower.includes('every 12 hours') || frequencyLower.includes('q12h')) timesPerDay = 2;

    // Parse duration to get number of days
    const durationMatch = duration.match(/(\d+)/);
    if (!durationMatch) return;

    const days = parseInt(durationMatch[1]);
    if (isNaN(days)) return;

    // Calculate quantity
    const calculatedQuantity = timesPerDay * days;

    // Update quantity if different
    if (parseInt(editingPrescription.quantity) !== calculatedQuantity) {
      setEditingPrescription(prev => ({
        ...prev,
        quantity: calculatedQuantity.toString()
      }));
    }
  }, [editingPrescription?.frequency, editingPrescription?.duration]);

  // Handle ESC key to close prescription modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && selectedPrescription) {
        setSelectedPrescription(null);
        setEditingPrescription(null);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [selectedPrescription]);

  if (!editingItem) return null;

  const isView = currentView === 'view';
  const { type, data } = editingItem;

  // Handle adding/updating preferred pharmacy
  const handleAddPreferredPharmacy = async () => {
    if (!selectedPharmacyId || !editingItem?.data?.id) {
      addNotification('alert', t.pleaseSelectPharmacy);
      return;
    }

    try {
      await api.addPreferredPharmacy(editingItem.data.id, selectedPharmacyId, true);
      addNotification('success', t.preferredPharmacyUpdated);

      // Refresh preferred pharmacies list
      const patientPreferred = await api.getPatientPreferredPharmacies(editingItem.data.id);
      setPreferredPharmacies(patientPreferred || []);
    } catch (error) {
      console.error('Error adding preferred pharmacy:', error);
      addNotification('alert', t.failedToUpdatePharmacy);
    }
  };

  const handleSubmit = () => {
    // Show confirmation modal before saving
    setShowConfirmation(true);
  };

  const handleActualSubmit = async () => {
    setShowConfirmation(false);

    try {
      if (type === 'appointment') {
        // Prepare appointment data with proper start_time and end_time
        const appointmentData = { ...editData };

        // If we have separate date and time, combine them into start_time
        if (editData.date && editData.time) {
          const startTime = `${editData.date.split('T')[0]}T${editData.time}:00`;
          const startDate = new Date(startTime);
          const endDate = new Date(startDate.getTime() + (editData.duration || 30) * 60000);

          appointmentData.start_time = startDate.toISOString().slice(0, 19).replace('T', ' ');
          appointmentData.end_time = endDate.toISOString().slice(0, 19).replace('T', ' ');
          appointmentData.duration_minutes = editData.duration || 30;
          appointmentData.appointment_type = editData.type;
          appointmentData.patient_id = editData.patientId || editData.patient_id;
          appointmentData.provider_id = editData.providerId || editData.provider_id;

          // Auto-update status to completed if appointment is in the past and currently scheduled
          const now = new Date();
          if (startDate < now && (appointmentData.status === 'scheduled' || !appointmentData.status)) {
            appointmentData.status = 'completed';
          }

          // Remove old fields
          delete appointmentData.date;
          delete appointmentData.time;
        }

        const updated = await api.updateAppointment(editData.id, appointmentData);

        // Enrich the updated appointment with patient and provider names
        const patient = patients?.find(p => p.id === updated.patient_id);
        const provider = users?.find(u => u.id === updated.provider_id);

        const enrichedAppointment = {
          ...updated,
          patient: patient ? (patient.name || `${patient.first_name} ${patient.last_name}`) : updated.patient,
          doctor: provider ? `${provider.first_name || provider.firstName} ${provider.last_name || provider.lastName}`.trim() : updated.doctor,
          provider_name: provider ? `${provider.first_name || provider.firstName} ${provider.last_name || provider.lastName}`.trim() : updated.provider_name
        };

        setAppointments(prev => prev.map(apt =>
          apt.id === editData.id ? enrichedAppointment : apt
        ));
      } else if (type === 'patient') {
        // Prepare patient data - send fields as-is to API
        // The database has separate columns: address, city, state, zip
        // Don't combine them - the API expects separate fields
        const patientData = { ...editData };

        const updated = await api.updatePatient(editData.id, patientData);
        setPatients(prev => prev.map(patient =>
          patient.id === editData.id ? {...updated, name: updated.name || `${updated.first_name} ${updated.last_name}`} : patient
        ));

        // Also update preferred pharmacy if selected
        if (selectedPharmacyId) {
          try {
            await api.addPreferredPharmacy(editData.id, selectedPharmacyId, true);
            // Refresh preferred pharmacies list
            const patientPreferred = await api.getPatientPreferredPharmacies(editData.id);
            setPreferredPharmacies(patientPreferred || []);
          } catch (error) {
            console.error('Error updating preferred pharmacy:', error);
            // Don't fail the save if pharmacy update fails
          }
        }

        await addNotification('success', t.patientUpdatedSuccessfully || 'Patient updated successfully');
      } else if (type === 'userProfile') {
        // Update user profile - ensure we send firstName and lastName
        const firstName = editData.first_name || editData.firstName || '';
        const lastName = editData.last_name || editData.lastName || '';

        // Generate avatar from initials
        const avatar = `${firstName.charAt(0) || ''}${lastName.charAt(0) || ''}`.toUpperCase();

        // Package preferences into nested object
        const preferences = {
          emailNotifications: editData.emailNotifications !== undefined ? editData.emailNotifications : true,
          smsAlerts: editData.smsAlerts !== undefined ? editData.smsAlerts : true,
          darkMode: editData.darkMode !== undefined ? editData.darkMode : true
        };

        const userData = {
          ...editData,
          firstName,
          lastName,
          avatar: avatar || editData.avatar,
          preferences
        };
        const updated = await api.updateUser(editData.id, userData);
        setUser(updated);

        // Update language in AppContext if it changed
        if (editData.language) {
          const languageMap = {
            'English': 'en',
            'Spanish': 'es',
            'French': 'fr',
            'German': 'de',
            'Arabic': 'ar'
          };
          const languageCode = languageMap[editData.language] || editData.language;
          setLanguage(languageCode);
        }

        await addNotification('success', t.profileUpdatedSuccessfully);
      } else if (type === 'user') {
        // Update user - ensure we send firstName and lastName
        const firstName = editData.first_name || editData.firstName || '';
        const lastName = editData.last_name || editData.lastName || '';

        // Generate avatar from initials
        const avatar = `${firstName.charAt(0) || ''}${lastName.charAt(0) || ''}`.toUpperCase();

        const userData = {
          ...editData,
          firstName,
          lastName,
          avatar: avatar || editData.avatar
        };
        const updated = await api.updateUser(editData.id, userData);
        setUsers(prev => prev.map(u =>
          u.id === editData.id ? updated : u
        ));
        await addNotification('alert', 'User updated successfully');
      } else {
        // Prepare claim data with proper field names
        const claimData = {
          ...editData,
          claim_number: editData.claim_number,
          service_date: editData.service_date || editData.serviceDate,
          diagnosis_codes: editData.diagnosis_codes || editData.diagnosisCodes,
          procedure_codes: editData.procedure_codes || editData.procedureCodes
        };

        const updated = await api.updateClaim(editData.id, claimData);
        setClaims(prev => prev.map(claim =>
          claim.id === editData.id ? updated : claim
        ));
        await addNotification('success', t.claimUpdatedSuccessfully || 'Claim updated successfully');
      }
      handleClose();
    } catch (err) {
      console.error('Error saving:', err);
      logError('ViewEditModal', 'modal', err.message, {
        module: 'General',
        metadata: {
          type: editingItem?.type,
          mode: currentView,
        },
      });
      await addNotification('alert', t.failedToSaveChanges || 'Failed to save changes. Please try again.');
    }
  };

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleActualSubmit}
        title={t.confirmSaveChanges || 'Confirm Save Changes'}
        message={t.confirmSaveChangesMessage || `Are you sure you want to save changes to this ${type}?`}
        type="confirm"
        confirmText={t.saveChanges || 'Save Changes'}
        cancelText={t.cancel || 'Cancel'}
      />
      <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10 ${theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-gray-300 bg-white'}`}>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {isView ? (t.view || 'View') : (t.edit || 'Edit')} {
              type === 'appointment' ? (t.appointment || 'Appointment') :
              type === 'patient' ? (t.patientChart || 'Patient Chart') :
              type === 'userProfile' ? (t.userProfile || 'User Profile') :
              type === 'user' ? (t.user || 'User') :
              type === 'task' ? (t.task || 'Task') :
              type === 'claim' ? (t.claim || 'Claim') :
              type === 'payment' ? 'Payment' :
              type === 'denial' ? 'Denial' :
              type === 'preapproval' ? 'Pre-approval' :
              (t.claim || 'Claim')
            }
          </h2>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {type === 'appointment' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.patient || 'Patient'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.patient}</p>
                  ) : (
                    <select
                      value={editData.patientId || editData.patient_id}
                      onChange={(e) => {
                        const patient = patients.find(p => p.id.toString() === e.target.value);
                        setEditData({...editData, patientId: e.target.value, patient_id: e.target.value, patient: patient?.name || `${patient?.first_name} ${patient?.last_name}`});
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="">{t.selectPatient || 'Select Patient'}</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name || `${p.first_name} ${p.last_name}` || `${p.firstName} ${p.lastName}`} {p.mrn ? `- ${p.mrn}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.provider || 'Provider'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.doctor || editData.provider_name || t.notApplicable || 'N/A'}</p>
                  ) : (
                    <select
                      value={editData.providerId || editData.provider_id}
                      onChange={(e) => {
                        const provider = users?.find(u => u.id.toString() === e.target.value);
                        setEditData({...editData, providerId: e.target.value, provider_id: e.target.value, doctor: provider ? `${provider.first_name || provider.firstName} ${provider.last_name || provider.lastName}` : ''});
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="">{t.selectProvider || 'Select Provider'}</option>
                      {users?.filter(u => u.role === 'doctor' || u.role === 'physician' || u.role === 'provider' || u.role === 'admin').map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {`${provider.first_name || provider.firstName} ${provider.last_name || provider.lastName}`.trim() || provider.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.date || 'Date'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatDate(editData.date)}</p>
                  ) : (
                    <input
                      type="date"
                      value={editData.date ? editData.date.split('T')[0] : ''}
                      onChange={(e) => setEditData({...editData, date: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.time || 'Time'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatTime(editData.time)}</p>
                  ) : (
                    <input
                      type="time"
                      value={editData.time}
                      onChange={(e) => setEditData({...editData, time: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.type || 'Type'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.type}</p>
                  ) : (
                    <select
                      value={editData.type}
                      onChange={(e) => setEditData({...editData, type: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="">{t.selectType || 'Select Type'}</option>
                      {appointmentTypes.map(type => (
                        <option key={type.id} value={type.name}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.duration || 'Duration'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.duration} {t.minutes || 'minutes'}</p>
                  ) : (
                    <input
                      type="number"
                      value={editData.duration}
                      onChange={(e) => setEditData({...editData, duration: parseInt(e.target.value)})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.status || 'Status'}</label>
                  {isView ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      editData.status === 'Confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {editData.status}
                    </span>
                  ) : (
                    <select
                      value={editData.status}
                      onChange={(e) => setEditData({...editData, status: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="Scheduled">{t.scheduled || 'Scheduled'}</option>
                      <option value="Confirmed">{t.confirmed || 'Confirmed'}</option>
                      <option value="Completed">{t.completed || 'Completed'}</option>
                      <option value="Cancelled">{t.cancelled || 'Cancelled'}</option>
                    </select>
                  )}
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.reason || 'Reason'}</label>
                {isView ? (
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.reason}</p>
                ) : (
                  <input
                    type="text"
                    value={editData.reason}
                    onChange={(e) => setEditData({...editData, reason: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                )}
              </div>
            </div>
          ) : type === 'patient' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.firstName || 'First Name'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.first_name}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.first_name || ''}
                      onChange={(e) => setEditData({...editData, first_name: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.lastName || 'Last Name'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.last_name}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.last_name || ''}
                      onChange={(e) => setEditData({...editData, last_name: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.mrn || 'MRN'}</label>
                  <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.mrn || t.notApplicable || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.dateOfBirth || 'Date of Birth'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatDate(editData.date_of_birth || editData.dob)}</p>
                  ) : (
                    <input
                      type="date"
                      value={((editData.date_of_birth || editData.dob) || '').split('T')[0]}
                      onChange={(e) => setEditData({...editData, date_of_birth: e.target.value, dob: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.gender || 'Gender'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.gender || t.notApplicable || 'N/A'}</p>
                  ) : (
                    <select
                      value={editData.gender || ''}
                      onChange={(e) => setEditData({...editData, gender: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="">{t.select || 'Select'}</option>
                      <option value="Male">{t.male || 'Male'}</option>
                      <option value="Female">{t.female || 'Female'}</option>
                      <option value="Other">{t.other || 'Other'}</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.phone || 'Phone'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.phone}</p>
                  ) : (
                    <input
                      type="tel"
                      value={editData.phone || ''}
                      onChange={(e) => setEditData({...editData, phone: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div className="col-span-2">
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.email || 'Email'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.email}</p>
                  ) : (
                    <input
                      type="email"
                      value={editData.email || ''}
                      onChange={(e) => setEditData({...editData, email: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div className="col-span-2">
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.streetAddress || 'Street Address'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.address || t.notApplicable || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.address || ''}
                      onChange={(e) => setEditData({...editData, address: e.target.value})}
                      placeholder={t.streetAddressPlaceholder || "123 Main Street"}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.city || 'City'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.city || t.notApplicable || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.city || ''}
                      onChange={(e) => setEditData({...editData, city: e.target.value})}
                      placeholder={t.city || "City"}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.state || 'State'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.state || t.notApplicable || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.state || ''}
                      onChange={(e) => setEditData({...editData, state: e.target.value})}
                      placeholder={t.state || "State"}
                      maxLength="2"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.zipCode || 'ZIP Code'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.zip || t.notApplicable || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.zip || ''}
                      onChange={(e) => setEditData({...editData, zip: e.target.value})}
                      placeholder="12345"
                      maxLength="10"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
              </div>

              {/* Medical History Section */}
              <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {t.medicalHistory || 'Medical History'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.allergies || 'Allergies'}
                    </label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'} whitespace-pre-wrap`}>
                        {editData.allergies || t.notApplicable || 'N/A'}
                      </p>
                    ) : (
                      <textarea
                        value={editData.allergies || ''}
                        onChange={(e) => setEditData({...editData, allergies: e.target.value})}
                        placeholder={t.allergiesPlaceholder || 'List any known allergies (medications, food, environmental, etc.)'}
                        rows="3"
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                      />
                    )}
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.pastHistory || 'Past Medical History'}
                    </label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'} whitespace-pre-wrap`}>
                        {editData.past_history || t.notApplicable || 'N/A'}
                      </p>
                    ) : (
                      <textarea
                        value={editData.past_history || ''}
                        onChange={(e) => setEditData({...editData, past_history: e.target.value})}
                        placeholder={t.pastHistoryPlaceholder || 'Previous illnesses, surgeries, hospitalizations, etc.'}
                        rows="3"
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                      />
                    )}
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.familyHistory || 'Family History'}
                    </label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'} whitespace-pre-wrap`}>
                        {editData.family_history || t.notApplicable || 'N/A'}
                      </p>
                    ) : (
                      <textarea
                        value={editData.family_history || ''}
                        onChange={(e) => setEditData({...editData, family_history: e.target.value})}
                        placeholder={t.familyHistoryPlaceholder || 'Family medical history (e.g., diabetes, heart disease, cancer, etc.)'}
                        rows="3"
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Insurance Payer Section */}
              <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {t.insuranceInformation || 'Insurance Information'}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.insuranceProvider || 'Insurance Provider'}
                    </label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {editData.insurance || t.notApplicable || 'N/A'}
                      </p>
                    ) : (
                      <input
                        type="text"
                        value={editData.insurance || ''}
                        onChange={(e) => setEditData({...editData, insurance: e.target.value})}
                        placeholder="Insurance company name"
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.insuranceMemberId || 'Insurance Member ID'}
                    </label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {editData.insurance_id || t.notApplicable || 'N/A'}
                      </p>
                    ) : (
                      <input
                        type="text"
                        value={editData.insurance_id || ''}
                        onChange={(e) => setEditData({...editData, insurance_id: e.target.value})}
                        placeholder="Member/Policy ID"
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>

                  {loadingInsurancePayers ? (
                    <div className="col-span-2">
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {t.loadingInsurancePayers || 'Loading insurance payers...'}
                      </p>
                    </div>
                  ) : (
                    <div className="col-span-2">
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {t.insurancePayer || 'Insurance Payer'}
                      </label>
                      {isView ? (
                        <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {editData.insurance_payer_id
                            ? insurancePayers.find(p => p.id === editData.insurance_payer_id)?.name || t.notApplicable || 'N/A'
                            : t.notApplicable || 'N/A'}
                        </p>
                      ) : (
                        <select
                          value={editData.insurance_payer_id || ''}
                          onChange={(e) => setEditData({...editData, insurance_payer_id: e.target.value})}
                          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                        >
                          <option value="">{t.selectInsurancePayer || 'Select Insurance Payer'}</option>
                          {insurancePayers.map((payer) => (
                            <option key={payer.id} value={payer.id}>
                              {payer.name} ({payer.payer_id})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Preferred Pharmacy Section */}
              <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {t.preferredPharmacy || 'Preferred Pharmacy'}
                </h3>

                {loadingPharmacies ? (
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.loadingPharmacies || 'Loading pharmacies...'}
                  </p>
                ) : (
                  <>
                    {/* Current Preferred Pharmacies */}
                    {preferredPharmacies.length > 0 && (
                      <div className="mb-4">
                        <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          {t.currentPreferred || 'Current Preferred:'}
                        </p>
                        <div className="space-y-2">
                          {preferredPharmacies.map((pharmacy) => (
                            <div
                              key={pharmacy.id || pharmacy.pharmacyId}
                              className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'}`}
                            >
                              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {pharmacy.pharmacyName || pharmacy.pharmacy_name}
                                {(pharmacy.isPreferred || pharmacy.is_preferred) && (
                                  <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">{t.primary || 'Primary'}</span>
                                )}
                              </p>
                              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                {pharmacy.addressLine1 || pharmacy.address_line1}, {pharmacy.city}, {pharmacy.state} {pharmacy.zipCode || pharmacy.zip_code}
                              </p>
                              {(pharmacy.phone) && (
                                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                  {t.phone || 'Phone'}: {pharmacy.phone}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add/Change Preferred Pharmacy */}
                    {!isView && (
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          {preferredPharmacies.length > 0 ? (t.changePreferredPharmacy || 'Change Preferred Pharmacy') : (t.selectPreferredPharmacy || 'Select Preferred Pharmacy')}
                        </label>
                        <select
                          value={selectedPharmacyId}
                          onChange={(e) => setSelectedPharmacyId(e.target.value)}
                          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                        >
                          <option value="">{t.selectAPharmacy || 'Select a pharmacy...'}</option>
                          {pharmacies.map((pharmacy) => (
                            <option key={pharmacy.id} value={pharmacy.id}>
                              {pharmacy.pharmacyName || pharmacy.pharmacy_name} - {pharmacy.city}, {pharmacy.state}
                            </option>
                          ))}
                        </select>
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                          {t.pharmacyWillBeSaved || 'Pharmacy will be saved with your other changes'}
                        </p>
                      </div>
                    )}

                    {preferredPharmacies.length === 0 && isView && (
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {t.noPreferredPharmacySet || 'No preferred pharmacy set.'}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Active Prescriptions Section - Only shown in view mode */}
              {isView && (
                <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                  <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {t.activePrescriptions || 'Active Prescriptions'}
                  </h3>
                  {loadingPrescriptions ? (
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.loadingPrescriptions || 'Loading prescriptions...'}
                    </p>
                  ) : prescriptions.length === 0 ? (
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {t.noActivePrescriptionsFound || 'No active prescriptions found.'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {prescriptions.map((rx) => (
                        <div
                          key={rx.id}
                          onClick={() => setSelectedPrescription(rx)}
                          className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {rx.medicationName || rx.medication || t.unknownMedication || 'Unknown Medication'}
                                </h4>
                                {rx.erxStatus && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    rx.erxStatus === 'sent' ? 'bg-green-500/20 text-green-400' :
                                    rx.erxStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                    rx.erxStatus === 'failed' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {rx.erxStatus === 'sent' ? (t.ePrescribed || 'ePrescribed') :
                                     rx.erxStatus === 'pending' ? (t.pending || 'Pending') :
                                     rx.erxStatus === 'failed' ? (t.failed || 'Failed') :
                                     (t.paper || 'Paper')}
                                  </span>
                                )}
                              </div>
                              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                {rx.dosage || t.notApplicable || 'N/A'} - {rx.frequency || t.notApplicable || 'N/A'}
                              </p>
                              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                                {t.qty || 'Qty'}: {rx.quantity || t.notApplicable || 'N/A'} | {t.refills || 'Refills'}: {rx.refillsRemaining !== undefined ? rx.refillsRemaining : (t.notApplicable || 'N/A')}
                              </p>
                              {rx.pharmacyName && (
                                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                                  {t.pharmacy || 'Pharmacy'}: {rx.pharmacyName}
                                </p>
                              )}
                            </div>
                            <div className={`text-right text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                              <p>{t.prescribed || 'Prescribed'}: {rx.prescribedDate ? formatDate(rx.prescribedDate) : (t.notApplicable || 'N/A')}</p>
                              {rx.expiresDate && (
                                <p className="mt-1">{t.expires || 'Expires'}: {formatDate(rx.expiresDate)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : type === 'userProfile' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {editData.avatar}
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.role || 'Role'}</p>
                  <p className={`font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.firstName || 'First Name'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.first_name}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.first_name || ''}
                      onChange={(e) => setEditData({...editData, first_name: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.lastName || 'Last Name'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.last_name}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.last_name || ''}
                      onChange={(e) => setEditData({...editData, last_name: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.email || 'Email'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.email || t.notApplicable || 'N/A'}</p>
                  ) : (
                    <input
                      type="email"
                      value={editData.email || ''}
                      onChange={(e) => setEditData({...editData, email: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.phone || 'Phone'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.phone || t.notApplicable || 'N/A'}</p>
                  ) : (
                    <input
                      type="tel"
                      value={editData.phone || ''}
                      onChange={(e) => setEditData({...editData, phone: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.license || 'License'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.license || t.notApplicable || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.license || ''}
                      onChange={(e) => setEditData({...editData, license: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.specialty || 'Specialty'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.specialty || t.notApplicable || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.specialty || ''}
                      onChange={(e) => setEditData({...editData, specialty: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.language || 'Language'}</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.language || 'English'}</p>
                  ) : (
                    <select
                      value={editData.language || 'English'}
                      onChange={(e) => setEditData({...editData, language: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Español</option>
                      <option value="French">Français</option>
                      <option value="German">Deutsch</option>
                      <option value="Arabic">العربية</option>
                    </select>
                  )}
                </div>
              </div>
              <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
                <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.preferences || 'Preferences'}</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.emailNotifications || 'Email Notifications'}</span>
                    <button
                      type="button"
                      onClick={() => setEditData({...editData, emailNotifications: !(editData.emailNotifications !== false)})}
                      disabled={isView}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        isView ? 'opacity-50 cursor-not-allowed' : ''
                      } ${
                        (editData.emailNotifications !== false)
                          ? 'bg-blue-500'
                          : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          (editData.emailNotifications !== false) ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.smsAlerts || 'SMS Alerts'}</span>
                    <button
                      type="button"
                      onClick={() => setEditData({...editData, smsAlerts: !(editData.smsAlerts !== false)})}
                      disabled={isView}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        isView ? 'opacity-50 cursor-not-allowed' : ''
                      } ${
                        (editData.smsAlerts !== false)
                          ? 'bg-blue-500'
                          : theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          (editData.smsAlerts !== false) ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : type === 'user' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {editData.avatar || editData.name?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Role</p>
                  <p className={`font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>First Name</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.first_name}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.first_name || ''}
                      onChange={(e) => setEditData({...editData, first_name: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Last Name</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.last_name}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.last_name || ''}
                      onChange={(e) => setEditData({...editData, last_name: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Email</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.email}</p>
                  ) : (
                    <input
                      type="email"
                      value={editData.email || ''}
                      onChange={(e) => setEditData({...editData, email: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Phone</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.phone || 'N/A'}</p>
                  ) : (
                    <input
                      type="tel"
                      value={editData.phone || ''}
                      onChange={(e) => setEditData({...editData, phone: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Role</label>
                  {isView ? (
                    <p className={`capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.role}</p>
                  ) : (
                    <select
                      value={editData.role || ''}
                      onChange={(e) => setEditData({...editData, role: e.target.value})}
                      disabled={loadingRoles}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'} ${loadingRoles ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {loadingRoles ? (
                        <option>Loading roles...</option>
                      ) : availableRoles.length === 0 ? (
                        <option value="">No custom roles available</option>
                      ) : (
                        <>
                          <option value="">Select a role</option>
                          {availableRoles.map(role => (
                            <option key={role.id} value={role.name}>
                              {role.display_name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>License</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.license || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.license || ''}
                      onChange={(e) => setEditData({...editData, license: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Specialty</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.specialty || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.specialty || ''}
                      onChange={(e) => setEditData({...editData, specialty: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Language</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.language || 'English'}</p>
                  ) : (
                    <select
                      value={editData.language || 'English'}
                      onChange={(e) => setEditData({...editData, language: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                      <option value="German">German</option>
                      <option value="Arabic">Arabic</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          ) : type === 'claim' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Claim Number</label>
                  <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.claim_number || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Status</label>
                  {isView ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      editData.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
                      editData.status === 'Submitted' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {editData.status}
                    </span>
                  ) : (
                    <select
                      value={editData.status}
                      onChange={(e) => setEditData({...editData, status: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Approved">Approved</option>
                      <option value="Denied">Denied</option>
                      <option value="Paid">Paid</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Patient</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.patient}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Amount</label>
                  {isView ? (
                    <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(editData.amount)}</p>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={editData.amount}
                      onChange={(e) => setEditData({...editData, amount: parseFloat(e.target.value)})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Payer</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.payer}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Service Date</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatDate(editData.serviceDate || editData.service_date)}</p>
                  ) : (
                    <input
                      type="date"
                      value={(editData.serviceDate || editData.service_date || '').split('T')[0]}
                      onChange={(e) => setEditData({...editData, serviceDate: e.target.value, service_date: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Diagnosis Codes</label>
                {isView ? (
                  <div className="flex gap-2 flex-wrap">
                    {editData.diagnosisCodes?.map((code, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-mono">
                        {code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={editData.diagnosisCodes?.join(', ')}
                    onChange={(e) => setEditData({...editData, diagnosisCodes: e.target.value.split(',').map(c => c.trim())})}
                    placeholder="Z00.00, I10"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                )}
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Procedure Codes</label>
                {isView ? (
                  <div className="flex gap-2 flex-wrap">
                    {editData.procedureCodes?.map((code, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-mono">
                        {code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={editData.procedureCodes?.join(', ')}
                    onChange={(e) => setEditData({...editData, procedureCodes: e.target.value.split(',').map(c => c.trim())})}
                    placeholder="99213, 99214"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                )}
              </div>
              {(editData.notes || !isView) && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Notes</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.notes}</p>
                  ) : (
                    <textarea
                      value={editData.notes || ''}
                      onChange={(e) => setEditData({...editData, notes: e.target.value})}
                      rows="3"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
              )}
            </div>
          ) : type === 'task' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Title</label>
                  {isView ? (
                    <p className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.title}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.title || ''}
                      onChange={(e) => setEditData({...editData, title: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Priority</label>
                  {isView ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      editData.priority === 'High' || editData.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      editData.priority === 'Medium' || editData.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {editData.priority}
                    </span>
                  ) : (
                    <select
                      value={editData.priority || 'medium'}
                      onChange={(e) => setEditData({...editData, priority: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Status</label>
                  {isView ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      editData.status === 'Completed' || editData.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      editData.status === 'In Progress' || editData.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {editData.status}
                    </span>
                  ) : (
                    <select
                      value={editData.status || 'pending'}
                      onChange={(e) => setEditData({...editData, status: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  )}
                </div>
                <div className="col-span-2">
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Due Date</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {formatDate(editData.due_date || editData.dueDate)}
                    </p>
                  ) : (
                    <input
                      type="date"
                      value={(editData.due_date || editData.dueDate || '').split('T')[0]}
                      onChange={(e) => setEditData({...editData, due_date: e.target.value, dueDate: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                {editData.description && (
                  <div className="col-span-2">
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Description</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.description}</p>
                    ) : (
                      <textarea
                        value={editData.description || ''}
                        onChange={(e) => setEditData({...editData, description: e.target.value})}
                        rows="4"
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : type === 'payment' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Payment Number</label>
                  <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.payment_number || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Status</label>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    editData.payment_status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    editData.payment_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    editData.payment_status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {editData.payment_status || 'N/A'}
                  </span>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Patient</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.patient_name || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Claim Number</label>
                  <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.claim_number || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Amount</label>
                  <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                    ${editData.amount ? parseFloat(editData.amount).toFixed(2) : '0.00'}
                  </p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Payment Date</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {editData.payment_date ? new Date(editData.payment_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Payment Method</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.payment_method || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Transaction ID</label>
                  <p className={`font-mono text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.transaction_id || 'N/A'}</p>
                </div>
                {editData.card_last_four && (
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Card</label>
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {editData.card_brand || 'Card'} ending in {editData.card_last_four}
                    </p>
                  </div>
                )}
              </div>
              {editData.description && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Description</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.description}</p>
                </div>
              )}
              {editData.notes && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Notes</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.notes}</p>
                </div>
              )}
            </div>
          ) : type === 'denial' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Denial Number</label>
                  <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.denial_number || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Status</label>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    editData.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                    editData.status === 'open' ? 'bg-red-500/20 text-red-400' :
                    editData.status === 'appealed' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {editData.status || 'N/A'}
                  </span>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Patient</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.patient_name || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Claim Number</label>
                  <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.claim_number || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Denial Amount</label>
                  <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                    ${editData.denial_amount ? parseFloat(editData.denial_amount).toFixed(2) : '0.00'}
                  </p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Denial Date</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {editData.denial_date ? new Date(editData.denial_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Denial Reason Code</label>
                  <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.denial_reason_code || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Priority</label>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    editData.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                    editData.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    editData.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {editData.priority || 'N/A'}
                  </span>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Denial Reason Description</label>
                <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.denial_reason_description || 'N/A'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Appeal Status</label>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    editData.appeal_status === 'appeal_approved' ? 'bg-green-500/20 text-green-400' :
                    editData.appeal_status === 'appeal_pending' ? 'bg-blue-500/20 text-blue-400' :
                    editData.appeal_status === 'not_appealed' ? 'bg-gray-500/20 text-gray-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {editData.appeal_status || 'N/A'}
                  </span>
                </div>
                {editData.appeal_deadline && (
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Appeal Deadline</label>
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {new Date(editData.appeal_deadline).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              {editData.notes && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Notes</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.notes}</p>
                </div>
              )}
            </div>
          ) : type === 'preapproval' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Pre-approval Number</label>
                  <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.preapproval_number || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Authorization Number</label>
                  <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.authorization_number || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Patient</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.patient_name || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Status</label>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    editData.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    editData.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    editData.status === 'denied' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {editData.status || 'N/A'}
                  </span>
                </div>
                <div className="col-span-2">
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Requested Service</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.requested_service || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Service Start Date</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {editData.service_start_date ? new Date(editData.service_start_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Service End Date</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {editData.service_end_date ? new Date(editData.service_end_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Estimated Cost</label>
                  <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                    ${editData.estimated_cost ? parseFloat(editData.estimated_cost).toFixed(2) : '0.00'}
                  </p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Insurance Payer</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.insurance_payer_name || 'N/A'}</p>
                </div>
              </div>
              {editData.diagnosis_codes && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Diagnosis Codes</label>
                  <div className="flex gap-2 flex-wrap">
                    {(Array.isArray(editData.diagnosis_codes) ? editData.diagnosis_codes :
                      typeof editData.diagnosis_codes === 'string' ? JSON.parse(editData.diagnosis_codes) : []
                    ).map((code, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-mono">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {editData.procedure_codes && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Procedure Codes</label>
                  <div className="flex gap-2 flex-wrap">
                    {(Array.isArray(editData.procedure_codes) ? editData.procedure_codes :
                      typeof editData.procedure_codes === 'string' ? JSON.parse(editData.procedure_codes) : []
                    ).map((code, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-mono">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {editData.clinical_notes && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Clinical Notes</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.clinical_notes}</p>
                </div>
              )}
            </div>
          ) : null } 

          <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            <button
              onClick={onClose}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
            >
              Close
            </button>
            {isView && type === 'patient' && (
              <button
                onClick={() => setShowEPrescribe(true)}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-white"
              >
                <Pill className="w-5 h-5" />
                ePrescribe
              </button>
            )}
            {!isView && (
              <button
                onClick={handleSubmit}
                className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                <Save className="w-5 h-5" />
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ePrescribe Modal */}
      {showEPrescribe && type === 'patient' && (() => {
        // Debug logging for ePrescribe modal props
        console.log('[ViewEditModal] Opening ePrescribe with:');
        console.log('[ViewEditModal] Patient (editData):', editData);
        console.log('[ViewEditModal] Patient ID:', editData?.id);
        console.log('[ViewEditModal] Provider (user):', user);
        console.log('[ViewEditModal] Provider ID:', user?.id);
        console.log('[ViewEditModal] Provider user_id:', user?.user_id);

        return (
          <EPrescribeModal
            theme={theme}
            patient={editData}
            provider={user}
            onClose={() => setShowEPrescribe(false)}
            api={api}
            addNotification={addNotification}
            onSuccess={async (prescription) => {
              // Refresh prescriptions list after successful prescription creation
              try {
                const patientPrescriptions = await api.getPatientActivePrescriptions(editData.id);
              setPrescriptions(patientPrescriptions);
            } catch (error) {
              console.error('Error refreshing prescriptions:', error);
            }
          }}
        />
        );
      })()}

      {/* Prescription Detail/Edit Modal */}
      {selectedPrescription && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => { setSelectedPrescription(null); setEditingPrescription(null); }}>
          <div
            className={`max-w-2xl w-full rounded-xl border p-6 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {selectedPrescription.medicationName || selectedPrescription.medication || 'Unknown Medication'}
                </h3>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                  selectedPrescription.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {selectedPrescription.status}
                </span>
              </div>
              <div className="flex gap-2">
                {!editingPrescription && (
                  <button
                    onClick={() => setEditingPrescription({...selectedPrescription})}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => { setSelectedPrescription(null); setEditingPrescription(null); }}
                  className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {editingPrescription ? (
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.updatePrescription(editingPrescription.id, editingPrescription);
                  addNotification('success', t.prescriptionUpdatedSuccessfully);
                  const updated = await api.getPatientActivePrescriptions(editData.id);
                  setPrescriptions(updated);
                  setSelectedPrescription(null);
                  setEditingPrescription(null);
                } catch (error) {
                  addNotification('alert', t.failedToUpdatePrescription);
                }
              }}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Dosage</label>
                      <input
                        type="text"
                        value={editingPrescription.dosage || ''}
                        onChange={(e) => setEditingPrescription({...editingPrescription, dosage: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Frequency</label>
                      <input
                        type="text"
                        value={editingPrescription.frequency || ''}
                        onChange={(e) => setEditingPrescription({...editingPrescription, frequency: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Duration</label>
                      <input
                        type="text"
                        value={editingPrescription.duration || ''}
                        onChange={(e) => setEditingPrescription({...editingPrescription, duration: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Quantity</label>
                      <input
                        type="number"
                        value={editingPrescription.quantity || ''}
                        onChange={(e) => setEditingPrescription({...editingPrescription, quantity: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Refills</label>
                      <input
                        type="number"
                        value={editingPrescription.refills || editingPrescription.refillsRemaining || ''}
                        onChange={(e) => setEditingPrescription({...editingPrescription, refills: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Status</label>
                      <select
                        value={editingPrescription.status || 'Active'}
                        onChange={(e) => setEditingPrescription({...editingPrescription, status: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      >
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Instructions</label>
                    <textarea
                      value={editingPrescription.instructions || ''}
                      onChange={(e) => setEditingPrescription({...editingPrescription, instructions: e.target.value})}
                      rows="3"
                      className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPrescription(null)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            ) : (
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
                  {selectedPrescription.pharmacyName && (
                    <div>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Pharmacy</p>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPrescription.pharmacyName}</p>
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
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatDate(selectedPrescription.prescribedDate)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ViewEditModal;
