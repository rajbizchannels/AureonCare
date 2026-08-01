import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../api/apiService';
import { getTranslations } from '../config/translations';

// Create the context
const AppContext = createContext();

const OAUTH_DEPARTURE_KEY = 'aureoncare.oauthDeparture';
const OAUTH_DEPARTURE_TTL_MS = 15 * 60 * 1000;

/**
 * Record that we are about to hand the browser to an external OAuth provider.
 *
 * Call this immediately before navigating away. The return trip is a fresh page
 * load, which would otherwise be treated as a refresh and end the session — the
 * user would come back from Google only to face the login page.
 */
export const markOAuthDeparture = () => {
  try {
    sessionStorage.setItem(OAUTH_DEPARTURE_KEY, String(Date.now()));
  } catch (error) {
    /* storage unavailable — the return trip will just ask for a fresh login */
  }
};

/** True when this page load is the return leg of an OAuth round trip. */
const isOAuthReturn = () => {
  try {
    const departedAt = Number(sessionStorage.getItem(OAUTH_DEPARTURE_KEY));
    sessionStorage.removeItem(OAUTH_DEPARTURE_KEY);
    return Boolean(departedAt) && Date.now() - departedAt < OAUTH_DEPARTURE_TTL_MS;
  } catch (error) {
    return false;
  }
};

/**
 * A page load always starts a fresh session.
 *
 * This module is evaluated once per page load, so clearing the stored session
 * here means a browser refresh (or a restored tab) lands on the login page
 * instead of resuming the previous session. The one exception is the return
 * leg of an OAuth round trip, which is a page load the app itself initiated.
 */
const clearStoredSession = () => {
  try {
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('portalSessionToken');
  } catch (error) {
    /* storage unavailable — nothing to clear */
  }
};

if (!isOAuthReturn()) {
  clearStoredSession();
}

// AppProvider component
const AppProvider = ({ children }) => {
  // Authentication and UI state - use sessionStorage for authentication (clears on tab/window close)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Initialize from sessionStorage (NOT localStorage) - clears on tab close
    try {
      const stored = sessionStorage.getItem('isAuthenticated');
      return stored === 'true';
    } catch (error) {
      return false;
    }
  });
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
  const [currency, setCurrency] = useState('USD');

  // Data state
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [claims, setClaims] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);

  // User state - stored in sessionStorage (clears on tab close, not readable cross-tab)
  const [user, setUser] = useState(() => {
    try {
      // One-time migration: remove stale 'user' entry left in localStorage by the old code
      localStorage.removeItem('user');
      const storedUser = sessionStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error('Error loading user from sessionStorage:', error);
      return null;
    }
  });

  // Persist authentication status to sessionStorage (clears on tab/window close)
  useEffect(() => {
    try {
      if (isAuthenticated) {
        sessionStorage.setItem('isAuthenticated', 'true');
      } else {
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('portalSessionToken');
      }
    } catch (error) {
      console.error('Error saving authentication status:', error);
    }
  }, [isAuthenticated]);

  // Persist user data to sessionStorage whenever it changes
  useEffect(() => {
    try {
      if (user) {
        sessionStorage.setItem('user', JSON.stringify(user));
      } else {
        sessionStorage.removeItem('user');
      }
    } catch (error) {
      console.error('Error saving user to sessionStorage:', error);
    }
  }, [user]);

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

  /**
   * Fetches all data from the backend API
   * @param {boolean} includeUser - Whether to fetch user data (only after authentication)
   */
  const fetchAllData = useCallback(async (includeUser = false) => {
    console.log('AppContext: fetchAllData called, includeUser:', includeUser);
    setLoading(true);
    setError(null);
    try {
      console.log('AppContext: Starting data fetch...');
      const dataPromises = [
        api.getAppointments().catch(err => { console.error('Failed to fetch appointments:', err); return []; }),
        api.getPatients().catch(err => { console.error('Failed to fetch patients:', err); return []; }),
        api.getClaims().catch(err => { console.error('Failed to fetch claims:', err); return []; }),
        api.getPayments().catch(err => { console.error('Failed to fetch payments:', err); return []; }),
        api.getNotifications(user?.id).catch(err => { console.error('Failed to fetch notifications:', err); return []; }),
        api.getTasks().catch(err => { console.error('Failed to fetch tasks:', err); return []; }),
        api.getUsers().catch(err => { console.error('Failed to fetch users:', err); return []; })
      ];

      // Only fetch user data if includeUser is true (after authentication)
      if (includeUser && user?.id) {
        dataPromises.push(api.getUser(user.id).catch(() => null));
      }

      const results = await Promise.all(dataPromises);
      const [appointmentsData, patientsData, claimsData, paymentsData, notificationsData, tasksData, usersData, userData] = results;

      // Derive display status for past scheduled appointments locally.
      // Doing N PUT/PATCH calls on every load is costly and error-prone
      // (FK drift can cause 500s). Status persists via normal appointment
      // workflows; here we only adjust the in-memory representation.
      const now = new Date();
      const updatedAppointments = appointmentsData.map((apt) => {
        if (apt.start_time && (apt.status === 'scheduled' || !apt.status)) {
          try {
            const startTime = new Date(apt.start_time.replace(' ', 'T'));
            if (startTime < now) {
              return { ...apt, status: 'completed' };
            }
          } catch (error) {
            console.error('Error parsing appointment time:', error);
          }
        }
        return apt;
      });

      setAppointments(updatedAppointments);
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
  }, [user]);

  // Load practice data once the user is authenticated. Every API router sits
  // behind `authenticate`, so fetching before sign-in only produced a wave of
  // 401s on the login screen. Re-runs when `user` changes (fetchAllData is
  // keyed on it), which is what refreshes data straight after login.
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAllData();
  }, [isAuthenticated, fetchAllData]);

  // Load currency from clinic settings after authentication
  useEffect(() => {
    if (!isAuthenticated) return;
    api.getClinicSettings()
      .then(s => { if (s?.currency) setCurrency(s.currency); })
      .catch(() => {});
  }, [isAuthenticated]);

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
    currency,
    setCurrency,

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

    // API service
    api,

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
