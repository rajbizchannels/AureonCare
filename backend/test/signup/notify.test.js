// Platform email alerts: who is told what, and when nobody is.
//
// The mail transport is stubbed at the notificationService boundary so the real routing,
// recipient resolution, dedupe and record-keeping all run.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');

// Capture sends instead of mailing. Must be installed BEFORE platformNotify is required.
const sent = [];
const notifPath = require.resolve(path.join(BACKEND, 'services/notificationService.js'));
const realNotif = require(notifPath);
require.cache[notifPath].exports = {
  ...realNotif,
  sendEmail: async (to, subject, html) => { sent.push({ to, subject, html }); },
  buildEmailHtml: (title, colour, greeting, intro, rows) =>
    `<h1>${title}</h1><p>${intro}</p>` + rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join(''),
};

process.env.PORT = process.env.TEST_PORT || '4891';
process.env.NODE_ENV = 'development';
process.env.AC_PLAT_S = process.env.AC_PLAT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
// sendEmail is stubbed, but the real one no-ops without this; set it so nothing silently
// short-circuits if the stub is ever bypassed.
process.env.AC_SM_U = 'platform@example.com';
process.env.AC_SM_W = 'test-app-password';

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const notify = require(path.join(BACKEND, 'services/platformNotify.js'));
const { logPlatformAction } = require(path.join(BACKEND, 'services/platformAudit.js'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const settle = () => new Promise((r) => setTimeout(r, 400));
const toAddrs = () => sent.map((s) => s.to);

(async () => {
  const RUN = crypto.randomBytes(4).toString('hex');
  const hash = await bcrypt.hash('A-Strong-Passphrase!23', 12);
  const mk = async (role) => {
    const email = `${role}_${RUN}@example.com`;
    const { rows } = await pool.query(
      `INSERT INTO control.operators (email, password_hash, name, role, status)
       VALUES ($1,$2,$3,$4,'active') RETURNING id`, [email, hash, role, role]);
    return { id: rows[0].id, email };
  };
  // Silence pre-existing operators so this run's assertions are about its own accounts.
  await pool.query('UPDATE control.operators SET notify_platform_events = false');
  const owner = await mk('owner');
  const billing = await mk('billing');
  const support = await mk('support');
  const readonly = await mk('readonly');

  const t = await provisionTenant(pool, { name: 'Notify Clinic ' + RUN });

  // ── routing by role ───────────────────────────────────────────────────────
  sent.length = 0;
  await notify.notify(pool, { action: 'billing.adjustment.credit', actorId: billing.id,
    tenantId: t.tenant.id, detail: { amount: 25, reason: 'goodwill' },
    dedupeKey: 'k1:' + RUN });
  check('a money event reaches owner and billing', toAddrs().includes(owner.email) && toAddrs().includes(billing.email));
  check('a money event does NOT reach support', !toAddrs().includes(support.email));
  check('a money event does NOT reach readonly', !toAddrs().includes(readonly.email));
  check('the actor is told about their own money movement', toAddrs().includes(billing.email));

  sent.length = 0;
  await notify.notify(pool, { action: 'break_glass.start', actorId: support.id,
    tenantId: t.tenant.id, detail: { reason: 'investigating' }, dedupeKey: 'k2:' + RUN });
  check('break-glass reaches owner and support',
        toAddrs().includes(owner.email) && toAddrs().includes(support.email));
  check('break-glass does NOT reach billing', !toAddrs().includes(billing.email));
  check('break-glass tells the actor too (an unexpected mail is how a compromise shows)',
        toAddrs().includes(support.email));

  sent.length = 0;
  await notify.notify(pool, { action: 'tenant.resume', actorId: support.id,
    tenantId: t.tenant.id, dedupeKey: 'k3:' + RUN });
  check('a routine action does NOT mail the actor back', !toAddrs().includes(support.email));
  check('but others still hear about it', toAddrs().includes(owner.email));

  // ── severity and content ──────────────────────────────────────────────────
  sent.length = 0;
  await notify.notify(pool, { action: 'operator.create', actorId: owner.id,
    detail: { email: 'x@y.z', role: 'billing' }, dedupeKey: 'k4:' + RUN });
  check('operator creation is subject-lined clearly',
        sent[0] && sent[0].subject.includes('A platform operator was created'));
  check('a critical alert says to investigate',
        sent[0] && /investigate now/i.test(sent[0].html));

  sent.length = 0;
  await notify.notify(pool, { action: 'subscription.free_months', actorId: billing.id,
    tenantId: t.tenant.id, detail: { months: 3, reason: 'goodwill', patient_name: 'SHOULD NOT APPEAR' },
    dedupeKey: 'k5:' + RUN });
  check('the tenant name is in the subject', sent[0] && sent[0].subject.includes('Notify Clinic'));
  check('clinical-looking fields are stripped from the body',
        sent[0] && !sent[0].html.includes('SHOULD NOT APPEAR'));

  // ── dedupe ────────────────────────────────────────────────────────────────
  sent.length = 0;
  const key = 'dup:' + RUN;
  await notify.notify(pool, { action: 'payment.failed', tenantId: t.tenant.id, dedupeKey: key });
  const firstBatch = sent.length;
  const again = await notify.notify(pool, { action: 'payment.failed', tenantId: t.tenant.id, dedupeKey: key });
  check('a repeated delivery sends nothing more', sent.length === firstBatch && again.sent === 0);
  check('the repeat is reported as already notified', again.reason === 'already notified');

  // ── opt-out ───────────────────────────────────────────────────────────────
  await pool.query('UPDATE control.operators SET notify_platform_events = false WHERE id = $1', [owner.id]);
  sent.length = 0;
  await notify.notify(pool, { action: 'tenant.suspend', tenantId: t.tenant.id, dedupeKey: 'k6:' + RUN });
  check('an operator who opted out is skipped', !toAddrs().includes(owner.email));
  check('others still receive it', toAddrs().includes(billing.email));
  await pool.query('UPDATE control.operators SET notify_platform_events = true WHERE id = $1', [owner.id]);

  // A disabled operator must never be mailed.
  await pool.query("UPDATE control.operators SET status='disabled' WHERE id = $1", [billing.id]);
  sent.length = 0;
  await notify.notify(pool, { action: 'coupon.create', dedupeKey: 'k7:' + RUN });
  check('a disabled operator is not mailed', !toAddrs().includes(billing.email));
  await pool.query("UPDATE control.operators SET status='active' WHERE id = $1", [billing.id]);

  // ── unrouted and disabled ─────────────────────────────────────────────────
  sent.length = 0;
  const un = await notify.notify(pool, { action: 'something.unrouted', dedupeKey: 'k8:' + RUN });
  check('an unrouted action is silent', sent.length === 0 && un.reason === 'not routed');

  process.env.AC_PLATFORM_ALERTS = 'false';
  sent.length = 0;
  const off = await notify.notify(pool, { action: 'tenant.create', dedupeKey: 'k9:' + RUN });
  check('AC_PLATFORM_ALERTS=false silences everything', sent.length === 0 && off.reason === 'alerts disabled');
  delete process.env.AC_PLATFORM_ALERTS;

  // ── the audit chokepoint raises alerts automatically ──────────────────────
  sent.length = 0;
  await logPlatformAction(pool, { operatorId: support.id, action: 'tenant.suspend',
    targetType: 'tenant', targetId: t.tenant.id, tenantId: t.tenant.id, ip: '203.0.113.9' });
  await settle();
  check('logging a privileged action mails the right operators', toAddrs().includes(owner.email));
  const { rows: auditRow } = await pool.query(
    "SELECT 1 FROM control.audit_log WHERE action='tenant.suspend' AND tenant_id=$1", [t.tenant.id]);
  check('the action is still audited as well as mailed', auditRow.length > 0);

  // A mail failure must never break the action being recorded.
  const broken = require.cache[notifPath].exports.sendEmail;
  require.cache[notifPath].exports.sendEmail = async () => { throw new Error('SMTP down'); };
  let threw = false;
  try {
    await logPlatformAction(pool, { operatorId: owner.id, action: 'tenant.create',
      targetType: 'tenant', targetId: t.tenant.id, tenantId: t.tenant.id });
    await settle();
  } catch { threw = true; }
  require.cache[notifPath].exports.sendEmail = broken;
  check('a mail failure does not break the audited action', threw === false);
  const { rows: stillAudited } = await pool.query(
    "SELECT 1 FROM control.audit_log WHERE action='tenant.create' AND tenant_id=$1", [t.tenant.id]);
  check('and the action is still recorded', stillAudited.length > 0);

  // ── the record of what was sent ───────────────────────────────────────────
  const { rows: log } = await pool.query(
    "SELECT action, severity, recipients FROM control.platform_notifications WHERE dedupe_key = $1",
    ['k2:' + RUN]);
  check('every alert is recorded with its recipients',
        log[0] && log[0].severity === 'critical' && log[0].recipients.length >= 2);

  let ok = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (c) ok++; }
  console.log(`\n${ok}/${results.length} checks passed.`);
  await pool.end();
  process.exit(ok === results.length ? 0 : 1);
})().catch(e => { console.error('harness error:', e); process.exit(1); });
