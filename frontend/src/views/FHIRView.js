import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Download, Upload, Check, AlertCircle, FileText, User, Activity, ArrowLeft } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import { useAudit } from '../hooks/useAudit';

const FHIRView = ({ theme, api, patients, addNotification, setCurrentModule }) => {
  const [fhirResources, setFhirResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedResourceType, setSelectedResourceType] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const resourceTypes = ['all', 'Patient', 'Observation', 'Condition', 'Medication', 'Procedure'];

  const { logViewAccess } = useAudit();

  useEffect(() => {
    logViewAccess('FHIRView', {
      module: 'FHIR',
    });
  }, []);

  useEffect(() => {
    fetchFhirResources();
  }, [selectedResourceType, selectedPatient]);

  const fetchFhirResources = async () => {
    try {
      setLoading(true);
      const resourceType = selectedResourceType === 'all' ? null : selectedResourceType;
      const data = await api.getFhirResources(resourceType, selectedPatient);
      setFhirResources(data);
    } catch (error) {
      console.error('Error fetching FHIR resources:', error);
      addNotification('alert', 'Failed to load FHIR resources');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPatient = async (patientId) => {
    try {
      setSyncing(true);
      await api.syncPatientToFhir(patientId);
      addNotification('appointment', 'Patient synced to FHIR successfully');
      fetchFhirResources();
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
      addNotification('appointment', 'FHIR bundle downloaded successfully');
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

  const getPatientName = (patientId) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown Patient';
  };

  const filteredResources = selectedResourceType === 'all'
    ? fhirResources
    : fhirResources.filter(r => r.resource_type === selectedResourceType);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title="Back to Dashboard"
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
          <div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              FHIR HL7 Integration
            </h2>
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Fast Healthcare Interoperability Resources (FHIR R4)
            </p>
          </div>
        </div>
        <button
          onClick={fetchFhirResources}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Total Resources</h3>
            <Database className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`} />
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
      <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
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
                  className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400' : 'bg-cyan-100 hover:bg-cyan-200 text-cyan-700'} disabled:opacity-50`}
                  title="Sync to FHIR"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDownloadBundle(patient.id)}
                  className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`}
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
      <div className="flex items-center gap-4">
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
                  ? 'bg-cyan-500 text-white'
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
          FHIR Resources ({filteredResources.length})
        </h3>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
            <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              No FHIR resources found. Sync patients to create resources.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredResources.map((resource) => {
              const Icon = getResourceIcon(resource.resource_type);
              return (
                <div
                  key={resource.id}
                  className={`flex items-center justify-between p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-gray-100/30 hover:bg-gray-200/50'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
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
    </div>
  );
};

export default FHIRView;
