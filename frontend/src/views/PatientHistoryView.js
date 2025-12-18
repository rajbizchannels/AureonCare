import React, { useState, useEffect } from 'react';
import {
  User, Calendar, Activity, FileText, Pill, ArrowLeft,
  Edit, Trash2, Plus, Clock, MapPin, Phone, Mail, Microscope, Printer
} from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';
import DiagnosisForm from '../components/forms/DiagnosisForm';
import MedicationMultiSelect from '../components/forms/MedicationMultiSelect';
import MedicalCodeMultiSelect from '../components/forms/MedicalCodeMultiSelect';
import NewLabOrderForm from '../components/forms/NewLabOrderForm';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import EPrescribeModal from '../components/modals/ePrescribeModal';

const PatientHistoryView = ({ theme, api, addNotification, user, patient, onBack }) => {
  const [activeTab, setActiveTab] = useState('prescriptions');
  const [loading, setLoading] = useState(true);

  // Data states
  const [patientData, setPatientData] = useState(patient || {});
  const [appointments, setAppointments] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
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
  const [showEPrescribeModal, setShowEPrescribeModal] = useState(false);

  // Lab order modal states
  const [showLabOrderForm, setShowLabOrderForm] = useState(false);
  const [editingLabOrder, setEditingLabOrder] = useState(null);
  const [deletingLabOrder, setDeletingLabOrder] = useState(null);

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
      const [appts, diags, presc, labOrds, records, fullPatient] = await Promise.all([
        api.getAppointments().then(all => all.filter(a => a.patient_id?.toString() === patientId?.toString())),
        api.getDiagnoses ? api.getDiagnoses(patientId) : Promise.resolve([]),
        api.getPatientActivePrescriptions ? api.getPatientActivePrescriptions(patientId).catch(() => []) : Promise.resolve([]),
        api.getLabOrders ? api.getLabOrders({ patient_id: patientId }).catch(() => []) : Promise.resolve([]),
        api.getMedicalRecords ? api.getMedicalRecords(patientId) : Promise.resolve([]),
        api.getPatientProfile ? api.getPatientProfile(patientId).catch(() => patient) : Promise.resolve(patient)
      ]);

      setAppointments(appts);
      setDiagnoses(diags);
      setPrescriptions(presc);
      setLabOrders(labOrds);
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

  const handleDeleteLabOrder = async () => {
    if (!deletingLabOrder) return;

    try {
      await api.deleteLabOrder(deletingLabOrder.id);
      addNotification('success', 'Lab order cancelled successfully');
      setDeletingLabOrder(null);
      fetchPatientHistory();
    } catch (error) {
      console.error('Error deleting lab order:', error);
      addNotification('error', 'Failed to cancel lab order');
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
          onClick={() => setShowEPrescribeModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New ePrescription
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
                        setShowEPrescribeModal(true);
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

  const printLabOrder = (order) => {
    const printWindow = window.open('', '_blank');
    const testCodes = order.test_codes ? (typeof order.test_codes === 'string' ? JSON.parse(order.test_codes) : order.test_codes) : [];
    const diagnosisCodes = order.diagnosis_codes ? (typeof order.diagnosis_codes === 'string' ? JSON.parse(order.diagnosis_codes) : order.diagnosis_codes) : [];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lab Order - ${order.order_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #000; }
          .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #555; }
          .section { margin: 20px 0; }
          .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          .field { margin: 8px 0; }
          .field-label { font-weight: bold; display: inline-block; width: 150px; }
          .field-value { display: inline; }
          .badge { display: inline-block; padding: 4px 8px; background: #e5e7eb; border-radius: 4px; font-size: 12px; margin: 2px; }
          .badge-priority { background: #fef3c7; }
          .badge-urgent { background: #fecaca; }
          .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; font-size: 12px; color: #666; }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Laboratory Order</h1>
          <p>Order Number: ${order.order_number}</p>
          <p>Order Date: ${formatDate(order.created_at)}</p>
        </div>

        <div class="section">
          <div class="section-title">Patient Information</div>
          <div class="field">
            <span class="field-label">Name:</span>
            <span class="field-value">${patientData.first_name} ${patientData.last_name}</span>
          </div>
          <div class="field">
            <span class="field-label">MRN:</span>
            <span class="field-value">${patientData.mrn || 'N/A'}</span>
          </div>
          <div class="field">
            <span class="field-label">Date of Birth:</span>
            <span class="field-value">${patientData.date_of_birth ? formatDate(patientData.date_of_birth) : patientData.dob ? formatDate(patientData.dob) : 'N/A'}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Order Details</div>
          <div class="field">
            <span class="field-label">Priority:</span>
            <span class="badge ${order.priority === 'urgent' || order.priority === 'stat' ? 'badge-urgent' : 'badge-priority'}">${(order.priority || 'routine').toUpperCase()}</span>
          </div>
          ${order.order_status ? `
          <div class="field">
            <span class="field-label">Status:</span>
            <span class="field-value">${order.order_status.replace('-', ' ').toUpperCase()}</span>
          </div>` : ''}
          ${order.order_status_date ? `
          <div class="field">
            <span class="field-label">${order.order_status === 'future' ? 'Scheduled Date:' : 'Latest Date:'}</span>
            <span class="field-value">${formatDate(order.order_status_date)}</span>
          </div>` : ''}
          ${order.frequency ? `
          <div class="field">
            <span class="field-label">Frequency:</span>
            <span class="field-value">${order.frequency.toUpperCase()}</span>
          </div>` : ''}
          ${order.collection_class ? `
          <div class="field">
            <span class="field-label">Collection Class:</span>
            <span class="field-value">${order.collection_class.replace('-', ' ').toUpperCase()}</span>
          </div>` : ''}
          ${order.result_recipients ? `
          <div class="field">
            <span class="field-label">Result Recipients:</span>
            <span class="field-value">${order.result_recipients.replace('-', ', ').toUpperCase()}</span>
          </div>` : ''}
        </div>

        <div class="section">
          <div class="section-title">Laboratory Tests</div>
          ${testCodes.length > 0 ? testCodes.map(code => `<div class="badge">${code}</div>`).join('') : '<p>No test codes specified</p>'}
        </div>

        ${diagnosisCodes.length > 0 ? `
        <div class="section">
          <div class="section-title">Diagnosis Codes</div>
          ${diagnosisCodes.map(code => `<div class="badge">${code}</div>`).join('')}
        </div>` : ''}

        ${order.clinical_notes ? `
        <div class="section">
          <div class="section-title">Clinical Notes</div>
          <p>${order.clinical_notes}</p>
        </div>` : ''}

        ${order.special_instructions ? `
        <div class="section">
          <div class="section-title">Special Instructions</div>
          <p>${order.special_instructions}</p>
        </div>` : ''}

        <div class="footer">
          <p>Printed on: ${new Date().toLocaleString()}</p>
          <p>This is an official laboratory order. Please retain for your records.</p>
        </div>

        <script>
          window.onload = () => {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderLabOrders = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Lab Orders
        </h3>
        <button
          onClick={() => {
            setEditingLabOrder(null);
            setShowLabOrderForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Lab Order
        </button>
      </div>
      {labOrders.length === 0 ? (
        <div className={`text-center py-12 rounded-xl border ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <Microscope className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>No lab orders found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {labOrders.map((order) => {
            const testCodes = order.test_codes ? (typeof order.test_codes === 'string' ? JSON.parse(order.test_codes) : order.test_codes) : [];
            const diagnosisCodes = order.diagnosis_codes ? (typeof order.diagnosis_codes === 'string' ? JSON.parse(order.diagnosis_codes) : order.diagnosis_codes) : [];

            return (
              <div
                key={order.id}
                className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {order.order_number}
                      </h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'completed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : order.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : order.status === 'sent_to_lab'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {order.status?.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.priority === 'stat'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : order.priority === 'urgent'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {(order.priority || 'routine').toUpperCase()}
                      </span>
                    </div>

                    <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      Order Date: {formatDate(order.created_at)}
                    </p>

                    {order.provider_name && (
                      <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                        Ordered by: Dr. {order.provider_name}
                      </p>
                    )}

                    {testCodes.length > 0 && (
                      <div className="mb-2">
                        <p className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Test Codes (CPT):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {testCodes.map((code, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {diagnosisCodes.length > 0 && (
                      <div className="mb-2">
                        <p className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Diagnosis Codes (ICD):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {diagnosisCodes.map((code, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {order.order_status && (
                      <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        Order Type: <span className="font-medium">{order.order_status.replace('-', ' ').toUpperCase()}</span>
                        {order.order_status_date && ` - ${order.order_status === 'future' ? 'Scheduled' : 'By'}: ${formatDate(order.order_status_date)}`}
                        {order.frequency && ` - Frequency: ${order.frequency.toUpperCase()}`}
                      </p>
                    )}

                    {order.collection_class && (
                      <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        Collection: <span className="font-medium">{order.collection_class.replace('-', ' ').toUpperCase()}</span>
                      </p>
                    )}

                    {order.result_recipients && (
                      <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        Recipients: <span className="font-medium">{order.result_recipients.replace(/-/g, ', ').toUpperCase()}</span>
                      </p>
                    )}

                    {order.special_instructions && (
                      <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        Instructions: {order.special_instructions}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setEditingLabOrder(order);
                        setShowLabOrderForm(true);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'dark'
                          ? 'hover:bg-blue-900/30 text-blue-400'
                          : 'hover:bg-blue-50 text-blue-600'
                      }`}
                      title="Edit Lab Order"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setDeletingLabOrder(order)}
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'dark'
                          ? 'hover:bg-red-900/30 text-red-400'
                          : 'hover:bg-red-50 text-red-600'
                      }`}
                      title="Cancel Lab Order"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => printLabOrder(order)}
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'dark'
                          ? 'hover:bg-green-900/30 text-green-400'
                          : 'hover:bg-green-50 text-green-600'
                      }`}
                      title="Print Lab Order"
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
          { id: 'labOrders', label: 'Lab Orders', icon: Microscope, count: labOrders.length },
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
        {activeTab === 'labOrders' && renderLabOrders()}
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

      {/* ePrescribe Modal */}
      {showEPrescribeModal && (
        <EPrescribeModal
          theme={theme}
          patient={patientData}
          provider={user}
          api={api}
          prescription={editingPrescription}
          onClose={() => {
            setShowEPrescribeModal(false);
            setEditingPrescription(null);
          }}
          onSuccess={(prescription) => {
            setShowEPrescribeModal(false);
            setEditingPrescription(null);
            addNotification('success', editingPrescription ? 'Prescription updated successfully' : 'Prescription created successfully');
            fetchPatientHistory(); // Refresh the prescriptions list
          }}
          addNotification={addNotification}
        />
      )}

      {/* Lab Order Form Modal */}
      {showLabOrderForm && (
        <NewLabOrderForm
          theme={theme}
          api={api}
          patient={patientData}
          patients={patients}
          providers={providers}
          user={user}
          editLabOrder={editingLabOrder}
          onClose={() => {
            setShowLabOrderForm(false);
            setEditingLabOrder(null);
          }}
          onSuccess={() => {
            setShowLabOrderForm(false);
            setEditingLabOrder(null);
            fetchPatientHistory();
          }}
          addNotification={addNotification}
          t={{}}
          createDiagnosisOption={false}
        />
      )}

      {/* Delete Lab Order Confirmation */}
      <ConfirmationModal
        theme={theme}
        isOpen={!!deletingLabOrder}
        onClose={() => setDeletingLabOrder(null)}
        onConfirm={handleDeleteLabOrder}
        title="Cancel Lab Order"
        message="Are you sure you want to cancel this lab order? This action cannot be undone."
        type="danger"
        confirmText="Cancel Order"
        cancelText="Keep Order"
      />

      {/* Delete Prescription Confirmation */}
      <ConfirmationModal
        theme={theme}
        isOpen={!!deletingPrescription}
        onClose={() => setDeletingPrescription(null)}
        onConfirm={handleDeletePrescription}
        title="Delete Prescription"
        message="Are you sure you want to delete this prescription? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Delete Diagnosis Confirmation */}
      <ConfirmationModal
        theme={theme}
        isOpen={!!deletingDiagnosis}
        onClose={() => setDeletingDiagnosis(null)}
        onConfirm={handleDeleteDiagnosis}
        title="Delete Diagnosis"
        message="Are you sure you want to delete this diagnosis? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default PatientHistoryView;
