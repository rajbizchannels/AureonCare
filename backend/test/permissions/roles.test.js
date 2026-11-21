// Creating and deleting a role.
//
// "Create Custom Role" had never worked. The form posted a grid of module x action
// checkboxes to PUT /api/permissions/:role, which looks the role up in `roles` BEFORE
// writing its permissions — and `roles` is empty on every installation checked, so the
// call answered 404 and the UI reported "Failed to save custom role" every single time.
// The checkboxes were decorative on top of that: they wrote to role_permissions, which no
// route reads.
//
// The form is now a name, created through POST /api/roles, and what the role may do is
// granted in the one permissions grid. Delete was broken differently: the handler called
// an api.deleteRole that did not exist in apiService at all, with a role NAME, against a
// route that takes an id.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4893';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
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
    if (err.code === '42P01') console.error('\nA table is missing. Run: npm run migrate && npm run migrate:tenants');
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
  const t = await provisionTenant(pool, { name: `Roles Clinic ${RUN}` });

  const mk = async (role) => {
    const email = `${role}_${RUN}@example.com`;
    const { rows } = await pool.query(
      `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
       VALUES (gen_random_uuid(),$1,$2,'Role',$3,'active',$4,$5,NOW()) RETURNING id`,
      [email, role, role, hash, t.practiceId]);
    const l = await api('POST', '/api/auth/login', { email, password: PW });
    return { id: rows[0].id, email, token: l.body && l.body.token };
  };
  const admin = await mk('admin');
  const nurse = await mk('nurse');
  check('users can sign in', Boolean(admin.token && nurse.token));

  const NAME = `ward_clerk_${RUN}`;
  const created = [];

  // ── what the old form did ──────────────────────────────────────────────────────────
  const oldWay = await api('PUT', `/api/permissions/${NAME}`,
    { patients: { view: true, create: false, edit: false, delete: false } }, admin.token);
  check('the old Create Custom Role path 404s for a role that does not exist yet',
    oldWay.status === 404);

  // ── creating a role ────────────────────────────────────────────────────────────────
  const made = await api('POST', '/api/roles',
    { name: NAME, display_name: 'Ward Clerk' }, admin.token);
  check('a role can be created by name', made.status === 201);
  check('and comes back with the id Delete needs', Boolean(obj(made.body).id));
  check('the name is stored as given', obj(made.body).name === NAME);
  check('and it is not a system role', obj(made.body).is_system_role === false);
  if (obj(made.body).id) created.push(made.body.id);

  const dupe = await api('POST', '/api/roles', { name: NAME, display_name: 'Ward Clerk' }, admin.token);
  check('creating the same role twice is refused rather than duplicated', dupe.status === 400);

  const noName = await api('POST', '/api/roles', { display_name: 'No name' }, admin.token);
  check('a role with no name is refused', noName.status === 400);

  // ── it reaches the one permissions grid, with nothing granted ──────────────────────
  const grid = await api('GET', '/api/permissions/modules', undefined, admin.token);
  check('the new role appears in the permissions grid',
    (obj(grid.body).roles || []).includes(NAME));
  check('starting with nothing granted, rather than inheriting another role\'s access',
    (obj(grid.body).permissions || []).filter((p) => p.roleName === NAME)
      .every((p) => p.canView === false && p.canCreate === false && p.canEdit === false
        && p.canDelete === false && p.canApprove === false && p.canExport === false));

  // The point of a name-only form: the role is useless until granted something HERE.
  const grant = await api('PUT', '/api/permissions/modules',
    { module: 'patients', roleName: NAME, resource: 'patients', canView: true }, admin.token);
  check('the new role can then be granted a permission', grant.status === 200);

  // ── deleting a role ────────────────────────────────────────────────────────────────
  const byName = await api('DELETE', `/api/roles/${NAME}`, undefined, admin.token);
  check('deleting by NAME does not work, which is what the old button tried',
    byName.status !== 200);

  const byId = await api('DELETE', `/api/roles/${made.body.id}`, undefined, admin.token);
  check('deleting by id works', byId.status === 200);
  const afterDelete = await api('GET', '/api/permissions/modules', undefined, admin.token);
  check('and the role is gone from the grid',
    !(obj(afterDelete.body).roles || []).includes(NAME));

  // A role somebody still holds must not vanish under them.
  const held = await api('POST', '/api/roles',
    { name: `nurse_${RUN}_held`, display_name: 'Held' }, admin.token);
  if (obj(held.body).id) created.push(held.body.id);
  await pool.query('UPDATE public.users SET role = $2 WHERE id = $1', [nurse.id, `nurse_${RUN}_held`]);
  const inUse = await api('DELETE', `/api/roles/${held.body.id}`, undefined, admin.token);
  check('a role that users still hold cannot be deleted', inUse.status !== 200);
  await pool.query('UPDATE public.users SET role = $2 WHERE id = $1', [nurse.id, 'nurse']);

  // ── who may do this ────────────────────────────────────────────────────────────────
  const nurseCreate = await api('POST', '/api/roles',
    { name: `sneaky_${RUN}`, display_name: 'Sneaky' }, nurse.token);
  check('a nurse cannot create a role', nurseCreate.status === 403 || nurseCreate.status === 401);
  if (nurseCreate.status === 201 && obj(nurseCreate.body).id) created.push(nurseCreate.body.id);
  check('an unauthenticated caller cannot create a role',
    (await api('POST', '/api/roles', { name: 'x', display_name: 'x' })).status === 401);

  // cleanup
  if (created.length) {
    await pool.query('DELETE FROM public.role_permissions WHERE role_id = ANY($1::int[])', [created])
      .catch(() => {});
    await pool.query('DELETE FROM public.roles WHERE id = ANY($1::int[])', [created]).catch(() => {});
  }
  await pool.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [[admin.id, nurse.id]]);

  report();
})().catch(report);
