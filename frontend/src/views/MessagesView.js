import React, { useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import SecureMessaging from '../components/messaging/SecureMessaging';
import { useAudit } from '../hooks/useAudit';

/**
 * Staff-facing secure messaging console.
 *
 * The conversation surface itself is shared with the patient portal — this
 * view supplies the module chrome and the staff `mode`.
 */
const MessagesView = ({ theme, api, addNotification, user, t = {} }) => {
  const dark = theme === 'dark';
  const { logViewAccess } = useAudit();

  useEffect(() => {
    logViewAccess('MessagesView', { module: 'Messaging' });
  }, [logViewAccess]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
            {t.messages || 'Messages'}
          </h1>
          <p className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-600'}`}>
            {t.messagesDescription || 'Secure conversations with colleagues and patients'}
          </p>
        </div>
      </div>

      <SecureMessaging
        theme={theme}
        api={api}
        addNotification={addNotification}
        user={user}
        mode="staff"
      />
    </div>
  );
};

export default MessagesView;
