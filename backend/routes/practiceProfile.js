// /api/practice-profile — the practice's public profile (directory Phase 2).
//
//   GET    /                    staff: the profile, its address, providers + consent state
//   PUT    /                    ADMIN: edit, visibility (off | link | searchable), random link
//   POST   /photos              admin: cover / logo / gallery; provider: their own photo
//   GET    /photos/:id          staff: any photo of this practice (incl. pending)
//   PUT    /photos/:id          admin: approve or reject
//   DELETE /photos/:id          admin, or the provider who uploaded it
//   PUT    /providers/:id/hidden  admin: hide / unhide a CONSENTED provider (cannot consent)
//   GET    /me                  provider: their own listing consent at this practice
//   PUT    /me                  provider: give, change or withdraw consent
//
// Only the provider can consent to their own listing — an admin can hide a listing, never
// create one. Every change is written to the append-only directory_events log.

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { sendDbError } = require('../utils/dbErrors');
const { sanitizeImage, ImageRejected } = require('../utils/imageSanitize');
const P = require('../services/practiceProfile');
// Profile and listing changes show up in search at once on this instance (others within a minute).
const { invalidate: refreshSearch } = require('../services/directorySearch');

const router = express.Router();
router.use(authenticate);

const isAdmin = (req) => req.user && req.user.role === 'admin';
const practiceOf = (req) => (req.user && req.user.practiceId) || null;

router.use((req, res, next) => {
  if (!req.user || req.user.role === 'patient') return res.status(403).json({ error: 'Staff only' });
  if (!practiceOf(req)) return res.status(409).json({ error: 'Your account is not linked to a practice.' });
  next();
});

const clip = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const validEmail = (e) => !e || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const validUrl = (u) => !u || /^https?:\/\/[^\s]+$/i.test(u);

