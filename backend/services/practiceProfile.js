// Practice profiles (directory Phase 2) — shared by the staff API and the public page.
// See migrations/092_practice_profiles.sql for the model and the visibility rules.

const crypto = require('crypto');
const { withTenant } = require('../db/tenantClient');

// The text a provider agrees to. Bump the version whenever the wording changes: each
// consent records the version it was given under.
const CONSENT_VERSION = '2026-11-20';
const CONSENT_TEXT =
  'I agree to be listed on this practice\'s public profile page and, if the practice makes it ' +
  'searchable, in the AureonCare directory, showing my name, title and the details I select ' +
  'below. I can withdraw this at any time, and my listing is removed straight away. No patient ' +
  'information is ever shown.';

const VISIBILITY = ['off', 'link', 'searchable'];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RANDOM_RE = /^[A-Za-z0-9]{12,16}$/;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomSlug(len = 14) {
  let out = '';
  while (out.length < len) for (const b of crypto.randomBytes(24)) if (b < 248 && out.length < len) out += ALPHABET[b % 62];
  return out;
}

const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'practice';

const appBase = () => (process.env.FRONTEND_URL || process.env.AC_FE_URL || '').split(',')[0].trim().replace(/\/+$/, '');

/** The address the profile is reachable at, or null when it is off. */
function publicPathFor(p) {
  if (!p || p.visibility === 'off') return null;
  if (p.visibility === 'link' && p.use_random_link) return `/p/${p.random_slug}`;
  return p.slug ? `/p/${p.slug}` : null;
}
const publicUrlFor = (p) => { const path = publicPathFor(p); return path ? `${appBase()}${path}` : null; };

