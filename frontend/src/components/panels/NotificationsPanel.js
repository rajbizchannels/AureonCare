import React from 'react';
import { X, Bell, Calendar, DollarSign, AlertCircle, MessageSquare } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

const NotificationsPanel = ({
  theme,
  notifications,
  onClose,
  clearAllNotifications,
  clearNotification
}) => {
  const formatNotificationTime = (notif) => {
    if (notif.created_at) {
      return formatDateTime(notif.created_at);
    } else if (notif.time) {
      return notif.time;
    }
    return 'Just now';
  };

  return (
    <div className={`fixed top-16 right-4 w-96 rounded-xl border shadow-2xl z-50 max-h-[80vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
    <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
      <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Notifications</h3>
      <div className="flex items-center gap-2">
        {notifications.length > 0 && (
          <button
            onClick={clearAllNotifications}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Clear All
          </button>
        )}
        <button onClick={onClose} className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
          <X className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        </button>
      </div>
    </div>
    <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
      {notifications.length === 0 ? (
        <div className={`p-8 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No notifications</p>
        </div>
      ) : (
        notifications.map(notif => (
          <div key={notif.id} className={`p-4 border-b transition-colors ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800/50' : 'border-gray-200 hover:bg-gray-200/50'} ${!notif.read && 'bg-cyan-500/5'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                notif.type === 'appointment' ? 'bg-blue-500/20' :
                notif.type === 'claim' ? 'bg-yellow-500/20' :
                notif.type === 'alert' ? 'bg-red-500/20' :
                'bg-green-500/20'
              }`}>
                {notif.type === 'appointment' && <Calendar className="w-4 h-4 text-blue-400" />}
                {notif.type === 'claim' && <DollarSign className="w-4 h-4 text-yellow-400" />}
                {notif.type === 'alert' && <AlertCircle className="w-4 h-4 text-red-400" />}
                {notif.type === 'message' && <MessageSquare className="w-4 h-4 text-green-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{notif.message}</p>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>{formatNotificationTime(notif)}</p>
              </div>
              <button
                onClick={() => clearNotification(notif.id)}
                className={`p-1 rounded transition-colors flex-shrink-0 ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                title="Clear notification"
              >
                <X className={`w-4 h-4 hover:text-white ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
  );
};

export default NotificationsPanel;
