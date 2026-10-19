// SEC-21: shared rate-limit store.
//
// express-rate-limit's default MemoryStore lives in one process. On Vercel (and any
// multi-instance deployment) each serverless instance keeps its own counters, so a limit
// of "10 attempts per 15 minutes" is really 10 PER INSTANCE — an attacker spreading
// requests across instances multiplies the ceiling and the protection is largely
// illusory. Backing the limiters with Redis makes the counter global.
//
// Implemented directly against the `redis` client already in the dependency tree rather
// than adding rate-limit-redis, so no new package has to be installed at deploy time.
// The Store contract used by express-rate-limit v7 is small: init / increment / decrement
// / resetKey.
//
// FAILURE MODE — fails OPEN: if Redis is unreachable the request is allowed rather than
// blocked, so a Redis outage degrades protection instead of taking down login for
// everyone. Every failure is logged; the global apiLimiter still applies in-process.

let redis;
try { redis = require('redis'); } catch (_) { redis = null; }

let clientPromise = null;

function redisConfigured() {
  return Boolean(process.env.AC_RD_H || process.env.AC_RD_URL);
}

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
              // Do not retry forever on a dead host — fail open quickly instead.
              reconnectStrategy: (attempts) => (attempts > 5 ? false : Math.min(attempts * 200, 2000)),
            },
          };
      if (process.env.AC_RD_W) opts.password = process.env.AC_RD_W;

      const c = redis.createClient(opts);
      c.on('error', (err) => console.error('[rateLimitStore] Redis error:', err.message));
      await c.connect();
      console.log('[rateLimitStore] Redis connected — rate limits are shared across instances');
      return c;
    })().catch((err) => {
      console.error('[rateLimitStore] Redis unavailable, falling back to per-instance limits:', err.message);
      clientPromise = null; // allow a later retry
      return null;
    });
  }
  return clientPromise;
}

/**
 * A Redis-backed store for express-rate-limit.
 * @param {string} prefix namespaces one limiter's counters from another's
 */
function createRedisStore(prefix) {
  let windowMs = 15 * 60 * 1000;
  return {
    init(options) {
      if (options && options.windowMs) windowMs = options.windowMs;
    },
    async increment(key) {
      const client = await getClient();
      if (!client) {
        // Fail open: report a single hit so the limiter never blocks on infrastructure.
        return { totalHits: 1, resetTime: new Date(Date.now() + windowMs) };
      }
      const k = `rl:${prefix}:${key}`;
      try {
        const hits = await client.incr(k);
        if (hits === 1) await client.pExpire(k, windowMs);
        let ttl = await client.pTTL(k);
        if (ttl < 0) { await client.pExpire(k, windowMs); ttl = windowMs; }
        return { totalHits: hits, resetTime: new Date(Date.now() + ttl) };
      } catch (err) {
        console.error('[rateLimitStore] increment failed, allowing request:', err.message);
        return { totalHits: 1, resetTime: new Date(Date.now() + windowMs) };
      }
    },
    async decrement(key) {
      const client = await getClient();
      if (!client) return;
      try { await client.decr(`rl:${prefix}:${key}`); } catch (_) { /* best effort */ }
    },
    async resetKey(key) {
      const client = await getClient();
      if (!client) return;
      try { await client.del(`rl:${prefix}:${key}`); } catch (_) { /* best effort */ }
    },
  };
}

/**
 * Store for a limiter, or undefined to let express-rate-limit use its MemoryStore.
 * Returning undefined keeps single-instance and local development working unchanged.
 */
function storeFor(prefix) {
  if (!redisConfigured()) return undefined;
  return createRedisStore(prefix);
}

module.exports = { storeFor, redisConfigured, createRedisStore };
