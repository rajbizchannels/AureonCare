import React, { useState, useEffect } from 'react';
import { CheckSquare, X, Save } from 'lucide-react';
import ConfirmationModal from '../modals/ConfirmationModal';

const NewTaskForm = ({ theme, api, onClose, onSuccess, addNotification, t }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    dueDate: '',
    status: 'Pending',
    assignedTo: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert(t.pleaseEnterTaskTitle || 'Please enter a task title');
      return;
    }

    try {
      const taskData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        due_date: formData.dueDate || null,
        status: formData.status,
        assigned_to: formData.assignedTo || null
      };

      const newTask = await api.createTask(taskData);

      await addNotification('task', `${t.newTaskCreated || 'New task created'}: ${formData.title}`);

      // Show success confirmation
      setShowConfirmation(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onSuccess(newTask);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error creating task:', err);
      addNotification('alert', t.failedToCreateTask || 'Failed to create task. Please try again.');
    }
  };

  return (
    <>
      <ConfirmationModal
        theme={theme}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={() => {
          setShowConfirmation(false);
          onClose();
        }}
        title={t.success || 'Success!'}
        message={t.taskCreatedSuccess || 'Task has been created successfully.'}
        type="success"
        confirmText={t.ok || 'OK'}
        showCancel={false}
      />
      <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
        <div className={`rounded-xl border max-w-2xl w-full ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-pink-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <CheckSquare className="w-6 h-6 text-white" />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.createNewTask || 'Create New Task'}</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.taskTitle || 'Task Title'} *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                placeholder={t.enterTaskTitle || 'Enter task title'}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.description || 'Description'}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                placeholder={t.enterTaskDescription || 'Enter task description'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  {t.priority || 'Priority'}
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                >
                  <option value="Low">{t.low || 'Low'}</option>
                  <option value="Medium">{t.medium || 'Medium'}</option>
                  <option value="High">{t.high || 'High'}</option>
                  <option value="Urgent">{t.urgent || 'Urgent'}</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  {t.status || 'Status'}
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                >
                  <option value="Pending">{t.pending || 'Pending'}</option>
                  <option value="In Progress">{t.inProgress || 'In Progress'}</option>
                  <option value="Completed">{t.completed || 'Completed'}</option>
                  <option value="On Hold">{t.onHold || 'On Hold'}</option>
                </select>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.dueDate || 'Due Date'}
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
              />
            </div>

            {/* Assigned To */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                {t.assignedToOptional || 'Assigned To (Optional)'}
              </label>
              <input
                type="text"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
                placeholder={t.enterAssigneeName || 'Enter assignee name'}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
            >
              {t.cancel || 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors text-white flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {t.createTask || 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default NewTaskForm;
