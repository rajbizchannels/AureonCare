/**
 * The free Listing plan (migration 109): a practice's public page, its directory listing and
 * online booking requests — nothing else. Runs at the end of authenticate(), so every API that
 * signs a staff member in is covered; a Listing practice reaching anything outside this list gets
 * 402 with what the plan covers and how to move up.
 *
 * Allowed: sign-in and session, the public profile, the directory, booking requests and the
 * booking setup they need (appointment types, provider booking settings and availability, the
 * provider list), reading appointments (to see confirmed bookings), clinic settings, locations,
 * notifications and the person's own notification choices, the subscription (to upgrade), and
 * reading users, roles and permissions (the app shell needs them).
 */
const { getTenantEntitlements } = require('../services/entitlements');

const ANY = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'];
const READ = ['GET', 'HEAD', 'OPTIONS'];
const ALLOWED = [
  ['/api/auth', ANY], ['/api/signup', ANY], ['/api/invites', ANY],
  ['/api/practice-profile', ANY], ['/api/directory', ANY], ['/api/booking-requests', ANY],
  ['/api/appointment-types', ANY], ['/api/scheduling', ANY], ['/api/providers', ANY],
  ['/api/appointments', READ],
  ['/api/clinic-settings', ANY], ['/api/locations', ANY],
  ['/api/notifications', ANY], ['/api/notification-settings', ANY],
  ['/api/plans', ANY],
  ['/api/users', READ], ['/api/roles', READ], ['/api/permissions', READ],
];

const isListing = (ent) => Boolean(ent && ent.features && (ent.features.listing === true || ent.features.listing === 'true'));

function allowed(req) {
  const path = String(req.originalUrl || '').split('?')[0];
  const method = (req.method || 'GET').toUpperCase();
  return ALLOWED.some(([prefix, methods]) => (path === prefix || path.startsWith(`${prefix}/`)) && methods.includes(method));
}

async function listingGate(req, res, next) {
  try {
    const practiceId = req.tenant && req.tenant.practiceId;
    if (!practiceId || !req.user || req.user.role === 'patient') return next();
    const ent = await getTenantEntitlements(req.app.locals.pool, practiceId);
    if (!isListing(ent) || allowed(req)) return next();
    return res.status(402).json({
      error: 'ListingPlan',
      message: 'The free Listing plan covers your public practice page and online booking requests. Start a free trial or choose a plan under Settings → Subscription Plans to use the rest of AureonCare.',
      upgrade_required: true,
    });
  } catch (err) {
    console.error('[listingGate] check failed:', err.message);
    return next(); // fail open, like the other plan checks
  }
}

module.exports = { listingGate, isListing, ALLOWED };
