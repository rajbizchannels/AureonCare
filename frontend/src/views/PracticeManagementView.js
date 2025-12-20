import React, { useState, useEffect } from 'react';
import { Plus, List, Calendar, Eye, Edit, Trash2, ChevronLeft, ChevronRight, ArrowLeft, Search, Filter, X, Clock, User, CheckCircle, Bell } from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import NewAppointmentForm from '../components/forms/NewAppointmentForm';
import ViewEditModal from '../components/modals/ViewEditModal';

const PracticeManagementView = ({
  theme,
  appointments,
  patients,
  users,
  appointmentViewType,
  calendarViewType,
  setAppointmentViewType,
  setCalendarViewType,
  showForm,
  setShowForm,
  editingItem,
  setEditingItem,
  currentView,
  setCurrentView,
  setAppointments,
  setClaims,
  setUsers,
  setPatients,
  setUser,
  api,
  addNotification,
  setCurrentModule,
  t,
  user
}) => {
  // State for calendar navigation
  const [selectedWeek, setSelectedWeek] = useState(0); // 0 = current week, -1 = last week, +1 = next week
  const [selectedDay, setSelectedDay] = useState(new Date());

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Waitlist state
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistStatusFilter, setWaitlistStatusFilter] = useState('active');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedWaitlistEntry, setSelectedWaitlistEntry] = useState(null);

  // Load waitlist when switching to waitlist view
  useEffect(() => {
    if (appointmentViewType === 'waitlist') {
      loadWaitlist();
    }
  }, [appointmentViewType, waitlistStatusFilter]);

  const loadWaitlist = async () => {
    setWaitlistLoading(true);
    try {
      const entries = await api.getAllWaitlist({ status: waitlistStatusFilter === 'all' ? undefined : waitlistStatusFilter });
      setWaitlistEntries(entries);
    } catch (error) {
      console.error('Error loading waitlist:', error);
      addNotification('alert', 'Failed to load waitlist entries');
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleConfirmAppointment = (entry) => {
    setSelectedWaitlistEntry(entry);
    setShowConfirmModal(true);
  };

  const handleActualConfirm = async () => {
    if (!selectedWaitlistEntry) return;

    try {
      await api.markWaitlistScheduled(selectedWaitlistEntry.id);
      await addNotification('success', `Waitlist entry confirmed for ${selectedWaitlistEntry.patientFirstName} ${selectedWaitlistEntry.patientLastName}`);
      setShowConfirmModal(false);
      setSelectedWaitlistEntry(null);
      await loadWaitlist();
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

  // Filter appointments based on user role
  // Doctors/providers should only see their own appointments
  // Admins and other roles see all appointments
  const filteredAppointments = appointments.filter(apt => {
    // If no user, show all appointments (shouldn't happen, but safety check)
    if (!user) return true;

    // Check if user is a doctor/provider/physician
    const isDoctorRole = user.role === 'doctor' || user.role === 'physician' || user.role === 'provider';

    // If user is a doctor, only show appointments where they are the provider
    if (isDoctorRole) {
      if (apt.provider_id !== user.id) return false;
    }

    // Apply search filter
    if (searchQuery) {
      const patient = patients.find(p => p.id === apt.patient_id);
      const patientName = apt.patient || patient?.name || (patient?.first_name && patient?.last_name ? `${patient.first_name} ${patient.last_name}` : '');
      if (!patientName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      const aptStatus = (apt.status || '').toLowerCase();
      if (aptStatus !== statusFilter.toLowerCase()) {
        return false;
      }
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      const aptType = (apt.type || apt.appointment_type || '').toLowerCase();
      if (aptType !== typeFilter.toLowerCase()) {
        return false;
      }
    }

    // For admins and other roles, show all appointments
    return true;
  });

  // Get unique appointment types for filter dropdown
  const appointmentTypes = [...new Set(appointments.map(apt => apt.type || apt.appointment_type).filter(Boolean))];

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  // Helper function to parse appointment date/time
  const getAppointmentDateTime = (apt) => {
    if (apt.start_time) {
      const startTimeStr = apt.start_time.replace(' ', 'T');
      return new Date(startTimeStr);
    } else if (apt.date) {
      return new Date(apt.date);
    }
    return new Date();
  };

  // Helper function to get appointments for a specific date
  const getAppointmentsForDate = (date) => {
    return filteredAppointments.filter(apt => {
      const aptDate = getAppointmentDateTime(apt);
      return aptDate.toDateString() === date.toDateString();
    });
  };

  // Get current week dates
  const getCurrentWeekDates = (weekOffset = 0) => {
    const today = new Date();
    today.setDate(today.getDate() + (weekOffset * 7));
    const currentDay = today.getDay(); // 0 = Sunday
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1)); // Get Monday

    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const weekDates = getCurrentWeekDates(selectedWeek);
  const today = new Date();

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedWaitlistEntry(null);
        }}
        onConfirm={handleActualConfirm}
        title="Confirm Waitlist Appointment"
        message={selectedWaitlistEntry ? `Confirm appointment for ${selectedWaitlistEntry.patientFirstName} ${selectedWaitlistEntry.patientLastName} on ${formatDate(selectedWaitlistEntry.preferredDate)}?` : ''}
        type="confirm"
        confirmText="Confirm & Schedule"
        cancelText="Cancel"
      />

    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title={t.backToDashboard || 'Back to Dashboard'}
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.appointments || 'Appointments'}</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* View Type Toggle */}
          <div className={`flex items-center gap-2 p-1 rounded-lg ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-200'}`}>
            <button
              onClick={() => setAppointmentViewType('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                appointmentViewType === 'list'
                  ? 'bg-cyan-500 text-white'
                  : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
              {t.list || 'List'}
            </button>
            <button
              onClick={() => setAppointmentViewType('calendar')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                appointmentViewType === 'calendar'
                  ? 'bg-cyan-500 text-white'
                  : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              {t.calendar || 'Calendar'}
            </button>
            <button
              onClick={() => setAppointmentViewType('waitlist')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                appointmentViewType === 'waitlist'
                  ? 'bg-cyan-500 text-white'
                  : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              {t.waitlist || 'Waitlist'}
            </button>
          </div>

          {/* Calendar View Type Toggle (only shown in calendar view) */}
          {appointmentViewType === 'calendar' && (
            <div className={`flex items-center gap-2 p-1 rounded-lg ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-200'}`}>
              <button
                onClick={() => setCalendarViewType('day')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  calendarViewType === 'day'
                    ? 'bg-purple-500 text-white'
                    : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.day || 'Day'}
              </button>
              <button
                onClick={() => setCalendarViewType('week')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  calendarViewType === 'week'
                    ? 'bg-purple-500 text-white'
                    : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.week || 'Week'}
              </button>
            </div>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showFilters
                ? 'bg-purple-500 text-white'
                : theme === 'dark'
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            {t.filters || 'Filters'}
            {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {[searchQuery, statusFilter !== 'all', typeFilter !== 'all'].filter(Boolean).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowForm('appointment')}
            className={`flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            <Plus className="w-4 h-4" />
            {t.newAppointment || 'New Appointment'}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t.filterAppointments || 'Filter Appointments'}
            </h3>
            {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <X className="w-4 h-4" />
                {t.clearFilters || 'Clear Filters'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search by Patient Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.searchPatient || 'Search Patient'}
              </label>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchByPatientName || 'Search by patient name...'}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg ${
                    theme === 'dark'
                      ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.status || 'Status'}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
              >
                <option value="all">{t.allStatuses || 'All Statuses'}</option>
                <option value="confirmed">{t.confirmed || 'Confirmed'}</option>
                <option value="pending">{t.pending || 'Pending'}</option>
                <option value="cancelled">{t.cancelled || 'Cancelled'}</option>
                <option value="completed">{t.completed || 'Completed'}</option>
              </select>
            </div>

            {/* Appointment Type Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.type || 'Type'}
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
              >
                <option value="all">{t.allTypes || 'All Types'}</option>
                {appointmentTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className={`mt-4 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            {t.showing || 'Showing'} <span className="font-semibold">{filteredAppointments.length}</span> {t.of || 'of'} <span className="font-semibold">{appointments.length}</span> {t.appointments || 'appointments'}
          </div>
        </div>
      )}

      {/* Appointment Form */}
      {showForm === 'appointment' && (
        <div className="mb-6">
          <NewAppointmentForm
            theme={theme}
            api={api}
            patients={patients}
            users={users}
            onClose={() => setShowForm(null)}
            onSuccess={(newAppointment) => {
              setAppointments([...appointments, newAppointment]);
              setShowForm(null);
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {/* Edit Appointment Form */}
      {editingItem && editingItem.type === 'appointment' && (
        <div className="mb-6">
          <ViewEditModal
            theme={theme}
            editingItem={editingItem}
            currentView={currentView}
            onClose={() => {
              setEditingItem(null);
              setCurrentView('list');
            }}
            patients={patients}
            users={users}
            api={api}
            addNotification={addNotification}
            setAppointments={setAppointments}
            setPatients={setPatients}
            setClaims={setClaims}
            setUsers={setUsers}
            setUser={setUser}
            user={user}
            t={t}
          />
        </div>
      )}

      {/* List View */}
      {appointmentViewType === 'list' && (
        <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
                <tr>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.patient || 'Patient'}</th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.doctor || 'Doctor'}</th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.dateAndTime || 'Date & Time'}</th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.type || 'Type'}</th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.status || 'Status'}</th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.actions || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((apt, idx) => {
                  const patient = patients.find(p => p.id === apt.patient_id);
                  const patientName = apt.patient || patient?.name || t.unknownPatient || 'Unknown Patient';
                  const aptDateTime = getAppointmentDateTime(apt);
                  // Get doctor name from users array
                  const provider = users?.find(u => u.id === apt.provider_id);
                  let doctorName = t.notApplicable || 'N/A';
                  if (apt.doctor) {
                    doctorName = apt.doctor;
                  } else if (apt.provider_name) {
                    doctorName = apt.provider_name;
                  } else if (provider) {
                    const firstName = provider.first_name || provider.firstName || '';
                    const lastName = provider.last_name || provider.lastName || '';
                    const fullName = `${firstName} ${lastName}`.trim();
                    if (fullName) {
                      doctorName = fullName;
                    } else if (provider.name) {
                      doctorName = provider.name;
                    }
                  }
                  const appointmentType = apt.type || apt.appointment_type || t.consultation || 'Consultation';

                  return (
                    <tr key={apt.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{patientName}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{doctorName}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(aptDateTime)} {formatTime(aptDateTime)}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{appointmentType}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          apt.status === 'Confirmed' || apt.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {apt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingItem({ type: 'appointment', data: apt });
                              setCurrentView('view');
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title={t.view || 'View'}
                          >
                            <Eye className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem({ type: 'appointment', data: apt });
                              setCurrentView('edit');
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title={t.edit || 'Edit'}
                          >
                            <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm(t.confirmDeleteAppointment || 'Are you sure you want to delete this appointment?')) {
                                try {
                                  await api.deleteAppointment(apt.id);
                                  setAppointments(prev => prev.filter(a => a.id !== apt.id));
                                  await addNotification('alert', t.appointmentDeletedSuccessfully || 'Appointment deleted successfully');
                                } catch (err) {
                                  console.error('Error deleting appointment:', err);
                                  alert(t.failedToDeleteAppointment || 'Failed to delete appointment');
                                }
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title={t.delete || 'Delete'}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {appointmentViewType === 'calendar' && (
        <div className={`bg-gradient-to-br rounded-xl border p-6 ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          {/* Week Navigation Controls */}
          {calendarViewType === 'week' && (
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setSelectedWeek(selectedWeek - 1)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                <ChevronLeft className="w-4 h-4" />
                {t.previousWeek || 'Previous Week'}
              </button>
              <div className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <button
                onClick={() => setSelectedWeek(selectedWeek + 1)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                {t.nextWeek || 'Next Week'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Day Navigation Controls */}
          {calendarViewType === 'day' && (
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => {
                  const newDay = new Date(selectedDay);
                  newDay.setDate(selectedDay.getDate() - 1);
                  setSelectedDay(newDay);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                <ChevronLeft className="w-4 h-4" />
                {t.previousDay || 'Previous Day'}
              </button>
              <div className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {selectedDay.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <button
                onClick={() => {
                  const newDay = new Date(selectedDay);
                  newDay.setDate(selectedDay.getDate() + 1);
                  setSelectedDay(newDay);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                {t.nextDay || 'Next Day'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Week View */}
          {calendarViewType === 'week' && (
            <div>
              <div className="grid grid-cols-7 gap-4 mb-2">
                {[t.mon || 'Mon', t.tue || 'Tue', t.wed || 'Wed', t.thu || 'Thu', t.fri || 'Fri', t.sat || 'Sat', t.sun || 'Sun'].map(day => (
                  <div key={day} className={`text-center font-semibold text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-4">
                {weekDates.map((date, idx) => {
                  const dayAppointments = getAppointmentsForDate(date);
                  const isToday = date.toDateString() === today.toDateString();

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDay(date);
                        setCalendarViewType('day');
                      }}
                      className={`min-h-[120px] rounded-lg p-3 border cursor-pointer transition-all hover:shadow-lg ${
                        isToday
                          ? theme === 'dark' ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-cyan-100 border-cyan-500/50'
                          : theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800' : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-cyan-400' : theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayAppointments.map(apt => {
                          const patient = patients.find(p => p.id === apt.patient_id);
                          const patientName = apt.patient || patient?.name || t.unknown || 'Unknown';
                          const aptDateTime = getAppointmentDateTime(apt);
                          return (
                            <div
                              key={apt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem({ type: 'appointment', data: apt });
                                setCurrentView('view');
                              }}
                              className={`text-xs p-2 rounded cursor-pointer transition-colors ${
                                apt.status === 'Confirmed' || apt.status === 'confirmed'
                                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                                  : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
                              }`}
                            >
                              <div className="font-semibold truncate">{formatTime(aptDateTime)}</div>
                              <div className="truncate">{patientName}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day View */}
          {calendarViewType === 'day' && (
            <div>
              <div className="space-y-2">
                {getAppointmentsForDate(selectedDay).length > 0 ? (
                  getAppointmentsForDate(selectedDay).map(apt => {
                    const patient = patients.find(p => p.id === apt.patient_id);
                    const patientName = apt.patient || patient?.name || t.unknownPatient || 'Unknown Patient';
                    const aptDateTime = getAppointmentDateTime(apt);
                    // Get doctor name from users array
                    const provider = users?.find(u => u.id === apt.provider_id);
                    let doctorName = t.notApplicable || 'N/A';
                    if (apt.doctor) {
                      doctorName = apt.doctor;
                    } else if (apt.provider_name) {
                      doctorName = apt.provider_name;
                    } else if (provider) {
                      const firstName = provider.first_name || provider.firstName || '';
                      const lastName = provider.last_name || provider.lastName || '';
                      const fullName = `${firstName} ${lastName}`.trim();
                      if (fullName) {
                        doctorName = fullName;
                      } else if (provider.name) {
                        doctorName = provider.name;
                      }
                    }
                    const appointmentType = apt.type || apt.appointment_type || t.consultation || 'Consultation';

                    return (
                      <div
                        key={apt.id}
                        className={`p-4 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                          theme === 'dark'
                            ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                            : 'bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setEditingItem({ type: 'appointment', data: apt });
                          setCurrentView('view');
                        }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
                              {formatTime(aptDateTime)}
                            </div>
                            <div>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {patientName}
                              </div>
                              <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                {appointmentType} {t.with || 'with'} {doctorName}
                              </div>
                            </div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          apt.status === 'Confirmed' || apt.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className={`text-center py-12 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {t.noAppointmentsScheduledForThisDay || 'No appointments scheduled for this day'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Waitlist View */}
      {appointmentViewType === 'waitlist' && (
        <div className="space-y-4">
          {/* Waitlist Status Filter */}
          <div className={`flex items-center gap-3 p-4 rounded-lg ${
            theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'
          }`}>
            <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              Status:
            </label>
            <select
              value={waitlistStatusFilter}
              onChange={(e) => setWaitlistStatusFilter(e.target.value)}
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
          {waitlistLoading ? (
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
              <p className="text-sm mt-2">There are no {waitlistStatusFilter !== 'all' ? waitlistStatusFilter : ''} waitlist entries at the moment.</p>
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
      )}
    </div>
    </>
  );
};

export default PracticeManagementView;
