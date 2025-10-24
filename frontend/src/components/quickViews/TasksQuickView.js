import React from 'react';
import { X, Check } from 'lucide-react';

const TasksQuickView = ({ theme, tasks, onClose, onCompleteTask }) => (
  <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
    <div className={`rounded-xl border max-w-3xl w-full max-h-[80vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
      <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Pending Tasks</h2>
        <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
          <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
        <div className="space-y-3">
          {tasks.filter(t => t.status === 'Pending').map(task => (
            <div key={task.id} className={`p-4 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-100/50 hover:bg-gray-100'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{task.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      task.priority === 'High' ? 'bg-red-500/20 text-red-400' :
                      task.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Due: {task.dueDate}</p>
                </div>
                <button
                  onClick={() => onCompleteTask(task.id)}
                  className="p-2 hover:bg-green-500/20 rounded-lg transition-colors group"
                  title="Mark as complete"
                >
                  <Check className={`w-5 h-5 group-hover:text-green-400 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default TasksQuickView;
