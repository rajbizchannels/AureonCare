import React, { useState, useEffect, useCallback } from 'react';
import { Video, Calendar, Users, Clock, ExternalLink, Plus, Play, ArrowLeft, Settings, Zap, X, AlertCircle } from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';
import { getTranslations } from '../config/translations';
import { useApp } from '../context/AppContext';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import { useAudit } from '../hooks/useAudit';
import ZoomMeetingEmbed from '../components/ZoomMeetingEmbed';

const PROVIDER_LABELS = {
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  microsoft_teams: 'Microsoft Teams',
  webex: 'Webex',
  aureoncare: 'AureonCare (Default)',
};

const providerLabel = (type) => PROVIDER_LABELS[type] || type;

const TelehealthView = ({ theme, api, appointments, patients, addNotification, setCurrentModule }) => {
  const { language } = useApp();
  const t = getTranslations(language);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [activeProvider, setActiveProvider] = useState(null);
  const [enabledProviders, setEnabledProviders] = useState([]);
  const [checkingProvider, setCheckingProvider] = useState(true);
  const [localAppointments, setLocalAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [launchingMeeting, setLaunchingMeeting] = useState(false);

  // Confirmation modal states
  const [showCreateConfirmation, setShowCreateConfirmation] = useState(false);
  const [showJoinConfirmation, setShowJoinConfirmation] = useState(false);
  const [pendingCreateData, setPendingCreateData] = useState(null);
  const [pendingJoinSessionId, setPendingJoinSessionId] = useState(null);

  // Error popup state
  const [meetingError, setMeetingError] = useState(null);

  // Embedded Zoom meeting state (null = not active)
  const [zoomEmbedConfig, setZoomEmbedConfig] = useState(null);

  const { logViewAccess } = useAudit();

  useEffect(() => {
    logViewAccess('TelehealthView', {
      module: 'Telehealth',
    });
  }, []);

  useEffect(() => {
    fetchSessions();
    checkActiveProvider();
  }, []);

  const checkActiveProvider = async () => {
    try {
      setCheckingProvider(true);
      const response = await api.getTelehealthSettings();
      const enabled = (response || []).filter(p => p.is_enabled);
      setEnabledProviders(enabled);
      setActiveProvider(enabled[0] || null);
    } catch (error) {
      console.error('Error checking active provider:', error);
      setActiveProvider(null);
      setEnabledProviders([]);
    } finally {
      setCheckingProvider(false);
    }
  };

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await api.getTelehealthSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching telehealth sessions:', error);
      addNotification('alert', t.failedToLoadTelehealthSessions || 'Failed to load telehealth sessions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch fresh appointments from the API when the new session form opens
  useEffect(() => {
    if (showNewSessionForm) {
      fetchAppointments();
    }
  }, [showNewSessionForm]);

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);
      const data = await api.getAppointments();
      setLocalAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setLocalAppointments(appointments || []);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const findAppointment = (appointmentId) => {
    return localAppointments.find(a => a.id === appointmentId)
      || (appointments || []).find(a => a.id === appointmentId);
  };

  const handleCreateSession = async (appointmentId, patientId, providerId) => {
    const appointment = findAppointment(appointmentId);
    if (!appointment) return;
    setPendingCreateData({ appointmentId, patientId, providerId });
    setShowCreateConfirmation(true);
  };

  const handleActualCreateSession = async () => {
    if (!pendingCreateData) return;

    try {
      const { appointmentId, patientId, providerId } = pendingCreateData;
      const appointment = findAppointment(appointmentId);
      if (!appointment) return;

      const sessionData = {
        appointmentId,
        patientId,
        providerId,
        startTime: appointment.start_time,
        duration: appointment.duration_minutes || 30,
        recordingEnabled: true
      };

      const newSession = await api.createTelehealthSession(sessionData);

      // If Zoom is the resolved provider, launch embedded; otherwise show success
      if (newSession.provider_type === 'zoom' && newSession.room_id) {
        addNotification('success', 'Zoom session created — launching meeting…');
        setZoomEmbedConfig({ meetingId: newSession.room_id });
      } else {
        const pLabel = providerLabel(newSession.provider_type);
        addNotification('appointment', `${pLabel} session created successfully`);
      }

      setSessions(prev => [newSession, ...prev]);
      setShowNewSessionForm(false);
    } catch (error) {
      console.error('Error creating session:', error);
      const msg = error.message || '';
      const isCredentialError = msg.includes('credentials') || msg.includes('not configured') || msg.includes('OAuth') || msg.includes('Client ID');
      setMeetingError({
        title: 'Telehealth Session Error',
        message: isCredentialError
          ? 'The telehealth provider is not configured or the connection has expired. Please contact your system administrator.'
          : (msg || 'Failed to create telehealth session. Please try again.'),
        isCredentialError
      });
    }
  };

  const handleJoinSession = async (sessionId) => {
    setPendingJoinSessionId(sessionId);
    setShowJoinConfirmation(true);
  };

  const handleActualJoinSession = async () => {
    if (!pendingJoinSessionId) return;

    try {
      const session = sessions.find(s => s.id === pendingJoinSessionId);
      if (session && (session.room_id || session.meeting_url)) {
        await api.updateTelehealthSession(pendingJoinSessionId, {
          sessionStatus: 'in-progress',
          startTime: new Date().toISOString()
        });
        fetchSessions();
        // Zoom meetings launch embedded; everything else opens in a new tab
        if (session.room_id && session.provider_type === 'zoom') {
          setZoomEmbedConfig({ meetingId: session.room_id });
        } else {
          window.open(session.meeting_url, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (error) {
      console.error('Error joining session:', error);
      addNotification('alert', t.failedToJoinSession || 'Failed to join session');
    }
  };

  /**
   * Launch a quick instant meeting via the active provider.
   */
  const handleLaunchInstantMeeting = useCallback(async () => {
    if (!activeProvider) return;
    const provType = activeProvider.provider_type;

    try {
      setLaunchingMeeting(true);
      addNotification('info', `Creating instant ${providerLabel(provType)} meeting...`);
      const result = await api.createInstantMeeting(provType, {
        topic: 'AureonCare Telehealth Session',
        duration: 30,
        recordingEnabled: false
      });
      const embedMeetingId = result.meetingId || result.roomId;
      if (provType === 'zoom' && embedMeetingId) {
        addNotification('success', 'Zoom meeting created — launching in-app…');
        setZoomEmbedConfig({ meetingId: embedMeetingId });
      } else if (result.meetingUrl) {
        window.open(result.meetingUrl, '_blank', 'noopener,noreferrer');
        addNotification('success', `${providerLabel(provType)} meeting launched in a new tab`);
      }
      // Refresh sessions so the total count and lists stay up-to-date
      fetchSessions();
    } catch (error) {
      console.error('Failed to create instant meeting:', error);
      const msg = error.message || '';
      const isCredentialError = msg.includes('credentials') || msg.includes('not configured') || msg.includes('OAuth') || msg.includes('Client ID');
      setMeetingError({
        title: `${providerLabel(provType)} Meeting Error`,
        message: isCredentialError
          ? `${providerLabel(provType)} is not configured or the connection has expired. Please contact your system administrator.`
          : (msg || 'Failed to create instant meeting. Please try again.'),
        isCredentialError
      });
    } finally {
      setLaunchingMeeting(false);
    }
  }, [api, addNotification, activeProvider]);

  const getUpcomingSessions = () => {
    return sessions.filter(s =>
      s.session_status === 'scheduled' &&
      new Date(s.start_time) > new Date()
    ).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  };

  const getCompletedSessions = () => {
    return sessions.filter(s =>
      s.session_status === 'completed' ||
      (s.end_time && new Date(s.end_time) < new Date())
    ).sort((a, b) => new Date(b.end_time || b.start_time) - new Date(a.end_time || a.start_time));
  };

  const getRecentSessions = () => {
    return getCompletedSessions().slice(0, 5);
  };

  const getAvailableAppointments = () => {
    const existingAppointmentIds = sessions.map(s => s.appointment_id);
    const source = localAppointments.length > 0 ? localAppointments : (appointments || []);
    return source
      .filter(a =>
        !existingAppointmentIds.includes(a.id) &&
        a.status !== 'cancelled' &&
        a.status !== 'canceled' &&
        a.status !== 'completed' &&
        new Date(a.start_time) > new Date()
      )
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  };

  const getPatientName = (patientId) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? `${patient.first_name} ${patient.last_name}` : (t.unknownPatient || 'Unknown Patient');
  };

  const isZoomActive = activeProvider?.provider_type === 'zoom';
  const upcomingSessions = getUpcomingSessions();
  const completedSessions = getCompletedSessions();
  const recentSessions = completedSessions.slice(0, 5);
  const availableAppointments = getAvailableAppointments();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <>
      {/* Embedded Zoom meeting overlay — renders when a meeting is active */}
      {zoomEmbedConfig && (
        <ZoomMeetingEmbed
          meetingId={zoomEmbedConfig.meetingId}
          api={api}
          displayName="Host"
          onClose={() => {
            setZoomEmbedConfig(null);
            // Refetch sessions after meeting ends so counts and statuses are current
            fetchSessions();
          }}
        />
      )}

      {/* Confirmation Modal for Creating Session */}
      <ConfirmationModal
        theme={theme}
        isOpen={showCreateConfirmation}
        onClose={() => {
          setShowCreateConfirmation(false);
          setPendingCreateData(null);
        }}
        onConfirm={handleActualCreateSession}
        title="Create Telehealth Session"
        message={
          enabledProviders.length > 1
            ? "This will create a telehealth session using the patient's preferred platform (or the clinic default). The patient will receive a join link."
            : `This will create a ${providerLabel(activeProvider?.provider_type)} session. The patient will receive a join link.`
        }
        type="confirm"
        confirmText="Create Session"
        cancelText="Cancel"
      />

      {/* Confirmation Modal for Joining Session */}
      <ConfirmationModal
        theme={theme}
        isOpen={showJoinConfirmation}
        onClose={() => {
          setShowJoinConfirmation(false);
          setPendingJoinSessionId(null);
        }}
        onConfirm={handleActualJoinSession}
        title="Join Telehealth Session"
        message="Are you sure you want to join this session? This will open the meeting and mark the session as in-progress."
        type="warning"
        confirmText="Join Session"
        cancelText="Cancel"
      />

      {/* Error Popup */}
      {meetingError && (
        <div
          className={`fixed inset-0 backdrop-blur-sm z-[70] flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`}
          onClick={() => setMeetingError(null)}
        >
          <div
            className={`rounded-xl border max-w-md w-full ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {meetingError.title}
                </h2>
                <button
                  onClick={() => setMeetingError(null)}
                  className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
                >
                  <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  meetingError.isCredentialError
                    ? (theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100')
                    : (theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100')
                }`}>
                  {meetingError.isCredentialError
                    ? <Settings className={`w-7 h-7 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} />
                    : <AlertCircle className={`w-7 h-7 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
                  }
                </div>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {meetingError.message}
                </p>
                {meetingError.isCredentialError && (
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                    The telehealth account must be connected by an administrator in Admin Panel &gt; Telehealth Integrations.
                  </p>
                )}
              </div>
            </div>

            <div className={`p-6 border-t flex gap-3 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
              <button
                onClick={() => setMeetingError(null)}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                Dismiss
              </button>
              {meetingError.isCredentialError && (
                <button
                  onClick={() => {
                    setMeetingError(null);
                    setCurrentModule && setCurrentModule('admin');
                  }}
                  className="flex-1 px-6 py-3 rounded-lg font-medium text-white transition-colors bg-yellow-500 hover:bg-yellow-600"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Settings className="w-4 h-4" />
                    Admin Settings
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title={t.backToDashboard || 'Back to Dashboard'}
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.videoConsultations || 'Video Consultations'}
          </h2>
        </div>
        {/* Action buttons when provider is configured */}
        {!checkingProvider && activeProvider && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleLaunchInstantMeeting}
              disabled={launchingMeeting}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg text-white font-medium transition-all shadow-sm disabled:opacity-60"
            >
              <Zap className="w-4 h-4" />
              {launchingMeeting ? 'Launching...' : `Instant ${providerLabel(activeProvider.provider_type)}`}
            </button>
            <button
              onClick={() => setShowNewSessionForm(!showNewSessionForm)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg text-white font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.newSession || 'New Session'}
            </button>
          </div>
        )}
      </div>

      {/* No Provider Configured Warning */}
      {!checkingProvider && !activeProvider && (
        <div className={`rounded-lg border p-6 ${theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Settings className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
                Video Conferencing Not Set Up
              </h3>
              <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-yellow-300/80' : 'text-yellow-700'}`}>
                A video conferencing provider (Zoom, Google Meet, Teams, or Webex) has not been configured yet. Please contact your system administrator to set up telehealth.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Only show content when provider is configured */}
      {!checkingProvider && activeProvider && (
        <>
          {/* Active Provider Info */}
          <div className={`rounded-lg border p-4 ${theme === 'dark' ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                    {enabledProviders.length > 1 ? 'Active Providers:' : 'Active Provider:'}
                  </span>
                </div>
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {enabledProviders.map(p => providerLabel(p.provider_type)).join(', ')}
                </span>
              </div>
              {enabledProviders.length > 1 && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                }`}>
                  Patient preference enabled
                </span>
              )}
            </div>
          </div>

          {/* New Session Form */}
          {showNewSessionForm && (
            <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {t.createNewSession || 'Create New Session'}
                </h3>
                <button
                  onClick={() => setShowNewSessionForm(false)}
                  className={`text-sm px-3 py-1 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-200 text-gray-600'}`}
                >
                  {t.cancel || 'Cancel'}
                </button>
              </div>
              <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'
              }`}>
                <Video className="w-4 h-4 text-blue-500" />
                <p className={`text-sm ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                  {enabledProviders.length > 1
                    ? "Sessions will use the patient's preferred platform. If none is set, the clinic default will be used."
                    : `Sessions will be created via ${providerLabel(activeProvider.provider_type)}.`
                  }
                </p>
              </div>
              <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.selectAppointmentForSession || 'Select an upcoming appointment to create a telehealth session:'}
              </p>
              <div className="space-y-3">
                {loadingAppointments ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                  </div>
                ) : availableAppointments.length === 0 ? (
                  <p className={`text-sm text-center py-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                    {t.noAppointmentsAvailable || 'No upcoming appointments available for telehealth sessions.'}
                  </p>
                ) : (
                  availableAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className={`flex items-center justify-between p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-gray-100/30 hover:bg-gray-200/50'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {getPatientName(appointment.patient_id)}
                          </p>
                          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                            {formatDate(appointment.start_time)} at {formatTime(appointment.start_time)}
                            {appointment.duration_minutes && ` · ${appointment.duration_minutes} ${t.min || 'min'}`}
                            {appointment.appointment_type && ` · ${appointment.appointment_type}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCreateSession(appointment.id, appointment.patient_id, appointment.provider_id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                      >
                        <Video className="w-4 h-4" />
                        {t.createSession || 'Create Session'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.totalSessions || 'Total Sessions'}</h3>
            <Video className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`} />
          </div>
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{sessions.length}</p>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.upcoming || 'Upcoming'}</h3>
            <Calendar className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
          </div>
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{upcomingSessions.length}</p>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.completed || 'Completed'}</h3>
            <Clock className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{completedSessions.length}</p>
        </div>
      </div>

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.upcomingSessions || 'Upcoming Sessions'}
          </h3>
          <div className="space-y-3">
            {upcomingSessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-gray-100/30 hover:bg-gray-200/50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600">
                    <Video className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {getPatientName(session.patient_id)}
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {formatDate(session.start_time)} at {formatTime(session.start_time)}
                      {session.duration_minutes && ` · ${session.duration_minutes} ${t.min || 'min'}`}
                      {session.provider_type && (
                        <span className={`ml-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                          via {providerLabel(session.provider_type)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    session.session_status === 'scheduled'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {session.session_status}
                  </span>
                  <button
                    onClick={() => handleJoinSession(session.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors bg-blue-500 hover:bg-blue-600"
                  >
                    <Play className="w-4 h-4" />
                    {session.provider_type === 'zoom' ? 'Launch Zoom' : (t.join || 'Join')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.recentSessions || 'Recent Sessions'}
          </h3>
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-gray-100/30 hover:bg-gray-200/50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <Video className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {getPatientName(session.patient_id)}
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {formatDate(session.end_time || session.start_time)}
                      {session.duration_minutes && ` · ${session.duration_minutes} ${t.min || 'min'}`}
                      {session.provider_type && ` · ${providerLabel(session.provider_type)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.recording_url && (
                    <button
                      onClick={() => window.open(session.recording_url, '_blank')}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t.viewRecording || 'View Recording'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

          {/* Empty State */}
          {sessions.length === 0 && !showNewSessionForm && (
            <div className={`bg-gradient-to-br rounded-xl p-12 border text-center ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600">
                <Video className="w-10 h-10 text-white" />
              </div>
              <h3 className={`text-xl font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t.noTelehealthSessionsYet || 'No Telehealth Sessions Yet'}
              </h3>
              <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.createFirstTelehealthSession || 'Create your first telehealth session to start video consultations with patients'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleLaunchInstantMeeting}
                  disabled={launchingMeeting}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg font-medium transition-all text-white shadow-sm disabled:opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    {launchingMeeting ? 'Launching...' : `Instant ${providerLabel(activeProvider?.provider_type)}`}
                  </div>
                </button>
                <button
                  onClick={() => setShowNewSessionForm(true)}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors text-white"
                >
                  {t.createFirstSession || 'Create First Session'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </>
  );
};

export default TelehealthView;
