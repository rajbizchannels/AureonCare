import { useCallback, useEffect, useState } from 'react';

import api from '../../api/apiService';

/**
 * Google Calendar sync status for one patient.
 *
 * `configured` reflects whether the practice has Google credentials at all.
 * When it is false the feature simply does not exist for the patient — callers
 * render nothing rather than explaining a server-side gap they cannot act on.
 */
export const useCalendarSync = (patientId) => {
  const [status, setStatus] = useState({ configured: false, connected: false, account: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const next = await api.getCalendarSyncStatus(patientId);
      setStatus({
        // Older deployments answer without the flag; a reachable endpoint that
        // does not say otherwise is treated as configured.
        configured: next.configured !== false,
        connected: Boolean(next.connected),
        account: next.account || null,
      });
    } catch (error) {
      // A failed status check is indistinguishable from "not available" for the
      // patient, so present it as unavailable instead of surfacing an error.
      console.error('Error checking calendar status:', error);
      setStatus({ configured: false, connected: false, account: null });
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...status, loading, refresh, setStatus };
};

export default useCalendarSync;
