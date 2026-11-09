// Fine-grained module permissions: the grid, and — the part that did not exist before —
// whether unticking a box actually stops anything.
//
// Two modules already had a permissions grid in the admin panel. Nothing read either one:
// inventory_role_permissions and account_role_permissions were written by their own
// endpoints, dumped by the inventory backup, and consulted by no route. An administrator
// could untick Delete for a nurse, watch the box go grey, and the nurse could still
// delete. Every check below headed "is refused" fails against that.
//
// The other thing worth proving: switching enforcement on must change NOTHING until
// somebody edits something. A practice with no rows has to keep working exactly as before.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4891';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const registry = require(path.join(BACKEND, 'utils/permissionRegistry.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const api = async (method, url, body, token) => {
  const r = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed };
};
const obj = (v) => v || {};

const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) {
    console.log(`\n${results.length - failed}/${results.length} passed before the suite stopped early.`);
    console.error(`\nSTOPPED: ${err.message || err}`);
    if (err.code === '42P01') {
      console.error('\nA table is missing. Run: npm run migrate && npm run migrate:tenants');
    }
    console.error(err);
  } else {
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  }
  process.exit(err || failed ? 1 : 0);
};

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  const RUN = crypto.randomBytes(4).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const hash = await bcrypt.hash(PW, 12);
  const t = await provisionTenant(pool, { name: `Perm Clinic ${RUN}` });
  const schema = t.tenant.schema_name;

  const mk = async (role) => {
    const email = `${role}_${RUN}@example.com`;
    const { rows } = await pool.query(
      `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
       VALUES (gen_random_uuid(),$1,$2,'Perm',$3,'active',$4,$5,NOW()) RETURNING id`,
      [email, role, role, hash, t.practiceId]);
    const l = await api('POST', '/api/auth/login', { email, password: PW });
    return { id: rows[0].id, email, token: l.body && l.body.token };
  };
  const admin = await mk('admin');
  const nurse = await mk('nurse');
  const reception = await mk('receptionist');
  check('users can sign in', Boolean(admin.token && nurse.token && reception.token));

  const sql = (text, params) => pool.query(
    text.replace(/\{s\}/g, schema), params);

  // ── the grid ───────────────────────────────────────────────────────────────────────
  const grid = await api('GET', '/api/permissions/modules', undefined, admin.token);
  check('an admin can read the permissions grid', grid.status === 200);
  check('every module in the registry is offered',
    Array.isArray(obj(grid.body).modules)
    && obj(grid.body).modules.length === Object.keys(registry.MODULES).length);
  check('the six actions are described', Array.isArray(obj(grid.body).actions)
    && obj(grid.body).actions.length === 6);
  check('the two modules that already had grids are included',
    obj(grid.body).modules.some((m) => m.key === 'inventory')
    && obj(grid.body).modules.some((m) => m.key === 'accounts'));
  check('nine modules that had none are now included',
    ['patients', 'appointments', 'clinical', 'rcm', 'crm', 'camps', 'forms', 'offerings', 'providers']
      .every((k) => obj(grid.body).modules.some((m) => m.key === k)));

  const perms = obj(grid.body).permissions || [];
  check('a grant is returned for every module/role/resource',
    perms.length === obj(grid.body).modules.reduce(
      (n, m) => n + m.resources.length * obj(grid.body).roles.length, 0));
  // The screen shows what is ENFORCED, not the empty table. A raw dump would imply nobody
  // can do anything on a practice that has never edited its permissions.
  check('with nothing stored, every grant is marked as a default',
    perms.every((p) => p.source === 'default'));
  check('the admin row is shown but marked uneditable',
    perms.filter((p) => p.roleName === 'admin').every((p) => p.editable === false && p.canDelete === true));

  const nonAdmin = await api('GET', '/api/permissions/modules', undefined, nurse.token);
  check('a nurse cannot read the permissions grid', nonAdmin.status === 403);
  const nurseWrite = await api('PUT', '/api/permissions/modules',
    { module: 'patients', roleName: 'nurse', resource: 'patients', canView: true }, nurse.token);
  check('a nurse cannot edit permissions', nurseWrite.status === 403);

  // ── validation ─────────────────────────────────────────────────────────────────────
  check('an unknown module is refused', (await api('PUT', '/api/permissions/modules',
    { module: 'nope', roleName: 'nurse', resource: 'patients' }, admin.token)).status === 400);
  check('a resource that does not belong to the module is refused',
    (await api('PUT', '/api/permissions/modules',
      { module: 'patients', roleName: 'nurse', resource: 'claims' }, admin.token)).status === 400);
  check('an unknown role is refused', (await api('PUT', '/api/permissions/modules',
    { module: 'patients', roleName: 'wizard', resource: 'patients' }, admin.token)).status === 400);
  // Refused rather than ignored: an administrator who thinks they have restricted their own
  // role would be wrong, and would find out by locking themselves out.
  const selfLock = await api('PUT', '/api/permissions/modules',
    { module: 'patients', roleName: 'admin', resource: 'patients', canView: false }, admin.token);
  check('the admin role cannot be restricted', selfLock.status === 400);

  // ── enforcement: a stored denial actually stops the request ────────────────────────
  const beforeDeny = await api('GET', '/api/patients', undefined, nurse.token);
  check('a nurse can list patients by default', beforeDeny.status === 200);

  const deny = await api('PUT', '/api/permissions/modules',
    { module: 'patients', roleName: 'nurse', resource: 'patients' }, admin.token);
  check('an admin can save a grant', deny.status === 200 && deny.body.source === 'stored');
  check('the saved grant has every action off', registry.ACTIONS.every(
    (a) => deny.body[`can${a[0].toUpperCase()}${a.slice(1)}`] === false));

  const afterDeny = await api('GET', '/api/patients', undefined, nurse.token);
  check('THE DENIAL IS ENFORCED: the nurse can no longer list patients', afterDeny.status === 403);
  check('the refusal names the permission that is missing',
    obj(obj(afterDeny.body).required).resource === 'patients'
    && obj(obj(afterDeny.body).required).action === 'view');
  check('and tells the user where it can be changed',
    typeof obj(afterDeny.body).message === 'string'
    && obj(afterDeny.body).message.includes('administrator'));

  const otherRole = await api('GET', '/api/patients', undefined, reception.token);
  check('another role is unaffected by that denial', otherRole.status === 200);
  const adminStill = await api('GET', '/api/patients', undefined, admin.token);
  check('an admin is never denied', adminStill.status === 200);

  // View restored, create still denied: proves the actions are independent rather than one
  // switch wearing six labels.
  await api('PUT', '/api/permissions/modules',
    { module: 'patients', roleName: 'nurse', resource: 'patients', canView: true }, admin.token);
  check('restoring view lets the nurse list patients again',
    (await api('GET', '/api/patients', undefined, nurse.token)).status === 200);
  const createDenied = await api('POST', '/api/patients',
    { first_name: 'X', last_name: 'Y', date_of_birth: '1990-01-01' }, nurse.token);
  check('create is still refused while only view is granted', createDenied.status === 403);

  // ── reset returns to the default ───────────────────────────────────────────────────
  const reset = await api('DELETE', '/api/permissions/modules/patients/nurse/patients', undefined, admin.token);
  check('a grant can be reset to the default', reset.status === 200 && reset.body.source === 'default');
  check('and the default is back in force',
    (await api('POST', '/api/patients',
      { first_name: `P${RUN}`, last_name: 'Reset', date_of_birth: '1990-01-01', mrn: `MRN-R-${RUN}` },
      nurse.token)).status !== 403);

  // ── absence is not denial ──────────────────────────────────────────────────────────
  // The whole deployment rests on this: a practice that has never opened the screen has no
  // rows, and must behave exactly as it did before enforcement existed.
  const { rows: [{ n: stored }] } = await sql(
    'SELECT count(*)::int AS n FROM {s}.module_permissions');
  check('no rows are stored for this practice after the reset', stored === 0);
  for (const [label, url, tok] of [
    ['patients', '/api/patients', nurse.token],
    ['appointments', '/api/appointments', reception.token],
    ['claims', '/api/claims', admin.token],
  ]) {
    check(`${label} still works with nothing stored`,
      (await api('GET', url, undefined, tok)).status === 200);
  }

  // ── the modules that had a grid but no enforcement ─────────────────────────────────
  // Written into the LEGACY table, the way the existing admin screen writes it, to prove
  // settings made before today are now honoured rather than quietly ignored.
  await sql(
    `INSERT INTO {s}.inventory_role_permissions
       (role_name, resource, can_view, can_create, can_edit, can_delete, can_approve, can_export)
     VALUES ('nurse','items',false,false,false,false,false,false)
     ON CONFLICT (role_name, resource) DO UPDATE SET can_view = false`);
  const invDenied = await api('GET', '/api/inventory/items', undefined, nurse.token);
  check('an inventory grant written by the OLD grid is now enforced', invDenied.status === 403);
  // The permissions screen itself must never be gated by the permissions it edits.
  const rbacStillReachable = await api('GET', '/api/inventory/rbac/permissions', undefined, admin.token);
  check('the inventory permissions endpoint is not gated by inventory permissions',
    rbacStillReachable.status === 200);
  // A new edit must BEAT the legacy row. Enforcement used to read the legacy table first
  // while the read endpoint preferred the new one, so with the separate Accounts and
  // Inventory grids now folded into one screen, an administrator would change a setting,
  // see it reported as saved, and enforcement would go on obeying the old row.
  const override = await api('PUT', '/api/permissions/modules',
    { module: 'inventory', roleName: 'nurse', resource: 'items', canView: true }, admin.token);
  check('a grant can be saved for a module that has a legacy table', override.status === 200);
  check('AN EDIT IN THE ONE GRID OVERRIDES THE LEGACY ROW',
    (await api('GET', '/api/inventory/items', undefined, nurse.token)).status === 200);
  // And the other direction, so this is not just "true wins".
  await api('PUT', '/api/permissions/modules',
    { module: 'inventory', roleName: 'nurse', resource: 'items', canView: false }, admin.token);
  await sql(`UPDATE {s}.inventory_role_permissions SET can_view = true WHERE role_name='nurse' AND resource='items'`);
  check('...in both directions: a new denial beats a legacy grant',
    (await api('GET', '/api/inventory/items', undefined, nurse.token)).status === 403);

  // Clearing the new row falls back to the legacy row, not straight to the defaults.
  await api('DELETE', '/api/permissions/modules/inventory/nurse/items', undefined, admin.token);
  check('removing the new grant falls back to the legacy row',
    (await api('GET', '/api/inventory/items', undefined, nurse.token)).status === 200);

  // ── the roles the practice actually uses are grantable ────────────────────────────
  // The grids this replaced each hardcoded six roles, so a custom role was invisible in
  // them and could never be granted anything.
  const custom = await mk('ward_clerk');
  const withCustom = await api('GET', '/api/permissions/modules', undefined, admin.token);
  check('a custom role in use appears in the grid',
    (obj(withCustom.body).roles || []).includes('ward_clerk'));
  check('and starts with nothing granted, rather than inheriting someone else\'s access',
    (obj(withCustom.body).permissions || [])
      .filter((p) => p.roleName === 'ward_clerk').every((p) => p.canView === false));
  check('a patient role is not offered here', !(obj(withCustom.body).roles || []).includes('patient'));
  const grantCustom = await api('PUT', '/api/permissions/modules',
    { module: 'patients', roleName: 'ward_clerk', resource: 'patients', canView: true }, admin.token);
  check('a custom role can be granted a permission', grantCustom.status === 200);
  check('and the grant takes effect',
    (await api('GET', '/api/patients', undefined, custom.token)).status === 200);
  check('without granting it anything else',
    (await api('GET', '/api/claims', undefined, custom.token)).status === 403);

  // ── the registry is the single source of truth ─────────────────────────────────────
  const described = registry.describe();
  check('every module in the registry declares at least one resource',
    described.modules.every((m) => m.resources.length > 0));
  check('no resource name is duplicated within a module',
    described.modules.every((m) => new Set(m.resources).size === m.resources.length));
  check('every role has a default for every module',
    described.modules.every((m) => described.roles.every((r) => m.defaults[r])));
  check('admin defaults to every action everywhere',
    described.modules.every((m) => registry.ACTIONS.every((a) => m.defaults.admin[a] === true)));

  await pool.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])',
    [[admin.id, nurse.id, reception.id, custom.id]]);

  report();
})().catch(report);
