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

export type ServerCheck =
  | { ok: true; version: string | null }
  | { ok: false; reason: string };

// The address rules live in ./url so they can be unit tested without the
// native modules this file pulls in.
export { normaliseServerUrl, isLocalHost, isServerUrlAllowed } from './url';

/**
 * Probe the candidate before saving it, so a typo fails here rather than as a
 * confusing login error. `/api/health` is unauthenticated; a 401 still proves
 * an AureonCare backend is answering, which is all this needs to establish.
 */
export const checkServer = async (origin: string, timeoutMs = 8000): Promise<ServerCheck> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${origin}/api/health`, { signal: controller.signal });
    if (!response.ok && response.status !== 401) {
      return { ok: false, reason: `Server answered ${response.status}` };
    }
    const body = await response.json().catch(() => null);
    const version =
      body && typeof body === 'object' && typeof (body as { version?: unknown }).version === 'string'
        ? (body as { version: string }).version
        : null;
    return { ok: true, version };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return { ok: false, reason: aborted ? 'Server did not respond' : 'Could not reach that server' };
  } finally {
    clearTimeout(timer);
  }
};

export const loadServerUrl = async (): Promise<string> =>
  (await prefs.get('serverUrl')) ?? DEFAULT_SERVER_URL;

export const saveServerUrl = (origin: string): Promise<void> => prefs.set('serverUrl', origin);
