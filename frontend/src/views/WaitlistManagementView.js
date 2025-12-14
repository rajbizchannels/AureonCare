import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Bell, User, Calendar, ArrowLeft, RefreshCw } from 'lucide-react';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import { formatDate } from '../utils/formatters';

const WaitlistManagementView = ({
  theme,
  api,
  addNotification,
  setCurrentModule,
  t = {}
}) => {
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  const loadWaitlist = async () => {
    setLoading(true);
    try {
      const entries = await api.getAllWaitlist({ status: statusFilter === 'all' ? undefined : statusFilter });
      setWaitlistEntries(entries);
    } catch (error) {
      console.error('Error loading waitlist:', error);
      addNotification('alert', 'Failed to load waitlist entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWaitlist();
  }, [statusFilter]);

  const handleConfirmAppointment = (entry) => {
    setSelectedEntry(entry);
    setShowConfirmModal(true);
  };

  const handleActualConfirm = async () => {
    if (!selectedEntry) return;

    try {
      await api.markWaitlistScheduled(selectedEntry.id);
      await addNotification('success', `Waitlist entry confirmed for ${selectedEntry.patientFirstName} ${selectedEntry.patientLastName}`);
      setShowConfirmModal(false);
      setSelectedEntry(null);
      await loadWaitlist(); // Reload list
    } catch (error) {
      console.error('Error confirming waitlist entry:', error);
      addNotification('alert', 'Failed to confirm waitlist entry');
    }
  };

  const handleNotifyNext = async (date, providerId = null) => {
    try {
      const result = await api.notifyNextWaitlist({ date, providerId });
      if (result.success) {
        await addNotification('success', `Notified ${result.patient.name} about available slot`);
        await loadWaitlist();
      }
    } catch (error) {
      console.error('Error notifying next patient:', error);
      addNotification('alert', error.message || 'Failed to notify next patient');
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      notified: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      scheduled: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
      expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || statusColors.active}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityColors = {
      high: 'text-red-600 dark:text-red-400',
      medium: 'text-yellow-600 dark:text-yellow-400',
      low: 'text-green-600 dark:text-green-400'
    };

    return (
      <span className={`text-xs font-medium ${priorityColors[priority] || priorityColors.medium}`}>
        Priority: {priority || 'Medium'}
      </span>
    );
  };

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedEntry(null);
        }}
        onConfirm={handleActualConfirm}
        title="Confirm Waitlist Appointment"
        message={selectedEntry ? `Confirm appointment for ${selectedEntry.patientFirstName} ${selectedEntry.patientLastName} on ${formatDate(selectedEntry.preferredDate)}?` : ''}
        type="confirm"
        confirmText="Confirm & Schedule"
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
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t.waitlistManagement || 'Waitlist Management'}
            </h2>
          </div>
          <button
            onClick={loadWaitlist}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Status Filter */}
        <div className={`flex items-center gap-3 p-4 rounded-lg ${
          theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'
        }`}>
          <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
            Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg border outline-none transition-colors ${
              theme === 'dark'
                ? 'bg-slate-700 border-slate-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="notified">Notified</option>
            <option value="scheduled">Scheduled</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {/* Waitlist Entries */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <p className={`mt-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Loading waitlist...
            </p>
          </div>
        ) : waitlistEntries.length === 0 ? (
          <div className={`text-center py-12 rounded-lg border-2 border-dashed ${
            theme === 'dark' ? 'border-slate-700 text-slate-400' : 'border-gray-300 text-gray-600'
          }`}>
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No waitlist entries found</p>
            <p className="text-sm mt-2">There are no {statusFilter !== 'all' ? statusFilter : ''} waitlist entries at the moment.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {waitlistEntries.map((entry) => (
              <div
                key={entry.id}
                className={`p-6 rounded-lg border transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Patient Info */}
                    <div className="flex items-center gap-3">
                      <User className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`} />
                      <div>
                        <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {entry.patientFirstName} {entry.patientLastName}
                        </h3>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          {entry.patientEmail} • {entry.patientPhone}
                        </p>
                      </div>
                    </div>

                    {/* Appointment Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <Calendar className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                        <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                          Preferred Date: <strong>{formatDate(entry.preferredDate)}</strong>
                        </span>
                      </div>
                      {entry.preferredTimeStart && (
                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                            Time: <strong>{entry.preferredTimeStart} - {entry.preferredTimeEnd || 'Flexible'}</strong>
                          </span>
                        </div>
                      )}
                      {entry.providerFirstName && (
                        <div className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                          Provider: <strong>{entry.providerFirstName} {entry.providerLastName}</strong>
                          {entry.providerSpecialization && ` (${entry.providerSpecialization})`}
                        </div>
                      )}
                      {entry.appointmentType && (
                        <div className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                          Type: <strong>{entry.appointmentType}</strong>
                        </div>
                      )}
                    </div>

                    {/* Reason */}
                    {entry.reason && (
                      <div className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        <strong>Reason:</strong> {entry.reason}
                      </div>
                    )}

                    {/* Badges */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {getStatusBadge(entry.status)}
                      {entry.priority && getPriorityBadge(entry.priority)}
                      <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                        Added: {formatDate(entry.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {entry.status === 'active' && (
                      <>
                        <button
                          onClick={() => handleConfirmAppointment(entry)}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all text-sm font-medium"
                          title="Confirm & Schedule"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Confirm
                        </button>
                        <button
                          onClick={() => handleNotifyNext(entry.preferredDate, entry.providerId)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            theme === 'dark'
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                          title="Notify Patient"
                        >
                          <Bell className="w-4 h-4" />
                          Notify
                        </button>
                      </>
                    )}
                    {entry.status === 'notified' && (
                      <button
                        onClick={() => handleConfirmAppointment(entry)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all text-sm font-medium"
                        title="Confirm & Schedule"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Confirm
                      </button>
                    )}
                    {entry.status === 'scheduled' && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        Scheduled
                      </div>
                    )}
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

export default WaitlistManagementView;