async function isProvider(pool, userId, practiceId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM public.providers p JOIN public.users u ON u.id = p.id
      WHERE p.id = $1 AND EXISTS (SELECT 1 FROM public.memberships mem WHERE mem.user_id = u.id AND mem.practice_id = $2 AND mem.status = 'active')`, [userId, practiceId]);
  return rows.length > 0;
}

// ── profile ─────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const practiceId = practiceOf(req);
    const loaded = await P.loadProfile(pool, practiceId);
    if (!loaded) return res.status(404).json({ error: 'Practice not found' });
    const { profile, practice, saved } = loaded;
    const [providers, locations, specialties, photos] = await Promise.all([
      P.practiceProviders(pool, practiceId),
      req.db ? req.db.query(
        `SELECT id, name, address, city, state, postal_code, country, is_primary
           FROM locations WHERE COALESCE(is_active, true) ORDER BY is_primary DESC NULLS LAST, name`).then((r) => r.rows).catch(() => []) : [],
      pool.query('SELECT code, name, parent_code FROM public.specialties WHERE COALESCE(is_active, true) ORDER BY sort_order, name').then((r) => r.rows),
      pool.query(`SELECT id, kind, provider_id, mime, status, uploaded_by, sort_order, created_at, octet_length(bytes) AS size
                    FROM public.practice_profile_photos WHERE practice_id = $1 ORDER BY kind, sort_order, created_at`, [practiceId]).then((r) => r.rows),
    ]);
    res.json({
      profile: { ...profile, slug: profile.slug || (saved ? null : await P.suggestSlug(pool, practice.name, practiceId)) },
      saved,
      canEdit: isAdmin(req),
      publicUrl: P.publicUrlFor(profile),
      providers: providers.map((r) => ({
        id: r.id, name: `Dr. ${[r.first_name, r.last_name].filter(Boolean).join(' ')}`, specialization: r.specialization,
        consented: Boolean(r.consented), hidden: r.hidden_by_admin, consentedAt: r.consented_at, withdrawnAt: r.withdrawn_at,
        listed: Boolean(r.consented && !r.hidden_by_admin),
      })),
      locations, specialties, photos,
      consent: { version: P.CONSENT_VERSION, text: P.CONSENT_TEXT },
    });
  } catch (err) {
    console.error('[practice-profile] get:', err.message);
    res.status(500).json({ error: 'Could not load the practice profile' });
  }
});

router.put('/', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Only practice administrators can change the profile.' });
  const pool = req.app.locals.pool;
  const practiceId = practiceOf(req);
  const b = req.body || {};
  try {
    const { profile: current, practice } = await P.loadProfile(pool, practiceId);
    const visibility = b.visibility === undefined ? current.visibility : b.visibility;
    if (!P.VISIBILITY.includes(visibility)) return res.status(400).json({ error: "visibility must be 'off', 'link' or 'searchable'" });
    const slug = b.slug === undefined ? (current.slug || await P.suggestSlug(pool, practice.name, practiceId)) : String(b.slug || '').trim().toLowerCase();
    if (!P.SLUG_RE.test(slug) || slug.length > 80) {
      return res.status(400).json({ error: 'The page address may use lowercase letters, numbers and single hyphens (e.g. riverside-family-clinic).' });
    }
    if (!(await P.slugAvailable(pool, slug, practiceId))) return res.status(409).json({ error: 'That page address is already taken.' });
    const email = clip(b.email === undefined ? current.email : b.email, 160);
    const website = clip(b.website === undefined ? current.website : b.website, 255);
    if (!validEmail(email)) return res.status(400).json({ error: 'The public email address is not valid.' });
    if (!validUrl(website)) return res.status(400).json({ error: 'The website must start with http:// or https://.' });

    const knownCodes = new Set((await pool.query('SELECT code FROM public.specialties')).rows.map((r) => r.code));
    const specialtyCodes = (Array.isArray(b.specialty_codes) ? b.specialty_codes : current.specialty_codes || [])
      .map(String).filter((c) => knownCodes.has(c)).slice(0, 30);
    const locationIds = (Array.isArray(b.location_ids) ? b.location_ids : current.location_ids || [])
      .map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 50);
    const locations = await P.publishedLocations(pool, req.tenant && req.tenant.schemaName, locationIds);

    // Photos named on the profile must be this practice's APPROVED cover / logo photos.
    const photoOk = async (id, kind) => {
      if (!id) return null;
      const { rows } = await pool.query(
        `SELECT 1 FROM public.practice_profile_photos WHERE id = $1 AND practice_id = $2 AND kind = $3 AND status = 'approved'`,
        [id, practiceId, kind]);
      return rows.length ? id : null;
    };
    const coverId = await photoOk(b.cover_photo_id === undefined ? current.cover_photo_id : b.cover_photo_id, 'cover');
    const logoId = await photoOk(b.logo_photo_id === undefined ? current.logo_photo_id : b.logo_photo_id, 'logo');
    const useRandom = b.use_random_link === undefined ? Boolean(current.use_random_link) : Boolean(b.use_random_link);
    // Ask for a new random address (e.g. the old one was shared too widely): old QR codes stop working.
    const randomSlug = (b.regenerate_random_link || !current.random_slug) ? P.randomSlug() : current.random_slug;

    const { rows: [saved] } = await pool.query(
      `INSERT INTO public.practice_profiles
         (practice_id, visibility, slug, random_slug, use_random_link, display_name, about, phone, email, website,
          specialty_codes, location_ids, locations, cover_photo_id, logo_photo_id, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now())
       ON CONFLICT (practice_id) DO UPDATE SET
         visibility = EXCLUDED.visibility, slug = EXCLUDED.slug, random_slug = EXCLUDED.random_slug,
         use_random_link = EXCLUDED.use_random_link, display_name = EXCLUDED.display_name, about = EXCLUDED.about,
         phone = EXCLUDED.phone, email = EXCLUDED.email, website = EXCLUDED.website,
         specialty_codes = EXCLUDED.specialty_codes, location_ids = EXCLUDED.location_ids, locations = EXCLUDED.locations,
         cover_photo_id = EXCLUDED.cover_photo_id, logo_photo_id = EXCLUDED.logo_photo_id,
         updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING *`,
      [practiceId, visibility, slug, randomSlug, useRandom,
        clip(b.display_name === undefined ? current.display_name : b.display_name, 160) || practice.name,
        clip(b.about === undefined ? current.about : b.about, 4000),
        clip(b.phone === undefined ? current.phone : b.phone, 40), email, website,
        specialtyCodes, locationIds, JSON.stringify(locations), coverId, logoId, req.user.id]);

    const changes = {};
    for (const k of ['visibility', 'slug', 'use_random_link']) if (String(current[k]) !== String(saved[k])) changes[k] = { from: current[k], to: saved[k] };
    if (b.regenerate_random_link) changes.random_link = 'regenerated';
    refreshSearch(); await P.logEvent(pool, { practiceId, action: 'profile_saved', detail: changes, actorId: req.user.id });
    res.json({ profile: saved, publicUrl: P.publicUrlFor(saved) });
  } catch (err) {
    console.error('[practice-profile] save:', err.message);
    if (sendDbError(res, err, 'Could not save the profile')) return;
    res.status(500).json({ error: 'Could not save the profile' });
  }
});

// ── photos ──────────────────────────────────────────────────────────────────────────
router.post('/photos', async (req, res) => {
  const pool = req.app.locals.pool;
  const practiceId = practiceOf(req);
  const { kind, data } = req.body || {};
  if (!['cover', 'logo', 'gallery', 'provider'].includes(kind)) return res.status(400).json({ error: 'Unknown photo type' });
  const admin = isAdmin(req);
  if (kind === 'provider') {
    if (!(await isProvider(pool, req.user.id, practiceId))) return res.status(403).json({ error: 'Only a provider can add their own photo.' });
  } else if (!admin) {
    return res.status(403).json({ error: 'Only practice administrators can add practice photos.' });
  }
  let img;
  try {
    const b64 = String(data || '').replace(/^data:[^;]+;base64,/, '');
    img = sanitizeImage(Buffer.from(b64, 'base64'));
  } catch (e) {
    if (e instanceof ImageRejected) return res.status(400).json({ error: e.message });
    throw e;
  }
  try {
    if (kind === 'gallery') {
      const { rows: [{ n }] } = await pool.query(
        "SELECT count(*)::int AS n FROM public.practice_profile_photos WHERE practice_id = $1 AND kind = 'gallery'", [practiceId]);
      if (n >= 12) return res.status(400).json({ error: 'A profile can have up to 12 gallery photos.' });
    }
    // An admin's own uploads are approved; a provider's photo waits for an admin (no patient,
    // screen or chart may appear on a public page).
    const status = admin && kind !== 'provider' ? 'approved' : 'pending';
    const { rows: [photo] } = await pool.query(
      `INSERT INTO public.practice_profile_photos (practice_id, kind, provider_id, mime, bytes, status, uploaded_by, reviewed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, kind, provider_id, mime, status, created_at`,
      [practiceId, kind, kind === 'provider' ? req.user.id : null, img.mime, img.bytes, status, req.user.id,
        status === 'approved' ? req.user.id : null]);
    refreshSearch(); await P.logEvent(pool, { practiceId, providerId: photo.provider_id, action: 'photo_uploaded', detail: { id: photo.id, kind, status }, actorId: req.user.id });
    res.status(201).json({ ...photo, width: img.width, height: img.height });
  } catch (err) {
    console.error('[practice-profile] photo upload:', err.message);
    res.status(500).json({ error: 'Could not save the photo' });
  }
});

router.get('/photos/:id', async (req, res) => {
  try {
    const { rows: [p] } = await req.app.locals.pool.query(
      'SELECT mime, bytes FROM public.practice_profile_photos WHERE id::text = $1 AND practice_id = $2', [req.params.id, practiceOf(req)]);
    if (!p) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=60');
    res.type(p.mime).send(p.bytes);
  } catch (e) { res.status(404).end(); }
});

router.put('/photos/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Only practice administrators can review photos.' });
  const status = (req.body || {}).status;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
  const pool = req.app.locals.pool;
  try {
    const { rows: [p] } = await pool.query(
      `UPDATE public.practice_profile_photos SET status = $1, reviewed_by = $2
        WHERE id::text = $3 AND practice_id = $4 RETURNING id, kind, provider_id, status`,
      [status, req.user.id, req.params.id, practiceOf(req)]);
    if (!p) return res.status(404).json({ error: 'Photo not found' });
    refreshSearch(); await P.logEvent(pool, { practiceId: practiceOf(req), providerId: p.provider_id, action: `photo_${status}`, detail: { id: p.id }, actorId: req.user.id });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: 'Could not update the photo' });
  }
});

router.delete('/photos/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const practiceId = practiceOf(req);
  try {
    const { rows: [p] } = await pool.query(
      'SELECT id, kind, provider_id FROM public.practice_profile_photos WHERE id::text = $1 AND practice_id = $2', [req.params.id, practiceId]);
    if (!p) return res.status(404).json({ error: 'Photo not found' });
    if (!isAdmin(req) && String(p.provider_id) !== String(req.user.id)) return res.status(403).json({ error: 'Not your photo' });
    await pool.query('DELETE FROM public.practice_profile_photos WHERE id = $1', [p.id]);
    await pool.query('UPDATE public.practice_profiles SET cover_photo_id = NULLIF(cover_photo_id, $1), logo_photo_id = NULLIF(logo_photo_id, $1) WHERE practice_id = $2', [p.id, practiceId]);
    await pool.query('UPDATE public.provider_listing_consents SET photo_id = NULL WHERE practice_id = $2 AND photo_id = $1', [p.id, practiceId]);
    refreshSearch(); await P.logEvent(pool, { practiceId, providerId: p.provider_id, action: 'photo_deleted', detail: { id: p.id, kind: p.kind }, actorId: req.user.id });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete the photo' });
  }
});

// ── admin: hide a consented provider (never consent for them) ───────────────────────
router.put('/providers/:id/hidden', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Only practice administrators can do this.' });
  const pool = req.app.locals.pool;
  const practiceId = practiceOf(req);
  const hidden = Boolean((req.body || {}).hidden);
  try {
    if (!(await isProvider(pool, req.params.id, practiceId))) return res.status(404).json({ error: 'Provider not found' });
    await pool.query(
      `INSERT INTO public.provider_listing_consents (practice_id, provider_id, hidden_by_admin, updated_at)
       VALUES ($1,$2,$3, now())
       ON CONFLICT (practice_id, provider_id) DO UPDATE SET hidden_by_admin = EXCLUDED.hidden_by_admin, updated_at = now()`,
      [practiceId, req.params.id, hidden]);
    refreshSearch(); await P.logEvent(pool, { practiceId, providerId: req.params.id, action: hidden ? 'provider_hidden' : 'provider_unhidden', actorId: req.user.id });
    res.json({ hidden });
  } catch (err) {
    res.status(500).json({ error: 'Could not update the listing' });
  }
});

// ── provider: their own consent ─────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const pool = req.app.locals.pool;
  const practiceId = practiceOf(req);
  try {
    if (!(await isProvider(pool, req.user.id, practiceId))) return res.json({ isProvider: false });
    const { rows: [c] } = await pool.query(
      'SELECT * FROM public.provider_listing_consents WHERE practice_id = $1 AND provider_id = $2', [practiceId, req.user.id]);
    const { rows: photos } = await pool.query(
      `SELECT id, status, created_at FROM public.practice_profile_photos
        WHERE practice_id = $1 AND kind = 'provider' AND provider_id = $2 ORDER BY created_at DESC`, [practiceId, req.user.id]);
    const { rows: [profile] } = await pool.query('SELECT visibility FROM public.practice_profiles WHERE practice_id = $1', [practiceId]);
    const specialties = (await pool.query('SELECT code, name FROM public.specialties WHERE COALESCE(is_active, true) ORDER BY sort_order, name')).rows;
    res.json({
      isProvider: true,
      consent: c || { consented: false, show_photo: false, show_bio: false, show_languages: false, show_specialties: true, bio: '', languages: [], specialty_codes: [], photo_id: null },
      currentVersion: P.CONSENT_VERSION, consentText: P.CONSENT_TEXT,
      needsReconsent: Boolean(c && c.consented && c.consent_version !== P.CONSENT_VERSION),
      practiceVisibility: profile ? profile.visibility : 'off',
      photos, specialties,
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not load your listing' });
  }
});

router.put('/me', async (req, res) => {
  const pool = req.app.locals.pool;
  const practiceId = practiceOf(req);
  const b = req.body || {};
  try {
    if (!(await isProvider(pool, req.user.id, practiceId))) return res.status(403).json({ error: 'Only providers have a listing.' });
    const consented = Boolean(b.consented);
    const languages = (Array.isArray(b.languages) ? b.languages : []).map((s) => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 10);
    const known = new Set((await pool.query('SELECT code FROM public.specialties')).rows.map((r) => r.code));
    const specialtyCodes = (Array.isArray(b.specialty_codes) ? b.specialty_codes : []).map(String).filter((c) => known.has(c)).slice(0, 10);
    let photoId = b.photo_id || null;
    if (photoId) {
      const { rows } = await pool.query(
        `SELECT 1 FROM public.practice_profile_photos WHERE id::text = $1 AND practice_id = $2 AND kind = 'provider' AND provider_id = $3`,
        [photoId, practiceId, req.user.id]);
      if (!rows.length) photoId = null;
    }
    const { rows: [before] } = await pool.query(
      'SELECT consented FROM public.provider_listing_consents WHERE practice_id = $1 AND provider_id = $2', [practiceId, req.user.id]);
    const { rows: [c] } = await pool.query(
      `INSERT INTO public.provider_listing_consents
         (practice_id, provider_id, consented, show_photo, show_bio, show_languages, show_specialties, bio, languages,
          specialty_codes, photo_id, consent_version, consented_at, withdrawn_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, CASE WHEN $3 THEN now() END, CASE WHEN NOT $3 THEN now() END, now())
       ON CONFLICT (practice_id, provider_id) DO UPDATE SET
         consented = EXCLUDED.consented, show_photo = EXCLUDED.show_photo, show_bio = EXCLUDED.show_bio,
         show_languages = EXCLUDED.show_languages, show_specialties = EXCLUDED.show_specialties,
         bio = EXCLUDED.bio, languages = EXCLUDED.languages, specialty_codes = EXCLUDED.specialty_codes,
         photo_id = EXCLUDED.photo_id,
         consent_version = CASE WHEN EXCLUDED.consented THEN EXCLUDED.consent_version ELSE provider_listing_consents.consent_version END,
         consented_at = CASE WHEN EXCLUDED.consented THEN now() ELSE provider_listing_consents.consented_at END,
         withdrawn_at = CASE WHEN EXCLUDED.consented THEN NULL ELSE now() END,
         updated_at = now()
       RETURNING *`,
      [practiceId, req.user.id, consented, Boolean(b.show_photo), Boolean(b.show_bio), Boolean(b.show_languages),
        b.show_specialties === undefined ? true : Boolean(b.show_specialties), clip(b.bio, 1500), languages, specialtyCodes,
        photoId, P.CONSENT_VERSION]);
    const action = consented ? (before && before.consented ? 'consent_updated' : 'consent_given') : 'consent_withdrawn';
    refreshSearch(); await P.logEvent(pool, {
      practiceId, providerId: req.user.id, action, actorId: req.user.id,
      detail: { version: P.CONSENT_VERSION, fields: { photo: c.show_photo, bio: c.show_bio, languages: c.show_languages, specialties: c.show_specialties } },
    });
    res.json({ consent: c });
  } catch (err) {
    console.error('[practice-profile] consent:', err.message);
    if (sendDbError(res, err, 'Could not save your listing')) return;
    res.status(500).json({ error: 'Could not save your listing' });
  }
});

module.exports = router;
