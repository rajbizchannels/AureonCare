import React from 'react';
import { ArrowLeft } from 'lucide-react';

const IntegrationsView = ({ theme, setCurrentModule, t }) => {
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
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.apiAndIntegrations || 'API & Integrations'}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.apiKeys || 'API Keys'}</h3>
          <div className="space-y-3 mb-4">
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.productionApiKey || 'Production API Key'}</span>
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">{t.active || 'Active'}</span>
              </div>
              <code className={`text-xs break-all ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>medflow_prod_xxxxxxxxxxxxxxxxxxx</code>
            </div>
          </div>
          <button className={`w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.generateNewKey || 'Generate New Key'}
          </button>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.webhooks || 'Webhooks'}</h3>
          <div className="space-y-3 mb-4">
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{t.appointmentCreated || 'Appointment Created'}</span>
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">{t.active || 'Active'}</span>
              </div>
              <code className={`text-xs break-all ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>https://api.example.com/webhook</code>
            </div>
          </div>
          <button className={`w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.addWebhook || 'Add Webhook'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsView;
