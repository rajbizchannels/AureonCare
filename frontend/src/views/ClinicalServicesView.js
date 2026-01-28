import React, { useState, useEffect } from 'react';
import { Pill, Microscope, Plus, Edit, Trash2, ArrowLeft, RefreshCw, Search, Activity, Database, Download, Upload, User, FileText, AlertCircle, Check } from 'lucide-react';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import NewPharmacyForm from '../components/forms/NewPharmacyForm';
import NewLaboratoryForm from '../components/forms/NewLaboratoryForm';
import { useAudit } from '../hooks/useAudit';

const ClinicalServicesView = ({
  theme,
  api,
  addNotification,
  setCurrentModule,
  patients = [],
  t = {}
}) => {
  const [activeTab, setActiveTab] = useState('pharmacies');
  const [loading, setLoading] = useState(true);

  // Pharmacy state
  const [pharmacies, setPharmacies] = useState([]);
  const [showPharmacyForm, setShowPharmacyForm] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState(null);
  const [deletePharmacyConfirm, setDeletePharmacyConfirm] = useState(null);
  const [pharmacySearchQuery, setPharmacySearchQuery] = useState('');

  // Laboratory state
  const [laboratories, setLaboratories] = useState([]);
  const [showLabForm, setShowLabForm] = useState(false);
  const [editingLaboratory, setEditingLaboratory] = useState(null);
  const [deleteLabConfirm, setDeleteLabConfirm] = useState(null);
  const [labSearchQuery, setLabSearchQuery] = useState('');

  // FHIR state
  const [fhirResources, setFhirResources] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [selectedResourceType, setSelectedResourceType] = useState('all');

  const resourceTypes = ['all', 'Patient', 'Observation', 'Condition', 'Medication', 'Procedure', 'MedicationRequest', 'ServiceRequest'];

  const { logViewAccess } = useAudit();

  useEffect(() => {
    logViewAccess('ClinicalServicesView', {
      module: 'EHR',
    });
  }, []);

  useEffect(() => {
    if (activeTab === 'pharmacies') {
      loadPharmacies();
    } else if (activeTab === 'laboratories') {
      loadLaboratories();
    } else if (activeTab === 'fhir') {
      loadFhirResources();
    }
  }, [activeTab, selectedResourceType]);

  // Close forms when tab changes
  useEffect(() => {
    setShowPharmacyForm(false);
    setShowLabForm(false);
    setEditingPharmacy(null);
    setEditingLaboratory(null);
  }, [activeTab]);

  const loadPharmacies = async () => {
    setLoading(true);
    try {
      const data = await api.getPharmacies();
      setPharmacies(data);
    } catch (error) {
      console.error('Error loading pharmacies:', error);
      addNotification('alert', 'Failed to load pharmacies');
    } finally {
      setLoading(false);
    }
  };

  const loadLaboratories = async () => {
    setLoading(true);
    try {
      const data = await api.getLaboratories();
      setLaboratories(data);
    } catch (error) {
      console.error('Error loading laboratories:', error);
      addNotification('alert', 'Failed to load laboratories');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePharmacy = async () => {
    if (!deletePharmacyConfirm) return;

    try {
      await api.deletePharmacy(deletePharmacyConfirm.id);
      await addNotification('success', `Pharmacy "${deletePharmacyConfirm.pharmacyName}" deleted successfully`);
      setDeletePharmacyConfirm(null);
      await loadPharmacies();
    } catch (error) {
      console.error('Error deleting pharmacy:', error);
      addNotification('alert', 'Failed to delete pharmacy');
    }
  };

  const handleDeleteLaboratory = async () => {
    if (!deleteLabConfirm) return;

    try {
      await api.deleteLaboratory(deleteLabConfirm.id);
      await addNotification('success', `Laboratory "${deleteLabConfirm.labName}" deleted successfully`);
      setDeleteLabConfirm(null);
      await loadLaboratories();
    } catch (error) {
      console.error('Error deleting laboratory:', error);
      addNotification('alert', 'Failed to delete laboratory');
    }
  };

  const loadFhirResources = async () => {
    setLoading(true);
    try {
      const resourceType = selectedResourceType === 'all' ? null : selectedResourceType;
      const data = await api.getFhirResources(resourceType, null);
      setFhirResources(data);
    } catch (error) {
      console.error('Error loading FHIR resources:', error);
      addNotification('alert', 'Failed to load FHIR resources');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPatient = async (patientId) => {
    try {
      setSyncing(true);
      await api.syncPatientToFhir(patientId);
      addNotification('success', 'Patient synced to FHIR successfully');
      loadFhirResources();
    } catch (error) {
      console.error('Error syncing patient:', error);
      addNotification('alert', 'Failed to sync patient to FHIR');
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadBundle = async (patientId) => {
    try {
      const bundle = await api.getFhirBundle(patientId);
      const dataStr = JSON.stringify(bundle, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fhir-bundle-${patientId}.json`;
      link.click();
      URL.revokeObjectURL(url);
      addNotification('success', 'FHIR bundle downloaded successfully');
    } catch (error) {
      console.error('Error downloading bundle:', error);
      addNotification('alert', 'Failed to download FHIR bundle');
    }
  };

  const getResourceIcon = (resourceType) => {
    switch (resourceType) {
      case 'Patient':
        return User;
      case 'Observation':
      case 'Condition':
        return Activity;
      default:
        return FileText;
    }
  };

  const filteredPharmacies = pharmacies.filter(pharmacy => {
    if (!pharmacySearchQuery) return true;
    const searchLower = pharmacySearchQuery.toLowerCase();
    return (
      pharmacy.pharmacyName?.toLowerCase().includes(searchLower) ||
      pharmacy.chainName?.toLowerCase().includes(searchLower) ||
      pharmacy.city?.toLowerCase().includes(searchLower) ||
      pharmacy.state?.toLowerCase().includes(searchLower)
    );
  });

  const filteredLaboratories = laboratories.filter(lab => {
    if (!labSearchQuery) return true;
    const searchLower = labSearchQuery.toLowerCase();
    return (
      lab.labName?.toLowerCase().includes(searchLower) ||
      lab.specialty?.toLowerCase().includes(searchLower) ||
      lab.city?.toLowerCase().includes(searchLower) ||
      lab.state?.toLowerCase().includes(searchLower)
    );
  });

  const filteredFhirResources = selectedResourceType === 'all'
    ? fhirResources
    : fhirResources.filter(r => r.resource_type === selectedResourceType);

  const getPatientName = (patientId) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const tabs = [
    { id: 'pharmacies', label: 'Pharmacies', icon: Pill, count: pharmacies.length },
    { id: 'laboratories', label: 'Laboratories', icon: Microscope, count: laboratories.length },
    { id: 'fhir', label: 'FHIR Resources', icon: Database, count: fhirResources.length }
  ];

  const renderPharmacies = () => (
    <>
      {/* Search */}
      <div className={`flex items-center gap-3 p-4 rounded-lg ${
        theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'
      }`}>
        <Search className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        <input
          type="text"
          value={pharmacySearchQuery}
          onChange={(e) => setPharmacySearchQuery(e.target.value)}
          placeholder="Search pharmacies by name, chain, city, or state..."
          className={`flex-1 bg-transparent border-none outline-none ${
            theme === 'dark' ? 'text-white placeholder-slate-400' : 'text-gray-900 placeholder-gray-500'
          }`}
        />
      </div>

      {/* Pharmacy Form */}
      {showPharmacyForm && (
        <div className={`mb-6 p-6 rounded-xl border-2 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-600' : 'bg-white border-gray-400'}`}>
          <NewPharmacyForm
            theme={theme}
            api={api}
            editingPharmacy={editingPharmacy}
            onClose={() => {
              setShowPharmacyForm(false);
              setEditingPharmacy(null);
            }}
            onSuccess={() => {
              setShowPharmacyForm(false);
              setEditingPharmacy(null);
              loadPharmacies();
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {/* Pharmacies List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          <p className={`mt-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Loading pharmacies...
          </p>
        </div>
      ) : filteredPharmacies.length === 0 ? (
        <div className={`text-center py-12 rounded-lg border-2 border-dashed ${
          theme === 'dark' ? 'border-slate-700 text-slate-400' : 'border-gray-300 text-gray-600'
        }`}>
          <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No pharmacies found</p>
          <p className="text-sm mt-2">Add your first pharmacy to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPharmacies.map((pharmacy) => (
            <div
              key={pharmacy.id}
              className={`p-6 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {pharmacy.pharmacyName}
                    </h3>
                    {pharmacy.chainName && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {pharmacy.chainName}
                      </span>
                    )}
                    {pharmacy.isActive ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {pharmacy.addressLine1 && (
                      <div className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
                        📍 {pharmacy.addressLine1}
                        {pharmacy.addressLine2 && `, ${pharmacy.addressLine2}`}
                        {pharmacy.city && `, ${pharmacy.city}`}
                        {pharmacy.state && `, ${pharmacy.state}`}
                        {pharmacy.zipCode && ` ${pharmacy.zipCode}`}
                      </div>
                    )}
                    {pharmacy.phone && (
                      <div className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
                        📞 {pharmacy.phone}
                      </div>
                    )}
                    {pharmacy.email && (
                      <div className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
                        ✉️ {pharmacy.email}
                      </div>
                    )}
                    {pharmacy.ncpdpId && (
                      <div className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
                        NCPDP: {pharmacy.ncpdpId}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    {pharmacy.acceptsErx && (
                      <span className="text-green-600 dark:text-green-400">✓ eRx Enabled</span>
                    )}
                    {pharmacy.is24Hours && (
                      <span className="text-blue-600 dark:text-blue-400">✓ 24 Hours</span>
                    )}
                    {pharmacy.deliveryAvailable && (
                      <span className="text-purple-600 dark:text-purple-400">✓ Delivery</span>
                    )}
                    {pharmacy.driveThrough && (
                      <span className="text-orange-600 dark:text-orange-400">✓ Drive-Through</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingPharmacy(pharmacy);
                      setShowPharmacyForm(true);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-blue-900/30 text-blue-400'
                        : 'hover:bg-blue-100 text-blue-700'
                    }`}
                    title="Edit Pharmacy"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletePharmacyConfirm(pharmacy)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-red-900/30 text-red-400'
                        : 'hover:bg-red-50 text-red-600'
                    }`}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderLaboratories = () => (
    <>
      {/* Search */}
      <div className={`flex items-center gap-3 p-4 rounded-lg ${
        theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'
      }`}>
        <Search className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        <input
          type="text"
          value={labSearchQuery}
          onChange={(e) => setLabSearchQuery(e.target.value)}
          placeholder="Search laboratories by name, specialty, city, or state..."
          className={`flex-1 bg-transparent border-none outline-none ${
            theme === 'dark' ? 'text-white placeholder-slate-400' : 'text-gray-900 placeholder-gray-500'
          }`}
        />
      </div>

      {/* Laboratory Form */}
      {showLabForm && (
        <div className={`mb-6 p-6 rounded-xl border-2 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-600' : 'bg-white border-gray-400'}`}>
          <NewLaboratoryForm
            theme={theme}
            api={api}
            editingLaboratory={editingLaboratory}
            onClose={() => {
              setShowLabForm(false);
              setEditingLaboratory(null);
            }}
            onSuccess={() => {
              setShowLabForm(false);
              setEditingLaboratory(null);
              loadLaboratories();
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {/* Laboratories List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className={`mt-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Loading laboratories...
          </p>
        </div>
      ) : filteredLaboratories.length === 0 ? (
        <div className={`text-center py-12 rounded-lg border-2 border-dashed ${
          theme === 'dark' ? 'border-slate-700 text-slate-400' : 'border-gray-300 text-gray-600'
        }`}>
          <Microscope className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No laboratories found</p>
          <p className="text-sm mt-2">Add your first laboratory to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredLaboratories.map((lab) => (
            <div
              key={lab.id}
              className={`p-6 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {lab.labName}
                    </h3>
                    {lab.specialty && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        theme === 'dark' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-cyan-100 text-cyan-700'
                      }`}>
                        {lab.specialty}
                      </span>
                    )}
                    {lab.isActive ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {lab.addressLine1 && (
                      <div className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
                        📍 {lab.addressLine1}
                        {lab.addressLine2 && `, ${lab.addressLine2}`}
                        {lab.city && `, ${lab.city}`}
                        {lab.state && `, ${lab.state}`}
                        {lab.zipCode && ` ${lab.zipCode}`}
                      </div>
                    )}
                    {lab.phone && (
                      <div className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
                        📞 {lab.phone}
                      </div>
                    )}
                    {lab.email && (
                      <div className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
                        ✉️ {lab.email}
                      </div>
                    )}
                    {lab.cliaNumber && (
                      <div className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
                        CLIA: {lab.cliaNumber}
                      </div>
                    )}
                    {lab.npi && (
                      <div className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>
                        NPI: {lab.npi}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    {lab.acceptsElectronicOrders && (
                      <span className="text-blue-600 dark:text-blue-400">✓ Electronic Orders</span>
                    )}
                    {lab.website && (
                      <a
                        href={lab.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        🌐 Website
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingLaboratory(lab);
                      setShowLabForm(true);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-blue-900/30 text-blue-400'
                        : 'hover:bg-blue-100 text-blue-700'
                    }`}
                    title="Edit Laboratory"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteLabConfirm(lab)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-red-900/30 text-red-400'
                        : 'hover:bg-red-50 text-red-600'
                    }`}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderFHIR = () => (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Total Resources</h3>
            <Database className={`w-5 h-5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
          </div>
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{fhirResources.length}</p>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Patients</h3>
            <User className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
          </div>
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {fhirResources.filter(r => r.resource_type === 'Patient').length}
          </p>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>FHIR Version</h3>
            <Check className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>R4</p>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Status</h3>
            <Activity className={`w-5 h-5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
          </div>
          <p className={`text-lg font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>Active</p>
        </div>
      </div>

      {/* Patient Sync Section */}
      <div className={`bg-gradient-to-br rounded-xl p-6 border mb-6 ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Sync Patients to FHIR
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.slice(0, 6).map((patient) => (
            <div
              key={patient.id}
              className={`flex items-center justify-between p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/30' : 'bg-gray-100/30'}`}
            >
              <div>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {patient.first_name} {patient.last_name}
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  MRN: {patient.mrn}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSyncPatient(patient.id)}
                  disabled={syncing}
                  className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400' : 'bg-purple-100 hover:bg-purple-200 text-purple-700'} disabled:opacity-50`}
                  title="Sync to FHIR"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDownloadBundle(patient.id)}
                  className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-pink-500/20 hover:bg-pink-500/30 text-pink-400' : 'bg-pink-100 hover:bg-pink-200 text-pink-700'}`}
                  title="Download FHIR Bundle"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          Resource Type:
        </label>
        <div className="flex flex-wrap gap-2">
          {resourceTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedResourceType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedResourceType === type
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : theme === 'dark'
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* FHIR Resources List */}
      <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          FHIR Resources ({filteredFhirResources.length})
        </h3>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        ) : filteredFhirResources.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
            <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              No FHIR resources found. Sync patients to create resources.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFhirResources.map((resource) => {
              const Icon = getResourceIcon(resource.resource_type);
              return (
                <div
                  key={resource.id}
                  className={`flex items-center justify-between p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-gray-100/30 hover:bg-gray-200/50'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {resource.resource_type} - {resource.resource_id}
                      </p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {resource.patient_id && `Patient: ${getPatientName(resource.patient_id)}`}
                        {' · '}
                        Updated: {formatDate(resource.last_updated)}
                        {' · '}
                        Version: {resource.fhir_version}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const dataStr = JSON.stringify(resource.resource_data, null, 2);
                      const dataBlob = new Blob([dataStr], { type: 'application/json' });
                      const url = URL.createObjectURL(dataBlob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${resource.resource_type}-${resource.resource_id}.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Modals */}
      <ConfirmationModal
        theme={theme}
        isOpen={!!deletePharmacyConfirm}
        onClose={() => setDeletePharmacyConfirm(null)}
        onConfirm={handleDeletePharmacy}
        title="Delete Pharmacy"
        message={`Are you sure you want to delete "${deletePharmacyConfirm?.pharmacyName}"? This action cannot be undone.`}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />

      <ConfirmationModal
        theme={theme}
        isOpen={!!deleteLabConfirm}
        onClose={() => setDeleteLabConfirm(null)}
        onConfirm={handleDeleteLaboratory}
        title="Delete Laboratory"
        message={`Are you sure you want to delete "${deleteLabConfirm?.labName}"? This action cannot be undone.`}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentModule && setCurrentModule('dashboard')}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'
              }`}
              title="Back to Dashboard"
            >
              <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t.clinicalServices || 'Clinical Services'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (activeTab === 'pharmacies') loadPharmacies();
                else if (activeTab === 'laboratories') loadLaboratories();
                else if (activeTab === 'fhir') loadFhirResources();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            {activeTab !== 'fhir' && (
              <button
                onClick={() => activeTab === 'pharmacies' ? setShowPharmacyForm(true) : setShowLabForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add {activeTab === 'pharmacies' ? 'Pharmacy' : 'Laboratory'}
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? theme === 'dark'
                        ? 'border-purple-500 text-purple-400'
                        : 'border-purple-500 text-purple-600'
                      : theme === 'dark'
                      ? 'border-transparent text-slate-400 hover:text-slate-300'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                  {tab.count !== null && (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      activeTab === tab.id
                        ? theme === 'dark'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-purple-100 text-purple-700'
                        : theme === 'dark'
                        ? 'bg-slate-700 text-slate-400'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === 'pharmacies' && renderPharmacies()}
          {activeTab === 'laboratories' && renderLaboratories()}
          {activeTab === 'fhir' && renderFHIR()}
        </div>
      </div>
    </>
  );
};

export default ClinicalServicesView;
