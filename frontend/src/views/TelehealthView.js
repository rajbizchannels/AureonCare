import React, { useState, useEffect } from 'react';
import { Video, Calendar, Users, Clock, ExternalLink, Plus, Play, ArrowLeft, Settings } from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';
import { getTranslations } from '../config/translations';
import { useApp } from '../context/AppContext';

const TelehealthView = ({ theme, api, appointments, patients, addNotification, setCurrentModule }) => {
  const { language } = useApp();
  const t = getTranslations(language);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [activeProvider, setActiveProvider] = useState(null);
  const [checkingProvider, setCheckingProvider] = useState(true);

  useEffect(() => {
    fetchSessions();
    checkActiveProvider();
  }, []);

  const checkActiveProvider = async () => {
    try {
      setCheckingProvider(true);
      const response = await api.getTelehealthSettings();
      const enabledProvider = response.find(p => p.is_enabled);
      setActiveProvider(enabledProvider || null);
    } catch (error) {
      console.error('Error checking active provider:', error);
      setActiveProvider(null);
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

  const handleCreateSession = async (appointmentId, patientId, providerId) => {
    try {
      const appointment = appointments.find(a => a.id === appointmentId);
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
      setSessions([newSession, ...sessions]);
      addNotification('appointment', t.telehealthSessionCreated || 'Telehealth session created successfully');
      setShowNewSessionForm(false);
    } catch (error) {
      console.error('Error creating session:', error);
      addNotification('alert', t.failedToCreateTelehealthSession || 'Failed to create telehealth session');
    }
  };

  const handleJoinSession = async (sessionId) => {
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (session && session.meeting_url) {
        window.open(session.meeting_url, '_blank');
        await api.updateTelehealthSession(sessionId, {
          sessionStatus: 'in-progress',
          startTime: new Date().toISOString()
        });
        fetchSessions();
      }
    } catch (error) {
      console.error('Error joining session:', error);
      addNotification('alert', t.failedToJoinSession || 'Failed to join session');
    }
  };

  const getUpcomingSessions = () => {
    return sessions.filter(s =>
      s.session_status === 'scheduled' &&
      new Date(s.start_time) > new Date()
    ).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  };

  const getRecentSessions = () => {
    return sessions.filter(s =>
      s.session_status === 'completed' ||
      (s.end_time && new Date(s.end_time) < new Date())
    ).sort((a, b) => new Date(b.end_time || b.start_time) - new Date(a.end_time || a.start_time))
    .slice(0, 5);
  };

  const getPatientName = (patientId) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? `${patient.first_name} ${patient.last_name}` : (t.unknownPatient || 'Unknown Patient');
  };

  const upcomingSessions = getUpcomingSessions();
  const recentSessions = getRecentSessions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
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
        <button
          onClick={() => setShowNewSessionForm(!showNewSessionForm)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.newSession || 'New Session'}
        </button>
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
                No Video Conferencing Provider Configured
              </h3>
              <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-yellow-300/80' : 'text-yellow-700'}`}>
                To use telehealth features, you need to configure a video conferencing provider (Zoom, Google Meet, or Webex) in the Admin Panel.
              </p>
              <button
                onClick={() => setCurrentModule && setCurrentModule('admin')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400'
                    : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configure Provider in Admin Panel
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Provider Info */}
      {!checkingProvider && activeProvider && (
        <div className={`rounded-lg border p-4 ${theme === 'dark' ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                Active Provider:
              </span>
            </div>
            <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {activeProvider.provider_type === 'zoom' && 'Zoom'}
              {activeProvider.provider_type === 'google_meet' && 'Google Meet'}
              {activeProvider.provider_type === 'webex' && 'Webex'}
              {activeProvider.provider_type === 'medflow' && 'MedFlow (Default)'}
            </span>
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
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{recentSessions.length}</p>
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
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                    <Video className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {getPatientName(session.patient_id)}
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {formatDate(session.start_time)} at {formatTime(session.start_time)}
                      {session.duration_minutes && ` · ${session.duration_minutes} ${t.min || 'min'}`}
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
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-white text-sm font-medium transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    {t.join || 'Join'}
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
                      {session.participants && ` · ${session.participants.length} ${t.participants || 'participants'}`}
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
      {sessions.length === 0 && (
        <div className={`bg-gradient-to-br rounded-xl p-12 border text-center ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
            <Video className="w-10 h-10 text-white" />
          </div>
          <h3 className={`text-xl font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.noTelehealthSessionsYet || 'No Telehealth Sessions Yet'}
          </h3>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            {t.createFirstTelehealthSession || 'Create your first telehealth session to start video consultations with patients'}
          </p>
          <button
            onClick={() => setShowNewSessionForm(true)}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors text-white"
          >
            {t.createFirstSession || 'Create First Session'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TelehealthView;
