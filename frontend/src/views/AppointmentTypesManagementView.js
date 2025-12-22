import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ArrowLeft, Clock, Inbox, Search } from 'lucide-react';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import NewAppointmentTypeForm from '../components/forms/NewAppointmentTypeForm';

const AppointmentTypesManagementView = ({
  theme,
  api,
  setShowForm,
  setEditingAppointmentType,
  setCurrentModule,
  addNotification,
  t = {}
}) => {
  const [appointmentTypes, setAppointmentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showFormLocal, setShowFormLocal] = useState(false);
  const [editingAppointmentTypeLocal, setEditingAppointmentTypeLocal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAppointmentTypes();
  }, []);

  const loadAppointmentTypes = async () => {
    try {
      setLoading(true);
      const data = await api.getAppointmentTypes();
      setAppointmentTypes(data || []);
    } catch (error) {
      console.error('Error loading appointment types:', error);
      addNotification('alert', 'Failed to load appointment types');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeletingId(id);
    setShowDeleteConfirmation(true);
  };

  const handleDelete = async () => {
    try {
      await api.deleteAppointmentType(deletingId);
      setAppointmentTypes(prev => prev.filter(apt => apt.id !== deletingId));
      addNotification('success', 'Appointment type deleted successfully');
    } catch (error) {
      console.error('Error deleting appointment type:', error);
      addNotification('alert', 'Failed to delete appointment type');
    } finally {
      setShowDeleteConfirmation(false);
      setDeletingId(null);
    }
  };

  const handleEdit = (appointmentType) => {
    setEditingAppointmentTypeLocal(appointmentType);
    setShowFormLocal(true);
  };

  const handleFormSuccess = (newAppointmentType) => {
    setShowFormLocal(false);
    setEditingAppointmentTypeLocal(null);
    loadAppointmentTypes();
  };

  const filteredAppointmentTypes = appointmentTypes.filter(apt => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      apt.name?.toLowerCase().includes(searchLower) ||
      apt.description?.toLowerCase().includes(searchLower) ||
      (apt.isActive || apt.is_active ? 'active' : 'inactive').includes(searchLower)
    );
  });

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showDeleteConfirmation}
        onClose={() => {
          setShowDeleteConfirmation(false);
          setDeletingId(null);
        }}
        onConfirm={handleDelete}
        title="Delete Appointment Type"
        message="Are you sure you want to delete this appointment type? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentModule && setCurrentModule('crm')}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
              title={t.backToCRM || 'Back to CRM'}
            >
              <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
            <Clock className="w-6 h-6 text-purple-400" />
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t.appointmentTypes || 'Appointment Types'}
            </h2>
          </div>
          <button
            onClick={() => {
              setEditingAppointmentTypeLocal(null);
              setShowFormLocal(true);
            }}
            className={`flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            <Plus className="w-4 h-4" />
            {t.createAppointmentType || 'Create Appointment Type'}
          </button>
        </div>

        {/* Inline Appointment Type Form */}
        {showFormLocal && (
          <div className="mb-6">
            <NewAppointmentTypeForm
              theme={theme}
              api={api}
              onClose={() => {
                setShowFormLocal(false);
                setEditingAppointmentTypeLocal(null);
              }}
              onSuccess={handleFormSuccess}
              addNotification={addNotification}
              t={t || {}}
            />
          </div>
        )}

        {/* Search Box */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-300'}`}>
          <Search className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search appointment types by name, description, or status..."
            className={`flex-1 bg-transparent border-none outline-none ${theme === 'dark' ? 'text-white placeholder-slate-500' : 'text-gray-900 placeholder-gray-400'}`}
          />
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme === 'dark' ? 'border-purple-400' : 'border-purple-600'}`}></div>
          </div>
        ) : appointmentTypes.length === 0 ? (
          <div className={`bg-gradient-to-br rounded-xl border p-12 ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
            <div className="flex flex-col items-center justify-center text-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-200'}`}>
                <Inbox className={`w-12 h-12 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t.noAppointmentTypesTitle || 'No Appointment Types Yet'}
              </h3>
              <p className={`mb-6 max-w-md ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                {t.noAppointmentTypesMessage || 'Get started by creating your first appointment type to organize your schedule and allow patients to book appointments.'}
              </p>
              <button
                onClick={() => {
                  setEditingAppointmentTypeLocal(null);
                  setShowFormLocal(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors text-white font-medium"
              >
                <Plus className="w-5 h-5" />
                {t.createFirstAppointmentType || 'Create Your First Appointment Type'}
              </button>
            </div>
          </div>
        ) : filteredAppointmentTypes.length === 0 ? (
          <div className={`bg-gradient-to-br rounded-xl border p-12 ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
            <div className="flex flex-col items-center justify-center text-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-200'}`}>
                <Search className={`w-12 h-12 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                No Results Found
              </h3>
              <p className={`mb-6 max-w-md ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                No appointment types match your search "{searchQuery}". Try different keywords.
              </p>
            </div>
          </div>
        ) : (
          <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
                  <tr>
                    <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t.name || 'Name'}
                    </th>
                    <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t.description || 'Description'}
                    </th>
                    <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t.duration || 'Duration'}
                    </th>
                    <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t.status || 'Status'}
                    </th>
                    <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t.actions || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointmentTypes.map((apt, idx) => (
                    <tr key={apt.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: apt.color || '#3B82F6' }}
                          />
                          <div className="font-medium">{apt.name}</div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        {apt.description || '-'}
                      </td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        {apt.durationMinutes || apt.duration_minutes} min
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          apt.isActive || apt.is_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {apt.isActive || apt.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(apt)}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title={t.edit || 'Edit'}
                          >
                            <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(apt.id)}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title={t.delete || 'Delete'}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AppointmentTypesManagementView;
