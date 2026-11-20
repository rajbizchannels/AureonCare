// SEC-30: give an anonymous public-booking request a tenant.
//
// The booking page (/book/<slug>) has no session, so the request has to say which
// practice it is for. It does so with the booking link's slug — the X-Booking-Slug header,
// or the :slug path parameter on the slug lookup itself. The slug is resolved through the
// control plane (migration 089) to the practice's schema, and req.db/req.tenant are set
// exactly as a session would set them.
//
// Rules:
//   - A slug, when given, ALWAYS decides the practice — even for a signed-in caller. A
//     patient of practice A opening practice B's booking link must see B, not A.
//   - The slug must still be live in the practice: allow_public_booking must be on. A
//     routing row outliving a disabled link grants nothing.
//   - A slug only opens ITS OWN provider. A providerId in the path or body that is not the
//     slug's provider is answered 404, so one public link cannot be used to read another
//     provider's calendar (whose public booking may be off).
//   - No slug and no session: 409, saying what is missing — not a 500 from the wrong schema.
//   - No slug but a session: the session's practice, as before.

const { makeTenantDb } = require('../db/requestTenantDb');
const { isValidSlug, resolveBookingSlug } = require('../services/bookingRouting');

const NO_CONTEXT = {
  error: 'No practice context',
  message: 'This request does not say which practice it is for. Open the practice\'s booking link, or sign in.',
};
const NOT_FOUND = { error: 'Provider not found or booking not available' };

function publicBookingTenant(req, res, next) {
  const slug = (req.params && req.params.slug) || req.get('X-Booking-Slug') || null;

  if (!slug) {
    if (req.db) return next();
    return res.status(409).json(NO_CONTEXT);
  }
  if (!isValidSlug(slug)) return res.status(404).json(NOT_FOUND);

  (async () => {
    const basePool = req.app.locals.pool;
    const route = await resolveBookingSlug(basePool, slug);
    if (!route) return res.status(404).json(NOT_FOUND);

    const asked = (req.params && req.params.providerId) || (req.body && req.body.providerId);
    if (asked && String(asked) !== route.providerId) return res.status(404).json(NOT_FOUND);

    // A session's handle (if any) belongs to the caller's own practice; replace it.
    if (req.db && typeof req.db.release === 'function') req.db.release();
    req.db = makeTenantDb(basePool, route.schemaName, res);
    req.tenant = { practiceId: null, tenantId: route.tenantId, schemaName: route.schemaName };
    req.bookingSlug = { slug, providerId: route.providerId };

    const live = await req.db.query(
      'SELECT 1 FROM provider_booking_config WHERE booking_url_slug = $1 AND allow_public_booking = true',
      [slug]);
    if (live.rowCount === 0) return res.status(404).json(NOT_FOUND);
    next();
  })().catch((err) => {
    console.error('[publicBookingTenant] could not resolve booking link:', err.message);
    res.status(500).json({ error: 'Could not resolve booking link' });
  });
}

module.exports = { publicBookingTenant };
