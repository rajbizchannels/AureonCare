/**
 * Server-address rules, kept free of native imports so they can be unit
 * tested. `server.ts` re-exports these alongside the parts that need
 * expo-constants and storage.
 */

/**
 * Accept what people actually type — "app.aureoncare.tech", a trailing slash,
 * a stray path — and return the canonical origin, or null when it is not a
 * usable host.
 */
export const normaliseServerUrl = (raw: string): string | null => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  // A bare word ("localhost" aside) is a typo far more often than a real host,
  // and a hostname with no dot cannot be a public deployment.
  if (!url.hostname) return null;
  if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
  return url.origin;
};

export const isLocalHost = (origin: string): boolean => {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^127\./.test(hostname)
    );
  } catch {
    return false;
  }
};

/**
 * Plain HTTP is refused unless the host is unambiguously local. A LAN
 * deployment over http is a real case on a closed network; a public host over
 * http would put PHI on the wire in clear, so it is not offered as a toggle.
 */
export const isServerUrlAllowed = (origin: string): boolean =>
  origin.startsWith('https://') || isLocalHost(origin);
