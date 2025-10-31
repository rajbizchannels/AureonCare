import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/apiService';

// Create the context
const AppContext = createContext();

// AppProvider component
const AppProvider = ({ children }) => {
  // Authentication and UI state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
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
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [appointmentViewType, setAppointmentViewType] = useState('list'); // 'list' or 'calendar'
  const [calendarViewType, setCalendarViewType] = useState('week'); // 'day' or 'week'

  // Data state
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [claims, setClaims] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);

  // User state - dynamically loaded from database
  const [user, setUser] = useState(null);

  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  /**
   * Fetches all data from the backend API
   */
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointmentsData, patientsData, claimsData, paymentsData, notificationsData, tasksData, userData, usersData] = await Promise.all([
        api.getAppointments(),
        api.getPatients(),
        api.getClaims(),
        api.getPayments().catch(() => []), // Get payments, fallback to empty array if fails
        api.getNotifications(),
        api.getTasks(),
        api.getUser(1).catch(() => null), // Get user with id 1, fallback to null if fails
        api.getUsers().catch(() => []) // Get all users, fallback to empty array if fails
      ]);

      setAppointments(appointmentsData);
      setPatients(patientsData);
      setClaims(claimsData);
      setPayments(paymentsData);
      setNotifications(notificationsData);
      setTasks(tasksData);
      setUsers(usersData);

      // Update user data - fetch from API or use first admin/physician from users list
      let currentUser = userData;
      if (!currentUser && usersData.length > 0) {
        // If no user fetched, get first admin or physician from users list
        currentUser = usersData.find(u => u.role === 'admin' || u.role === 'physician') || usersData[0];
        console.log('Using fallback user:', currentUser);
      }

      if (currentUser) {
        // Ensure required fields exist with fallbacks
        const userWithDefaults = {
          ...currentUser,
          avatar: currentUser.avatar || `${currentUser.first_name?.charAt(0) || ''}${currentUser.last_name?.charAt(0) || ''}`.toUpperCase() || 'U',
          practice: currentUser.practice || 'Medical Practice',
          preferences: currentUser.preferences || {
            emailNotifications: true,
            smsAlerts: true,
            darkMode: true
          }
        };

        setUser(userWithDefaults);

        // Sync theme and language from user preferences
        if (userWithDefaults.preferences) {
          if (userWithDefaults.preferences.darkMode !== undefined) {
            setTheme(userWithDefaults.preferences.darkMode ? 'dark' : 'light');
          }
          if (userWithDefaults.preferences.language) {
            setLanguage(userWithDefaults.preferences.language);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please check if the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Updates user preferences in the backend and local state
   * @param {Object} newPreferences - The new preferences to merge with existing ones
   * @returns {boolean} - Returns true if successful, false otherwise
   */
  const updateUserPreferences = async (newPreferences) => {
    try {
      const updatedUser = {
        ...user,
        preferences: {
          ...user.preferences,
          ...newPreferences
        }
      };

      // Update backend
      await api.updateUser(user.id, { preferences: updatedUser.preferences });

      // Update local state
      setUser(updatedUser);

      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      await addNotification('alert', 'Failed to save preferences');
      return false;
    }
  };

  /**
   * Adds a new notification
   * @param {string} type - The type of notification (e.g., 'alert', 'info', 'success')
   * @param {string} message - The notification message
   */
  const addNotification = async (type, message) => {
    try {
      const newNotif = await api.createNotification({ type, message, read: false });
      setNotifications(prev => [newNotif, ...prev]);
    } catch (err) {
      console.error('Error creating notification:', err);
    }
  };

  /**
   * Marks a task as completed
   * @param {number|string} taskId - The ID of the task to complete
   */
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

  /**
   * Clears a single notification
   * @param {number|string} notifId - The ID of the notification to clear
   */
  const clearNotification = async (notifId) => {
    try {
      await api.deleteNotification(notifId);
      setNotifications(prevNotifications => prevNotifications.filter(n => n.id !== notifId));
    } catch (err) {
      console.error('Error clearing notification:', err);
    }
  };

  /**
   * Clears all notifications
   */
  const clearAllNotifications = async () => {
    try {
      await api.clearAllNotifications();
      setNotifications([]);
    } catch (err) {
      console.error('Error clearing all notifications:', err);
    }
  };

  // Context value object containing all state and functions
  const value = {
    // Authentication and UI state
    isAuthenticated,
    setIsAuthenticated,
    showForgotPassword,
    setShowForgotPassword,
    showRegister,
    setShowRegister,
    currentModule,
    setCurrentModule,
    currentView,
    setCurrentView,
    language,
    setLanguage,
    theme,
    setTheme,
    planTier,
    setPlanTier,
    selectedItem,
    setSelectedItem,
    showNotifications,
    setShowNotifications,
    showSearch,
    setShowSearch,
    showAIAssistant,
    setShowAIAssistant,
    showForm,
    setShowForm,
    editingItem,
    setEditingItem,
    loading,
    setLoading,
    error,
    setError,
    showChangePassword,
    setShowChangePassword,
    appointmentViewType,
    setAppointmentViewType,
    calendarViewType,
    setCalendarViewType,

    // Data state
    appointments,
    setAppointments,
    patients,
    setPatients,
    claims,
    setClaims,
    payments,
    setPayments,
    notifications,
    setNotifications,
    tasks,
    setTasks,
    users,
    setUsers,

    // User state
    user,
    setUser,

    // Helper functions
    fetchAllData,
    updateUserPreferences,
    addNotification,
    completeTask,
    clearNotification,
    clearAllNotifications
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the AppContext
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Export AppProvider as both named and default export
export { AppProvider };
export default AppProvider;
