// SSRF guard for operator-supplied outbound URLs.
//
// Several integration settings let an operator override the vendor endpoint
// (vendor_integration_settings.base_url and friends). The server then makes requests to
// that address WITH THE INTEGRATION'S CREDENTIALS ATTACHED, and surfaces the result via
// the /test endpoint. Without validation that is a full-read SSRF: it can reach cloud
// metadata (169.254.169.254), loopback and private-range services, and it leaks the
// configured client id/secret to whatever host is named.
//
// This module rejects URLs that are not plainly external:
//   * scheme must be https (http allowed only when AC_ALLOW_INSECURE_INTEGRATIONS=true,
//     for local development against a sandbox)
//   * no embedded credentials (https://user:pass@host)
//   * every address the hostname resolves to must be a public unicast address
//
// RESIDUAL RISK — DNS rebinding: a hostname validated here can resolve to a private
// address later, when the request is actually made. Checking at both write time and use
// time (as the callers do) narrows the window but does not close it. Closing it properly
// requires pinning the validated IP for the outbound connection (custom agent lookup);
// that is deliberately not attempted here and is recorded as a known limitation.

const dns = require('dns').promises;
const net = require('net');

const ALLOW_INSECURE = String(process.env.AC_ALLOW_INSECURE_INTEGRATIONS || '').toLowerCase() === 'true';

function ipv4IsPublic(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  const [a, b] = p;
  if (a === 0) return false;                        // 0.0.0.0/8  "this network"
  if (a === 10) return false;                       // 10/8       private
  if (a === 127) return false;                      // 127/8      loopback
  if (a === 169 && b === 254) return false;         // 169.254/16 link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;// 172.16/12  private
  if (a === 192 && b === 168) return false;         // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return false;// 100.64/10 CGNAT
  if (a === 192 && b === 0) return false;           // 192.0.0/24 IETF protocol assignments
  if (a >= 224) return false;                       // multicast + reserved + broadcast
  return true;
}

function ipv6IsPublic(ip) {
  const s = ip.toLowerCase();
  if (s === '::' || s === '::1') return false;                 // unspecified / loopback
  if (s.startsWith('fe8') || s.startsWith('fe9') ||
      s.startsWith('fea') || s.startsWith('feb')) return false; // fe80::/10 link-local
  if (s.startsWith('fc') || s.startsWith('fd')) return false;   // fc00::/7 unique local
  // IPv4-mapped (::ffff:a.b.c.d) — judge on the embedded IPv4 address
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPublic(mapped[1]);
  return true;
}

function addressIsPublic(ip) {
  if (net.isIPv4(ip)) return ipv4IsPublic(ip);
  if (net.isIPv6(ip)) return ipv6IsPublic(ip);
  return false;
}

/**
 * Validate an operator-supplied outbound URL.
 * @param {string} rawUrl
 * @param {{ label?: string }} [opts] label used in the error message
 * @throws {Error} with .statusCode = 400 when the URL is not acceptable
 * @returns {Promise<URL>} the parsed URL when it is safe
 */
async function assertSafeExternalUrl(rawUrl, opts = {}) {
  const label = opts.label || 'URL';
  const fail = (msg) => {
    const e = new Error(`${label} rejected: ${msg}`);
    e.statusCode = 400;
    throw e;
  };

  let url;
  try {
    url = new URL(String(rawUrl));
  } catch (_) {
    return fail('not a valid absolute URL');
  }

  const scheme = url.protocol.replace(':', '');
  if (scheme !== 'https' && !(scheme === 'http' && ALLOW_INSECURE)) {
    return fail(`scheme "${scheme}" is not allowed (use https)`);
  }
  if (url.username || url.password) {
    return fail('embedded credentials are not allowed');
  }

  // A literal IP is checked directly; a hostname is checked against EVERY address it
  // resolves to, so a name with one public and one private record is still rejected.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((a) => a.address);
    } catch (_) {
      return fail(`hostname "${host}" could not be resolved`);
    }
  }
  if (addresses.length === 0) return fail(`hostname "${host}" resolved to no addresses`);
  for (const addr of addresses) {
    if (!addressIsPublic(addr)) {
      return fail(`resolves to a non-public address (${addr}) — internal endpoints are not permitted`);
    }
  }
  return url;
}

/** Non-throwing variant: resolves to true/false. */
async function isSafeExternalUrl(rawUrl) {
  try { await assertSafeExternalUrl(rawUrl); return true; } catch (_) { return false; }
}

module.exports = { assertSafeExternalUrl, isSafeExternalUrl, addressIsPublic };
