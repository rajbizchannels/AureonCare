/**
 * Reachability probe for a candidate server.
 *
 * Split out from server.ts so it can be unit tested: that module imports
 * expo-constants and secure storage, neither of which loads outside a device.
 */

export type ServerCheck =
  | { ok: true; version: string | null }
  | { ok: false; reason: string };

/**
 * Where the backend answers a health check.
 *
 * server.js mounts it at the ROOT (`/health`), not under `/api` like every
 * other route — so the obvious guess is wrong and 404s against a perfectly
 * good server. `/api/health` is tried second because a reverse proxy that only
 * forwards `/api/*` is a normal way to deploy this.
 */
const HEALTH_PATHS = ['/health', '/api/health'] as const;

/**
 * Probe the candidate before saving it, so a typo fails here rather than as a
 * confusing login error. A 401 still counts: it proves something is listening
 * and enforcing auth, which is all this needs to establish.
 */
export const checkServer = async (origin: string, timeoutMs = 8000): Promise<ServerCheck> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let lastStatus: number | null = null;

    for (const path of HEALTH_PATHS) {
      let response: Response;
      try {
        response = await fetch(`${origin}${path}`, { signal: controller.signal });
      } catch (error) {
        // A transport failure is about the host, not the path — no point
        // trying the second one.
        const aborted = error instanceof Error && error.name === 'AbortError';
        return {
          ok: false,
          reason: aborted ? 'Server did not respond' : 'Could not reach that server',
        };
      }

      if (response.ok || response.status === 401) {
        const body = await response.json().catch(() => null);
        const version =
          body && typeof body === 'object' && typeof (body as { version?: unknown }).version === 'string'
            ? (body as { version: string }).version
            : null;
        return { ok: true, version };
      }

      lastStatus = response.status;
      // Only a missing route is worth retrying at the other path.
      if (response.status !== 404) break;
    }

    return { ok: false, reason: `Server answered ${lastStatus ?? 'unexpectedly'}` };
  } finally {
    clearTimeout(timer);
  }
};

