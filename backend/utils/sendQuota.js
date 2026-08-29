// SEC-24: per-recipient send quotas for email / WhatsApp.
//
// Notifications are triggered by ordinary business events (a claim submitted, a task
// created, a password reset requested), so a route-level rate limit would miss most of
// them. The quota is therefore enforced at the SENDING layer, which every path funnels
// through, keyed by RECIPIENT rather than by caller — the abuse that matters is one
// person's inbox or phone being flooded, which no per-IP limit prevents (an attacker can
// rotate IPs; the victim's address stays the same).
//
// It also caps the blast radius if the platform is ever used as an open mail relay, and
// bounds spend on the SMS/WhatsApp provider.
//
// Backed by Redis when configured (shared across serverless instances, same as SEC-21);
// otherwise an in-process map, which still limits a single instance. Fails OPEN on a
// Redis error: a monitoring outage must not stop a clinician's password reset.

let redis;
try { redis = require('redis'); } catch (_) { redis = null; }

const WINDOW_MS = Number(process.env.AC_SEND_WINDOW_MS || 60 * 60 * 1000); // 1 hour
const LIMITS = {
  email: Number(process.env.AC_SEND_MAX_EMAIL || 20),
  whatsapp: Number(process.env.AC_SEND_MAX_WHATSAPP || 10),
};

// ── in-process fallback ───────────────────────────────────────────────────────
const memory = new Map(); // key -> { count, resetAt }

function memoryConsume(key, limit) {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, count: 1, limit };
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, count: entry.count, limit };
}

// Keep the map from growing without bound on a long-lived process.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
}, WINDOW_MS).unref?.();

// ── Redis (shared) ────────────────────────────────────────────────────────────
let clientPromise = null;
const redisConfigured = () => Boolean(process.env.AC_RD_H || process.env.AC_RD_URL);

async function getClient() {
  if (!redis || !redisConfigured()) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      const opts = process.env.AC_RD_URL
        ? { url: process.env.AC_RD_URL }
        : {
            socket: {
              host: process.env.AC_RD_H || 'localhost',
              port: Number(process.env.AC_RD_P || 6379),
              reconnectStrategy: (a) => (a > 5 ? false : Math.min(a * 200, 2000)),
            },
          };
      if (process.env.AC_RD_W) opts.password = process.env.AC_RD_W;
      const c = redis.createClient(opts);
      c.on('error', (e) => console.error('[sendQuota] Redis error:', e.message));
      await c.connect();
      return c;
    })().catch((e) => {
      console.error('[sendQuota] Redis unavailable, using per-instance quotas:', e.message);
      clientPromise = null;
      return null;
    });
  }
  return clientPromise;
}

/**
 * Count one send against the recipient's quota.
 * @param {'email'|'whatsapp'} channel
 * @param {string} recipient address or phone number
 * @returns {Promise<{allowed: boolean, count: number, limit: number}>}
 */
async function consumeSendQuota(channel, recipient) {
  const limit = LIMITS[channel] ?? 20;
  if (!recipient) return { allowed: true, count: 0, limit };
  // Normalise so casing/spacing cannot be used to get a fresh bucket per send.
  const key = `send:${channel}:${String(recipient).trim().toLowerCase()}`;

  const client = await getClient();
  if (!client) return memoryConsume(key, limit);

  try {
    const count = await client.incr(key);
    if (count === 1) await client.pExpire(key, WINDOW_MS);
    return { allowed: count <= limit, count, limit };
  } catch (err) {
    console.error('[sendQuota] check failed, allowing send:', err.message);
    return { allowed: true, count: 0, limit };
  }
}

module.exports = { consumeSendQuota, WINDOW_MS, LIMITS };
