import Constants from 'expo-constants';
import { prefs } from './storage';

/**
 * Which AureonCare deployment this device talks to.
 *
 * Practices run their own instances (the `onprem` plan tier exists for exactly
 * that), so the host is configuration, not a constant. It is resolved once at
 * boot and again whenever the user changes it.
 */

export const DEFAULT_SERVER_URL =
  (Constants.expoConfig?.extra?.['defaultServerUrl'] as string | undefined) ??
  'https://app.aureoncare.tech';

// The address rules live in ./url so they can be unit tested without the
// native modules this file pulls in.
export { normaliseServerUrl, isLocalHost, isServerUrlAllowed } from './url';
export { checkServer, type ServerCheck } from './health';

export const loadServerUrl = async (): Promise<string> =>
  (await prefs.get('serverUrl')) ?? DEFAULT_SERVER_URL;

export const saveServerUrl = (origin: string): Promise<void> => prefs.set('serverUrl', origin);
