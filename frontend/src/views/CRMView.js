import React from 'react';
import { Mail, MessageSquare, Phone } from 'lucide-react';

const CRMView = ({ theme, setShowForm }) => {
  return (
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
};

export default CRMView;
