import React from 'react';
import { TrendingUp } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, color, onClick, theme = 'dark' }) => (
  <div
    onClick={onClick}
    className={`bg-gradient-to-br backdrop-blur-sm rounded-xl p-6 border transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer group ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-cyan-500/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50 hover:border-cyan-600/50'}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{title}</p>
        <p className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</p>
        {trend && (
          <p className="text-sm text-green-400 flex items-center">
            <TrendingUp className="w-4 h-4 mr-1" />
            {trend}
          </p>
        )}
      </div>
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
      </div>
    </div>
  </div>
);

export default StatCard;
