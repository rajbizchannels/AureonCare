import React from 'react';
import { TrendingUp } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, color, onClick, theme = 'dark' }) => (
  <div
    onClick={onClick}
    className={`bg-gradient-to-br backdrop-blur-sm rounded-xl p-5 border transition-all duration-300 hover:shadow-lg cursor-pointer group ${
      theme === 'dark'
        ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-cyan-500/50 hover:shadow-cyan-500/10'
        : 'from-white to-gray-50 border-gray-200 hover:border-cyan-500/60 hover:shadow-gray-200/80'
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-sm mb-1.5 leading-snug ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{title}</p>
        <p className={`text-2xl font-bold mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</p>
        {trend && (
          <p className={`text-xs flex items-center ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
            <TrendingUp className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
            <span className="truncate">{trend}</span>
          </p>
        )}
      </div>
      <div className={`w-10 h-10 flex-shrink-0 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

export default StatCard;
