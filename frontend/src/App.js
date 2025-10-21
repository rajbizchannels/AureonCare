import React, { useState, useEffect } from 'react';
import { Shield, Activity, Video, DollarSign, Users, Plug, Bell, Search, Lock, Bot, Menu, X, ChevronRight, Calendar, FileText, Stethoscope, BarChart3, MessageSquare, Clock, UserCheck, CreditCard, Database, Zap, Settings, ArrowLeft, Plus, Edit, Trash2, Eye, Phone, Mail, MapPin, Check, AlertCircle, TrendingUp, Save, XCircle, Sun, Moon } from 'lucide-react';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// API Service
const api = {
  // Appointments
  getAppointments: async () => {
    const response = await fetch(`${API_BASE_URL}/appointments`);
    if (!response.ok) throw new Error('Failed to fetch appointments');
    return response.json();
  },
  createAppointment: async (data) => {
    const response = await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create appointment');
    return response.json();
  },
  updateAppointment: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update appointment');
    return response.json();
  },
  deleteAppointment: async (id) => {
    const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete appointment');
    return response.json();
  },

  // Patients
  getPatients: async () => {
    const response = await fetch(`${API_BASE_URL}/patients`);
    if (!response.ok) throw new Error('Failed to fetch patients');
    return response.json();
  },
  createPatient: async (data) => {
    const response = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create patient');
    return response.json();
  },
  updatePatient: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/patients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update patient');
    return response.json();
  },
  deletePatient: async (id) => {
    const response = await fetch(`${API_BASE_URL}/patients/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete patient');
    return response.json();
  },

  // Claims
  getClaims: async () => {
    const response = await fetch(`${API_BASE_URL}/claims`);
    if (!response.ok) throw new Error('Failed to fetch claims');
    return response.json();
  },
  createClaim: async (data) => {
    const response = await fetch(`${API_BASE_URL}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create claim');
    return response.json();
  },
  updateClaim: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/claims/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update claim');
    return response.json();
  },
  deleteClaim: async (id) => {
    const response = await fetch(`${API_BASE_URL}/claims/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete claim');
    return response.json();
  },

  // Notifications
  getNotifications: async () => {
    const response = await fetch(`${API_BASE_URL}/notifications`);
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },
  createNotification: async (data) => {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create notification');
    return response.json();
  },
  deleteNotification: async (id) => {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete notification');
    return response.json();
  },
  clearAllNotifications: async () => {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to clear notifications');
    return response.json();
  },

  // Tasks
  getTasks: async () => {
    const response = await fetch(`${API_BASE_URL}/tasks`);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  },
  createTask: async (data) => {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create task');
    return response.json();
  },
  updateTask: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update task');
    return response.json();
  },
  deleteTask: async (id) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete task');
    return response.json();
  },

  // Users
  getUser: async (id) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },
  updateUser: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
  },
  getUsers: async () => {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },
  createUser: async (data) => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create user');
    return response.json();
  },
  deleteUser: async (id) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete user');
    return response.json();
  }
};

// Utility Functions for Date and Currency Formatting
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '$0.00';
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '$0.00';
  return `$${numAmount.toFixed(2)}`;
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  try {
    // If it's a full timestamp, extract time
    if (timeString.includes('T') || timeString.includes(' ')) {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    // If it's already in HH:MM format
    return timeString.substring(0, 5);
  } catch (error) {
    return 'Invalid Time';
  }
};

const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return 'N/A';
  try {
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return 'Invalid DateTime';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid DateTime';
  }
};

const MedFlowApp = () => {
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [currentView, setCurrentView] = useState('list');
  const [language, setLanguage] = useState('en');
  const [theme, setTheme] = useState('dark');
  const [planTier, setPlanTier] = useState('professional');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showForm, setShowForm] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [claims, setClaims] = useState([]);
  const [notifications, setNotifications] = useState([]);
  
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);

  const [user, setUser] = useState({
    id: 1,
    name: 'Dr. Sarah Chen',
    role: 'admin',
    practice: 'Central Medical Group',
    avatar: 'SC',
    email: 'sarah.chen@medflow.com',
    phone: '(555) 123-4567',
    license: 'MD-123456',
    specialty: 'Internal Medicine',
    preferences: {
      emailNotifications: true,
      smsAlerts: true,
      darkMode: true
    }
  });

  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointmentsData, patientsData, claimsData, notificationsData, tasksData, userData, usersData] = await Promise.all([
        api.getAppointments(),
        api.getPatients(),
        api.getClaims(),
        api.getNotifications(),
        api.getTasks(),
        api.getUser(1).catch(() => null), // Get user with id 1, fallback to null if fails
        api.getUsers().catch(() => []) // Get all users, fallback to empty array if fails
      ]);

      // Add computed 'name' field to patients for compatibility
      const patientsWithNames = patientsData.map(p => ({
        ...p,
        name: p.name || `${p.first_name} ${p.last_name}`
      }));

      setAppointments(appointmentsData);
      setPatients(patientsWithNames);
      setClaims(claimsData);
      setNotifications(notificationsData);
      setTasks(tasksData);
      setUsers(usersData);

      // Update user data if fetched successfully
      if (userData) {
        setUser(userData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please check if the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const addNotification = async (type, message) => {
    try {
      const newNotif = await api.createNotification({ type, message, read: false });
      setNotifications(prev => [newNotif, ...prev]);
    } catch (err) {
      console.error('Error creating notification:', err);
    }
  };

  const translations = {
    en: {
      dashboard: 'Dashboard',
      practiceManagement: 'Practice Management',
      ehr: 'Electronic Health Records',
      telehealth: 'Telehealth',
      rcm: 'Revenue Cycle Management',
      crm: 'Patient CRM',
      integrations: 'Integrations',
      welcome: 'Welcome back',
      todaysAppointments: "Today's Appointments",
      pendingTasks: 'Pending Tasks',
      revenue: 'Revenue This Month',
      activePatients: 'Active Patients',
      backToDashboard: 'Back to Dashboard'
    }
  };

  const t = translations[language] || translations['en'];

  const modules = [
    { id: 'practiceManagement', name: t.practiceManagement, icon: Activity, color: 'from-blue-500 to-cyan-500' },
    { id: 'ehr', name: t.ehr, icon: FileText, color: 'from-purple-500 to-pink-500' },
    { id: 'telehealth', name: t.telehealth, icon: Video, color: 'from-green-500 to-emerald-500' },
    { id: 'rcm', name: t.rcm, icon: DollarSign, color: 'from-yellow-500 to-orange-500' },
    { id: 'crm', name: t.crm, icon: Users, color: 'from-red-500 to-rose-500' },
    { id: 'integrations', name: t.integrations, icon: Plug, color: 'from-indigo-500 to-blue-500' }
  ];

  const planFeatures = {
    starter: ['practiceManagement', 'rcm'],
    professional: ['practiceManagement', 'ehr', 'telehealth', 'rcm', 'crm'],
    enterprise: ['practiceManagement', 'ehr', 'telehealth', 'rcm', 'crm', 'integrations']
  };

  const hasAccess = (moduleId) => planFeatures[planTier]?.includes(moduleId);

  const completeTask = async (taskId) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const updated = await api.updateTask(taskId, { ...task, status: 'Completed' });
        setTasks(prevTasks => prevTasks.map(t =>
          t.id === taskId ? updated : t
        ));
      }
    } catch (err) {
      console.error('Error completing task:', err);
    }
  };

  const clearNotification = async (notifId) => {
    try {
      await api.deleteNotification(notifId);
      setNotifications(prevNotifications => prevNotifications.filter(n => n.id !== notifId));
    } catch (err) {
      console.error('Error clearing notification:', err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await api.clearAllNotifications();
      setNotifications([]);
    } catch (err) {
      console.error('Error clearing all notifications:', err);
    }
  };

  // New Appointment Form
  const NewAppointmentForm = () => {
    const [formData, setFormData] = useState({
      patientId: '',
      providerId: '1',
      date: '',
      time: '',
      type: 'Check-up',
      duration: 30,
      reason: '',
      notes: ''
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      try {
        const appointmentData = {
          patient_id: formData.patientId,
          provider_id: formData.providerId,
          date: formData.date,
          time: formData.time,
          type: formData.type,
          status: 'Scheduled',
          reason: formData.reason,
          duration: formData.duration,
          notes: formData.notes
        };
        
        const newAppointment = await api.createAppointment(appointmentData);
        setAppointments(prev => [...prev, newAppointment]);
        
        const patient = patients.find(p => p.id.toString() === formData.patientId);
        await addNotification('appointment', `New appointment scheduled with ${patient?.name || patient?.first_name + ' ' + patient?.last_name}`);
        
        setShowForm(null);
      } catch (err) {
        console.error('Error creating appointment:', err);
        alert('Failed to create appointment. Please try again.');
      }
    };

    return (
      <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={() => setShowForm(null)}>
        <div className={`rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
          <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Calendar className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
              </div>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>New Appointment</h2>
            </div>
            <button onClick={() => setShowForm(null)} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Patient <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.patientId}
                    onChange={(e) => setFormData({...formData, patientId: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="">Select Patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {p.mrn}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Appointment Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="Check-up">Check-up</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Consultation">Consultation</option>
                    <option value="Physical">Physical Exam</option>
                    <option value="Procedure">Procedure</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Time <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Duration (minutes) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="15"
                    step="15"
                    value={formData.duration}
                    onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Provider
                  </label>
                  <select
                    value={formData.providerId}
                    onChange={(e) => setFormData({...formData, providerId: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="1">Dr. Sarah Chen</option>
                    <option value="2">Dr. Michael Torres</option>
                    <option value="3">Dr. Emily Watson</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Reason for Visit <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  placeholder="e.g., Annual physical, Follow-up on treatment"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Additional Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="3"
                  placeholder="Any additional information..."
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>
            </div>

            <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
              <button
                type="button"
                onClick={() => setShowForm(null)}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                <Save className="w-5 h-5" />
                Schedule Appointment
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // New Patient Form
  const NewPatientForm = () => {
    const [formData, setFormData] = useState({
      firstName: '',
      lastName: '',
      dob: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      insurance: '',
      insuranceId: '',
      emergencyContact: '',
      emergencyPhone: ''
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      try {
        // Generate MRN
        const mrn = `MRN${String(patients.length + 1).padStart(6, '0')}`;
        
        const patientData = {
          first_name: formData.firstName,
          last_name: formData.lastName,
          mrn: mrn,
          dob: formData.dob,
          gender: formData.gender,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          insurance: formData.insurance,
          insurance_id: formData.insuranceId,
          status: 'Active'
        };
        
        const newPatient = await api.createPatient(patientData);
        // Add computed 'name' field for compatibility
        const patientWithName = {
          ...newPatient,
          name: `${newPatient.first_name} ${newPatient.last_name}`
        };
        setPatients(prev => [...prev, patientWithName]);
        
        await addNotification('alert', `New patient added: ${newPatient.first_name} ${newPatient.last_name}`);
        setShowForm(null);
      } catch (err) {
        console.error('Error creating patient:', err);
        alert('Failed to create patient. Please try again.');
      }
    };

    return (
      <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={() => setShowForm(null)}>
        <div className={`rounded-xl border max-w-4xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
          <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-pink-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Users className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
              </div>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>New Patient</h2>
            </div>
            <button onClick={() => setShowForm(null)} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            <div className="space-y-6">
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      First Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Last Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Date of Birth <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.dob}
                      onChange={(e) => setFormData({...formData, dob: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Gender <span className="text-red-400">*</span>
                    </label>
                    <select
                      required
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Phone <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+1-555-0100"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="patient@example.com"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="123 Main Street"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      City <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      State <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength="2"
                      value={formData.state}
                      onChange={(e) => setFormData({...formData, state: e.target.value.toUpperCase()})}
                      placeholder="MA"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      ZIP Code <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.zip}
                      onChange={(e) => setFormData({...formData, zip: e.target.value})}
                      placeholder="02101"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Insurance Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Insurance Provider
                    </label>
                    <input
                      type="text"
                      value={formData.insurance}
                      onChange={(e) => setFormData({...formData, insurance: e.target.value})}
                      placeholder="Blue Cross"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Insurance ID
                    </label>
                    <input
                      type="text"
                      value={formData.insuranceId}
                      onChange={(e) => setFormData({...formData, insuranceId: e.target.value})}
                      placeholder="BC123456"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.emergencyContact}
                      onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                      placeholder="Jane Doe (Spouse)"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Emergency Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.emergencyPhone}
                      onChange={(e) => setFormData({...formData, emergencyPhone: e.target.value})}
                      placeholder="+1-555-0200"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
              <button
                type="button"
                onClick={() => setShowForm(null)}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                <Save className="w-5 h-5" />
                Add Patient
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // New Claim Form
  const NewClaimForm = () => {
    const [formData, setFormData] = useState({
      patientId: '',
      payerId: '',
      serviceDate: '',
      diagnosisCodes: '',
      procedureCodes: '',
      amount: '',
      notes: ''
    });

    const payers = [
      { id: 'BC001', name: 'Blue Cross' },
      { id: 'AE001', name: 'Aetna' },
      { id: 'UH001', name: 'UnitedHealth' },
      { id: 'CG001', name: 'Cigna' },
      { id: 'HU001', name: 'Humana' }
    ];

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      try {
        const claimNo = `CLM-2024-${String(claims.length + 1).padStart(3, '0')}`;
        const patient = patients.find(p => p.id.toString() === formData.patientId);
        const payer = payers.find(p => p.id === formData.payerId);
        
        const claimData = {
          claim_no: claimNo,
          patient_id: formData.patientId,
          payer: payer?.name || 'Unknown',
          payer_id: formData.payerId,
          amount: parseFloat(formData.amount),
          status: 'Pending',
          date: new Date().toISOString().split('T')[0],
          service_date: formData.serviceDate,
          diagnosis_codes: formData.diagnosisCodes.split(',').map(c => c.trim()),
          procedure_codes: formData.procedureCodes.split(',').map(c => c.trim()),
          notes: formData.notes
        };
        
        const newClaim = await api.createClaim(claimData);
        setClaims(prev => [...prev, newClaim]);
        
        await addNotification('claim', `New claim ${claimNo} created for ${patient?.name || patient?.first_name + ' ' + patient?.last_name}`);
        setShowForm(null);
      } catch (err) {
        console.error('Error creating claim:', err);
        alert('Failed to create claim. Please try again.');
      }
    };

    return (
      <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={() => setShowForm(null)}>
        <div className={`rounded-xl border max-w-3xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
          <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-yellow-500/10 to-orange-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                <DollarSign className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
              </div>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>New Claim</h2>
            </div>
            <button onClick={() => setShowForm(null)} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Patient <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.patientId}
                    onChange={(e) => setFormData({...formData, patientId: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="">Select Patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {p.mrn}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Insurance Payer <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.payerId}
                    onChange={(e) => setFormData({...formData, payerId: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="">Select Payer</option>
                    {payers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Service Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.serviceDate}
                    onChange={(e) => setFormData({...formData, serviceDate: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Claim Amount ($) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    placeholder="0.00"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Diagnosis Codes (ICD-10) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.diagnosisCodes}
                  onChange={(e) => setFormData({...formData, diagnosisCodes: e.target.value})}
                  placeholder="e.g., Z00.00, I10 (comma-separated)"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>Enter multiple codes separated by commas</p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Procedure Codes (CPT) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.procedureCodes}
                  onChange={(e) => setFormData({...formData, procedureCodes: e.target.value})}
                  placeholder="e.g., 99213, 99214 (comma-separated)"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>Enter multiple codes separated by commas</p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Clinical Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="4"
                  placeholder="Add any relevant clinical documentation or notes..."
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Bot className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-cyan-400 text-sm font-medium mb-1">AI Coding Assistant</p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Based on the selected patient and service date, AI can suggest appropriate diagnosis and procedure codes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
              <button
                type="button"
                onClick={() => setShowForm(null)}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                <Save className="w-5 h-5" />
                Create Claim
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // New User Form
  const NewUserForm = () => {
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      phone: '',
      role: 'staff',
      specialty: '',
      license: '',
      practice: user.practice
    });

    const handleSubmit = async (e) => {
      e.preventDefault();

      try {
        const initials = formData.name.split(' ').map(n => n[0]).join('').toUpperCase();

        const userData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          specialty: formData.specialty,
          license: formData.license,
          practice: formData.practice,
          avatar: initials,
          preferences: {
            emailNotifications: true,
            smsAlerts: false,
            darkMode: false
          }
        };

        const newUser = await api.createUser(userData);
        setUsers(prev => [...prev, newUser]);
        await addNotification('alert', 'User created successfully');
        setShowForm(null);
      } catch (err) {
        console.error('Error creating user:', err);
        alert('Failed to create user. Please try again.');
      }
    };

    return (
      <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={() => setShowForm(null)}>
        <div className={`rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
          <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-pink-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Add New User</h2>
            <button onClick={() => setShowForm(null)} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`}
                  placeholder="Dr. John Smith"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`}
                    placeholder="john.smith@medflow.com"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Role *</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="staff">Staff</option>
                    <option value="doctor">Doctor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>License Number</label>
                  <input
                    type="text"
                    value={formData.license}
                    onChange={(e) => setFormData({...formData, license: e.target.value})}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`}
                    placeholder="MD-123456"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Specialty</label>
                <input
                  type="text"
                  value={formData.specialty}
                  onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`}
                  placeholder="Internal Medicine"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Practice</label>
                <input
                  type="text"
                  value={formData.practice}
                  onChange={(e) => setFormData({...formData, practice: e.target.value})}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`}
                  placeholder="Central Medical Group"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowForm(null)}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                <Save className="w-5 h-5" />
                Add User
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // View/Edit Modal
  const ViewEditModal = () => {
    const [editData, setEditData] = useState(editingItem?.data || {});

    // Update editData when editingItem changes
    useEffect(() => {
      if (editingItem?.data) {
        setEditData(editingItem.data);
      }
    }, [editingItem]);

    // ESC key handler
    useEffect(() => {
      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          setEditingItem(null);
        }
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    if (!editingItem) return null;

    const isView = currentView === 'view';
    const { type, data } = editingItem;

    const handleSave = async () => {
      try {
        if (type === 'appointment') {
          const updated = await api.updateAppointment(editData.id, editData);
          setAppointments(prev => prev.map(apt =>
            apt.id === editData.id ? updated : apt
          ));
        } else if (type === 'patient') {
          const updated = await api.updatePatient(editData.id, editData);
          setPatients(prev => prev.map(patient =>
            patient.id === editData.id ? {...updated, name: updated.name || `${updated.first_name} ${updated.last_name}`} : patient
          ));
        } else if (type === 'userProfile') {
          // Update user profile
          const updated = await api.updateUser(editData.id, editData);
          setUser(updated);
          await addNotification('alert', 'User profile updated successfully');
        } else if (type === 'user') {
          // Update user
          const updated = await api.updateUser(editData.id, editData);
          setUsers(prev => prev.map(u =>
            u.id === editData.id ? updated : u
          ));
          await addNotification('alert', 'User updated successfully');
        } else {
          const updated = await api.updateClaim(editData.id, editData);
          setClaims(prev => prev.map(claim =>
            claim.id === editData.id ? updated : claim
          ));
        }
        await addNotification('alert', `${type === 'appointment' ? 'Appointment' : type === 'patient' ? 'Patient' : type === 'userProfile' ? 'User Profile' : type === 'user' ? 'User' : 'Claim'} updated successfully`);
        setEditingItem(null);
      } catch (err) {
        console.error('Error saving:', err);
        alert('Failed to save changes. Please try again.');
      }
    };

    return (
      <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={() => setEditingItem(null)}>
        <div className={`rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
          <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {isView ? 'View' : 'Edit'} {type === 'appointment' ? 'Appointment' : type === 'patient' ? 'Patient Chart' : type === 'userProfile' ? 'User Profile' : 'Claim'}
            </h2>
            <button onClick={() => setEditingItem(null)} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            {type === 'appointment' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Patient</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.patient}</p>
                    ) : (
                      <select
                        value={editData.patientId}
                        onChange={(e) => {
                          const patient = patients.find(p => p.id.toString() === e.target.value);
                          setEditData({...editData, patientId: e.target.value, patient: patient?.name});
                        }}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      >
                        {patients.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Doctor</label>
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.doctor}</p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Date</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatDate(editData.date)}</p>
                    ) : (
                      <input
                        type="date"
                        value={editData.date ? editData.date.split('T')[0] : ''}
                        onChange={(e) => setEditData({...editData, date: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Time</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatTime(editData.time)}</p>
                    ) : (
                      <input
                        type="time"
                        value={editData.time}
                        onChange={(e) => setEditData({...editData, time: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Type</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.type}</p>
                    ) : (
                      <select
                        value={editData.type}
                        onChange={(e) => setEditData({...editData, type: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      >
                        <option value="Check-up">Check-up</option>
                        <option value="Follow-up">Follow-up</option>
                        <option value="Consultation">Consultation</option>
                        <option value="Physical">Physical Exam</option>
                        <option value="Procedure">Procedure</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Duration</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.duration} minutes</p>
                    ) : (
                      <input
                        type="number"
                        value={editData.duration}
                        onChange={(e) => setEditData({...editData, duration: parseInt(e.target.value)})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Status</label>
                    {isView ? (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        editData.status === 'Confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {editData.status}
                      </span>
                    ) : (
                      <select
                        value={editData.status}
                        onChange={(e) => setEditData({...editData, status: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      >
                        <option value="Scheduled">Scheduled</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Reason</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.reason}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.reason}
                      onChange={(e) => setEditData({...editData, reason: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
              </div>
            ) : type === 'patient' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>First Name</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.first_name}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.first_name || ''}
                        onChange={(e) => setEditData({...editData, first_name: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Last Name</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.last_name}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.last_name || ''}
                        onChange={(e) => setEditData({...editData, last_name: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>MRN</label>
                    <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.mrn || 'N/A'}</p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Date of Birth</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatDate(editData.dob)}</p>
                    ) : (
                      <input
                        type="date"
                        value={(editData.dob || '').split('T')[0]}
                        onChange={(e) => setEditData({...editData, dob: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Gender</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.gender || 'N/A'}</p>
                    ) : (
                      <select
                        value={editData.gender || ''}
                        onChange={(e) => setEditData({...editData, gender: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Phone</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.phone}</p>
                    ) : (
                      <input
                        type="tel"
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({...editData, phone: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Email</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.email}</p>
                    ) : (
                      <input
                        type="email"
                        value={editData.email || ''}
                        onChange={(e) => setEditData({...editData, email: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Address</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.address || 'N/A'}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.address || ''}
                        onChange={(e) => setEditData({...editData, address: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : type === 'userProfile' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {editData.avatar}
                  </div>
                  <div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Role</p>
                    <p className={`font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.role}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Full Name</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.name}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.name || ''}
                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Practice</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.practice}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.practice || ''}
                        onChange={(e) => setEditData({...editData, practice: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Email</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.email || 'sarah.chen@medflow.com'}</p>
                    ) : (
                      <input
                        type="email"
                        value={editData.email || 'sarah.chen@medflow.com'}
                        onChange={(e) => setEditData({...editData, email: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Phone</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.phone || '(555) 123-4567'}</p>
                    ) : (
                      <input
                        type="tel"
                        value={editData.phone || '(555) 123-4567'}
                        onChange={(e) => setEditData({...editData, phone: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>License</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.license || 'MD-123456'}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.license || 'MD-123456'}
                        onChange={(e) => setEditData({...editData, license: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Specialty</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.specialty || 'Internal Medicine'}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.specialty || 'Internal Medicine'}
                        onChange={(e) => setEditData({...editData, specialty: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Language</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.language || 'English'}</p>
                    ) : (
                      <select
                        value={editData.language || 'English'}
                        onChange={(e) => setEditData({...editData, language: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      >
                        <option value="English">English</option>
                        <option value="Spanish">Spanish</option>
                        <option value="French">French</option>
                        <option value="German">German</option>
                        <option value="Chinese">Chinese</option>
                        <option value="Japanese">Japanese</option>
                        <option value="Hindi">Hindi</option>
                      </select>
                    )}
                  </div>
                </div>
                <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
                  <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Preferences</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Email Notifications</span>
                      <input
                        type="checkbox"
                        checked={editData.emailNotifications !== false}
                        onChange={(e) => setEditData({...editData, emailNotifications: e.target.checked})}
                        disabled={isView}
                        className="form-checkbox h-5 w-5 text-cyan-500"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>SMS Alerts</span>
                      <input
                        type="checkbox"
                        checked={editData.smsAlerts !== false}
                        onChange={(e) => setEditData({...editData, smsAlerts: e.target.checked})}
                        disabled={isView}
                        className="form-checkbox h-5 w-5 text-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : type === 'user' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {editData.avatar || editData.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Role</p>
                    <p className={`font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.role}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Full Name</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.name}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.name || ''}
                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Email</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.email}</p>
                    ) : (
                      <input
                        type="email"
                        value={editData.email || ''}
                        onChange={(e) => setEditData({...editData, email: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Phone</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.phone || 'N/A'}</p>
                    ) : (
                      <input
                        type="tel"
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({...editData, phone: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Role</label>
                    {isView ? (
                      <p className={`capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.role}</p>
                    ) : (
                      <select
                        value={editData.role || 'staff'}
                        onChange={(e) => setEditData({...editData, role: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      >
                        <option value="staff">Staff</option>
                        <option value="doctor">Doctor</option>
                        <option value="admin">Administrator</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>License</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.license || 'N/A'}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.license || ''}
                        onChange={(e) => setEditData({...editData, license: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Specialty</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.specialty || 'N/A'}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.specialty || ''}
                        onChange={(e) => setEditData({...editData, specialty: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Practice</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.practice || 'N/A'}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.practice || ''}
                        onChange={(e) => setEditData({...editData, practice: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Claim Number</label>
                    <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.claimNo || editData.claim_no || 'N/A'}</p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Status</label>
                    {isView ? (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        editData.status === 'Approved' ? 'bg-green-500/20 text-green-400' : 
                        editData.status === 'Submitted' ? 'bg-blue-500/20 text-blue-400' : 
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {editData.status}
                      </span>
                    ) : (
                      <select
                        value={editData.status}
                        onChange={(e) => setEditData({...editData, status: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Approved">Approved</option>
                        <option value="Denied">Denied</option>
                        <option value="Paid">Paid</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Patient</label>
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.patient}</p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Amount</label>
                    {isView ? (
                      <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(editData.amount)}</p>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        value={editData.amount}
                        onChange={(e) => setEditData({...editData, amount: parseFloat(e.target.value)})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Payer</label>
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.payer}</p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Service Date</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatDate(editData.serviceDate || editData.service_date)}</p>
                    ) : (
                      <input
                        type="date"
                        value={(editData.serviceDate || editData.service_date || '').split('T')[0]}
                        onChange={(e) => setEditData({...editData, serviceDate: e.target.value, service_date: e.target.value})}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Diagnosis Codes</label>
                  {isView ? (
                    <div className="flex gap-2 flex-wrap">
                      {editData.diagnosisCodes?.map((code, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-mono">
                          {code}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={editData.diagnosisCodes?.join(', ')}
                      onChange={(e) => setEditData({...editData, diagnosisCodes: e.target.value.split(',').map(c => c.trim())})}
                      placeholder="Z00.00, I10"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Procedure Codes</label>
                  {isView ? (
                    <div className="flex gap-2 flex-wrap">
                      {editData.procedureCodes?.map((code, idx) => (
                        <span key={idx} className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-mono">
                          {code}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={editData.procedureCodes?.join(', ')}
                      onChange={(e) => setEditData({...editData, procedureCodes: e.target.value.split(',').map(c => c.trim())})}
                      placeholder="99213, 99214"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                {(editData.notes || !isView) && (
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Notes</label>
                    {isView ? (
                      <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.notes}</p>
                    ) : (
                      <textarea
                        value={editData.notes || ''}
                        onChange={(e) => setEditData({...editData, notes: e.target.value})}
                        rows="3"
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
              <button
                onClick={() => setEditingItem(null)}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                Close
              </button>
              {!isView && (
                <button
                  onClick={handleSave}
                  className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                >
                  <Save className="w-5 h-5" />
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const StatCard = ({ title, value, icon: Icon, trend, color, onClick }) => (
    <div 
      onClick={onClick}
      className={`bg-gradient-to-br backdrop-blur-sm rounded-xl p-6 border transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer group ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-cyan-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-cyan-600/50'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{title}</p>
          <p className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</p>
          {trend && (
            <p className="text-sm text-green-400 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              {trend}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
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
        className={`relative bg-gradient-to-br rounded-xl p-6 border transition-all duration-300 text-left w-full ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}${!locked && 'hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/20 cursor-pointer'} ${locked && 'opacity-50 cursor-not-allowed'}`}
      >
        {locked && <Lock className={`absolute top-3 right-3 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`} />}
        <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center mb-4`}>
          <Icon className={`w-7 h-7 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
        </div>
        <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{module.name}</h3>
        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{locked ? 'Upgrade to access' : 'Click to open'}</p>
      </button>
    );
  };

  const AppointmentsQuickView = ({ onClose }) => (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
      <div className={`rounded-xl border max-w-4xl w-full max-h-[80vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Today's Appointments</h2>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="space-y-3">
            {appointments.map(apt => {
              const patient = patients.find(p => p.id === apt.patient_id);
              const patientName = apt.patient || patient?.name || 'Unknown Patient';
              const initials = patientName.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase();
              
              return (
                <div key={apt.id} className={`p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {initials}
                      </div>
                      <div>
                        <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{patientName}</h3>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{apt.type}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      apt.status === 'Confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {apt.status}
                    </span>
                  </div>
                  <div className={`flex items-center gap-4 text-sm ml-13 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatTime(apt.time)}
                    </div>
                    <div className="flex items-center gap-1">
                      <UserCheck className="w-4 h-4" />
                      {apt.doctor || 'Dr. Sarah Chen'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button 
            onClick={() => {
              onClose();
              setCurrentModule('practiceManagement');
            }}
            className={`w-full mt-6 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            View All Appointments
          </button>
        </div>
      </div>
    </div>
  );

  const TasksQuickView = ({ onClose }) => (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
      <div className={`rounded-xl border max-w-3xl w-full max-h-[80vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Pending Tasks</h2>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="space-y-3">
            {tasks.filter(t => t.status === 'Pending').map(task => (
              <div key={task.id} className={`p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{task.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        task.priority === 'High' ? 'bg-red-500/20 text-red-400' :
                        task.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Due: {task.dueDate}</p>
                  </div>
                  <button 
                    onClick={() => completeTask(task.id)}
                    className="p-2 hover:bg-green-500/20 rounded-lg transition-colors group"
                    title="Mark as complete"
                  >
                    <Check className={`w-5 h-5 group-hover:text-green-400 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const RevenueQuickView = ({ onClose }) => (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
      <div className={`rounded-xl border max-w-4xl w-full max-h-[80vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Revenue Overview</h2>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Total Billed</p>
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {formatCurrency(claims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0))}
              </p>
            </div>
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Collected</p>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(claims.filter(c => c.status === 'Approved' || c.status === 'Paid').reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0))}
              </p>
            </div>
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Pending</p>
              <p className="text-2xl font-bold text-yellow-400">
                {formatCurrency(claims.filter(c => c.status === 'Pending' || c.status === 'Submitted').reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0))}
              </p>
            </div>
          </div>
          
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Recent Claims</h3>
          <div className="space-y-3">
            {claims.map(claim => {
              const patient = patients.find(p => p.id === claim.patient_id);
              const patientName = claim.patient || patient?.name || 'Unknown Patient';
              
              return (
                <div key={claim.id} className={`p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{claim.claimNo || claim.claim_no || 'N/A'}</h4>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{patientName}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(claim.amount)}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        claim.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
                        claim.status === 'Submitted' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {claim.status}
                      </span>
                    </div>
                  </div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>{claim.payer} • {formatDate(claim.date)}</p>
                </div>
              );
            })}
          </div>
          <button 
            onClick={() => {
              onClose();
              setCurrentModule('rcm');
            }}
            className={`w-full mt-6 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            View All Claims
          </button>
        </div>
      </div>
    </div>
  );

  const PatientsQuickView = ({ onClose }) => (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
      <div className={`rounded-xl border max-w-4xl w-full max-h-[80vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Active Patients</h2>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patients.map(patient => {
              const displayName = patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
              const initials = displayName.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase();
              
              return (
                <div key={patient.id} className={`p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {initials}
                    </div>
                    <div>
                      <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{displayName}</h3>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{patient.mrn}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(patient.dob)}</span>
                    </div>
                    <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      <Phone className="w-4 h-4" />
                      <span>{patient.phone}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button 
            onClick={() => {
              onClose();
              setCurrentModule('ehr');
            }}
            className={`w-full mt-6 px-4 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            View All Patients
          </button>
        </div>
      </div>
    </div>
  );

  const NotificationsPanel = () => (
    <div className={`fixed top-16 right-4 w-96 rounded-xl border shadow-2xl z-50 max-h-[80vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
      <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Notifications</h3>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button 
              onClick={clearAllNotifications}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Clear All
            </button>
          )}
          <button onClick={() => setShowNotifications(false)} className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
        {notifications.length === 0 ? (
          <div className={`p-8 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No notifications</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div key={notif.id} className={`p-4 border-b transition-colors ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800/50' : 'border-gray-200 hover:bg-gray-200/50'} ${!notif.read && 'bg-cyan-500/5'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notif.type === 'appointment' ? 'bg-blue-500/20' :
                  notif.type === 'claim' ? 'bg-yellow-500/20' :
                  notif.type === 'alert' ? 'bg-red-500/20' :
                  'bg-green-500/20'
                }`}>
                  {notif.type === 'appointment' && <Calendar className="w-4 h-4 text-blue-400" />}
                  {notif.type === 'claim' && <DollarSign className="w-4 h-4 text-yellow-400" />}
                  {notif.type === 'alert' && <AlertCircle className="w-4 h-4 text-red-400" />}
                  {notif.type === 'message' && <MessageSquare className="w-4 h-4 text-green-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{notif.message}</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>{notif.time}</p>
                </div>
                <button
                  onClick={() => clearNotification(notif.id)}
                  className={`p-1 rounded transition-colors flex-shrink-0 ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                  title="Clear notification"
                >
                  <X className={`w-4 h-4 hover:text-white ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const SearchPanel = () => {
    const [searchQuery, setSearchQuery] = useState('');

    // ESC key handler
    useEffect(() => {
      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          setShowSearch(false);
        }
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const searchResults = [
      ...patients.filter(p => {
        const name = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      }).map(p => ({ type: 'patient', ...p })),
      ...appointments.filter(a => {
        const patient = patients.find(p => p.id === a.patient_id);
        const patientName = a.patient || patient?.name || '';
        return patientName.toLowerCase().includes(searchQuery.toLowerCase());
      }).map(a => ({ type: 'appointment', ...a }))
    ].slice(0, 5);

    return (
      <div className={`fixed top-16 left-1/2 transform -translate-x-1/2 w-full max-w-2xl rounded-xl border shadow-2xl z-50 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
        <div className="p-4">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients, appointments, records..."
              className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              autoFocus
            />
            <button onClick={() => setShowSearch(false)} className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}>
              <X className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          </div>
        </div>
        {searchQuery && (
          <div className={`border-t max-h-96 overflow-y-auto ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            {searchResults.length > 0 ? (
              searchResults.map((result, idx) => {
                let displayName;
                if (result.type === 'patient') {
                  displayName = result.name || `${result.first_name || ''} ${result.last_name || ''}`.trim();
                } else {
                  const patient = patients.find(p => p.id === result.patient_id);
                  displayName = result.patient || patient?.name || 'Unknown Patient';
                }
                
                return (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentView('view');
                    setEditingItem({ type: result.type, data: result });
                    setShowSearch(false);
                  }}
                  className={`p-4 transition-colors cursor-pointer border-b last:border-b-0 ${theme === 'dark' ? 'hover:bg-slate-800 border-slate-800' : 'hover:bg-gray-100 border-gray-200'}`}
                >
                  <div className="flex items-center gap-3">
                    {result.type === 'patient' && <Users className="w-5 h-5 text-purple-400" />}
                    {result.type === 'appointment' && <Calendar className="w-5 h-5 text-blue-400" />}
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{displayName}</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        {result.type === 'patient' ? result.mrn : `${formatDate(result.date)} ${formatTime(result.time)}`}
                      </p>
                    </div>
                  </div>
                </div>
              );
              })
            ) : (
              <div className={`p-8 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                No results found
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const AIAssistantPanel = () => {
    // ESC key handler
    useEffect(() => {
      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          setShowAIAssistant(false);
        }
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    return (
      <div className={`fixed bottom-24 right-6 w-96 rounded-xl border border-cyan-500/30 shadow-2xl z-50 ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
        <div className={`p-4 border-b bg-gradient-to-r from-cyan-500/10 to-blue-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
              <Bot className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>AI Assistant</h3>
              <p className="text-cyan-400 text-xs">How can I help you today?</p>
            </div>
            <button onClick={() => setShowAIAssistant(false)} className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
              <X className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          </div>
        </div>
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        <div
          onClick={() => {
            setSelectedItem('tasks');
            setShowAIAssistant(false);
          }}
          className={`p-3 rounded-lg cursor-pointer transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
        >
          <p className="text-cyan-400 text-sm mb-2">📊 Today's Insights</p>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>You have {tasks.filter(t => t.status === 'Pending' && t.priority === 'High').length} high-priority tasks requiring attention.</p>
        </div>
        <div
          onClick={() => {
            setSelectedItem('appointments');
            setShowAIAssistant(false);
          }}
          className={`p-3 rounded-lg cursor-pointer transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
        >
          <p className="text-cyan-400 text-sm mb-2">💡 Suggestion</p>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>2 appointments can be rescheduled to reduce patient wait time by 15 minutes.</p>
        </div>
        <div
          onClick={() => {
            setCurrentModule('rcm');
            setShowAIAssistant(false);
          }}
          className={`p-3 rounded-lg cursor-pointer transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
        >
          <p className="text-cyan-400 text-sm mb-2">⚠️ Alert</p>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Review documentation for pending claims to reduce denial risk.</p>
        </div>
      </div>
      <div className={`p-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask me anything..."
            className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
          />
          <button className={`px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
    );
  };

  const UserProfileModal = () => {
    // ESC key handler
    useEffect(() => {
      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          setCurrentView('list');
        }
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    return (
      <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={() => setCurrentView('list')}>
        <div className={`rounded-xl border max-w-2xl w-full p-6 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>User Profile</h2>
            <button onClick={() => setCurrentView('list')} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className={`w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {user.avatar}
            </div>
            <div>
              <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.name}</h3>
              <p className={`capitalize ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{user.role}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>{user.practice}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Email</p>
              <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.email || 'N/A'}</p>
            </div>
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Phone</p>
              <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.phone || 'N/A'}</p>
            </div>
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>License</p>
              <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.license || 'N/A'}</p>
            </div>
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Specialty</p>
              <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.specialty || 'N/A'}</p>
            </div>
          </div>

          <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
            <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Preferences</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Email Notifications</span>
                <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-cyan-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>SMS Alerts</span>
                <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-cyan-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Dark Mode</span>
                <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-cyan-500" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setCurrentView('edit');
                setEditingItem({ type: 'userProfile', data: user });
              }}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
            >
              Edit Profile
            </button>
            <button onClick={() => setCurrentView('list')} className={`flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
    );
  };

  const SettingsModal = () => {
    // ESC key handler
    useEffect(() => {
      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          setCurrentView('list');
        }
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    return (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={() => setCurrentView('list')}>
      <div className={`rounded-xl border max-w-3xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
          <button onClick={() => setCurrentView('list')} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-6">
            {/* General Settings */}
            <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>General Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Email Notifications</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Receive email updates for appointments and tasks</p>
                  </div>
                  <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-cyan-500" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>SMS Alerts</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Get text message reminders</p>
                  </div>
                  <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-cyan-500" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Push Notifications</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Browser notifications for important updates</p>
                  </div>
                  <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-cyan-500" />
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Appearance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Dark Mode</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Use dark theme</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={theme === 'dark'}
                    onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
                    className="form-checkbox h-5 w-5 text-cyan-500"
                  />
                </div>
                <div>
                  <label className={`block font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Privacy & Security */}
            <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Privacy & Security</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Two-Factor Authentication</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Enhanced account security</p>
                  </div>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm">Enabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Session Timeout</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Auto logout after inactivity</p>
                  </div>
                  <select className={`px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}>
                    <option value="15">15 minutes</option>
                    <option value="30" selected>30 minutes</option>
                    <option value="60">1 hour</option>
                  </select>
                </div>
                <button className="w-full px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-colors">
                  Change Password
                </button>
              </div>
            </div>

            {/* Integration Settings */}
            <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Integrations</h3>
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Calendar Sync</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Google Calendar integration</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors">
                    Connected
                  </button>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Email Provider</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Gmail integration</p>
                    </div>
                  </div>
                  <button className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                    Connect
                  </button>
                </div>
              </div>
            </div>
          </div>

            {/* User Management */}
            {user.role === 'admin' && (
              <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>User Management</h3>
                  <button
                    onClick={() => setShowForm('user')}
                    className={`flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    <Plus className="w-4 h-4" />
                    Add User
                  </button>
                </div>
                <div className="space-y-3">
                  {users.map((u) => (
                    <div key={u.id} className={`flex items-center justify-between p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {u.avatar || u.name?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{u.name}</p>
                          <p className={`text-sm capitalize ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{u.role} • {u.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingItem({ type: 'user', data: u });
                            setCurrentView('edit');
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-gray-300'}`}
                          title="Edit"
                        >
                          <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                        </button>
                        <button
                          onClick={async () => {
                            if (u.id === user.id) {
                              alert('You cannot delete your own account');
                              return;
                            }
                            if (window.confirm(`Are you sure you want to delete ${u.name}?`)) {
                              try {
                                await api.deleteUser(u.id);
                                setUsers(prev => prev.filter(usr => usr.id !== u.id));
                                await addNotification('alert', 'User deleted successfully');
                              } catch (err) {
                                console.error('Error deleting user:', err);
                                alert('Failed to delete user');
                              }
                            }
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-gray-300'}`}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <p className={`text-center py-8 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      No users found. Click "Add User" to create one.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Roles & Permissions */}
            {user.role === 'admin' && (
              <div className={`rounded-lg p-6 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Roles & Permissions</h3>
                <div className="space-y-4">
                  {/* Admin Role */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Administrator</h4>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Full access to all features and settings
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium">
                        {users.filter(u => u.role === 'admin').length} users
                      </span>
                    </div>
                    <div className={`grid grid-cols-2 gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>User Management</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>All Modules</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>System Settings</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Reports & Analytics</span>
                      </div>
                    </div>
                  </div>

                  {/* Doctor Role */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Doctor</h4>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Access to patient records and clinical features
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium">
                        {users.filter(u => u.role === 'doctor').length} users
                      </span>
                    </div>
                    <div className={`grid grid-cols-2 gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Patient Records</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Appointments</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>EHR & Telehealth</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span>User Management</span>
                      </div>
                    </div>
                  </div>

                  {/* Staff Role */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-200/50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Staff</h4>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Access to appointments and basic features
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium">
                        {users.filter(u => u.role === 'staff' || u.role === 'user').length} users
                      </span>
                    </div>
                    <div className={`grid grid-cols-2 gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Appointments</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Patient Search</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span>Patient Records</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span>System Settings</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6 p-6 pt-0">
          <button onClick={() => setCurrentView('list')} className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}>
            Cancel
          </button>
          <button className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.welcome}, {user.name}</h1>
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{user.practice}</p>
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
          onClick={() => setSelectedItem('appointments')}
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
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button 
            onClick={() => setShowForm('appointment')}
            className={`p-4 rounded-lg transition-colors text-left group ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
          >
            <Calendar className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>New Appointment</p>
          </button>
          <button 
            onClick={() => setShowForm('patient')}
            className={`p-4 rounded-lg transition-colors text-left group ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
          >
            <FileText className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Add Patient</p>
          </button>
          <button 
            onClick={() => setCurrentModule('telehealth')}
            className={`p-4 rounded-lg transition-colors text-left group ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
          >
            <Video className="w-6 h-6 text-green-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Start Video Call</p>
          </button>
          <button 
            onClick={() => setShowForm('claim')}
            className={`p-4 rounded-lg transition-colors text-left group ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
          >
            <DollarSign className="w-6 h-6 text-yellow-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>New Claim</p>
          </button>
        </div>
      </div>

      <div>
        <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Available Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map(module => (
            <ModuleCard key={module.id} module={module} onClick={(id) => {
              setCurrentModule(id);
            }} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          onClick={() => setSelectedItem('appointments')}
          className={`bg-gradient-to-br rounded-xl p-6 border cursor-pointer transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-blue-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-blue-600/50'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Upcoming Appointments</h3>
            <ChevronRight className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </div>
          <div className="space-y-3">
            {appointments.slice(0, 3).map(apt => {
              const patient = patients.find(p => p.id === apt.patient_id);
              const patientName = apt.patient || patient?.name || 'Unknown Patient';

              return (
                <div key={apt.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-gray-100/30 hover:bg-gray-200/50'}`}>
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{patientName}</p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{formatTime(apt.time)} - {apt.type}</p>
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
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>High Priority Tasks</h3>
            <ChevronRight className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </div>
          <div className="space-y-3">
            {tasks.filter(t => t.priority === 'High' && t.status === 'Pending').slice(0, 3).map(task => (
              <div key={task.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-gray-100/30 hover:bg-gray-200/50'}`}>
                <div className="flex-1">
                  <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{task.title}</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Due: {task.dueDate}</p>
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

  const renderPracticeManagement = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Appointments</h2>
        <button 
          onClick={() => setShowForm('appointment')}
          className={`flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          <Plus className="w-4 h-4" />
          New Appointment
        </button>
      </div>

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
    </div>
  );

  const renderEHR = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Patient Records</h2>
        <button 
          onClick={() => setShowForm('patient')}
          className={`flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          <Plus className="w-4 h-4" />
          New Patient
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {patients.map(patient => {
          const displayName = patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
          const initials = displayName.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase();
          
          return (
            <div key={patient.id} className={`bg-gradient-to-br rounded-xl p-6 border transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-purple-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-purple-600/50'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {initials}
                </div>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                  {patient.status}
                </span>
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{displayName}</h3>
              <div className="space-y-2 text-sm">
                <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  <FileText className="w-4 h-4" />
                  <span>MRN: {patient.mrn}</span>
                </div>
                <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  <Calendar className="w-4 h-4" />
                  <span>DOB: {formatDate(patient.dob)}</span>
                </div>
                <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  <Phone className="w-4 h-4" />
                  <span>{patient.phone}</span>
                </div>
                <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{patient.email}</span>
                </div>
              </div>
              <div className={`mt-4 pt-4 border-t flex gap-2 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
                <button
                  onClick={() => {
                    setCurrentView('view');
                    setEditingItem({ type: 'patient', data: patient });
                  }}
                  className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm transition-colors"
                >
                  View Chart
                </button>
                <button
                  onClick={() => {
                    setCurrentView('edit');
                    setEditingItem({ type: 'patient', data: patient });
                  }}
                  className={`px-3 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTelehealth = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Video Consultations</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`bg-gradient-to-br rounded-xl p-8 border text-center ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
            <Video className={`w-10 h-10 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
          </div>
          <h3 className={`text-xl font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Start Video Call</h3>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Launch a secure video consultation with your patient</p>
          <button className={`px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Start New Call
          </button>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-8 border text-center ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
            <Calendar className={`w-10 h-10 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
          </div>
          <h3 className={`text-xl font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Scheduled Sessions</h3>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>View and manage upcoming telehealth appointments</p>
          <button className={`px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            View Schedule
          </button>
        </div>
      </div>

      <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Recent Sessions</h3>
        <div className="space-y-3">
          {['John Doe - 45 min - Oct 19, 2025', 'Jane Smith - 30 min - Oct 18, 2025', 'Mike Johnson - 60 min - Oct 17, 2025'].map((session, idx) => (
            <div key={idx} className={`flex items-center justify-between p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-gray-100/30 hover:bg-gray-200/50'}`}>
              <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{session}</span>
              <button className={`px-4 py-2 rounded-lg text-sm transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                View Recording
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRCM = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Claims Management</h2>
        <button 
          onClick={() => setShowForm('claim')}
          className={`flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          <Plus className="w-4 h-4" />
          New Claim
        </button>
      </div>

      <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Claim #</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Patient</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Amount</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Payer</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Date</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim, idx) => {
                const patient = patients.find(p => p.id === claim.patient_id);
                const patientName = claim.patient || patient?.name || 'Unknown Patient';
                
                return (
                <tr key={claim.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                  <td className={`px-6 py-4 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{claim.claimNo || claim.claim_no || 'N/A'}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{patientName}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatCurrency(claim.amount)}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{claim.payer}</td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{formatDate(claim.date)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      claim.status === 'Approved' ? 'bg-green-500/20 text-green-400' : 
                      claim.status === 'Submitted' ? 'bg-blue-500/20 text-blue-400' : 
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {claim.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingItem({ type: 'claim', data: claim });
                          setCurrentView('view');
                        }}
                        className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} 
                        title="View"
                      >
                        <Eye className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingItem({ type: 'claim', data: claim });
                          setCurrentView('edit');
                        }}
                        className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`} 
                        title="Edit"
                      >
                        <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm('Are you sure you want to delete this claim?')) {
                            try {
                              await api.deleteClaim(claim.id);
                              setClaims(prev => prev.filter(c => c.id !== claim.id));
                              await addNotification('alert', 'Claim deleted successfully');
                            } catch (err) {
                              console.error('Error deleting claim:', err);
                              alert('Failed to delete claim');
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
    </div>
  );

  const renderCRM = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Patient Communications</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`bg-gradient-to-br rounded-xl p-6 border text-center transition-all cursor-pointer ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-red-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-red-600/50'}`}>
          <Mail className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Email Campaign</h3>
          <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Send bulk emails to patients</p>
          <button
            onClick={() => setShowForm('campaign')}
            className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            Create Campaign
          </button>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border text-center transition-all cursor-pointer ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-green-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-green-600/50'}`}>
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-green-400" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>SMS Reminders</h3>
          <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Send appointment reminders</p>
          <button
            onClick={() => setShowForm('sms')}
            className="w-full px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
          >
            Send SMS
          </button>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border text-center transition-all cursor-pointer ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-blue-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-blue-600/50'}`}>
          <Phone className="w-12 h-12 mx-auto mb-4 text-blue-400" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Call Queue</h3>
          <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Manage patient callbacks</p>
          <button
            onClick={() => setShowForm('callQueue')}
            className="w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
          >
            View Queue
          </button>
        </div>
      </div>
    </div>
  );

  const renderIntegrations = () => (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>API & Integrations</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>API Keys</h3>
          <div className="space-y-3 mb-4">
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Production API Key</span>
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
              </div>
              <code className={`text-xs break-all ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>medflow_prod_xxxxxxxxxxxxxxxxxxx</code>
            </div>
          </div>
          <button className={`w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Generate New Key
          </button>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Webhooks</h3>
          <div className="space-y-3 mb-4">
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Appointment Created</span>
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
              </div>
              <code className={`text-xs break-all ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>https://api.example.com/webhook</code>
            </div>
          </div>
          <button className={`w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Add Webhook
          </button>
        </div>
      </div>
    </div>
  );

  const renderModule = () => {
    const module = modules.find(m => m.id === currentModule);
    if (!module) return renderDashboard();

    const Icon = module.icon;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentModule('dashboard')}
            className={`flex items-center gap-2 hover:text-white transition-colors px-4 py-2 rounded-lg ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/50' : 'text-gray-600 hover:bg-gray-200/50'}`}
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t.backToDashboard}</span>
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center shadow-lg`}>
            <Icon className={`w-8 h-8 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
          </div>
          <div>
            <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{module.name}</h1>
            <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Manage and monitor all activities</p>
          </div>
        </div>

        {currentModule === 'practiceManagement' && renderPracticeManagement()}
        {currentModule === 'ehr' && renderEHR()}
        {currentModule === 'telehealth' && renderTelehealth()}
        {currentModule === 'rcm' && renderRCM()}
        {currentModule === 'crm' && renderCRM()}
        {currentModule === 'integrations' && renderIntegrations()}
      </div>
    );
  };
  
  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-gray-100 via-white to-gray-100'}`}>
      {/* Loading Overlay */}
      {loading && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`}>
          <div className={`rounded-xl p-8 border ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
              <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Loading data...</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 font-medium">Error</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <header className={`backdrop-blur-md border-b sticky top-0 z-50 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/50 border-gray-200/50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button 
              onClick={() => setCurrentModule('dashboard')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Stethoscope className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>MedFlow</h1>
                <p className={`text-xs capitalize ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{planTier} Plan</p>
              </div>
            </button>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowSearch(!showSearch)}
                className={`p-2 rounded-lg transition-colors relative ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                title="Search"
              >
                <Search className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
              </button>

              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-lg transition-colors relative ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                title="Notifications"
              >
                <Bell className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>

              <button
                onClick={() => setCurrentView('settings')}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                title="Settings"
              >
                <Settings className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
              </button>

              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-yellow-400" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-600" />
                )}
              </button>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'}`}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="zh">中文</option>
                <option value="ja">日本語</option>
                <option value="hi">हिन्दी</option>
              </select>

              <button
                onClick={() => {
                  const plans = ['starter', 'professional', 'enterprise'];
                  const currentIndex = plans.indexOf(planTier);
                  const nextIndex = (currentIndex + 1) % plans.length;
                  setPlanTier(plans[nextIndex]);
                }}
                className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 text-xs font-medium transition-colors"
              >
                {planTier}
              </button>

              <button
                onClick={() => setCurrentView('profile')}
                className={`w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-semibold cursor-pointer hover:scale-105 transition-transform ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                {user.avatar}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentModule === 'dashboard' ? renderDashboard() : renderModule()}
      </main>

      <button 
        onClick={() => setShowAIAssistant(!showAIAssistant)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-110 z-50"
        title="AI Assistant"
      >
        <Bot className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
      </button>

      {showForm === 'appointment' && <NewAppointmentForm />}
      {showForm === 'patient' && <NewPatientForm />}
      {showForm === 'claim' && <NewClaimForm />}
      {showForm === 'user' && <NewUserForm />}
      {editingItem && <ViewEditModal />}
      {selectedItem === 'appointments' && <AppointmentsQuickView onClose={() => setSelectedItem(null)} />}
      {selectedItem === 'tasks' && <TasksQuickView onClose={() => setSelectedItem(null)} />}
      {selectedItem === 'revenue' && <RevenueQuickView onClose={() => setSelectedItem(null)} />}
      {selectedItem === 'patients' && <PatientsQuickView onClose={() => setSelectedItem(null)} />}
      {showNotifications && <NotificationsPanel />}
      {showSearch && <SearchPanel />}
      {showAIAssistant && <AIAssistantPanel />}
      {currentView === 'profile' && <UserProfileModal />}
      {currentView === 'settings' && <SettingsModal />}
    </div>
  );
};

export default MedFlowApp;