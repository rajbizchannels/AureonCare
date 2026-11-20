// GET /p/<slug> — a practice's public profile page (directory Phase 2), rendered on the
// server so it can be read without JavaScript and indexed when the practice allows it.
//
//   off         404, exactly like an address that never existed
//   link        the page, with `noindex` (direct link / QR code only)
//   searchable  the page, indexable, with schema.org MedicalClinic data
//
// It shows only what the practice published and the providers who CONSENTED (and were not
// hidden), with only the fields each provider chose. No reviews, no patient data, no
// third-party scripts, trackers or fonts. Search queries are not handled here (Phase 3).

const express = require('express');
const rateLimit = require('express-rate-limit');
const { storeFor } = require('../middleware/rateLimitStore');
const P = require('../services/practiceProfile');

const router = express.Router();
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false, store: storeFor('public-profile') }));

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paras = (t) => esc(t).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

function notFound(res) {
  res.status(404).set('X-Robots-Tag', 'noindex').type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found · AureonCare</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0F172A;color:#E2E8F0;display:flex;min-height:100vh;align-items:center;justify-content:center}
.c{max-width:420px;margin:24px;padding:28px;background:#1E293B;border-radius:14px;border-top:4px solid #08B39C}.g{color:#F9BD00}.t{color:#08B39C}</style></head>
<body><main class="c"><div style="font-size:22px;font-weight:700"><span class="g">Aureon</span><span class="t">Care</span></div>
<h1 style="font-size:18px">This page isn't available</h1><p style="color:#94A3B8">The practice profile you are looking for does not exist or is not public.</p></main></body></html>`);
}

async function load(req) {
  const pool = req.app.locals.pool;
  const profile = await P.resolvePublic(pool, req.params.slug);
  if (!profile) return null;
  const { rows: [tenant] } = await pool.query('SELECT schema_name FROM control.tenants WHERE practice_id = $1 AND status = \'active\'', [profile.practice_id]);
  if (!tenant) return null;   // a suspended or closed practice has no public page
  return { pool, profile, schemaName: tenant.schema_name };
}

router.get('/:slug', async (req, res) => {
  try {
    const ctx = await load(req);
    if (!ctx) return notFound(res);
    const { pool, profile: p, schemaName } = ctx;
    const providers = (await P.practiceProviders(pool, p.practice_id)).map(P.publicProvider).filter(Boolean);
    const [names, booking, photos] = await Promise.all([
      P.specialtyNames(pool, [...new Set([...(p.specialty_codes || []), ...providers.flatMap((x) => x.specialty_codes)])]),
      P.bookingSlugs(pool, schemaName, providers.map((x) => x.id)),
      pool.query(`SELECT id, kind FROM public.practice_profile_photos
                   WHERE practice_id = $1 AND status = 'approved' AND kind = 'gallery' ORDER BY sort_order, created_at LIMIT 12`,
        [p.practice_id]).then((r) => r.rows),
    ]);
    const base = `/p/${encodeURIComponent(req.params.slug)}`;
    const photoUrl = (id) => `${base}/photo/${id}`;
    const indexable = p.visibility === 'searchable';
    const name = p.display_name || p.practice_name;
    const specialties = (p.specialty_codes || []).map((c) => names.get(c)).filter(Boolean);
    const locations = Array.isArray(p.locations) ? p.locations : [];
    const canonical = indexable && p.slug ? `${P.appBase()}/p/${p.slug}` : null;
    const description = (p.about || `${name}${specialties.length ? ` — ${specialties.join(', ')}` : ''}`).replace(/\s+/g, ' ').slice(0, 160);

    const jsonLd = indexable ? JSON.stringify({
      '@context': 'https://schema.org', '@type': 'MedicalClinic', name,
      url: canonical || undefined, telephone: p.phone || undefined, email: p.email || undefined,
      medicalSpecialty: specialties.length ? specialties : undefined,
      address: locations.map((l) => ({ '@type': 'PostalAddress', streetAddress: l.address || undefined,
        addressLocality: l.city || undefined, addressRegion: l.state || undefined, postalCode: l.postal_code || undefined, addressCountry: l.country || undefined })),
      employee: providers.map((x) => ({ '@type': 'Physician', name: x.name })),
    }).replace(/</g, '\\u003c') : null;

    const addr = (l) => [l.address, [l.city, l.state].filter(Boolean).join(', '), l.postal_code, l.country].filter(Boolean).map(esc).join('<br>');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} · AureonCare</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${indexable ? 'index,follow' : 'noindex,nofollow'}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta property="og:title" content="${esc(name)}"><meta property="og:description" content="${esc(description)}">
${p.cover_photo_id ? `<meta property="og:image" content="${esc(P.appBase() + photoUrl(p.cover_photo_id))}">` : ''}
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>
:root{--bg:#F8FAFC;--card:#fff;--text:#0F172A;--muted:#475569;--line:#E2E8F0;--teal:#068573;--gold:#F9BD00}
@media (prefers-color-scheme:dark){:root{--bg:#0B1120;--card:#111827;--text:#E5E7EB;--muted:#94A3B8;--line:#1F2937;--teal:#2DD4BF}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.55}
header.top{background:#0F172A;color:#fff;padding:12px 16px}header.top .w{max-width:960px;margin:0 auto;font-weight:700}
.g{color:#F9BD00}.t{color:#08B39C}main{max-width:960px;margin:0 auto;padding:16px}
.hero{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.cover{width:100%;max-height:280px;object-fit:cover;display:block}.hd{display:flex;gap:16px;align-items:center;padding:20px}
.logo{width:72px;height:72px;border-radius:14px;object-fit:cover;border:1px solid var(--line);background:#fff}
h1{font-size:1.6rem;margin:0}h2{font-size:1.15rem;margin:28px 0 12px}.muted{color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:8px 0 0;list-style:none}.chips li{border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:.9rem;background:var(--card)}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.prov{display:flex;gap:12px;align-items:flex-start}.av{width:56px;height:56px;border-radius:50%;object-fit:cover;flex:none;background:var(--line)}
.btn{display:inline-block;margin-top:10px;background:var(--teal);color:#fff;text-decoration:none;font-weight:600;padding:8px 14px;border-radius:8px}
.btn:focus,a:focus{outline:3px solid var(--gold);outline-offset:2px}a{color:var(--teal)}
.gal{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}.gal img{width:100%;height:140px;object-fit:cover;border-radius:10px}
footer{max-width:960px;margin:24px auto;padding:0 16px 32px;font-size:.85rem;color:var(--muted)}
</style>
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
</head><body>
<header class="top"><div class="w" style="display:flex;justify-content:space-between;align-items:center"><span><span class="g">Aureon</span><span class="t">Care</span></span><a href="/find" style="color:#CBD5E1;font-weight:500;font-size:.9rem;text-decoration:none">Find a practice</a></div></header>
<main>
<section class="hero" aria-labelledby="practice-name">
${p.cover_photo_id ? `<img class="cover" src="${photoUrl(p.cover_photo_id)}" alt="">` : ''}
<div class="hd">
${p.logo_photo_id ? `<img class="logo" src="${photoUrl(p.logo_photo_id)}" alt="${esc(name)} logo">` : ''}
<div><h1 id="practice-name">${esc(name)}</h1>
${specialties.length ? `<ul class="chips" aria-label="Specialties">${specialties.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
</div></div></section>

${p.about ? `<section aria-labelledby="about"><h2 id="about">About</h2>${paras(p.about)}</section>` : ''}

${(p.phone || p.email || p.website) ? `<section aria-labelledby="contact"><h2 id="contact">Contact</h2><div class="card">
${p.phone ? `<div>Phone: <a href="tel:${esc(p.phone.replace(/[^+\d]/g, ''))}">${esc(p.phone)}</a></div>` : ''}
${p.email ? `<div>Email: <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></div>` : ''}
${p.website ? `<div>Website: <a href="${esc(p.website)}" rel="noopener nofollow">${esc(p.website.replace(/^https?:\/\//, ''))}</a></div>` : ''}
</div></section>` : ''}

${locations.length ? `<section aria-labelledby="locations"><h2 id="locations">Locations</h2><div class="grid">
${locations.map((l) => `<div class="card"><strong>${esc(l.name || 'Location')}</strong><div class="muted">${addr(l)}</div>
${l.phone ? `<div><a href="tel:${esc(String(l.phone).replace(/[^+\d]/g, ''))}">${esc(l.phone)}</a></div>` : ''}</div>`).join('')}
</div></section>` : ''}

${providers.length ? `<section aria-labelledby="providers"><h2 id="providers">Providers</h2><div class="grid">
${providers.map((x) => {
    const spec = [x.specialization, ...x.specialty_codes.map((c) => names.get(c)).filter(Boolean)].filter(Boolean);
    const slug = booking.get(String(x.id));
    return `<div class="card prov">${x.photo_id ? `<img class="av" src="${photoUrl(x.photo_id)}" alt="">` : '<div class="av" aria-hidden="true"></div>'}
<div><strong>${esc(x.name)}</strong>
${spec.length ? `<div class="muted">${esc([...new Set(spec)].join(', '))}</div>` : ''}
${x.languages.length ? `<div class="muted">Languages: ${esc(x.languages.join(', '))}</div>` : ''}
${x.bio ? `<div style="margin-top:6px">${esc(x.bio)}</div>` : ''}
${slug ? `<a class="btn" href="/book/${esc(encodeURIComponent(slug))}">Book with ${esc(x.name)}</a>` : ''}
</div></div>`;
  }).join('')}
</div></section>` : ''}

${photos.length ? `<section aria-labelledby="photos"><h2 id="photos">Photos</h2><div class="gal">
${photos.map((ph) => `<img src="${photoUrl(ph.id)}" alt="" loading="lazy">`).join('')}</div></section>` : ''}
</main>
<footer>This page is published by ${esc(name)} on AureonCare. Providers are listed only with their consent.
<br><a href="${base}/join">Work here? Ask to join this practice</a></footer>
</body></html>`;
    res.set('Cache-Control', 'public, max-age=60');
    res.set('X-Robots-Tag', indexable ? 'index, follow' : 'noindex, nofollow');
    res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.type('html').send(html);
  } catch (err) {
    console.error('[public-profile] render:', err.message);
    notFound(res);
  }
});

// A photo on a visible profile: approved, of this practice, and — for a provider photo —
// only while that provider is listed with "show photo".
router.get('/:slug/photo/:id', async (req, res) => {
  try {
    const ctx = await load(req);
    if (!ctx) return res.status(404).end();
    const { pool, profile: p } = ctx;
    const { rows: [ph] } = await pool.query(
      `SELECT id, kind, provider_id, mime, bytes FROM public.practice_profile_photos
        WHERE id::text = $1 AND practice_id = $2 AND status = 'approved'`, [req.params.id, p.practice_id]);
    if (!ph) return res.status(404).end();
    if (ph.kind === 'provider') {
      const { rows: [c] } = await pool.query(
        `SELECT 1 FROM public.provider_listing_consents
          WHERE practice_id = $1 AND provider_id = $2 AND consented AND NOT hidden_by_admin AND show_photo AND photo_id = $3`,
        [p.practice_id, ph.provider_id, ph.id]);
      if (!c) return res.status(404).end();
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.set('X-Robots-Tag', p.visibility === 'searchable' ? 'index' : 'noindex');
    res.type(ph.mime).send(ph.bytes);
  } catch (e) {
    res.status(404).end();
  }
});

// ── "Work here? Ask to join" ─────────────────────────────────────────────────────────
//
// A staff member asks to join the practice from its public page. Nothing is granted here:
//   form -> email link proves the address -> admins approve in Team access -> a normal staff
//   invitation is sent -> accepting it is what gives access.
// The answers never reveal whether someone already works here or already asked.
const crypto = require('crypto');
const joinLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, store: storeFor('profile-join'),
  // Same two-condition test switch as middleware/rateLimiters.js.
  skip: () => process.env.AC_RL_TEST_BYPASS === '1' && process.env.NODE_ENV !== 'production' });
const JOIN_ROLES = { doctor: 'Doctor', nurse: 'Nurse', staff: 'Staff (front desk, admin team)' };
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

function shell(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} · AureonCare</title>
<style>:root{--bg:#F8FAFC;--card:#fff;--text:#0F172A;--muted:#475569;--line:#E2E8F0;--teal:#068573}
@media (prefers-color-scheme:dark){:root{--bg:#0B1120;--card:#111827;--text:#E5E7EB;--muted:#94A3B8;--line:#1F2937;--teal:#2DD4BF}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
header{background:#0F172A;padding:12px 16px;font-weight:700}.g{color:#F9BD00}.t{color:#08B39C}
main{max-width:480px;margin:24px auto;padding:0 16px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px}
label{display:block;font-weight:600;margin:12px 0 4px}input,select{width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;font:inherit;background:var(--bg);color:var(--text)}
button{margin-top:16px;width:100%;padding:11px;border:0;border-radius:8px;background:var(--teal);color:#fff;font-weight:600;font:inherit;cursor:pointer}
.muted{color:var(--muted);font-size:.92rem}a{color:var(--teal)}.err{color:#DC2626}</style></head>
<body><header><span class="g">Aureon</span><span class="t">Care</span></header><main><div class="card">${inner}</div></main></body></html>`;
}
const send = (res, status, title, inner) => {
  res.set('Cache-Control', 'no-store');
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.status(status).type('html').send(shell(title, inner));
};
const joinForm = (p, slug, vals = {}, error = '') => `
<h1 style="margin:0 0 4px;font-size:1.3rem">Ask to join ${esc(p.display_name || p.practice_name)}</h1>
<p class="muted">For people who work, or are starting to work, at this practice. We email you a link to confirm your address; the practice's administrators then decide. You get no access until they invite you.</p>
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
<form method="post" action="/p/${esc(encodeURIComponent(slug))}/join">
<label for="fn">First name</label><input id="fn" name="firstName" required maxlength="100" autocomplete="given-name" value="${esc(vals.firstName || '')}">
<label for="ln">Last name</label><input id="ln" name="lastName" required maxlength="100" autocomplete="family-name" value="${esc(vals.lastName || '')}">
<label for="em">Work email</label><input id="em" name="email" type="email" required maxlength="255" autocomplete="email" value="${esc(vals.email || '')}">
<label for="rl">Your role</label><select id="rl" name="role">${Object.entries(JOIN_ROLES).map(([k, v]) => `<option value="${k}"${vals.role === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
<button type="submit">Send request</button></form>
<p class="muted" style="margin-top:14px"><a href="/p/${esc(encodeURIComponent(slug))}">Back to the practice page</a></p>`;

router.get('/:slug/join', async (req, res) => {
  const ctx = await load(req).catch(() => null);
  if (!ctx) return notFound(res);
  send(res, 200, 'Ask to join', joinForm(ctx.profile, req.params.slug));
});

// The app-wide parser runs express.json first, which leaves req.body = {} for a form post,
// so this route parses its own (small) form body.
router.post('/:slug/join', joinLimiter, express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
  const ctx = await load(req).catch(() => null);
  if (!ctx) return notFound(res);
  const { pool, profile: p } = ctx;
  const b = req.body || {};
  const vals = { firstName: String(b.firstName || '').trim().slice(0, 100), lastName: String(b.lastName || '').trim().slice(0, 100),
    email: String(b.email || '').trim().toLowerCase().slice(0, 255), role: JOIN_ROLES[b.role] ? b.role : 'staff' };
  if (!vals.firstName || !vals.lastName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(vals.email)) {
    return send(res, 400, 'Ask to join', joinForm(p, req.params.slug, vals, 'Please give your first name, last name and a valid email address.'));
  }
  const done = () => send(res, 200, 'Check your email', `<h1 style="margin:0 0 8px;font-size:1.3rem">Check your email</h1>
<p>If ${esc(vals.email)} can receive mail, we have sent it a link to confirm your request to join ${esc(p.display_name || p.practice_name)}. The link works for 24 hours.</p>
<p class="muted">The practice sees your request only after you confirm it.</p>`);
  try {
    // Already a member, or a request already confirmed: same answer, nothing new.
    const { rows: member } = await pool.query(
      `SELECT 1 FROM public.memberships m JOIN public.users u ON u.id = m.user_id
        WHERE m.practice_id = $1 AND m.status = 'active' AND LOWER(u.email) = $2`, [p.practice_id, vals.email]);
    const { rows: open } = await pool.query(
      `SELECT id, status FROM public.join_requests WHERE practice_id = $1 AND LOWER(email) = $2 AND status IN ('unverified','pending')`,
      [p.practice_id, vals.email]);
    if (member.length || open.some((r) => r.status === 'pending')) return done();
    const token = crypto.randomBytes(32).toString('base64url');
    if (open.length) {
      await pool.query(`UPDATE public.join_requests SET verify_token_hash = $2, verify_expires_at = now() + interval '24 hours',
        first_name = $3, last_name = $4, requested_role = $5 WHERE id = $1`, [open[0].id, sha(token), vals.firstName, vals.lastName, vals.role]);
    } else {
      await pool.query(
        `INSERT INTO public.join_requests (id, practice_id, user_id, email, requested_role, status, first_name, last_name, source,
            verify_token_hash, verify_expires_at, created_at)
         VALUES (gen_random_uuid(), $1, NULL, $2, $3, 'unverified', $4, $5, 'profile', $6, now() + interval '24 hours', now())`,
        [p.practice_id, vals.email, vals.role, vals.firstName, vals.lastName, sha(token)]);
    }
    const { shorten } = require('../services/shortLinks');
    const { sendEmail, buildEmailHtml, emailButton, escapeHtml } = require('../services/notificationService');
    const link = await shorten(`${P.appBase()}/p/${encodeURIComponent(req.params.slug)}/join/verify?t=${token}`,
      { expiresAt: new Date(Date.now() + 24 * 3600 * 1000), kind: 'join-verify' });
    const practiceName = p.display_name || p.practice_name;
    await sendEmail(vals.email, `Confirm your request to join ${practiceName}`, buildEmailHtml(
      'Confirm your request', '#08B39C', `Hello ${escapeHtml(vals.firstName)},`,
      `Please confirm that you asked to join <strong>${escapeHtml(practiceName)}</strong> on AureonCare. The practice's administrators will then review your request.`,
      [['Practice', practiceName], ['Role requested', JOIN_ROLES[vals.role]]],
      emailButton(link, 'Confirm my request') + `<p style="font-size:13px;color:#64748B">If you did not ask for this, ignore this email — nothing happens without the confirmation.</p>`,
      { practiceName })).catch(() => {});
    done();
  } catch (e) {
    console.error('[profile-join] request failed:', e.message);
    send(res, 500, 'Ask to join', joinForm(p, req.params.slug, vals, 'Something went wrong. Please try again later.'));
  }
});

router.get('/:slug/join/verify', joinLimiter, async (req, res) => {
  const ctx = await load(req).catch(() => null);
  if (!ctx) return notFound(res);
  const { pool, profile: p } = ctx;
  const practiceName = p.display_name || p.practice_name;
  try {
    const { rows: [r] } = await pool.query(
      `UPDATE public.join_requests SET status = 'pending', verify_token_hash = NULL, email_verified_via = 'email-link'
        WHERE verify_token_hash = $1 AND practice_id = $2 AND status = 'unverified' AND verify_expires_at > now()
        RETURNING email, first_name, last_name, requested_role`, [sha(req.query.t || ''), p.practice_id]);
    if (!r) {
      return send(res, 410, 'Link expired', `<h1 style="margin:0 0 8px;font-size:1.3rem">This link has expired or was already used</h1>
<p><a href="/p/${esc(encodeURIComponent(req.params.slug))}/join">Ask again</a></p>`);
    }
    // Tell the practice's admins.
    try {
      const { sendEmail, buildEmailHtml } = require('../services/notificationService');
      const { rows: admins } = await pool.query(
        `SELECT u.email FROM public.users u JOIN public.memberships m ON m.user_id = u.id
          WHERE m.practice_id = $1 AND m.role = 'admin' AND m.status = 'active' AND u.status = 'active'`, [p.practice_id]);
      const html = buildEmailHtml('Someone has asked to join your practice', '#08B39C', 'Hello,',
        'A request to join came in from your practice\'s public page, and the email address has been confirmed.',
        [['Name', `${r.first_name} ${r.last_name}`], ['Email', r.email], ['Role requested', JOIN_ROLES[r.requested_role] || r.requested_role]],
        'Review it under Settings → User Management → Team access. Approving sends them a staff invitation.', { practiceName });
      for (const a of admins) await sendEmail(a.email, `Request to join ${practiceName}`, html).catch(() => {});
    } catch (_) { /* the request stands */ }
    send(res, 200, 'Request sent', `<h1 style="margin:0 0 8px;font-size:1.3rem">Request sent</h1>
<p>Thanks — ${esc(practiceName)}'s administrators will review your request. If they approve it, you will get an invitation by email.</p>`);
  } catch (e) {
    console.error('[profile-join] verify failed:', e.message);
    send(res, 500, 'Ask to join', '<p>Something went wrong. Please try the link again later.</p>');
  }
});

module.exports = router;
