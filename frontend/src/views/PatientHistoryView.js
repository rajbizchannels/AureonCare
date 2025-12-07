import React, { useState, useEffect } from 'react';
import {
  User, Calendar, Activity, FileText, Pill, ArrowLeft,
  Edit, Trash2, Plus, Clock, MapPin, Phone, Mail
} from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';
import DiagnosisForm from '../components/forms/DiagnosisForm';
import MedicationMultiSelect from '../components/forms/MedicationMultiSelect';
import ConfirmationModal from '../components/modals/ConfirmationModal';

const PatientHistoryView = ({ theme, api, addNotification, user, patient, onBack }) => {
  const [activeTab, setActiveTab] = useState('prescriptions');
  const [loading, setLoading] = useState(true);

  // Data states
  const [patientData, setPatientData] = useState(patient || {});
  const [appointments, setAppointments] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [providers, setProviders] = useState([]);
  const [patients, setPatients] = useState([]);

  // Modal states
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
  const [editingDiagnosis, setEditingDiagnosis] = useState(null);
  const [deletingDiagnosis, setDeletingDiagnosis] = useState(null);

  // Prescription modal states
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [editingPrescription, setEditingPrescription] = useState(null);
  const [deletingPrescription, setDeletingPrescription] = useState(null);

  useEffect(() => {
    if (patient?.id) {
      fetchPatientHistory();
      fetchProviders();
      fetchPatients();
    }
  }, [patient?.id]);

  const fetchProviders = async () => {
    try {
      const data = await api.getProviders();
      setProviders(data);
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      const data = await api.getPatients();
      setPatients(data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const fetchPatientHistory = async () => {
    setLoading(true);
    try {
      const patientId = patient.id;

      // Fetch all patient data in parallel
      const [appts, diags, presc, records, fullPatient] = await Promise.all([
        api.getAppointments().then(all => all.filter(a => a.patient_id?.toString() === patientId?.toString())),
        api.getDiagnoses ? api.getDiagnoses(patientId) : Promise.resolve([]),
        api.getPatientActivePrescriptions ? api.getPatientActivePrescriptions(patientId).catch(() => []) : Promise.resolve([]),
        api.getMedicalRecords ? api.getMedicalRecords(patientId) : Promise.resolve([]),
        api.getPatientProfile ? api.getPatientProfile(patientId).catch(() => patient) : Promise.resolve(patient)
      ]);

      setAppointments(appts);
      setDiagnoses(diags);
      setPrescriptions(presc);
      setMedicalRecords(records);
      setPatientData(fullPatient || patient);
    } catch (error) {
      console.error('Error fetching patient history:', error);
      addNotification('error', 'Failed to load patient history');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiagnosis = async () => {
    if (!deletingDiagnosis) return;

    try {
      await api.deleteDiagnosis(deletingDiagnosis.id);
      addNotification('success', 'Diagnosis deleted successfully');
      setDeletingDiagnosis(null);
      fetchPatientHistory();
    } catch (error) {
      console.error('Error deleting diagnosis:', error);
      addNotification('error', 'Failed to delete diagnosis');
    }
  };

  const handleDeletePrescription = async () => {
    if (!deletingPrescription) return;

    try {
      await api.deletePrescription(deletingPrescription.id);
      addNotification('success', 'Prescription deleted successfully');
      setDeletingPrescription(null);
      fetchPatientHistory();
    } catch (error) {
      console.error('Error deleting prescription:', error);
      addNotification('error', 'Failed to delete prescription');
    }
  };

  const handleSavePrescription = async (prescriptionData) => {
    try {
      if (editingPrescription) {
        await api.updatePrescription(editingPrescription.id, prescriptionData);
        addNotification('success', 'Prescription updated successfully');
      } else {
        await api.createPrescription({ ...prescriptionData, patient_id: patient.id });
        addNotification('success', 'Prescription created successfully');
      }
      setShowPrescriptionForm(false);
      setEditingPrescription(null);
      fetchPatientHistory();
    } catch (error) {
      console.error('Error saving prescription:', error);
      addNotification('error', 'Failed to save prescription');
    }
  };

  const renderOverview = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Patient Header Card */}
      <div className={`p-8 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-2xl">
            {patientData.first_name?.charAt(0)}{patientData.last_name?.charAt(0)}
          </div>
          <div>
            <h3 className={`font-semibold text-2xl ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.first_name} {patientData.last_name}
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              MRN: {patientData.mrn || 'N/A'}
            </p>
          </div>
        </div>

        {/* Personal Information */}
        <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Personal Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>First Name</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.first_name || 'Not provided'}
            </p>
          </div>
          <div>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Last Name</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.last_name || 'Not provided'}
            </p>
          </div>
        </div>

        {/* Contact Information */}
        <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Email</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.email || 'Not provided'}
            </p>
          </div>
          <div>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Phone</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.phone || 'Not provided'}
            </p>
          </div>
          <div className="col-span-2">
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Address</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.address || 'Not provided'}
            </p>
          </div>
          {patientData.country && (
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Country</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {patientData.country || 'Not provided'}
              </p>
            </div>
          )}
          {patientData.language && (
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Language</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {patientData.language || 'Not provided'}
              </p>
            </div>
          )}
          <div>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Date of Birth</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.date_of_birth ? formatDate(patientData.date_of_birth) : patientData.dob ? formatDate(patientData.dob) : 'Not provided'}
            </p>
          </div>
        </div>
      </div>

      {/* Medical Information Card */}
      <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
        <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Medical Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Height</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.height || 'Not provided'}
            </p>
          </div>
          <div>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Weight</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.weight || 'Not provided'}
            </p>
          </div>
          <div>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Blood Type</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.blood_type || 'Not provided'}
            </p>
          </div>
          <div className="col-span-2">
            <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Allergies</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.allergies || 'Not provided'}
            </p>
          </div>
          <div className="col-span-2">
            <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Past Medical History</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.past_history || 'Not provided'}
            </p>
          </div>
          <div className="col-span-2">
            <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Family History</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.family_history || 'Not provided'}
            </p>
          </div>
          <div className="col-span-2">
            <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Current Medications</p>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {patientData.current_medications || 'Not provided'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRecords = () => (
    <div className="space-y-4">
      <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Medical Records
      </h3>
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
              className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {record.title || record.record_type}
                  </h4>
                </div>
              </div>
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

  const renderDiagnoses = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Diagnoses
        </h3>
        <button
          onClick={() => {
            setEditingDiagnosis(null);
            setShowDiagnosisForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 rounded-lg text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Diagnosis
        </button>
      </div>

      {diagnoses.length === 0 ? (
        <div className={`text-center py-8 rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <Activity className={`w-10 h-10 mx-auto mb-3 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>No diagnoses found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {diagnoses.map((diagnosis) => (
            <div
              key={diagnosis.id}
              className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {diagnosis.diagnosisName || diagnosis.diagnosis_name || 'Diagnosis'}
                  </h4>
                  {diagnosis.diagnosisCode && (
                    <p className={`text-sm mt-1 font-mono ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                      Code: {diagnosis.diagnosisCode || diagnosis.diagnosis_code}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {diagnosis.severity && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      diagnosis.severity === 'Severe'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : diagnosis.severity === 'Moderate'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {diagnosis.severity}
                    </span>
                  )}
                  {diagnosis.status && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      diagnosis.status === 'Active'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : diagnosis.status === 'Resolved'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {diagnosis.status}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setEditingDiagnosis(diagnosis);
                      setShowDiagnosisForm(true);
                    }}
                    className={`p-2 rounded-lg hover:bg-blue-100 transition-colors ${theme === 'dark' ? 'hover:bg-blue-900/20' : ''}`}
                    title="Edit diagnosis"
                  >
                    <Edit className="w-4 h-4 text-blue-500" />
                  </button>
                  <button
                    onClick={() => setDeletingDiagnosis(diagnosis)}
                    className={`p-2 rounded-lg hover:bg-red-100 transition-colors ${theme === 'dark' ? 'hover:bg-red-900/20' : ''}`}
                    title="Delete diagnosis"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  <strong>Date:</strong> {formatDate(diagnosis.diagnosedDate || diagnosis.diagnosed_date)}
                </p>
                {diagnosis.provider && (
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    <strong>Provider:</strong> Dr. {diagnosis.provider.first_name || diagnosis.provider.firstName} {diagnosis.provider.last_name || diagnosis.provider.lastName}
                  </p>
                )}
              </div>

              {diagnosis.description && (
                <p className={`text-sm mt-3 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  <strong>Description:</strong> {diagnosis.description}
                </p>
              )}

              {diagnosis.notes && (
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  <strong>Notes:</strong> {diagnosis.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPrescriptions = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Prescriptions
        </h3>
        <button
          onClick={() => {
            setEditingPrescription(null);
            setShowPrescriptionForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Prescription
        </button>
      </div>
      {prescriptions.length === 0 ? (
        <div className={`text-center py-12 rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <Pill className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>No active prescriptions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <div
              key={rx.id}
              className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {rx.medicationName || rx.medication_name}
                  </h4>
                  {(rx.providerFirstName || rx.providerLastName || rx.providerName) && (
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                      Prescribed by: Dr. {rx.providerFirstName && rx.providerLastName ? `${rx.providerFirstName} ${rx.providerLastName}` : rx.providerName}
                      {rx.providerSpecialization && ` (${rx.providerSpecialization})`}
                    </p>
                  )}
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
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    rx.status === 'Active'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                  }`}>
                    {rx.status}
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => {
                        setEditingPrescription(rx);
                        setShowPrescriptionForm(true);
                      }}
                      className={`p-2 rounded-lg hover:bg-blue-100 transition-colors ${theme === 'dark' ? 'hover:bg-blue-900/20' : ''}`}
                      title="Edit prescription"
                    >
                      <Edit className="w-4 h-4 text-blue-500" />
                    </button>
                    <button
                      onClick={() => setDeletingPrescription(rx)}
                      className={`p-2 rounded-lg hover:bg-red-100 transition-colors ${theme === 'dark' ? 'hover:bg-red-900/20' : ''}`}
                      title="Delete prescription"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAppointments = () => (
    <div className="space-y-4">
      <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Appointments
      </h3>
      {appointments.length === 0 ? (
        <div className={`text-center py-12 rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <Calendar className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>No appointments found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {appt.type || 'Appointment'}
                  </h4>
                  <div className={`flex items-center gap-2 mt-1 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    <Clock className="w-4 h-4" />
                    <span>{formatDate(appt.start_time)} at {formatTime(appt.start_time)}</span>
                  </div>
                  {appt.reason && (
                    <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {appt.reason}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  appt.status === 'Completed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : appt.status === 'Cancelled'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {appt.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : ''}`}
        >
          <ArrowLeft className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
        </button>
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Patient History
          </h1>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            {patientData.first_name} {patientData.last_name}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        {[
          { id: 'overview', label: 'Overview', icon: User, count: null },
          { id: 'records', label: 'Records', icon: FileText, count: medicalRecords.length },
          { id: 'diagnoses', label: 'Diagnoses', icon: Activity, count: diagnoses.length },
          { id: 'prescriptions', label: 'Prescriptions', icon: Pill, count: prescriptions.length },
          { id: 'appointments', label: 'Appointments', icon: Calendar, count: appointments.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === tab.id
                ? `border-b-2 ${theme === 'dark' ? 'border-blue-500 text-blue-500' : 'border-blue-600 text-blue-600'}`
                : `${theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-gray-600 hover:text-gray-900'}`
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== null && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id
                  ? `${theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'}`
                  : `${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'records' && renderRecords()}
        {activeTab === 'diagnoses' && renderDiagnoses()}
        {activeTab === 'prescriptions' && renderPrescriptions()}
        {activeTab === 'appointments' && renderAppointments()}
      </div>

      {/* Diagnosis Form Modal */}
      {showDiagnosisForm && (
        <DiagnosisForm
          theme={theme}
          api={api}
          patient={patientData}
          patients={patients}
          providers={providers}
          user={user}
          editDiagnosis={editingDiagnosis}
          onClose={() => {
            setShowDiagnosisForm(false);
            setEditingDiagnosis(null);
          }}
          onSuccess={() => {
            setShowDiagnosisForm(false);
            setEditingDiagnosis(null);
            fetchPatientHistory();
          }}
          addNotification={addNotification}
        />
      )}

      {/* Delete Diagnosis Confirmation Modal */}
      <ConfirmationModal
        theme={theme}
        isOpen={!!deletingDiagnosis}
        onClose={() => setDeletingDiagnosis(null)}
        onConfirm={handleDeleteDiagnosis}
        title="Delete Diagnosis"
        message={`Are you sure you want to delete this diagnosis? This action cannot be undone.`}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Delete Prescription Confirmation Modal */}
      <ConfirmationModal
        theme={theme}
        isOpen={!!deletingPrescription}
        onClose={() => setDeletingPrescription(null)}
        onConfirm={handleDeletePrescription}
        title="Delete Prescription"
        message={`Are you sure you want to delete this prescription? This action cannot be undone.`}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Prescription Form Modal */}
      {showPrescriptionForm && (
        <PrescriptionFormModal
          theme={theme}
          api={api}
          prescription={editingPrescription}
          patient={patientData}
          user={user}
          onClose={() => {
            setShowPrescriptionForm(false);
            setEditingPrescription(null);
          }}
          onSave={handleSavePrescription}
        />
      )}
    </div>
  );
};

// Prescription Form Modal Component
const PrescriptionFormModal = ({ theme, api, prescription, patient, user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    medication_name: prescription?.medicationName || prescription?.medication_name || '',
    dosage: prescription?.dosage || '',
    frequency: prescription?.frequency || '',
    duration: prescription?.duration || '',
    quantity: prescription?.quantity || '',
    refills: prescription?.refills || prescription?.refillsRemaining || 0,
    instructions: prescription?.instructions || '',
    pharmacy_name: prescription?.pharmacyName || prescription?.pharmacy_name || '',
    status: prescription?.status || 'Active'
  });

  const [selectedMedications, setSelectedMedications] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // When medication is selected from search, populate form fields
  const handleMedicationSelect = (medications) => {
    setSelectedMedications(medications);
    if (medications.length > 0) {
      const med = medications[0]; // Take first selected medication
      setFormData(prev => ({
        ...prev,
        medication_name: med.drug_name || med.brand_name || '',
        dosage: med.strength || prev.dosage,
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${
          theme === 'dark' ? 'bg-slate-800' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {prescription ? 'Edit Prescription' : 'New Prescription'}
          </h3>
          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Patient: {patient.first_name} {patient.last_name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Medication Search */}
          {!prescription && (
            <MedicationMultiSelect
              theme={theme}
              api={api}
              value={selectedMedications}
              onChange={handleMedicationSelect}
              label="Search Medication (optional)"
              placeholder="Search to auto-fill medication details..."
            />
          )}

          {/* Medication Name */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              Medication Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.medication_name}
              onChange={(e) => handleChange('medication_name', e.target.value)}
              required
              className={`w-full px-3 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              placeholder="Enter medication name or search above"
            />
          </div>

          {/* Dosage and Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Dosage <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.dosage}
                onChange={(e) => handleChange('dosage', e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="e.g., 10mg"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Frequency <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.frequency}
                onChange={(e) => handleChange('frequency', e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="e.g., Once daily"
              />
            </div>
          </div>

          {/* Duration and Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Duration
              </label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e) => handleChange('duration', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="e.g., 30 days"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="e.g., 30"
              />
            </div>
          </div>

          {/* Refills and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Refills
              </label>
              <input
                type="number"
                value={formData.refills}
                onChange={(e) => handleChange('refills', e.target.value)}
                min="0"
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Pharmacy Name */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              Pharmacy Name
            </label>
            <input
              type="text"
              value={formData.pharmacy_name}
              onChange={(e) => handleChange('pharmacy_name', e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              placeholder="Enter pharmacy name"
            />
          </div>

          {/* Instructions */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              Instructions
            </label>
            <textarea
              value={formData.instructions}
              onChange={(e) => handleChange('instructions', e.target.value)}
              rows="3"
              className={`w-full px-3 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              placeholder="Enter special instructions"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-medium transition-colors"
            >
              {prescription ? 'Update Prescription' : 'Create Prescription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientHistoryView;
