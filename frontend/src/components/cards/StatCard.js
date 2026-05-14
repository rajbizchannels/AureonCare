import React from 'react';
import { TrendingUp } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, color, onClick, theme = 'dark' }) => (
  <div
    onClick={onClick}
    className={`bg-gradient-to-br backdrop-blur-sm rounded-xl p-6 border transition-all duration-300 hover:shadow-lg cursor-pointer group ${
      theme === 'dark'
        ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-cyan-500/50 hover:shadow-cyan-500/10'
        : 'from-white to-gray-50 border-gray-200 hover:border-cyan-500/60 hover:shadow-gray-200/80'
    }`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{title}</p>
        <p className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</p>
        {trend && (
          <p className={`text-sm flex items-center ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
            <TrendingUp className="w-4 h-4 mr-1" />
            {trend}
          </p>
        )}
      </div>
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

export default StatCard;
