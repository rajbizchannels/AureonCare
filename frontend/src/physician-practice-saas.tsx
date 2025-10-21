import React, { useState, useEffect } from 'react';
import { Shield, Activity, Video, DollarSign, Users, Plug, Settings, Bell, Search, Globe, Lock, Bot, Menu, X, ChevronRight, Calendar, FileText, Stethoscope, BarChart3, MessageSquare, Clock, UserCheck, CreditCard, Database, Zap, Edit, Trash2, Plus, Building2, UserCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const API_URL = 'http://localhost:3000/api';

// Utility function to format dates
const formatDate = (date) => {
  if (!date) return 'N/A';
  try {
    if (typeof date === 'string') {
      return format(parseISO(date), 'MMM dd, yyyy');
    }
    return format(new Date(date), 'MMM dd, yyyy');
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

// Utility function to format time
const formatTime = (time) => {
  if (!time) return 'N/A';
  try {
    return time.substring(0, 5); // HH:MM format
  } catch (error) {
    return 'Invalid Time';
  }
};

// Utility function to format currency
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '$0.00';
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '$0.00';
  return `$${numAmount.toFixed(2)}`;
};

const MedFlowApp = () => {
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [language, setLanguage] = useState('en');
  const [planTier, setPlanTier] = useState('professional');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [showAIPopup, setShowAIPopup] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showDoctorProfile, setShowDoctorProfile] = useState(false);
  const [showEditAppointment, setShowEditAppointment] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Data states
  const [appointments, setAppointments] = useState([]);
  const [claims, setClaims] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [user] = useState({
    name: 'Dr. Sarah Chen',
    role: 'admin',
    practice: 'Central Medical Group',
    avatar: 'SC',
    specialty: 'Internal Medicine',
    license: 'MD-123456',
    email: 'sarah.chen@medflow.com',
    phone: '(555) 123-4567'
  });

  const translations = {
    en: {
      dashboard: 'Dashboard',
      practiceManagement: 'Practice Management',
      ehr: 'Electronic Health Records',
      telehealth: 'Telehealth',
      rcm: 'Revenue Cycle Management',
      crm: 'Patient CRM',
      integrations: 'Integrations',
      clinicAdmin: 'Clinic Admin',
      saasAdmin: 'SaaS Admin',
      settings: 'Settings',
      logout: 'Logout',
      welcome: 'Welcome back',
      todaysAppointments: "Today's Appointments",
      pendingTasks: 'Pending Tasks',
      revenue: 'Revenue This Month',
      activePatients: 'Active Patients',
      aiInsights: 'AI Insights',
      scheduledCalls: 'Scheduled Video Calls',
      claimsPending: 'Claims Pending Review',
      upcomingFollowups: 'Upcoming Follow-ups'
    }
  };

  const t = translations[language];

  // Fetch data from API
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [appointmentsRes, claimsRes, patientsRes] = await Promise.all([
        fetch(`${API_URL}/appointments`).then(r => r.json()),
        fetch(`${API_URL}/claims`).then(r => r.json()),
        fetch(`${API_URL}/patients`).then(r => r.json())
      ]);

      setAppointments(appointmentsRes);
      setClaims(claimsRes);
      setPatients(patientsRes);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const modules = [
    {
      id: 'practiceManagement',
      name: t.practiceManagement,
      icon: Activity,
      color: 'from-blue-500 to-cyan-500',
      plans: ['starter', 'professional', 'enterprise']
    },
    {
      id: 'ehr',
      name: t.ehr,
      icon: FileText,
      color: 'from-purple-500 to-pink-500',
      plans: ['professional', 'enterprise']
    },
    {
      id: 'telehealth',
      name: t.telehealth,
      icon: Video,
      color: 'from-green-500 to-emerald-500',
      plans: ['professional', 'enterprise']
    },
    {
      id: 'rcm',
      name: t.rcm,
      icon: DollarSign,
      color: 'from-yellow-500 to-orange-500',
      plans: ['starter', 'professional', 'enterprise']
    },
    {
      id: 'crm',
      name: t.crm,
      icon: Users,
      color: 'from-red-500 to-rose-500',
      plans: ['professional', 'enterprise']
    },
    {
      id: 'integrations',
      name: t.integrations,
      icon: Plug,
      color: 'from-indigo-500 to-blue-500',
      plans: ['enterprise']
    },
    {
      id: 'clinicAdmin',
      name: t.clinicAdmin,
      icon: Building2,
      color: 'from-teal-500 to-cyan-500',
      plans: ['professional', 'enterprise']
    },
    {
      id: 'saasAdmin',
      name: t.saasAdmin,
      icon: Database,
      color: 'from-orange-500 to-red-500',
      plans: ['enterprise']
    }
  ];

  const planFeatures = {
    starter: ['practiceManagement', 'rcm'],
    professional: ['practiceManagement', 'ehr', 'telehealth', 'rcm', 'crm', 'clinicAdmin'],
    enterprise: ['practiceManagement', 'ehr', 'telehealth', 'rcm', 'crm', 'integrations', 'clinicAdmin', 'saasAdmin']
  };

  const hasAccess = (moduleId) => planFeatures[planTier]?.includes(moduleId);

  const StatCard = ({ title, value, icon: Icon, trend, color }) => (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-2">{title}</p>
          <p className="text-3xl font-bold text-white mb-2">{value}</p>
          {trend && (
            <p className="text-sm text-green-400 flex items-center">
              <ChevronRight className="w-4 h-4" />
              {trend}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  const ModuleCard = ({ module, onClick }) => {
    const Icon = module.icon;
    const locked = !hasAccess(module.id);

    return (
      <button
        onClick={() => !locked && onClick(module.id)}
        disabled={locked}
        className={`relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 transition-all duration-300 text-left w-full group ${
          locked
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer'
        }`}
      >
        {locked && (
          <div className="absolute top-3 right-3">
            <Lock className="w-5 h-5 text-slate-500" />
          </div>
        )}
        <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{module.name}</h3>
        <p className="text-sm text-slate-400">
          {locked ? 'Upgrade to access' : 'Click to open module'}
        </p>
      </button>
    );
  };

  const FeatureItem = ({ icon: Icon, text }) => (
    <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors">
      <Icon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
      <span className="text-slate-300 text-sm">{text}</span>
    </div>
  );

  const ComplianceBadge = ({ icon: Icon, text }) => (
    <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
      <Icon className="w-4 h-4 text-green-400" />
      <span className="text-slate-300 text-sm">{text}</span>
    </div>
  );

  // Quick View Components with real data
  const RevenueQuickView = () => {
    const totalRevenue = claims.reduce((sum, claim) => {
      const amount = typeof claim.amount === 'string' ? parseFloat(claim.amount) : (claim.amount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    return (
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-6 h-6 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">{t.claimsPending}</h3>
        </div>
        <div className="space-y-3">
          {claims.length === 0 ? (
            <p className="text-slate-400 text-sm">No pending claims</p>
          ) : (
            claims.slice(0, 3).map((claim) => (
              <div key={claim.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300 text-sm">
                  {claim.claim_no} - {formatCurrency(claim.amount)}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  claim.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
                  claim.status === 'Denied' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {claim.status}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Total Revenue</span>
            <span className="text-xl font-bold text-green-400">{formatCurrency(totalRevenue)}</span>
          </div>
        </div>
      </div>
    );
  };

  const UpcomingAppointmentsCard = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = appointments.filter(apt => apt.date && apt.date.startsWith(today));

    return (
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">{t.todaysAppointments}</h3>
          </div>
          <button
            onClick={() => setCurrentModule('practiceManagement')}
            className="text-cyan-400 hover:text-cyan-300 text-sm"
          >
            View All
          </button>
        </div>
        <div className="space-y-3">
          {todayAppointments.length === 0 ? (
            <p className="text-slate-400 text-sm">No appointments today</p>
          ) : (
            todayAppointments.slice(0, 3).map((apt) => (
              <div key={apt.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedAppointment(apt);
                  setShowEditAppointment(true);
                }}
              >
                <div className="flex-1">
                  <p className="text-slate-300 text-sm font-medium">{apt.patient || 'Unknown Patient'}</p>
                  <p className="text-slate-500 text-xs">{formatTime(apt.time)} - {apt.type || 'General'}</p>
                </div>
                <button className="text-blue-400 hover:text-blue-300 transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const HighPriorityTasks = () => {
    const urgentAppointments = appointments.filter(apt => apt.status === 'Urgent').length;
    const pendingClaims = claims.filter(claim => claim.status === 'Pending').length;

    return (
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-6 h-6 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">{t.pendingTasks}</h3>
        </div>
        <div className="space-y-3">
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-300 text-sm">Urgent Appointments</span>
              <span className="text-lg font-bold text-red-400">{urgentAppointments}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div className="bg-red-500 h-2 rounded-full" style={{width: `${Math.min(urgentAppointments * 10, 100)}%`}}></div>
            </div>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-300 text-sm">Pending Claims</span>
              <span className="text-lg font-bold text-yellow-400">{pendingClaims}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div className="bg-yellow-500 h-2 rounded-full" style={{width: `${Math.min(pendingClaims * 5, 100)}%`}}></div>
            </div>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-300 text-sm">Follow-ups Due</span>
              <span className="text-lg font-bold text-purple-400">5</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full" style={{width: '50%'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Popups
  const DoctorProfilePopup = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => setShowDoctorProfile(false)}>
      <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-2xl w-full p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Doctor Profile</h2>
          <button onClick={() => setShowDoctorProfile(false)} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user.avatar}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">{user.name}</h3>
              <p className="text-slate-400">{user.specialty}</p>
              <p className="text-slate-500 text-sm">{user.license}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Email</p>
              <p className="text-white">{user.email}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Phone</p>
              <p className="text-white">{user.phone}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Practice</p>
              <p className="text-white">{user.practice}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Role</p>
              <p className="text-white capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const SettingsPopup = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => setShowSettingsPopup(false)}>
      <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-2xl w-full p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button onClick={() => setShowSettingsPopup(false)} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">General Settings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Email Notifications</span>
                <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-cyan-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">SMS Alerts</span>
                <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-cyan-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Dark Mode</span>
                <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-cyan-500" />
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Privacy & Security</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Two-Factor Authentication</span>
                <span className="text-green-400 text-sm">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Session Timeout</span>
                <span className="text-slate-400 text-sm">30 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const AIAssistantPopup = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => setShowAIPopup(false)}>
      <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-2xl w-full p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">AI Assistant</h2>
          </div>
          <button onClick={() => setShowAIPopup(false)} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
            <p className="text-cyan-300 text-sm mb-2">AI Insights for Today</p>
            <ul className="space-y-2">
              <li className="text-slate-300 text-sm flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>You have {appointments.filter(a => a.date && a.date.startsWith(new Date().toISOString().split('T')[0])).length} appointments scheduled today</span>
              </li>
              <li className="text-slate-300 text-sm flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>{claims.filter(c => c.status === 'Pending').length} claims require your review</span>
              </li>
              <li className="text-slate-300 text-sm flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>Revenue forecasting shows positive trend for this month</span>
              </li>
            </ul>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              rows="4"
              placeholder="Ask AI Assistant anything..."
            />
            <button className="mt-3 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all">
              Send Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const EditAppointmentPopup = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => setShowEditAppointment(false)}>
      <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-2xl w-full p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Edit Appointment</h2>
          <button onClick={() => setShowEditAppointment(false)} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        {selectedAppointment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-sm block mb-2">Patient</label>
                <input
                  type="text"
                  defaultValue={selectedAppointment.patient}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-2">Doctor</label>
                <input
                  type="text"
                  defaultValue={selectedAppointment.doctor}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-2">Date</label>
                <input
                  type="date"
                  defaultValue={selectedAppointment.date}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-2">Time</label>
                <input
                  type="time"
                  defaultValue={selectedAppointment.time}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-2">Type</label>
                <select
                  defaultValue={selectedAppointment.type}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white"
                >
                  <option>General Checkup</option>
                  <option>Follow-up</option>
                  <option>Consultation</option>
                  <option>Emergency</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-2">Status</label>
                <select
                  defaultValue={selectedAppointment.status}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white"
                >
                  <option>Scheduled</option>
                  <option>Confirmed</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-2">Notes</label>
              <textarea
                defaultValue={selectedAppointment.notes}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white resize-none"
                rows="3"
              />
            </div>
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all">
                Save Changes
              </button>
              <button onClick={() => setShowEditAppointment(false)} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const SearchDropdown = () => (
    <div className="absolute top-full left-0 mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
      <div className="p-2">
        <div className="px-3 py-2 text-slate-400 text-xs font-semibold uppercase">Patients</div>
        {patients.slice(0, 3).map(patient => (
          <div key={patient.id} className="px-3 py-2 hover:bg-slate-700 rounded cursor-pointer">
            <p className="text-white text-sm">{patient.first_name} {patient.last_name}</p>
            <p className="text-slate-400 text-xs">{patient.email}</p>
          </div>
        ))}
        <div className="px-3 py-2 text-slate-400 text-xs font-semibold uppercase mt-2">Appointments</div>
        {appointments.slice(0, 3).map(apt => (
          <div key={apt.id} className="px-3 py-2 hover:bg-slate-700 rounded cursor-pointer">
            <p className="text-white text-sm">{apt.patient} - {formatDate(apt.date)}</p>
            <p className="text-slate-400 text-xs">{formatTime(apt.time)} - {apt.type}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{t.welcome}, {user.name}</h1>
          <p className="text-slate-400">{user.practice}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          value={appointments.filter(a => a.date && a.date.startsWith(new Date().toISOString().split('T')[0])).length}
          icon={Calendar}
          trend="+12% from yesterday"
          color="from-blue-500 to-cyan-500"
        />
        <StatCard
          title={t.pendingTasks}
          value={claims.filter(c => c.status === 'Pending').length}
          icon={Clock}
          trend={`${appointments.filter(a => a.status === 'Urgent').length} urgent`}
          color="from-purple-500 to-pink-500"
        />
        <StatCard
          title={t.revenue}
          value={formatCurrency(claims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0))}
          icon={DollarSign}
          trend="+18% vs last month"
          color="from-green-500 to-emerald-500"
        />
        <StatCard
          title={t.activePatients}
          value={patients.length}
          icon={Users}
          trend="+45 this week"
          color="from-yellow-500 to-orange-500"
        />
      </div>

      <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">{t.aiInsights}</h3>
            <p className="text-slate-300 mb-4">Your AI assistant has analyzed schedule and identified optimization opportunities:</p>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>You have {appointments.filter(a => a.date && a.date.startsWith(new Date().toISOString().split('T')[0])).length} appointments scheduled for today</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>{claims.filter(c => c.status === 'Pending').length} claims are pending review and approval</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>Total revenue tracked: {formatCurrency(claims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0))}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Available Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {modules.map(module => (
            <ModuleCard key={module.id} module={module} onClick={setCurrentModule} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <UpcomingAppointmentsCard />
        <RevenueQuickView />
        <HighPriorityTasks />
      </div>
    </div>
  );

  const renderClinicAdmin = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setCurrentModule('dashboard')} className="text-slate-400 hover:text-white transition-colors">
          ← Back
        </button>
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white">Clinic Admin</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-semibold text-white mb-4">Staff Management</h3>
          <p className="text-slate-400 mb-4">Manage doctors, nurses, and administrative staff</p>
          <button className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
            Manage Staff
          </button>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-semibold text-white mb-4">Facility Settings</h3>
          <p className="text-slate-400 mb-4">Configure clinic hours, locations, and resources</p>
          <button className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
            Configure
          </button>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-semibold text-white mb-4">Reports</h3>
          <p className="text-slate-400 mb-4">View clinic performance and analytics</p>
          <button className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
            View Reports
          </button>
        </div>
      </div>
    </div>
  );

  const renderSaaSAdmin = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setCurrentModule('dashboard')} className="text-slate-400 hover:text-white transition-colors">
          ← Back
        </button>
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
          <Database className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white">SaaS Admin</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-semibold text-white mb-4">Tenant Management</h3>
          <p className="text-slate-400 mb-4">Manage all clinic tenants and subscriptions</p>
          <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
            Manage Tenants
          </button>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-semibold text-white mb-4">System Configuration</h3>
          <p className="text-slate-400 mb-4">Configure global system settings and features</p>
          <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
            Configure
          </button>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-semibold text-white mb-4">Analytics</h3>
          <p className="text-slate-400 mb-4">Platform-wide analytics and insights</p>
          <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
            View Analytics
          </button>
        </div>
      </div>
    </div>
  );

  const renderModule = () => {
    if (currentModule === 'clinicAdmin') return renderClinicAdmin();
    if (currentModule === 'saasAdmin') return renderSaaSAdmin();

    const module = modules.find(m => m.id === currentModule);
    if (!module) return renderDashboard();

    const Icon = module.icon;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setCurrentModule('dashboard')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">{module.name}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700/50">
            <h2 className="text-xl font-semibold text-white mb-6">Module Features</h2>
            <div className="space-y-4">
              {currentModule === 'practiceManagement' && (
                <>
                  <FeatureItem icon={Calendar} text="Advanced appointment scheduling with AI-powered optimization" />
                  <FeatureItem icon={Users} text="Multi-provider support with role-based access control" />
                  <FeatureItem icon={BarChart3} text="Real-time practice analytics and performance metrics" />
                  <FeatureItem icon={Bot} text="AI assistant for workflow automation and suggestions" />
                </>
              )}
              {currentModule === 'ehr' && (
                <>
                  <FeatureItem icon={FileText} text="Comprehensive patient records with version control" />
                  <FeatureItem icon={Stethoscope} text="Clinical decision support with AI recommendations" />
                  <FeatureItem icon={Database} text="Secure, encrypted data storage (HIPAA/GDPR compliant)" />
                  <FeatureItem icon={Bot} text="Smart charting with voice-to-text and auto-coding" />
                </>
              )}
              {currentModule === 'telehealth' && (
                <>
                  <FeatureItem icon={Video} text="HD video consultations with screen sharing" />
                  <FeatureItem icon={MessageSquare} text="Secure messaging and chat functionality" />
                  <FeatureItem icon={FileText} text="Digital prescription and documentation" />
                  <FeatureItem icon={Shield} text="End-to-end encrypted communications" />
                </>
              )}
              {currentModule === 'rcm' && (
                <>
                  <FeatureItem icon={DollarSign} text="Automated claims submission and tracking" />
                  <FeatureItem icon={CreditCard} text="Patient billing and payment processing" />
                  <FeatureItem icon={BarChart3} text="Revenue analytics and forecasting" />
                  <FeatureItem icon={Bot} text="AI-powered coding suggestions and denial prevention" />
                </>
              )}
              {currentModule === 'crm' && (
                <>
                  <FeatureItem icon={Users} text="360-degree patient relationship management" />
                  <FeatureItem icon={MessageSquare} text="Multi-channel communication hub" />
                  <FeatureItem icon={BarChart3} text="Patient engagement analytics" />
                  <FeatureItem icon={Bot} text="Automated follow-up and recall campaigns" />
                </>
              )}
              {currentModule === 'integrations' && (
                <>
                  <FeatureItem icon={Plug} text="RESTful API with comprehensive documentation" />
                  <FeatureItem icon={Zap} text="Pre-built integrations with major EHR systems" />
                  <FeatureItem icon={Database} text="Real-time data synchronization" />
                  <FeatureItem icon={Settings} text="Custom webhooks and automation rules" />
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4">Security & Compliance</h3>
              <div className="space-y-3">
                <ComplianceBadge icon={Shield} text="HIPAA Compliant" />
                <ComplianceBadge icon={Shield} text="GDPR Compliant" />
                <ComplianceBadge icon={Lock} text="2FA Enabled" />
                <ComplianceBadge icon={UserCheck} text="RBAC Active" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/30">
              <div className="flex items-center gap-3 mb-3">
                <Bot className="w-6 h-6 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">AI Assistant</h3>
              </div>
              <p className="text-slate-300 text-sm">
                Your AI assistant is analyzing this module and will provide personalized insights and recommendations.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden text-slate-400 hover:text-white"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">MedFlow</h1>
                  <p className="text-xs text-slate-400 capitalize">{planTier} Plan</p>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  onFocus={() => setShowSearchDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                  className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors w-64"
                />
                {showSearchDropdown && <SearchDropdown />}
              </div>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="en">English</option>
              </select>

              <button
                onClick={() => setShowSettingsPopup(true)}
                className="p-2 text-slate-400 hover:text-white transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>

              <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={() => setShowDoctorProfile(true)}
                  className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold hover:scale-110 transition-transform"
                >
                  {user.avatar}
                </button>
              </div>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur-md">
            <div className="px-4 py-4 space-y-3">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300"
              >
                <option value="en">English</option>
              </select>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {user.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{user.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{user.role}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading...</p>
            </div>
          </div>
        ) : (
          currentModule === 'dashboard' ? renderDashboard() : renderModule()
        )}
      </main>

      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        <button
          onClick={() => setShowAIPopup(true)}
          className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-110"
        >
          <Bot className="w-6 h-6 text-white" />
        </button>
        <button
          onClick={() => {
            const plans = ['starter', 'professional', 'enterprise'];
            const currentIndex = plans.indexOf(planTier);
            const nextIndex = (currentIndex + 1) % plans.length;
            setPlanTier(plans[nextIndex]);
          }}
          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white text-sm font-medium shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105"
        >
          Switch Plan
        </button>
      </div>

      {showDoctorProfile && <DoctorProfilePopup />}
      {showSettingsPopup && <SettingsPopup />}
      {showAIPopup && <AIAssistantPopup />}
      {showEditAppointment && <EditAppointmentPopup />}
    </div>
  );
};

export default MedFlowApp;
