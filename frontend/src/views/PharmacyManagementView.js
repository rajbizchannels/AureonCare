import React, { useState, useEffect } from 'react';
import { Pill, Plus, Edit, Trash2, ArrowLeft, RefreshCw, Search } from 'lucide-react';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import NewPharmacyForm from '../components/forms/NewPharmacyForm';

const PharmacyManagementView = ({
  theme,
  api,
  addNotification,
  setCurrentModule,
  t = {}
}) => {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  useEffect(() => {
    loadPharmacies();
  }, []);

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await api.deletePharmacy(deleteConfirm.id);
      await addNotification('success', `Pharmacy "${deleteConfirm.pharmacyName}" deleted successfully`);
      setDeleteConfirm(null);
      await loadPharmacies();
    } catch (error) {
      console.error('Error deleting pharmacy:', error);
      addNotification('alert', 'Failed to delete pharmacy');
    }
  };

  const filteredPharmacies = pharmacies.filter(pharmacy => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      pharmacy.pharmacyName?.toLowerCase().includes(searchLower) ||
      pharmacy.chainName?.toLowerCase().includes(searchLower) ||
      pharmacy.city?.toLowerCase().includes(searchLower) ||
      pharmacy.state?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Pharmacy"
        message={`Are you sure you want to delete "${deleteConfirm?.pharmacyName}"? This action cannot be undone.`}
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
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <Pill className="w-5 h-5 text-white" />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t.pharmacyManagement || 'Pharmacy Management'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadPharmacies}
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
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Pharmacy
            </button>
          </div>
        </div>

        {/* Search */}
        <div className={`flex items-center gap-3 p-4 rounded-lg ${
          theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'
        }`}>
          <Search className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pharmacies by name, chain, city, or state..."
            className={`flex-1 bg-transparent border-none outline-none ${
              theme === 'dark' ? 'text-white placeholder-slate-400' : 'text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>

        {/* Pharmacy Form - Between search and list */}
        {showForm && (
          <div className="mb-6">
            <NewPharmacyForm
              theme={theme}
              api={api}
              onClose={() => {
                setShowForm(false);
                setEditingPharmacy(null);
              }}
              onSuccess={() => {
                setShowForm(false);
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
                    <div className="flex items-center gap-3">
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
                      onClick={() => setDeleteConfirm(pharmacy)}
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
      </div>
    </>
  );
};

export default PharmacyManagementView;
