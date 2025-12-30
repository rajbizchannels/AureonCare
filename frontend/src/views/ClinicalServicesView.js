import React, { useState, useEffect } from 'react';
import { Pill, Microscope, Plus, Edit, Trash2, ArrowLeft, RefreshCw, Search, Activity } from 'lucide-react';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import NewPharmacyForm from '../components/forms/NewPharmacyForm';
import NewLaboratoryForm from '../components/forms/NewLaboratoryForm';
import FHIRTrackingBadge from '../components/FHIRTrackingBadge';
import FHIRTracking from '../components/FHIRTracking';

const ClinicalServicesView = ({
  theme,
  api,
  addNotification,
  setCurrentModule,
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

  // FHIR Tracking state
  const [viewingTracking, setViewingTracking] = useState(null);

  useEffect(() => {
    if (activeTab === 'pharmacies') {
      loadPharmacies();
    } else if (activeTab === 'laboratories') {
      loadLaboratories();
    }
  }, [activeTab]);

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

  const tabs = [
    { id: 'pharmacies', label: 'Pharmacies', icon: Pill, count: pharmacies.length },
    { id: 'laboratories', label: 'Laboratories', icon: Microscope, count: laboratories.length }
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
              onClick={activeTab === 'pharmacies' ? loadPharmacies : loadLaboratories}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => activeTab === 'pharmacies' ? setShowPharmacyForm(true) : setShowLabForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add {activeTab === 'pharmacies' ? 'Pharmacy' : 'Laboratory'}
            </button>
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
        </div>
      </div>
    </>
  );
};

export default ClinicalServicesView;
