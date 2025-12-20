import React, { useState, useEffect } from 'react';
import { Bot, Shield, Users, Video, ChevronRight, Calendar, Clock, DollarSign, Check, FileText, Activity, ChevronDown, Zap } from 'lucide-react';
import StatCard from '../components/cards/StatCard';
import ModuleCard from '../components/cards/ModuleCard';
import { formatTime, formatDate, formatCurrency } from '../utils/formatters';
import { hasPermission } from '../utils/rolePermissions';
import NewAppointmentForm from '../components/forms/NewAppointmentForm';
import NewPatientForm from '../components/forms/NewPatientForm';
import NewTaskForm from '../components/forms/NewTaskForm';
import NewClaimForm from '../components/forms/NewClaimForm';
import DiagnosisForm from '../components/forms/DiagnosisForm';

const DashboardView = ({
  theme,
  t,
  user,
  appointments,
  tasks,
  claims,
  patients,
  users,
  modules,
  hasAccess,
  setSelectedItem,
  showForm,
  setShowForm,
  setCurrentModule,
  setAppointmentViewType,
  setCalendarViewType,
  setAppointments,
  setPatients,
  setTasks,
  setClaims,
  api,
  completeTask,
  updateUserPreferences,
  addNotification
}) => {
  const [clinicName, setClinicName] = useState('Medical Practice');
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Load clinic name from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('clinicSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.name) {
          setClinicName(settings.name);
        }
      }
    } catch (error) {
      console.error('Error loading clinic name:', error);
    }
  }, []);

  // Define all available quick actions with permission requirements
  const allQuickActions = [
    { id: 'appointment', label: t.newAppointment, icon: Calendar, color: 'blue', module: 'appointments', action: 'create' },
    { id: 'patient', label: t.addPatient, icon: FileText, color: 'purple', module: 'patients', action: 'create' },
    { id: 'diagnosis', label: t.newDiagnosis || 'New Diagnosis', icon: Activity, color: 'orange', module: 'ehr', action: 'create' },
    { id: 'task', label: t.newTask, icon: Check, color: 'green', module: null, action: null }, // All roles can create tasks
    { id: 'claim', label: t.newClaim, icon: DollarSign, color: 'yellow', module: 'billing', action: 'create' }
  ];

  // Filter quick actions based on user role permissions
  const permittedQuickActions = allQuickActions.filter(action => {
    // If no permission requirement, allow for all users
    if (!action.module || !action.action) return true;
    // Check if user has required permission
    return hasPermission(user, action.module, action.action);
  });

  // Get enabled actions from user preferences or default to all permitted actions
  const enabledQuickActions = user?.preferences?.quickActions || permittedQuickActions.map(a => a.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.welcome}, {user?.firstName || user?.first_name || 'User'}
          </h1>
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            {user?.practice || clinicName}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-400" />
              <span className="text-sm text-cyan-400 font-medium">AI Enabled</span>
            </div>
          </div>
          <div className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-400 font-medium">HIPAA Compliant</span>
            </div>
          </div>

          {/* Quick Actions Dropdown */}
          {permittedQuickActions.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showQuickActions
                    ? 'bg-blue-500 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span className="font-medium text-sm">Quick Actions</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showQuickActions ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showQuickActions && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowQuickActions(false)}
                  />

                  {/* Dropdown Content */}
                  <div className={`absolute left-0 mt-2 w-64 rounded-lg shadow-lg border z-20 ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-white border-gray-200'
                  }`}>
                    <div className="p-2">
                      {permittedQuickActions
                        .filter(action => enabledQuickActions.includes(action.id))
                        .map(action => {
                          const Icon = action.icon;
                          return (
                            <button
                              key={action.id}
                              onClick={() => {
                                setShowForm(action.id);
                                setShowQuickActions(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                                theme === 'dark'
                                  ? 'hover:bg-slate-700 text-slate-200'
                                  : 'hover:bg-gray-100 text-gray-700'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${action.color}-500/10`}>
                                <Icon className={`w-4 h-4 text-${action.color}-500`} />
                              </div>
                              <span className="font-medium text-sm">{action.label}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Today's Appointments - Show if user can view appointments */}
        {hasPermission(user, 'appointments', 'view') && (
          <StatCard
            title={t.todaysAppointments}
            value={(() => {
              const today = new Date();
              const todayStr = today.toISOString().split('T')[0];
              return appointments.filter(a => {
                if (a.date && a.date.startsWith(todayStr)) return true;
                if (a.start_time) {
                  const startDate = new Date(a.start_time.replace(' ', 'T'));
                  const startDateStr = startDate.toISOString().split('T')[0];
                  return startDateStr === todayStr;
                }
                return false;
              }).length.toString();
            })()}
            icon={Calendar}
            trend={(() => {
              const today = new Date();
              const todayStr = today.toISOString().split('T')[0];
              const todayCount = appointments.filter(a => {
                if (a.date && a.date.startsWith(todayStr)) return true;
                if (a.start_time) {
                  const startDate = new Date(a.start_time.replace(' ', 'T'));
                  const startDateStr = startDate.toISOString().split('T')[0];
                  return startDateStr === todayStr;
                }
                return false;
              }).length;
              const avgPerDay = Math.ceil(appointments.length / 7);
              const change = avgPerDay > 0 ? Math.round(((todayCount - avgPerDay) / avgPerDay) * 100) : 0;
              return change >= 0 ? `+${change}% ${t.fromAverage || 'from average'}` : `${change}% ${t.fromAverage || 'from average'}`;
            })()}
            color="from-blue-500 to-cyan-500"
            onClick={() => {
              if (setAppointmentViewType && setCalendarViewType) {
                setAppointmentViewType('calendar');
                setCalendarViewType('day');
              }
              setCurrentModule('practiceManagement');
            }}
          />
        )}

        {/* Pending Tasks - Show for all authenticated users */}
        <StatCard
          title={t.pendingTasks}
          value={tasks.filter(t => t.status === 'Pending').length.toString()}
          icon={Clock}
          trend={`${tasks.filter(t => t.priority === 'High' && t.status === 'Pending').length} ${t.urgent}`}
          color="from-purple-500 to-pink-500"
          onClick={() => setSelectedItem('tasks')}
        />

        {/* Revenue - Show only if user can view billing */}
        {hasPermission(user, 'billing', 'view') && (
          <StatCard
            title={t.revenue}
            value={(() => {
              const totalRevenue = claims.reduce((sum, c) => {
                const amount = typeof c.amount === 'string' ? parseFloat(c.amount) : (c.amount || 0);
                return sum + amount;
              }, 0);
              return totalRevenue >= 1000 ? `$${(totalRevenue / 1000).toFixed(1)}K` : `$${totalRevenue.toFixed(0)}`;
            })()}
            icon={DollarSign}
            trend={(() => {
              const totalRevenue = claims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
              const approvedRevenue = claims.filter(c => c.status === 'Approved' || c.status === 'Paid').reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
              const approvalRate = totalRevenue > 0 ? Math.round((approvedRevenue / totalRevenue) * 100) : 0;
              return `${approvalRate}% ${t.approved}`;
            })()}
            color="from-green-500 to-emerald-500"
            onClick={() => setSelectedItem('revenue')}
          />
        )}

        {/* Active Patients - Show if user can view patients */}
        {hasPermission(user, 'patients', 'view') && (
          <StatCard
            title={t.activePatients}
            value={patients.length.toString()}
            icon={Users}
            trend={(() => {
              const recentPatients = patients.filter(p => {
                if (!p.created_at && !p.dob) return false;
                const dateStr = p.created_at || p.dob;
                const patientDate = new Date(dateStr);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return patientDate >= weekAgo;
              }).length;
              return `+${recentPatients} ${t.thisWeek}`;
            })()}
            color="from-yellow-500 to-orange-500"
            onClick={() => setCurrentModule('ehr')}
          />
        )}
      </div>

      {/* Forms - Quick actions are now in header dropdown */}
      {showForm === 'appointment' && (
        <div className={`mb-6 rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
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

      {showForm === 'patient' && (
        <div className={`mb-6 rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <NewPatientForm
            theme={theme}
            api={api}
            onClose={() => setShowForm(null)}
            onSuccess={(newPatient) => {
              setPatients([...patients, newPatient]);
              setShowForm(null);
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {showForm === 'task' && (
        <div className={`mb-6 rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <NewTaskForm
            theme={theme}
            api={api}
            users={users}
            patients={patients}
            onClose={() => setShowForm(null)}
            onSuccess={(newTask) => {
              setTasks([...tasks, newTask]);
              setShowForm(null);
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {showForm === 'claim' && (
        <div className={`mb-6 rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <NewClaimForm
            theme={theme}
            api={api}
            patients={patients}
            claims={claims}
            onClose={() => setShowForm(null)}
            onSuccess={(newClaim) => {
              setClaims([...claims, newClaim]);
              setShowForm(null);
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      {showForm === 'diagnosis' && (
        <div className={`mb-6 rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <DiagnosisForm
            theme={theme}
            api={api}
            patient={null}
            patients={patients}
            providers={users}
            user={user}
            onClose={() => setShowForm(null)}
            onSuccess={() => {
              setShowForm(null);
              addNotification('success', t.diagnosisCreated || 'Diagnosis created successfully');
            }}
            addNotification={addNotification}
            t={t}
          />
        </div>
      )}

      <div>
        <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.availableModules}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map(module => (
            <ModuleCard
              key={module.id}
              module={module}
              onClick={(id) => {
                setCurrentModule(id);
              }}
              hasAccess={hasAccess}
              theme={theme}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          onClick={() => {
            if (setAppointmentViewType && setCalendarViewType) {
              setAppointmentViewType('calendar');
              setCalendarViewType('day');
            }
            setCurrentModule('practiceManagement');
          }}
          className={`bg-gradient-to-br rounded-xl p-6 border cursor-pointer transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-blue-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-blue-600/50'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.upcomingAppointments}</h3>
            <ChevronRight className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </div>
          <div className="space-y-3">
            {appointments
              .filter(apt => {
                // Only show scheduled appointments
                const status = (apt.status || '').toLowerCase().trim();
                if (status !== 'scheduled') return false;

                // Only show appointments from today onwards
                if (apt.start_time) {
                  const startTimeStr = apt.start_time.replace(' ', 'T');
                  const startDate = new Date(startTimeStr);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0); // Reset time to start of day

                  // Return true only if appointment is today or later
                  return startDate >= today;
                }

                return false;
              })
              .slice(0, 3)
              .map(apt => {
              const patient = patients.find(p => p.id === apt.patient_id);
              const patientName = apt.patient || (patient?.first_name && patient?.last_name ? `${patient.first_name} ${patient.last_name}` : patient?.first_name || patient?.last_name || 'Unknown Patient');

              // Parse appointment date/time from start_time
              let appointmentDateTime = '';
              if (apt.start_time) {
                const startTimeStr = apt.start_time.replace(' ', 'T');
                const startDate = new Date(startTimeStr);
                if (!isNaN(startDate.getTime())) {
                  appointmentDateTime = `${formatDate(startDate)} ${formatTime(startDate)}`;
                }
              }
              const appointmentType = apt.appointment_type || apt.type || 'N/A';

              return (
                <div key={apt.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-gray-100/30 hover:bg-gray-200/50'}`}>
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{patientName}</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{appointmentDateTime} - {appointmentType}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    apt.status === 'Confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {apt.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          onClick={() => setSelectedItem('tasks')}
          className={`bg-gradient-to-br rounded-xl p-6 border cursor-pointer transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-purple-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-purple-600/50'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.highPriorityTasks}</h3>
            <ChevronRight className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </div>
          <div className="space-y-3">
            {tasks.filter(t => t.priority === 'High' && t.status === 'Pending').slice(0, 3).map(task => (
              <div key={task.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-gray-100/30 hover:bg-gray-200/50'}`}>
                <div className="flex-1">
                  <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{task.title}</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Due: {formatDate(task.due_date || task.dueDate)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    completeTask(task.id);
                  }}
                  className="p-2 hover:bg-green-500/20 rounded-lg transition-colors"
                >
                  <Check className="w-4 h-4 text-green-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
