import React, { useState, useEffect } from 'react';
import { Video, Calendar, Users, Clock, ExternalLink, Plus, Play } from 'lucide-react';
import { formatDate, formatTime } from '../utils/formatters';

const TelehealthView = ({ theme, api, appointments, patients, addNotification }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await api.getTelehealthSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching telehealth sessions:', error);
      addNotification('alert', 'Failed to load telehealth sessions');
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
      addNotification('appointment', 'Telehealth session created successfully');
      setShowNewSessionForm(false);
    } catch (error) {
      console.error('Error creating session:', error);
      addNotification('alert', 'Failed to create telehealth session');
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
      addNotification('alert', 'Failed to join session');
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
    return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown Patient';
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
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Video Consultations
        </h2>
        <button
          onClick={() => setShowNewSessionForm(!showNewSessionForm)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Total Sessions</h3>
            <Video className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`} />
          </div>
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{sessions.length}</p>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Upcoming</h3>
            <Calendar className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
          </div>
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{upcomingSessions.length}</p>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Completed</h3>
            <Clock className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{recentSessions.length}</p>
        </div>
      </div>

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Upcoming Sessions
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
                      {session.duration_minutes && ` · ${session.duration_minutes} min`}
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
                    Join
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
            Recent Sessions
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
                      {session.duration_minutes && ` · ${session.duration_minutes} min`}
                      {session.participants && ` · ${session.participants.length} participants`}
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
                      View Recording
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
            No Telehealth Sessions Yet
          </h3>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            Create your first telehealth session to start video consultations with patients
          </p>
          <button
            onClick={() => setShowNewSessionForm(true)}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors text-white"
          >
            Create First Session
          </button>
        </div>
      )}
    </div>
  );
};

export default TelehealthView;
