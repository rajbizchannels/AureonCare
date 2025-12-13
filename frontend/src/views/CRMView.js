import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, Phone, ArrowLeft, Calendar, Plus, Heart, Clock, Edit } from 'lucide-react';

const CRMView = ({ theme, setShowForm, setCurrentModule, api, t }) => {
  const [campaignCount, setCampaignCount] = useState(0);
  const [offeringCount, setOfferingCount] = useState(0);
  const [appointmentTypeCount, setAppointmentTypeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        setLoading(true);
        // Fetch campaigns
        const campaigns = await api.getCampaigns().catch(() => []);
        setCampaignCount(campaigns?.length || 0);

        // Fetch offerings
        const offerings = await api.getOfferings().catch(() => []);
        setOfferingCount(offerings?.length || 0);

        // Fetch appointment types
        const appointmentTypes = await api.getAppointmentTypes().catch(() => []);
        setAppointmentTypeCount(appointmentTypes?.length || 0);
      } catch (error) {
        console.error('Error fetching counts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [api]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentModule && setCurrentModule('dashboard')}
          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
          title={t.backToDashboard || 'Back to Dashboard'}
        >
          <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        </button>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.patientCommunications || 'Patient Communications'}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={`bg-gradient-to-br rounded-xl p-6 border text-center transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <Mail className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.emailCampaign || 'Email Campaign'}</h3>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.sendBulkEmailsToPatients || 'Send bulk emails to patients'}</p>
          {!loading && (
            <p className={`text-xs font-medium mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
              {campaignCount} {campaignCount === 1 ? 'campaign' : 'campaigns'}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => campaignCount > 0 && setCurrentModule && setCurrentModule('campaigns')}
              disabled={campaignCount === 0}
              className={`w-full px-4 py-2 rounded-lg transition-colors ${
                campaignCount === 0
                  ? 'bg-red-500/10 text-red-400/50 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {t.manageCampaigns || 'Manage Campaigns'}
            </button>
            <button
              onClick={() => setShowForm('campaign')}
              className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
            >
              {t.createCampaign || 'Create Campaign'}
            </button>
          </div>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border text-center transition-all cursor-pointer ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-green-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-green-600/50'}`}>
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-green-400" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.smsReminders || 'SMS Reminders'}</h3>
          <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.sendAppointmentReminders || 'Send appointment reminders'}</p>
          <button
            onClick={() => setShowForm('sms')}
            className="w-full px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
          >
            {t.sendSMS || 'Send SMS'}
          </button>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border text-center transition-all cursor-pointer ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-blue-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-blue-600/50'}`}>
          <Phone className="w-12 h-12 mx-auto mb-4 text-blue-400" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.callQueue || 'Call Queue'}</h3>
          <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.managePatientCallbacks || 'Manage patient callbacks'}</p>
          <button
            onClick={() => setShowForm('callQueue')}
            className="w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
          >
            {t.viewQueue || 'View Queue'}
          </button>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border text-center transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <Heart className="w-12 h-12 mx-auto mb-4 text-teal-400" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.healthcareOfferings || 'Healthcare Offerings'}</h3>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.manageServices || 'Manage healthcare services and offerings'}</p>
          {!loading && (
            <p className={`text-xs font-medium mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
              {offeringCount} {offeringCount === 1 ? 'offering' : 'offerings'}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => offeringCount > 0 && setCurrentModule && setCurrentModule('offerings')}
              disabled={offeringCount === 0}
              className={`w-full px-4 py-2 rounded-lg transition-colors ${
                offeringCount === 0
                  ? 'bg-teal-500/10 text-teal-400/50 cursor-not-allowed'
                  : 'bg-teal-500 hover:bg-teal-600 text-white'
              }`}
            >
              {t.manageOfferings || 'Manage Offerings'}
            </button>
            <button
              onClick={() => setShowForm('healthcareOffering')}
              className="w-full px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 rounded-lg transition-colors"
            >
              {t.addOffering || 'Add Offering'}
            </button>
          </div>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border text-center transition-all ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <Clock className="w-12 h-12 mx-auto mb-4 text-purple-400" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.appointmentTypes || 'Appointment Types'}</h3>
          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.manageAppointmentTypes || 'Manage appointment types and durations'}</p>
          {!loading && (
            <p className={`text-xs font-medium mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
              {appointmentTypeCount} {appointmentTypeCount === 1 ? 'type' : 'types'}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => appointmentTypeCount > 0 && setCurrentModule && setCurrentModule('appointmentTypes')}
              disabled={appointmentTypeCount === 0}
              className={`w-full px-4 py-2 rounded-lg transition-colors ${
                appointmentTypeCount === 0
                  ? 'bg-purple-500/10 text-purple-400/50 cursor-not-allowed'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              }`}
            >
              {t.manageTypes || 'Manage Types'}
            </button>
            <button
              onClick={() => setShowForm('appointmentType')}
              className="w-full px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
            >
              {t.addType || 'Add Type'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CRMView;
