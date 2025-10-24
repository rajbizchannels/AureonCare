import React from 'react';
import { Lock } from 'lucide-react';

const ModuleCard = ({ module, onClick, hasAccess, theme = 'dark' }) => {
  const Icon = module.icon;
  const locked = !hasAccess(module.id);

  return (
    <button
      onClick={() => !locked && onClick(module.id)}
      disabled={locked}
      className={`relative bg-gradient-to-br rounded-xl p-6 border transition-all duration-300 text-left w-full ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'} ${!locked && 'hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/20 cursor-pointer'} ${locked && 'opacity-50 cursor-not-allowed'}`}
    >
      {locked && <Lock className={`absolute top-3 right-3 w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`} />}
      <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center mb-4`}>
        <Icon className={`w-7 h-7 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
      </div>
      <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{module.name}</h3>
      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{locked ? 'Upgrade to access' : 'Click to open'}</p>
    </button>
  );
};

export default ModuleCard;
