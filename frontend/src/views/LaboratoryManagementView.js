import React, { useState, useEffect } from 'react';
import { Microscope, Plus, Edit, Trash2, ArrowLeft, RefreshCw, Search } from 'lucide-react';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import NewLaboratoryForm from '../components/forms/NewLaboratoryForm';

const LaboratoryManagementView = ({
  theme,
  api,
  addNotification,
  setCurrentModule,
  t = {}
}) => {
  const [laboratories, setLaboratories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLaboratory, setEditingLaboratory] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  useEffect(() => {
    loadLaboratories();
  }, []);

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await api.deleteLaboratory(deleteConfirm.id);
      await addNotification('success', `Laboratory "${deleteConfirm.labName}" deleted successfully`);
      setDeleteConfirm(null);
      await loadLaboratories();
    } catch (error) {
      console.error('Error deleting laboratory:', error);
      addNotification('alert', 'Failed to delete laboratory');
    }
  };

  const filteredLaboratories = laboratories.filter(lab => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      lab.labName?.toLowerCase().includes(searchLower) ||
      lab.specialty?.toLowerCase().includes(searchLower) ||
      lab.city?.toLowerCase().includes(searchLower) ||
      lab.state?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <>
      {showForm && (
        <NewLaboratoryForm
          theme={theme}
          api={api}
          onClose={() => {
            setShowForm(false);
            setEditingLaboratory(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingLaboratory(null);
            loadLaboratories();
          }}
          addNotification={addNotification}
          t={t}
        />
      )}

      <ConfirmationModal
        theme={theme}
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Laboratory"
        message={`Are you sure you want to delete "${deleteConfirm?.labName}"? This action cannot be undone.`}
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
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Microscope className="w-5 h-5 text-white" />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t.laboratoryManagement || 'Laboratory Management'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadLaboratories}
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
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Laboratory
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
            placeholder="Search laboratories by name, specialty, city, or state..."
            className={`flex-1 bg-transparent border-none outline-none ${
              theme === 'dark' ? 'text-white placeholder-slate-400' : 'text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>

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
                    <div className="flex items-center gap-3">
                      <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {lab.labName}
                      </h3>
                      {lab.specialty && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
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
                      onClick={() => setDeleteConfirm(lab)}
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

export default LaboratoryManagementView;
