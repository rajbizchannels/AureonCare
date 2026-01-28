import React, { useEffect } from 'react';
import { Bot, X, MessageSquare } from 'lucide-react';

const AIAssistantPanel = ({
  theme,
  tasks,
  onClose,
  onSelectItem,
  onSelectModule
}) => {
  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose]);

  return (
    <div className={`fixed bottom-24 right-6 w-96 rounded-xl border border-cyan-500/30 shadow-2xl z-50 ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
      <div className={`p-4 border-b bg-gradient-to-r from-cyan-500/10 to-blue-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
            <Bot className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} />
          </div>
          <div className="flex-1">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>AI Assistant</h3>
            <p className="text-cyan-400 text-xs">How can I help you today?</p>
          </div>
          <button onClick={onClose} className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>
      </div>
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        <div
          onClick={() => {
            onSelectItem('tasks');
            onClose();
          }}
          className={`p-3 rounded-lg cursor-pointer transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
        >
          <p className="text-cyan-400 text-sm mb-2">📊 Today's Insights</p>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>You have {tasks.filter(t => t.status === 'Pending' && t.priority === 'High').length} high-priority tasks requiring attention.</p>
        </div>
        <div
          onClick={() => {
            onSelectItem('appointments');
            onClose();
          }}
          className={`p-3 rounded-lg cursor-pointer transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
        >
          <p className="text-cyan-400 text-sm mb-2">💡 Suggestion</p>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>2 appointments can be rescheduled to reduce patient wait time by 15 minutes.</p>
        </div>
        <div
          onClick={() => {
            onSelectModule('rcm');
            onClose();
          }}
          className={`p-3 rounded-lg cursor-pointer transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}
        >
          <p className="text-cyan-400 text-sm mb-2">⚠️ Alert</p>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Review documentation for pending claims to reduce denial risk.</p>
        </div>
      </div>
      <div className={`p-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask me anything..."
            className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
          />
          <button className={`px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPanel;
