import React from 'react';
import { Plus, List, Calendar, Eye, Edit, Trash2 } from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';

const PracticeManagementView = ({
  theme,
  appointments,
  patients,
  appointmentViewType,
  calendarViewType,
  setAppointmentViewType,
  setCalendarViewType,
  setShowForm,
  setEditingItem,
  setCurrentView,
  setAppointments,
  api,
  addNotification
}) => {
  // Helper function to get appointments for a specific date
  const getAppointmentsForDate = (date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.date);
      return aptDate.toDateString() === date.toDateString();
    });
  };

  // Get current week dates
  const getCurrentWeekDates = () => {
    const today = new Date();
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

  const weekDates = getCurrentWeekDates();
  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Appointments</h2>
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
              List
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
              Calendar
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
                Day
              </button>
              <button
                onClick={() => setCalendarViewType('week')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  calendarViewType === 'week'
                    ? 'bg-purple-500 text-white'
                    : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Week
              </button>
            </div>
          )}

          <button
            onClick={() => setShowForm('appointment')}
            className={`flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        </div>
      </div>

      {/* List View */}
      {appointmentViewType === 'list' && (
        <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
                <tr>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Doctor</th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Date & Time</th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Type</th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt, idx) => {
                  const patient = patients.find(p => p.id === apt.patient_id);
                  const patientName = apt.patient || patient?.name || 'Unknown Patient';

                  return (
                    <tr key={apt.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{patientName}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{apt.doctor || 'Dr. Sarah Chen'}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(apt.date)} {formatTime(apt.time)}</td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{apt.type}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          apt.status === 'Confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
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
                            title="View"
                          >
                            <Eye className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem({ type: 'appointment', data: apt });
                              setCurrentView('edit');
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title="Edit"
                          >
                            <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this appointment?')) {
                                try {
                                  await api.deleteAppointment(apt.id);
                                  setAppointments(prev => prev.filter(a => a.id !== apt.id));
                                  await addNotification('alert', 'Appointment deleted successfully');
                                } catch (err) {
                                  console.error('Error deleting appointment:', err);
                                  alert('Failed to delete appointment');
                                }
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title="Delete"
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
          {/* Week View */}
          {calendarViewType === 'week' && (
            <div>
              <div className="grid grid-cols-7 gap-4 mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
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
                      className={`min-h-[120px] rounded-lg p-3 border ${
                        isToday
                          ? theme === 'dark' ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-cyan-100 border-cyan-500/50'
                          : theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'
                      }`}
                    >
                      <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-cyan-400' : theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayAppointments.map(apt => {
                          const patient = patients.find(p => p.id === apt.patient_id);
                          const patientName = apt.patient || patient?.name || 'Unknown';
                          return (
                            <div
                              key={apt.id}
                              onClick={() => {
                                setEditingItem({ type: 'appointment', data: apt });
                                setCurrentView('view');
                              }}
                              className={`text-xs p-2 rounded cursor-pointer transition-colors ${
                                apt.status === 'Confirmed'
                                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                                  : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
                              }`}
                            >
                              <div className="font-semibold truncate">{formatTime(apt.time)}</div>
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
              <div className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="space-y-2">
                {getAppointmentsForDate(today).length > 0 ? (
                  getAppointmentsForDate(today).map(apt => {
                    const patient = patients.find(p => p.id === apt.patient_id);
                    const patientName = apt.patient || patient?.name || 'Unknown Patient';

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
                              {formatTime(apt.time)}
                            </div>
                            <div>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {patientName}
                              </div>
                              <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                {apt.type} with {apt.doctor || 'Dr. Sarah Chen'}
                              </div>
                            </div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          apt.status === 'Confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className={`text-center py-12 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    No appointments scheduled for today
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PracticeManagementView;
