import { useState, useEffect, useCallback } from 'react';

import api from '../api/apiService';

/**
 * The practice's specialty configuration, loaded once per session.
 *
 * The shell needs this on load, not only the wizard: `hiddenModules` decides what appears
 * in the navigation and `terminology` decides what the labels say. It fails quiet on
 * purpose — a practice that has never run the wizard, or an account with no tenant, must
 * get the ordinary generic product rather than a broken shell.
 */
export default function usePracticeSetup(user) {
  const [setup, setSetup] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!user || !user.id) { setSetup(null); setLoaded(true); return; }
    try {
      setSetup(await api.getPracticeSetupState());
    } catch {
      setSetup(null); // generic product, no error surfaced to the user
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  // Offer the wizard only to an admin who has never finished or skipped it, and only once
  // the state has actually loaded — otherwise it would flash on every page load.
  const shouldOfferWizard = Boolean(
    loaded && setup && user && user.role === 'admin'
    && setup.onboarding && !setup.onboarding.completedAt && !setup.onboarding.skipped
  );

  return { setup, loaded, reload, shouldOfferWizard };
}
