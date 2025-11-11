import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/apiService';
import { getTranslations } from '../config/translations';

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

  // Sync language and theme when user changes (e.g., after login or profile update)
  useEffect(() => {
    if (user) {
      // Language mapping: full names to codes
      const languageMap = {
        'English': 'en',
        'Spanish': 'es',
        'French': 'fr',
        'German': 'de',
        'Arabic': 'ar'
      };

      // Load language from user profile setting (with fallback to preferences)
      let userLanguage = 'en'; // default
      if (user.language) {
        // Convert full language name to code
        userLanguage = languageMap[user.language] || user.language || 'en';
      } else if (user.preferences?.language) {
        userLanguage = user.preferences.language;
      }
      setLanguage(userLanguage);

      // Sync theme from user preferences
      if (user.preferences?.darkMode !== undefined) {
        setTheme(user.preferences.darkMode ? 'dark' : 'light');
      }

      // Load plan tier from preferences
      if (user.preferences?.planTier) {
        setPlanTier(user.preferences.planTier);
      }
    }
  }, [user]);

  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  /**
   * Fetches all data from the backend API
   * @param {boolean} includeUser - Whether to fetch user data (only after authentication)
   */
  const fetchAllData = async (includeUser = false) => {
    setLoading(true);
    setError(null);
    try {
      const dataPromises = [
        api.getAppointments(),
        api.getPatients(),
        api.getClaims(),
        api.getPayments().catch(() => []), // Get payments, fallback to empty array if fails
        api.getNotifications(user?.id), // Filter by user_id if available
        api.getTasks(),
        api.getUsers().catch(() => []) // Get all users, fallback to empty array if fails
      ];

      // Only fetch user data if includeUser is true (after authentication)
      if (includeUser && user?.id) {
        dataPromises.push(api.getUser(user.id).catch(() => null));
      }

      const results = await Promise.all(dataPromises);
      const [appointmentsData, patientsData, claimsData, paymentsData, notificationsData, tasksData, usersData, userData] = results;

      setAppointments(appointmentsData);
      setPatients(patientsData);
      setClaims(claimsData);
      setPayments(paymentsData);
      setNotifications(notificationsData);
      setTasks(tasksData);
      setUsers(usersData);

      // Only update user data if we fetched it and includeUser is true
      if (includeUser && userData) {
        // Ensure required fields exist, but don't override with static defaults
        const userWithDefaults = {
          ...userData,
          avatar: userData.avatar || `${userData.first_name?.charAt(0) || ''}${userData.last_name?.charAt(0) || ''}`.toUpperCase() || 'U',
          // Only set practice default if it's explicitly null/undefined
          practice: userData.practice !== undefined && userData.practice !== null ? userData.practice : 'Medical Practice',
          preferences: userData.preferences || {
            emailNotifications: true,
            smsAlerts: true,
            darkMode: true
          }
        };

        setUser(userWithDefaults);

        // Language mapping: full names to codes
        const languageMap = {
          'English': 'en',
          'Spanish': 'es',
          'French': 'fr',
          'German': 'de',
          'Arabic': 'ar'
        };

        // Sync theme from user preferences
        if (userWithDefaults.preferences) {
          if (userWithDefaults.preferences.darkMode !== undefined) {
            setTheme(userWithDefaults.preferences.darkMode ? 'dark' : 'light');
          }
          // Load plan tier from preferences
          if (userWithDefaults.preferences.planTier) {
            setPlanTier(userWithDefaults.preferences.planTier);
          }
        }

        // Load language from user profile setting (with fallback to preferences)
        let userLanguage = 'en'; // default
        if (userWithDefaults.language) {
          // Convert full language name to code
          userLanguage = languageMap[userWithDefaults.language] || userWithDefaults.language || 'en';
        } else if (userWithDefaults.preferences?.language) {
          userLanguage = userWithDefaults.preferences.language;
        }
        setLanguage(userLanguage);
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
    const t = getTranslations(language);
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
      await addNotification('alert', t.failedToSavePreferences);
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
