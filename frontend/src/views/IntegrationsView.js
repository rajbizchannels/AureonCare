import React from 'react';

const IntegrationsView = ({ theme }) => {
  return (
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
};

export default IntegrationsView;
