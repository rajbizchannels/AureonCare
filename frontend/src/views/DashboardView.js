import React, { useState } from 'react';
import { Bot, Shield, Calendar, Clock, DollarSign, Users, Video, FileText, ChevronRight, Check, Settings } from 'lucide-react';
import StatCard from '../components/cards/StatCard';
import ModuleCard from '../components/cards/ModuleCard';
import { formatTime, formatDate, formatCurrency } from '../utils/formatters';

const DashboardView = ({
  theme,
  t,
  user,
  appointments,
  tasks,
  claims,
  patients,
  modules,
  hasAccess,
  setSelectedItem,
  setShowForm,
  setCurrentModule,
  setAppointmentViewType,
  setCalendarViewType,
  completeTask,
  updateUserPreferences,
  addNotification
}) => {
  const [showQuickActionsSettings, setShowQuickActionsSettings] = useState(false);

  // Define all available quick actions
  const allQuickActions = [
    { id: 'appointment', label: 'New Appointment', icon: Calendar, color: 'blue' },
    { id: 'patient', label: 'Add Patient', icon: FileText, color: 'purple' },
    { id: 'task', label: 'New Task', icon: Check, color: 'green' },
    { id: 'claim', label: 'New Claim', icon: DollarSign, color: 'yellow' }
  ];

  // Get enabled actions from user preferences or default to all
  const enabledActions = user?.preferences?.quickActions || allQuickActions.map(a => a.id);

  const toggleQuickAction = async (actionId) => {
    const newEnabledActions = enabledActions.includes(actionId)
      ? enabledActions.filter(id => id !== actionId)
      : [...enabledActions, actionId];

    await updateUserPreferences({ quickActions: newEnabledActions });
    if (enabledActions.includes(actionId)) {
      await addNotification('success', 'Quick action removed');
    } else {
      await addNotification('success', 'Quick action added');
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.welcome}, {user?.name || 'User'}</h1>
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{user?.practice || 'Medical Practice'}</p>
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t.todaysAppointments}
          value={appointments.length.toString()}
          icon={Calendar}
          trend={(() => {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const todayCount = appointments.filter(a => a.date && a.date.startsWith(todayStr)).length;
            const avgPerDay = Math.ceil(appointments.length / 7);
            const change = avgPerDay > 0 ? Math.round(((todayCount - avgPerDay) / avgPerDay) * 100) : 0;
            return change >= 0 ? `+${change}% from average` : `${change}% from average`;
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
        <StatCard
          title={t.pendingTasks}
          value={tasks.filter(t => t.status === 'Pending').length.toString()}
          icon={Clock}
          trend={`${tasks.filter(t => t.priority === 'High' && t.status === 'Pending').length} urgent`}
          color="from-purple-500 to-pink-500"
          onClick={() => setSelectedItem('tasks')}
        />
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
            return `${approvalRate}% approved`;
          })()}
          color="from-green-500 to-emerald-500"
          onClick={() => setSelectedItem('revenue')}
        />
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
            return `+${recentPatients} this week`;
          })()}
          color="from-yellow-500 to-orange-500"
          onClick={() => setSelectedItem('patients')}
        />
      </div>

      <div className={`bg-gradient-to-br backdrop-blur-sm rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.quickActions}</h3>
          <button
            onClick={() => setShowQuickActionsSettings(!showQuickActionsSettings)}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
            title="Customize Quick Actions"
          >
            <Settings className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        {showQuickActionsSettings ? (
          <div className="space-y-3">
            <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Toggle which quick actions you want to see:
            </p>
            {allQuickActions.map(action => {
              const Icon = action.icon;
              const isEnabled = enabledActions.includes(action.id);
              return (
                <div
                  key={action.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 text-${action.color}-400`} />
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{action.label}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => toggleQuickAction(action.id)}
                    className="form-checkbox h-5 w-5 text-blue-500"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allQuickActions
              .filter(action => enabledActions.includes(action.id))
              .map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => setShowForm(action.id)}
                    className={`p-4 rounded-lg transition-colors text-left group ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
                  >
                    <Icon className={`w-6 h-6 text-${action.color}-400 mb-2 group-hover:scale-110 transition-transform`} />
                    <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{action.label}</p>
                  </button>
                );
              })}
          </div>
        )}
      </div>

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
            {appointments.slice(0, 3).map(apt => {
              const patient = patients.find(p => p.id === apt.patient_id);
              const patientName = apt.patient || patient?.name || 'Unknown Patient';

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