/** The practice's providers (staff with a providers row), with their listing consent. */
async function practiceProviders(pool, practiceId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.first_name, p.last_name, p.specialization, p.specialty_code,
            c.consented, c.show_photo, c.show_bio, c.show_languages, c.show_specialties,
            c.bio, c.languages, c.specialty_codes, c.photo_id, c.consent_version, c.consented_at,
            c.withdrawn_at, COALESCE(c.hidden_by_admin, false) AS hidden_by_admin
       FROM public.providers p
       JOIN public.users u ON u.id = p.id
       LEFT JOIN public.provider_listing_consents c ON c.provider_id = p.id AND c.practice_id = $1
      WHERE EXISTS (SELECT 1 FROM public.memberships mem WHERE mem.user_id = u.id AND mem.practice_id = $1 AND mem.status = 'active') AND COALESCE(u.status, 'active') = 'active'
      ORDER BY p.last_name, p.first_name`, [practiceId]);
  return rows;
}

/** The profile row, or a default (OFF) built from the practice's existing details. */
async function loadProfile(pool, practiceId) {
  const { rows: [practice] } = await pool.query(
    'SELECT id, name, phone, email, setup FROM public.practices WHERE id = $1', [practiceId]);
  if (!practice) return null;
  const { rows: [row] } = await pool.query('SELECT * FROM public.practice_profiles WHERE practice_id = $1', [practiceId]);
  if (row) return { practice, profile: row, saved: true };
  const setup = practice.setup || {};
  return {
    practice,
    saved: false,
    profile: {
      practice_id: practiceId, visibility: 'off', slug: null, random_slug: null, use_random_link: false,
      display_name: practice.name, about: '', phone: practice.phone || '', email: practice.email || '', website: '',
      specialty_codes: Array.isArray(setup.specialtyCodes) ? setup.specialtyCodes : [],
      location_ids: [], locations: [], cover_photo_id: null, logo_photo_id: null,
    },
  };
}

/** Is `slug` free for this practice? */
async function slugAvailable(pool, slug, practiceId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM public.practice_profiles WHERE (slug = $1 OR random_slug = $1) AND practice_id <> $2', [slug, practiceId]);
  return rows.length === 0;
}

/** A free readable slug based on the practice name. */
async function suggestSlug(pool, name, practiceId) {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (await slugAvailable(pool, candidate, practiceId)) return candidate;
  }
  return `${base}-${randomSlug(6).toLowerCase()}`;
}

/** Public fields of the practice's chosen locations (copied into the profile on save). */
async function publishedLocations(basePool, schemaName, ids) {
  if (!ids || !ids.length || !schemaName) return [];
  const { rows } = await withTenant(basePool, schemaName, (c) => c.query(
    `SELECT id, name, address, city, state, postal_code, country, phone, latitude, longitude
       FROM locations WHERE id = ANY($1::uuid[]) AND COALESCE(is_active, true)`, [ids]));
  const order = new Map(ids.map((id, i) => [String(id), i]));
  return rows.sort((a, b) => order.get(String(a.id)) - order.get(String(b.id))).map((l) => ({
    id: l.id, name: l.name, address: l.address, city: l.city, state: l.state, postal_code: l.postal_code,
    country: l.country, phone: l.phone,
    latitude: l.latitude == null ? null : Number(l.latitude), longitude: l.longitude == null ? null : Number(l.longitude),
  }));
}

async function logEvent(pool, { practiceId, providerId = null, action, detail = {}, actorId = null }) {
  await pool.query(
    'INSERT INTO public.directory_events (practice_id, provider_id, action, detail, actor_id) VALUES ($1,$2,$3,$4,$5)',
    [practiceId, providerId, action, JSON.stringify(detail), actorId]);
}

/**
 * The profile behind a public address, or null. The rules:
 *   readable slug  -> searchable, or link-only WITHOUT the random address
 *   random slug    -> link-only or searchable (a printed QR code keeps working)
 *   off            -> nothing, ever
 */
async function resolvePublic(pool, slug) {
  if (!SLUG_RE.test(slug) && !RANDOM_RE.test(slug)) return null;
  const { rows: [p] } = await pool.query(
    `SELECT pp.*, pr.name AS practice_name
       FROM public.practice_profiles pp JOIN public.practices pr ON pr.id = pp.practice_id
      WHERE (pp.slug = $1 AND (pp.visibility = 'searchable' OR (pp.visibility = 'link' AND NOT pp.use_random_link)))
         OR (pp.random_slug = $1 AND pp.visibility IN ('link', 'searchable'))
      LIMIT 1`, [slug]);
  return p || null;
}

/** What the public page shows for a provider: only consented, not hidden, only chosen fields. */
function publicProvider(r) {
  if (!r.consented || r.hidden_by_admin) return null;
  return {
    id: r.id,
    name: `Dr. ${[r.first_name, r.last_name].filter(Boolean).join(' ')}`.trim(),
    specialization: r.show_specialties ? (r.specialization || null) : null,
    specialty_codes: r.show_specialties ? (r.specialty_codes || []) : [],
    bio: r.show_bio ? (r.bio || null) : null,
    languages: r.show_languages ? (r.languages || []) : [],
    photo_id: r.show_photo ? (r.photo_id || null) : null,
  };
}

/** Booking slugs of providers who take online bookings, from the practice's own schema. */
async function bookingSlugs(basePool, schemaName, providerIds) {
  if (!schemaName || !providerIds.length) return new Map();
  try {
    const { rows } = await withTenant(basePool, schemaName, (c) => c.query(
      `SELECT provider_id, booking_url_slug FROM provider_booking_config
        WHERE provider_id = ANY($1::uuid[]) AND booking_url_slug IS NOT NULL AND COALESCE(allow_public_booking, true)`,
      [providerIds]));
    return new Map(rows.map((r) => [String(r.provider_id), r.booking_url_slug]));
  } catch (e) {
    console.warn('[profile] booking links unavailable:', e.message);
    return new Map();
  }
}

async function specialtyNames(pool, codes) {
  if (!codes || !codes.length) return new Map();
  const { rows } = await pool.query('SELECT code, name FROM public.specialties WHERE code = ANY($1::text[])', [codes]);
  return new Map(rows.map((r) => [r.code, r.name]));
}

module.exports = {
  CONSENT_VERSION, CONSENT_TEXT, VISIBILITY, SLUG_RE, RANDOM_RE,
  randomSlug, slugify, publicPathFor, publicUrlFor, appBase,
  practiceProviders, loadProfile, slugAvailable, suggestSlug, publishedLocations, logEvent,
  resolvePublic, publicProvider, bookingSlugs, specialtyNames,
};
