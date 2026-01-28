import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, FileText, GitBranch, FileCheck, ArrowLeft, Search, X, Filter } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import NewIntakeFormForm from '../components/forms/NewIntakeFormForm';
import NewIntakeFlowForm from '../components/forms/NewIntakeFlowForm';
import NewConsentFormForm from '../components/forms/NewConsentFormForm';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import { useAudit } from '../hooks/useAudit';

const PatientIntakeView = ({
  theme,
  patients,
  setCurrentModule,
  addNotification,
  api,
  t = {}
}) => {
  const [activeTab, setActiveTab] = useState('forms');
  const [showIntakeFormForm, setShowIntakeFormForm] = useState(false);
  const [showFlowForm, setShowFlowForm] = useState(false);
  const [showConsentForm, setShowConsentForm] = useState(false);

  const [editingIntakeForm, setEditingIntakeForm] = useState(null);
  const [viewingIntakeForm, setViewingIntakeForm] = useState(null);
  const [editingFlow, setEditingFlow] = useState(null);
  const [viewingFlow, setViewingFlow] = useState(null);
  const [editingConsent, setEditingConsent] = useState(null);
  const [viewingConsent, setViewingConsent] = useState(null);

  // Confirmation modal states
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'confirm'
  });

  // Data states
  const [intakeForms, setIntakeForms] = useState([]);
  const [intakeFlows, setIntakeFlows] = useState([]);
  const [consentForms, setConsentForms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search states
  const [intakeFormSearch, setIntakeFormSearch] = useState('');
  const [flowSearch, setFlowSearch] = useState('');
  const [consentSearch, setConsentSearch] = useState('');

  const { logViewAccess } = useAudit();

  useEffect(() => {
    logViewAccess('PatientIntakeView', {
      module: 'Patient Intake',
    });
  }, []);

  // Close all forms when tab changes
  useEffect(() => {
    setShowIntakeFormForm(false);
    setShowFlowForm(false);
    setShowConsentForm(false);
    setEditingIntakeForm(null);
    setViewingIntakeForm(null);
    setEditingFlow(null);
    setViewingFlow(null);
    setEditingConsent(null);
    setViewingConsent(null);
  }, [activeTab]);

  // Fetch all intake data
  useEffect(() => {
    fetchIntakeData();
  }, []);

  const fetchIntakeData = async () => {
    setLoading(true);
    try {
      const [formsData, flowsData, consentsData] = await Promise.all([
        api.getIntakeForms().catch(() => []),
        api.getIntakeFlows().catch(() => []),
        api.getConsentForms().catch(() => [])
      ]);

      setIntakeForms(formsData || []);
      setIntakeFlows(flowsData || []);
      setConsentForms(consentsData || []);
    } catch (error) {
      console.error('Error fetching intake data:', error);
      addNotification('error', 'Failed to load intake data');
    } finally {
      setLoading(false);
    }
  };

  // Filter functions
  const filteredIntakeForms = intakeForms.filter(form => {
    if (!intakeFormSearch) return true;
    const searchLower = intakeFormSearch.toLowerCase();
    return (
      form.form_name?.toLowerCase().includes(searchLower) ||
      form.patient_name?.toLowerCase().includes(searchLower) ||
      form.form_type?.toLowerCase().includes(searchLower) ||
      form.status?.toLowerCase().includes(searchLower)
    );
  });

  const filteredFlows = intakeFlows.filter(flow => {
    if (!flowSearch) return true;
    const searchLower = flowSearch.toLowerCase();
    return (
      flow.flow_name?.toLowerCase().includes(searchLower) ||
      flow.patient_name?.toLowerCase().includes(searchLower) ||
      flow.flow_type?.toLowerCase().includes(searchLower) ||
      flow.status?.toLowerCase().includes(searchLower)
    );
  });

  const filteredConsents = consentForms.filter(consent => {
    if (!consentSearch) return true;
    const searchLower = consentSearch.toLowerCase();
    return (
      consent.consent_title?.toLowerCase().includes(searchLower) ||
      consent.patient_name?.toLowerCase().includes(searchLower) ||
      consent.consent_type?.toLowerCase().includes(searchLower) ||
      consent.status?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (status) => {
    const statusColors = {
      'draft': 'bg-gray-500/20 text-gray-400',
      'submitted': 'bg-blue-500/20 text-blue-400',
      'reviewed': 'bg-purple-500/20 text-purple-400',
      'approved': 'bg-green-500/20 text-green-400',
      'rejected': 'bg-red-500/20 text-red-400',
      'in_progress': 'bg-yellow-500/20 text-yellow-400',
      'completed': 'bg-green-500/20 text-green-400',
      'abandoned': 'bg-gray-500/20 text-gray-400',
      'expired': 'bg-red-500/20 text-red-400',
      'pending': 'bg-yellow-500/20 text-yellow-400',
      'signed': 'bg-green-500/20 text-green-400',
      'declined': 'bg-red-500/20 text-red-400',
      'revoked': 'bg-orange-500/20 text-orange-400'
    };
    return statusColors[status] || 'bg-gray-500/20 text-gray-400';
  };

  const renderIntakeForms = () => (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            value={intakeFormSearch}
            onChange={(e) => setIntakeFormSearch(e.target.value)}
            placeholder="Search intake forms by name, patient, type, or status..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
      </div>

      {/* View Intake Form Details */}
      {viewingIntakeForm && (
        <div className={`mb-4 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {viewingIntakeForm.form_name}
            </h3>
            <button
              onClick={() => setViewingIntakeForm(null)}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                {viewingIntakeForm.patient_name}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Form Type</label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                {viewingIntakeForm.form_type}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(viewingIntakeForm.status)}`}>
                  {viewingIntakeForm.status}
                </span>
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Created At</label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                {formatDate(viewingIntakeForm.created_at)}
              </div>
            </div>
            {viewingIntakeForm.notes && (
              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Notes</label>
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                  {viewingIntakeForm.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Intake Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIntakeForms.length === 0 ? (
          <div className={`col-span-full text-center py-12 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            {intakeFormSearch ? 'No intake forms found matching your search' : 'No intake forms yet'}
          </div>
        ) : (
          filteredIntakeForms.map((form) => (
            <div
              key={form.id}
              className={`p-4 rounded-xl border transition-all ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:border-blue-500/50' : 'bg-white border-gray-300 hover:border-blue-500/50'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className={`font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {form.form_name}
                  </h4>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {form.patient_name}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(form.status)}`}>
                  {form.status}
                </span>
              </div>

              <div className={`text-xs mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                <div>Type: {form.form_type}</div>
                <div>Created: {formatDate(form.created_at)}</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setViewingIntakeForm(viewingIntakeForm?.id === form.id ? null : form);
                    setShowIntakeFormForm(false);
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={() => {
                    setEditingIntakeForm(form);
                    setShowIntakeFormForm(true);
                    setViewingIntakeForm(null);
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400' : 'bg-blue-100 hover:bg-blue-200 text-blue-600'}`}
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Delete Intake Form',
                      message: 'Are you sure you want to delete this intake form? This action cannot be undone.',
                      type: 'danger',
                      onConfirm: async () => {
                        try {
                          await api.deleteIntakeForm(form.id);
                          setIntakeForms(prev => prev.filter(f => f.id !== form.id));
                          await addNotification('success', 'Intake form deleted successfully');
                        } catch (err) {
                          console.error('Error deleting intake form:', err);
                          addNotification('error', 'Failed to delete intake form');
                        }
                        setConfirmModal({ ...confirmModal, isOpen: false });
                      }
                    });
                  }}
                  className={`px-3 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-red-500/20' : 'hover:bg-red-100'}`}
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderFlows = () => (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            value={flowSearch}
            onChange={(e) => setFlowSearch(e.target.value)}
            placeholder="Search intake flows by name, patient, type, or status..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
      </div>

      {/* View Flow Details */}
      {viewingFlow && (
        <div className={`mb-4 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {viewingFlow.flow_name}
            </h3>
            <button
              onClick={() => setViewingFlow(null)}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                {viewingFlow.patient_name}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Flow Type</label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                {viewingFlow.flow_type}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Progress</label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                Step {viewingFlow.current_step} of {viewingFlow.total_steps}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(viewingFlow.status)}`}>
                  {viewingFlow.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Intake Flows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFlows.length === 0 ? (
          <div className={`col-span-full text-center py-12 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            {flowSearch ? 'No intake flows found matching your search' : 'No intake flows yet'}
          </div>
        ) : (
          filteredFlows.map((flow) => (
            <div
              key={flow.id}
              className={`p-4 rounded-xl border transition-all ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:border-green-500/50' : 'bg-white border-gray-300 hover:border-green-500/50'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className={`font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {flow.flow_name}
                  </h4>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {flow.patient_name}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(flow.status)}`}>
                  {flow.status}
                </span>
              </div>

              <div className={`text-xs mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                <div>Type: {flow.flow_type}</div>
                <div>Progress: Step {flow.current_step} of {flow.total_steps}</div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${(flow.current_step / flow.total_steps) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setViewingFlow(viewingFlow?.id === flow.id ? null : flow);
                    setShowFlowForm(false);
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={() => {
                    setEditingFlow(flow);
                    setShowFlowForm(true);
                    setViewingFlow(null);
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400' : 'bg-green-100 hover:bg-green-200 text-green-600'}`}
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Delete Intake Flow',
                      message: 'Are you sure you want to delete this intake flow? This action cannot be undone.',
                      type: 'danger',
                      onConfirm: async () => {
                        try {
                          await api.deleteIntakeFlow(flow.id);
                          setIntakeFlows(prev => prev.filter(f => f.id !== flow.id));
                          await addNotification('success', 'Intake flow deleted successfully');
                        } catch (err) {
                          console.error('Error deleting intake flow:', err);
                          addNotification('error', 'Failed to delete intake flow');
                        }
                        setConfirmModal({ ...confirmModal, isOpen: false });
                      }
                    });
                  }}
                  className={`px-3 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-red-500/20' : 'hover:bg-red-100'}`}
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderConsents = () => (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className={`absolute left-3 top-3 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            value={consentSearch}
            onChange={(e) => setConsentSearch(e.target.value)}
            placeholder="Search consent forms by title, patient, type, or status..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
      </div>

      {/* View Consent Details */}
      {viewingConsent && (
        <div className={`mb-4 p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {viewingConsent.consent_title}
            </h3>
            <button
              onClick={() => setViewingConsent(null)}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                {viewingConsent.patient_name}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Consent Type</label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                {viewingConsent.consent_type}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</label>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(viewingConsent.status)}`}>
                  {viewingConsent.status}
                </span>
              </div>
            </div>
            {viewingConsent.signed_at && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Signed At</label>
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                  {formatDate(viewingConsent.signed_at)}
                </div>
              </div>
            )}
            {viewingConsent.consent_description && (
              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Description</label>
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                  {viewingConsent.consent_description}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Consent Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredConsents.length === 0 ? (
          <div className={`col-span-full text-center py-12 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            {consentSearch ? 'No consent forms found matching your search' : 'No consent forms yet'}
          </div>
        ) : (
          filteredConsents.map((consent) => (
            <div
              key={consent.id}
              className={`p-4 rounded-xl border transition-all ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:border-purple-500/50' : 'bg-white border-gray-300 hover:border-purple-500/50'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className={`font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {consent.consent_title}
                  </h4>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {consent.patient_name}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(consent.status)}`}>
                  {consent.status}
                </span>
              </div>

              <div className={`text-xs mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                <div>Type: {consent.consent_type}</div>
                <div>Version: {consent.version}</div>
                {consent.signed_at && <div>Signed: {formatDate(consent.signed_at)}</div>}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setViewingConsent(viewingConsent?.id === consent.id ? null : consent);
                    setShowConsentForm(false);
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={() => {
                    setEditingConsent(consent);
                    setShowConsentForm(true);
                    setViewingConsent(null);
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400' : 'bg-purple-100 hover:bg-purple-200 text-purple-600'}`}
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Delete Consent Form',
                      message: 'Are you sure you want to delete this consent form? This action cannot be undone.',
                      type: 'danger',
                      onConfirm: async () => {
                        try {
                          await api.deleteConsentForm(consent.id);
                          setConsentForms(prev => prev.filter(c => c.id !== consent.id));
                          await addNotification('success', 'Consent form deleted successfully');
                        } catch (err) {
                          console.error('Error deleting consent form:', err);
                          addNotification('error', 'Failed to delete consent form');
                        }
                        setConfirmModal({ ...confirmModal, isOpen: false });
                      }
                    });
                  }}
                  className={`px-3 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-red-500/20' : 'hover:bg-red-100'}`}
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('crm')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title="Back to Patient CRM"
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
          <div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Patient Intake Forms
            </h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Manage patient intake forms, workflows, and consent documentation
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        {[
          { id: 'forms', label: 'Intake Forms', icon: FileText, count: intakeForms.length },
          { id: 'flows', label: 'Intake Flows', icon: GitBranch, count: intakeFlows.length },
          { id: 'consents', label: 'Consent Forms', icon: FileCheck, count: consentForms.length }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? `border-b-2 ${theme === 'dark' ? 'border-blue-500 text-blue-500' : 'border-blue-600 text-blue-600'}`
                  : `${theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-gray-600 hover:text-gray-900'}`
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id
                  ? `${theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`
                  : `${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-700'}`
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Add Button for Active Tab */}
      <div className="flex justify-end">
        {activeTab === 'forms' && (
          <button
            onClick={() => {
              setEditingIntakeForm(null);
              setShowIntakeFormForm(!showIntakeFormForm);
            }}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors`}
          >
            <Plus className="w-4 h-4" />
            New Intake Form
          </button>
        )}
        {activeTab === 'flows' && (
          <button
            onClick={() => {
              setEditingFlow(null);
              setShowFlowForm(!showFlowForm);
            }}
            className={`flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors`}
          >
            <GitBranch className="w-4 h-4" />
            New Intake Flow
          </button>
        )}
        {activeTab === 'consents' && (
          <button
            onClick={() => {
              setEditingConsent(null);
              setShowConsentForm(!showConsentForm);
            }}
            className={`flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors`}
          >
            <FileCheck className="w-4 h-4" />
            New Consent Form
          </button>
        )}
      </div>

      {/* Inline Forms */}
      {activeTab === 'forms' && showIntakeFormForm && (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewIntakeFormForm
            theme={theme}
            api={api}
            patients={patients}
            editingForm={editingIntakeForm}
            onClose={() => {
              setShowIntakeFormForm(false);
              setEditingIntakeForm(null);
            }}
            onSuccess={(form) => {
              if (editingIntakeForm) {
                setIntakeForms(intakeForms.map(f => f.id === form.id ? form : f));
                addNotification('success', 'Intake form updated successfully');
              } else {
                setIntakeForms([form, ...intakeForms]);
                addNotification('success', 'Intake form created successfully');
              }
              setShowIntakeFormForm(false);
              setEditingIntakeForm(null);
            }}
            addNotification={addNotification}
          />
        </div>
      )}

      {activeTab === 'flows' && showFlowForm && (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewIntakeFlowForm
            theme={theme}
            api={api}
            patients={patients}
            editingFlow={editingFlow}
            onClose={() => {
              setShowFlowForm(false);
              setEditingFlow(null);
            }}
            onSuccess={(flow) => {
              if (editingFlow) {
                setIntakeFlows(intakeFlows.map(f => f.id === flow.id ? flow : f));
                addNotification('success', 'Intake flow updated successfully');
              } else {
                setIntakeFlows([flow, ...intakeFlows]);
                addNotification('success', 'Intake flow created successfully');
              }
              setShowFlowForm(false);
              setEditingFlow(null);
            }}
            addNotification={addNotification}
          />
        </div>
      )}

      {activeTab === 'consents' && showConsentForm && (
        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <NewConsentFormForm
            theme={theme}
            api={api}
            patients={patients}
            editingConsent={editingConsent}
            onClose={() => {
              setShowConsentForm(false);
              setEditingConsent(null);
            }}
            onSuccess={(consent) => {
              if (editingConsent) {
                setConsentForms(consentForms.map(c => c.id === consent.id ? consent : c));
                addNotification('success', 'Consent form updated successfully');
              } else {
                setConsentForms([consent, ...consentForms]);
                addNotification('success', 'Consent form created successfully');
              }
              setShowConsentForm(false);
              setEditingConsent(null);
            }}
            addNotification={addNotification}
          />
        </div>
      )}

      {/* Content Area - Based on Active Tab */}
      <div className="mt-6">
        {activeTab === 'forms' && renderIntakeForms()}
        {activeTab === 'flows' && renderFlows()}
        {activeTab === 'consents' && renderConsents()}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        theme={theme}
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.type === 'danger' ? 'Delete' : 'Confirm'}
        cancelText="Cancel"
      />
    </div>
  );
};

export default PatientIntakeView;
