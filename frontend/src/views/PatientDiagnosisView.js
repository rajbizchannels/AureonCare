import React, { useState, useEffect } from 'react';
import { Activity, Plus, Search, Calendar, User, Edit2, Trash2, Filter, AlertCircle } from 'lucide-react';
import DiagnosisForm from '../components/forms/DiagnosisForm';
import ConfirmationModal from '../components/modals/ConfirmationModal';

/**
 * PatientDiagnosisView - Manage patient diagnoses in practice management
 *
 * Features:
 * - View all diagnoses for all patients or filter by patient
 * - Add new diagnosis with ICD/CPT codes
 * - Edit existing diagnoses
 * - Delete diagnoses with confirmation
 * - Search and filter capabilities
 */
const PatientDiagnosisView = ({ theme, api, addNotification }) => {
  const [diagnoses, setDiagnoses] = useState([]);
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [editingDiagnosis, setEditingDiagnosis] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPatient, setFilterPatient] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [diagnosisToDelete, setDiagnosisToDelete] = useState(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [diagnosesData, patientsData, providersData] = await Promise.all([
        api.getDiagnoses(),
        api.getPatients(),
        api.getProviders()
      ]);

      setDiagnoses(diagnosesData || []);
      setPatients(patientsData || []);
      setProviders(providersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      addNotification('alert', 'Failed to load diagnoses data');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle add new diagnosis
  const handleAddDiagnosis = (patient = null) => {
    setSelectedPatient(patient);
    setEditingDiagnosis(null);
    setShowDiagnosisForm(true);
  };

  // Handle edit diagnosis
  const handleEditDiagnosis = (diagnosis) => {
    // Parse metadata from notes if available
    let icdCodes = [];
    let cptCodes = [];

    if (diagnosis.diagnosisCode) {
      // Parse ICD codes from diagnosis_code field
      const codes = diagnosis.diagnosisCode.split(',').map(c => c.trim()).filter(Boolean);
      icdCodes = codes.map(code => ({
        code: code,
        description: diagnosis.diagnosisName || '',
        type: 'ICD-10'
      }));
    }

    // Try to parse metadata from notes
    if (diagnosis.notes) {
      const icdMatch = diagnosis.notes.match(/ICD Codes: (.*?)(?:\n|$)/);
      if (icdMatch) {
        const icdText = icdMatch[1];
        const icdParts = icdText.split(';').map(p => p.trim());
        icdCodes = icdParts.map(part => {
          const match = part.match(/([A-Z0-9.]+)\s*\((.*?)\)/);
          if (match) {
            return {
              code: match[1],
              description: match[2],
              type: 'ICD-10'
            };
          }
          return null;
        }).filter(Boolean);
      }

      const cptMatch = diagnosis.notes.match(/CPT Codes: (.*?)(?:\n|$)/);
      if (cptMatch) {
        const cptText = cptMatch[1];
        const cptParts = cptText.split(';').map(p => p.trim());
        cptCodes = cptParts.map(part => {
          const match = part.match(/([0-9]+[A-Z]?)\s*\((.*?)\)/);
          if (match) {
            return {
              code: match[1],
              description: match[2],
              type: 'CPT'
            };
          }
          return null;
        }).filter(Boolean);
      }
    }

    // Find patient for this diagnosis
    const patient = patients.find(p => p.id === diagnosis.patientId);

    setSelectedPatient(patient);
    setEditingDiagnosis({
      ...diagnosis,
      icdCodes,
      cptCodes
    });
    setShowDiagnosisForm(true);
  };

  // Handle delete diagnosis
  const handleDeleteDiagnosis = (diagnosis) => {
    setDiagnosisToDelete(diagnosis);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await api.deleteDiagnosis(diagnosisToDelete.id);
      setDiagnoses(diagnoses.filter(d => d.id !== diagnosisToDelete.id));
      addNotification('diagnosis', 'Diagnosis deleted successfully');
      setShowDeleteConfirm(false);
      setDiagnosisToDelete(null);
    } catch (error) {
      console.error('Error deleting diagnosis:', error);
      addNotification('alert', 'Failed to delete diagnosis');
    }
  };

  // Handle form success
  const handleFormSuccess = async (newDiagnosis) => {
    await loadData();
  };

  // Filter diagnoses
  const filteredDiagnoses = diagnoses.filter(diagnosis => {
    // Search filter
    const matchesSearch = !searchTerm ||
      diagnosis.diagnosisName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      diagnosis.diagnosisCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      diagnosis.patientName?.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchesStatus = filterStatus === 'all' || diagnosis.status === filterStatus;

    // Patient filter
    const matchesPatient = filterPatient === 'all' || diagnosis.patientId === filterPatient;

    return matchesSearch && matchesStatus && matchesPatient;
  });

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return theme === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800';
      case 'resolved':
        return theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800';
      case 'chronic':
        return theme === 'dark' ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-100 text-orange-800';
      default:
        return theme === 'dark' ? 'bg-gray-900/50 text-gray-300' : 'bg-gray-100 text-gray-800';
    }
  };

  // Get severity badge color
  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'mild':
        return theme === 'dark' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-800';
      case 'moderate':
        return theme === 'dark' ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-100 text-orange-800';
      case 'severe':
        return theme === 'dark' ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-800';
      default:
        return theme === 'dark' ? 'bg-gray-900/50 text-gray-300' : 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 ${
            theme === 'dark' ? 'border-blue-400' : 'border-blue-600'
          }`}></div>
          <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Loading diagnoses...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Patient Diagnoses
            </h1>
            <p className={`mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage patient diagnoses with ICD-10 and CPT codes
            </p>
          </div>
          <button
            onClick={() => handleAddDiagnosis()}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition-all flex items-center gap-2 font-medium shadow-lg"
          >
            <Plus className="w-5 h-5" />
            New Diagnosis
          </button>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <input
                type="text"
                placeholder="Search by patient name, diagnosis, or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg outline-none transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-500 focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                }`}
              />
            </div>
          </div>

          {/* Patient Filter */}
          <div>
            <select
              value={filterPatient}
              onChange={(e) => setFilterPatient(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              }`}
            >
              <option value="all">All Patients</option>
              {patients.map(patient => (
                <option key={patient.id} value={patient.id}>
                  {patient.first_name || patient.firstName} {patient.last_name || patient.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              }`}
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Resolved">Resolved</option>
              <option value="Chronic">Chronic</option>
            </select>
          </div>
        </div>
      </div>

      {/* Diagnoses List */}
      {filteredDiagnoses.length === 0 ? (
        <div className={`text-center py-12 rounded-lg border ${
          theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-gray-300 bg-gray-50'
        }`}>
          <Activity className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
          <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            {searchTerm || filterStatus !== 'all' || filterPatient !== 'all'
              ? 'No diagnoses found'
              : 'No diagnoses yet'}
          </h3>
          <p className={`mb-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
            {searchTerm || filterStatus !== 'all' || filterPatient !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first diagnosis'}
          </p>
          {!searchTerm && filterStatus === 'all' && filterPatient === 'all' && (
            <button
              onClick={() => handleAddDiagnosis()}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add First Diagnosis
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDiagnoses.map((diagnosis) => (
            <div
              key={diagnosis.id}
              className={`p-4 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Patient and Diagnosis Name */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                      <User className="w-4 h-4" />
                      <span className="font-medium">{diagnosis.patientName || 'Unknown Patient'}</span>
                    </div>
                    <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>•</span>
                    <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {diagnosis.diagnosisName || 'Unnamed Diagnosis'}
                    </span>
                  </div>

                  {/* Codes */}
                  {diagnosis.diagnosisCode && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {diagnosis.diagnosisCode.split(',').map((code, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-1 text-xs font-mono rounded ${
                            theme === 'dark'
                              ? 'bg-green-900/50 text-green-300 border border-green-700'
                              : 'bg-green-100 text-green-800 border border-green-300'
                          }`}
                        >
                          {code.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  {diagnosis.description && (
                    <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {diagnosis.description}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {new Date(diagnosis.diagnosedDate).toLocaleDateString()}
                      </span>
                    </div>
                    {diagnosis.providerName && (
                      <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Provider: {diagnosis.providerName}
                      </div>
                    )}
                    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(diagnosis.status)}`}>
                      {diagnosis.status}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded ${getSeverityColor(diagnosis.severity)}`}>
                      {diagnosis.severity}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEditDiagnosis(diagnosis)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-slate-700 text-blue-400'
                        : 'hover:bg-gray-100 text-blue-600'
                    }`}
                    title="Edit diagnosis"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteDiagnosis(diagnosis)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-slate-700 text-red-400'
                        : 'hover:bg-gray-100 text-red-600'
                    }`}
                    title="Delete diagnosis"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Diagnosis Form Modal */}
      {showDiagnosisForm && (
        <DiagnosisForm
          theme={theme}
          api={api}
          patient={selectedPatient}
          providers={providers}
          editDiagnosis={editingDiagnosis}
          onClose={() => {
            setShowDiagnosisForm(false);
            setSelectedPatient(null);
            setEditingDiagnosis(null);
          }}
          onSuccess={handleFormSuccess}
          addNotification={addNotification}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        theme={theme}
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDiagnosisToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Diagnosis"
        message={`Are you sure you want to delete this diagnosis${diagnosisToDelete ? ` for ${diagnosisToDelete.patientName}` : ''}? This action cannot be undone.`}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default PatientDiagnosisView;
