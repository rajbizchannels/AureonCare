import React from 'react';
import { Video, Calendar } from 'lucide-react';

const TelehealthView = ({ theme }) => {
  return (
    <div className="space-y-6">
      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Video Consultations</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`bg-gradient-to-br rounded-xl p-8 border text-center ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
            <Video className={`w-10 h-10 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
          </div>
          <h3 className={`text-xl font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Start Video Call</h3>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Launch a secure video consultation with your patient</p>
          <button className={`px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Start New Call
          </button>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-8 border text-center ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
            <Calendar className={`w-10 h-10 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
          </div>
          <h3 className={`text-xl font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Scheduled Sessions</h3>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>View and manage upcoming telehealth appointments</p>
          <button className={`px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            View Schedule
          </button>
        </div>
      </div>

      <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Recent Sessions</h3>
        <div className="space-y-3">
          {['John Doe - 45 min - Oct 19, 2025', 'Jane Smith - 30 min - Oct 18, 2025', 'Mike Johnson - 60 min - Oct 17, 2025'].map((session, idx) => (
            <div key={idx} className={`flex items-center justify-between p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-gray-100/30 hover:bg-gray-200/50'}`}>
              <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{session}</span>
              <button className={`px-4 py-2 rounded-lg text-sm transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                View Recording
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TelehealthView;
