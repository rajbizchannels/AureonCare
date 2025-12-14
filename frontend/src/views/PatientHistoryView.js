import React, { useState, useEffect } from 'react';
import {
  User, Calendar, Activity, FileText, Pill, ArrowLeft,
  Edit, Trash2, Plus, Clock, MapPin, Phone, Mail, Microscope, Printer
} from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';
import DiagnosisForm from '../components/forms/DiagnosisForm';
import MedicationMultiSelect from '../components/forms/MedicationMultiSelect';
import MedicalCodeMultiSelect from '../components/forms/MedicalCodeMultiSelect';
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
      <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Lab Orders
      </h3>
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

                  <button
                    onClick={() => printLabOrder(order)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-blue-900/30 text-blue-400'
                        : 'hover:bg-blue-50 text-blue-600'
                    }`}
                    title="Print Lab Order"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
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
    </div>
  );
};

// Prescription Form Modal Component
const PrescriptionFormModal = ({ theme, api, prescription, patient, user, onClose, onSave }) => {
  // For edit mode, we still handle single prescription
  const [formData, setFormData] = useState({
    medication_name: prescription?.medicationName || prescription?.medication_name || '',
    dosage: prescription?.dosage || '',
    frequency: prescription?.frequency || '',
    duration: prescription?.duration || '',
    quantity: prescription?.quantity || '',
    refills: prescription?.refills || prescription?.refillsRemaining || 0,
    instructions: prescription?.instructions || '',
    pharmacy_id: prescription?.pharmacy_id || '',
    status: prescription?.status || 'Active',
    ndc_code: prescription?.ndc_code || ''
  });

  // For new prescriptions, support multiple medications (master-detail)
  const [medications, setMedications] = useState([]);
  const [selectedMedications, setSelectedMedications] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);
  const [createDiagnosis, setCreateDiagnosis] = useState(!prescription);
  const [diagnosisData, setDiagnosisData] = useState({
    diagnosisName: '',
    icdCodes: [], // Array of ICD code objects
    severity: 'Moderate',
    status: 'Active'
  });

  // Load pharmacies on mount
  useEffect(() => {
    const loadPharmacies = async () => {
      setLoadingPharmacies(true);
      try {
        const pharmaciesData = await api.getPharmacies?.();
        if (pharmaciesData) {
          setPharmacies(pharmaciesData);

          // Load patient's preferred pharmacy
          if (patient?.id && !prescription) {
            try {
              const preferredPharmacy = await api.getPatientPreferredPharmacy?.(patient.id);
              if (preferredPharmacy?.pharmacy_id) {
                setFormData(prev => ({ ...prev, pharmacy_id: preferredPharmacy.pharmacy_id }));
              }
            } catch (err) {
              console.log('Could not load preferred pharmacy:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error loading pharmacies:', err);
      } finally {
        setLoadingPharmacies(false);
      }
    };
    loadPharmacies();
  }, [api, patient, prescription]);

  // Load existing medication when editing
  useEffect(() => {
    const loadExistingMedication = async () => {
      if (!prescription) return;

      // Try to load full medication details by NDC code
      if (prescription.ndc_code || prescription.ndcCode) {
        try {
          const ndcCode = prescription.ndc_code || prescription.ndcCode;
          const medication = await api.getMedicationByNdc(ndcCode);
          if (medication) {
            setSelectedMedications([medication]);
            return;
          }
        } catch (err) {
          console.log('Could not load medication by NDC:', err);
        }
      }

      // Fallback: Create a basic medication object from prescription data
      const medicationName = prescription.medicationName || prescription.medication_name;
      if (medicationName) {
        const basicMedication = {
          ndc_code: prescription.ndc_code || prescription.ndcCode || '',
          drug_name: medicationName,
          generic_name: '',
          strength: prescription.dosage || '',
          dosage_form: '',
          brand_name: ''
        };
        setSelectedMedications([basicMedication]);
      }
    };
    loadExistingMedication();
  }, [prescription, api]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    let diagnosisId = prescription?.diagnosis_id;

    // Create diagnosis if checkbox is checked
    if (createDiagnosis && !prescription && medications.length > 0) {
      try {
        const firstMed = medications[0];
        // Get ICD codes as comma-separated string
        const icdCodeString = diagnosisData.icdCodes.map(c => c.code).join(', ');

        const newDiagnosis = await api.createDiagnosis({
          patientId: patient.id,
          providerId: user.id,
          diagnosisName: diagnosisData.diagnosisName || `Condition requiring ${firstMed.medication_name}`,
          diagnosisCode: icdCodeString,
          severity: diagnosisData.severity,
          status: diagnosisData.status,
          diagnosedDate: new Date().toISOString().split('T')[0],
          description: `Diagnosis created for prescription(s)`
        });
        diagnosisId = newDiagnosis.id;
      } catch (err) {
        console.error('Error creating diagnosis:', err);
      }
    }

    // Edit mode: Update single prescription
    if (prescription) {
      const prescriptionData = {
        ...formData,
        diagnosis_id: diagnosisId
      };
      onSave(prescriptionData);
    } else {
      // New mode: Create multiple prescriptions
      try {
        for (const med of medications) {
          const prescriptionData = {
            patient_id: patient.id,
            provider_id: user.id,
            medication_name: med.medication_name,
            dosage: med.dosage,
            frequency: med.frequency,
            duration: med.duration,
            quantity: med.quantity,
            refills: med.refills,
            instructions: med.instructions,
            pharmacy_id: formData.pharmacy_id,
            status: 'Active',
            ndc_code: med.ndc_code,
            diagnosis_id: diagnosisId
          };
          await api.createPrescription(prescriptionData);
        }
        onClose();
        window.location.reload(); // Refresh to show new prescriptions
      } catch (err) {
        console.error('Error creating prescriptions:', err);
      }
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Add medication to the list
  const handleAddMedication = () => {
    if (selectedMedications.length === 0) return;

    const med = selectedMedications[0];
    const newMed = {
      id: Date.now(),
      medication_name: med.drug_name || med.generic_name || med.brand_name || '',
      ndc_code: med.ndc_code || '',
      dosage: med.strength || '',
      frequency: 'Once daily',
      duration: '30 days',
      quantity: 30,
      refills: 0,
      instructions: ''
    };

    setMedications([...medications, newMed]);
    setSelectedMedications([]);
  };

  // Remove medication from list
  const handleRemoveMedication = (id) => {
    setMedications(medications.filter(m => m.id !== id));
  };

  // Update medication in list
  const handleUpdateMedication = (id, field, value) => {
    setMedications(medications.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  // When medication is selected from search (edit mode)
  const handleMedicationSelect = (meds) => {
    setSelectedMedications(meds);
    if (prescription && meds.length > 0) {
      const med = meds[0];
      setFormData(prev => ({
        ...prev,
        medication_name: med.drug_name || med.generic_name || med.brand_name || '',
        dosage: med.strength || prev.dosage,
        ndc_code: med.ndc_code || ''
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className={`max-w-5xl w-full max-h-[90vh] overflow-hidden rounded-xl shadow-2xl ${
          theme === 'dark' ? 'bg-slate-800' : 'bg-white'
        } flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {prescription ? 'Edit Prescription' : 'New Prescriptions'}
          </h3>
          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Patient: {patient.first_name} {patient.last_name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Edit Mode: Single Prescription */}
            {prescription ? (
              <>
                {/* Medication Search */}
                <MedicationMultiSelect
                  theme={theme}
                  api={api}
                  value={selectedMedications}
                  onChange={handleMedicationSelect}
                  label="Select Medication *"
                  placeholder="Search medication by name..."
                />

                {/* Prescription Details */}
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
                        theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
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
                        theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      placeholder="e.g., Once daily"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Duration
                    </label>
                    <input
                      type="text"
                      value={formData.duration}
                      onChange={(e) => handleChange('duration', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
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
                        theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      placeholder="e.g., 30"
                    />
                  </div>
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
                        theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
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
                        theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                {/* Pharmacy Dropdown */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Pharmacy
                  </label>
                  <select
                    value={formData.pharmacy_id}
                    onChange={(e) => handleChange('pharmacy_id', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    disabled={loadingPharmacies}
                  >
                    <option value="">Select pharmacy...</option>
                    {pharmacies.map(pharmacy => (
                      <option key={pharmacy.id} value={pharmacy.id}>
                        {pharmacy.pharmacy_name} - {pharmacy.city}, {pharmacy.state}
                      </option>
                    ))}
                  </select>
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
                      theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="Enter special instructions"
                  />
                </div>
              </>
            ) : (
              <>
                {/* New Mode: Master-Detail Layout */}
                <div className="grid grid-cols-3 gap-6">
                  {/* Left: Master - Add Medications */}
                  <div className={`col-span-1 p-4 rounded-lg border ${
                    theme === 'dark' ? 'border-slate-600 bg-slate-800/50' : 'border-gray-300 bg-gray-50'
                  }`}>
                    <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Add Medications
                    </h4>

                    {/* Medication Search */}
                    <MedicationMultiSelect
                      theme={theme}
                      api={api}
                      value={selectedMedications}
                      onChange={setSelectedMedications}
                      label="Search Medication"
                      placeholder="Search medication..."
                    />

                    {/* Add Button */}
                    <button
                      type="button"
                      onClick={handleAddMedication}
                      disabled={selectedMedications.length === 0}
                      className={`w-full mt-3 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
                        selectedMedications.length === 0
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      Add Medication
                    </button>

                    {/* Pharmacy Selection */}
                    <div className="mt-4">
                      <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        Pharmacy (for all)
                      </label>
                      <select
                        value={formData.pharmacy_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, pharmacy_id: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                        disabled={loadingPharmacies}
                      >
                        <option value="">Select pharmacy...</option>
                        {pharmacies.map(pharmacy => (
                          <option key={pharmacy.id} value={pharmacy.id}>
                            {pharmacy.pharmacy_name}
                          </option>
                        ))}
                      </select>
                      {formData.pharmacy_id && (
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                          From patient's preferred pharmacy
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Detail - Medications List */}
                  <div className="col-span-2">
                    <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Medications to Prescribe ({medications.length})
                    </h4>

                    {medications.length === 0 ? (
                      <div className={`text-center py-12 rounded-lg border-2 border-dashed ${
                        theme === 'dark' ? 'border-slate-600' : 'border-gray-300'
                      }`}>
                        <Pill className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
                        <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          No medications added yet
                        </p>
                        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                          Search and add medications from the left panel
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {medications.map((med) => (
                          <div
                            key={med.id}
                            className={`p-4 rounded-lg border ${
                              theme === 'dark' ? 'bg-slate-800/50 border-slate-600' : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <h5 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {med.medication_name}
                                </h5>
                                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                  NDC: {med.ndc_code || 'N/A'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveMedication(med.id)}
                                className={`p-1 rounded hover:bg-red-100 ${theme === 'dark' ? 'hover:bg-red-900/20' : ''}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={med.dosage}
                                onChange={(e) => handleUpdateMedication(med.id, 'dosage', e.target.value)}
                                placeholder="Dosage"
                                className={`px-2 py-1 text-sm rounded border ${
                                  theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                              <input
                                type="text"
                                value={med.frequency}
                                onChange={(e) => handleUpdateMedication(med.id, 'frequency', e.target.value)}
                                placeholder="Frequency"
                                className={`px-2 py-1 text-sm rounded border ${
                                  theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                              <input
                                type="text"
                                value={med.duration}
                                onChange={(e) => handleUpdateMedication(med.id, 'duration', e.target.value)}
                                placeholder="Duration"
                                className={`px-2 py-1 text-sm rounded border ${
                                  theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                              <input
                                type="number"
                                value={med.quantity}
                                onChange={(e) => handleUpdateMedication(med.id, 'quantity', e.target.value)}
                                placeholder="Quantity"
                                className={`px-2 py-1 text-sm rounded border ${
                                  theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                              <input
                                type="number"
                                value={med.refills}
                                onChange={(e) => handleUpdateMedication(med.id, 'refills', e.target.value)}
                                placeholder="Refills"
                                className={`px-2 py-1 text-sm rounded border ${
                                  theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                              <input
                                type="text"
                                value={med.instructions}
                                onChange={(e) => handleUpdateMedication(med.id, 'instructions', e.target.value)}
                                placeholder="Instructions"
                                className={`px-2 py-1 text-sm rounded border ${
                                  theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Create Diagnosis Option - Only for new prescriptions */}
                <div className="mt-4">
            <div className={`p-4 rounded-lg border ${
              theme === 'dark' ? 'border-slate-600 bg-slate-800/50' : 'border-gray-300 bg-gray-50'
            }`}>
              <label className="flex items-center gap-3 cursor-pointer group mb-3">
                <input
                  type="checkbox"
                  checked={createDiagnosis}
                  onChange={(e) => setCreateDiagnosis(e.target.checked)}
                  className="w-4 h-4 rounded border-2 border-purple-500 text-purple-600 focus:ring-purple-500 focus:ring-2 cursor-pointer"
                />
                <span className={`font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                  Create diagnosis for this prescription
                </span>
              </label>

              {createDiagnosis && (
                <div className="space-y-3 ml-7">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Diagnosis Name
                    </label>
                    <input
                      type="text"
                      value={diagnosisData.diagnosisName}
                      onChange={(e) => setDiagnosisData(prev => ({ ...prev, diagnosisName: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        theme === 'dark'
                          ? 'bg-slate-700 border-slate-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      placeholder={`Condition requiring ${formData.medication_name || 'medication'}`}
                    />
                  </div>

                  {/* ICD Codes Multiselect */}
                  <MedicalCodeMultiSelect
                    theme={theme}
                    api={api}
                    value={diagnosisData.icdCodes}
                    onChange={(codes) => setDiagnosisData(prev => ({ ...prev, icdCodes: codes }))}
                    codeType="icd"
                    label="ICD-10 Diagnosis Codes (Optional)"
                    placeholder="Search for ICD codes..."
                  />

                  {/* Severity */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Severity
                    </label>
                    <select
                      value={diagnosisData.severity}
                      onChange={(e) => setDiagnosisData(prev => ({ ...prev, severity: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        theme === 'dark'
                          ? 'bg-slate-700 border-slate-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="Mild">Mild</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Severe">Severe</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
                </div>
              </>
            )}
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
              disabled={!prescription && medications.length === 0}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                !prescription && medications.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
              }`}
            >
              {prescription ? 'Update Prescription' : `Create ${medications.length} Prescription${medications.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientHistoryView;
