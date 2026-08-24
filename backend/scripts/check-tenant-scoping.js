#!/usr/bin/env node
// SEC-05 Model D — Step S9: static tenant-scoping guard (CI check).
//
// Fails (exit 1) when a route regresses tenant isolation:
//   A. Hardcodes a tenant schema in SQL (e.g. `tenant_default.patients`) — routes must
//      rely on search_path, never name a tenant schema.
//   B. Qualifies a tenant table with `public.` — pins it to public, bypassing the tenant
//      schema.
//   C. Binds the request pool as the raw shared pool (`const pool = req.app.locals.pool;`
//      without the `req.db ||` fallback) in a file that is NOT an approved
//      identity/shared/control route — i.e. an unswept or new route touching tenant data.
//
// Run: node backend/scripts/check-tenant-scoping.js

const fs = require('fs');
const path = require('path');

const ROUTES = path.join(__dirname, '..', 'routes');
const MIGRATIONS = path.join(__dirname, '..', 'migrations');

// Files allowed to use the raw shared pool: identity (public + practice_id scoping),
// global shared master data, and control-plane config. These do NOT route through a
// tenant schema by design.
const RAW_POOL_ALLOWLIST = new Set([
  'users.js', 'providers.js', 'auth.js',                 // identity plane
  'roles.js', 'permissions.js', 'medical-codes.js',      // shared RBAC / code master
  'medications.js', 'plans.js',                          // shared master / control
  'stripeSettings.js', 'stripeWebhook.js',               // control-plane billing config
  'platform.js',                                         // control-plane console: operates on control.* + explicit withTenant (break-glass)
]);

// Tenant table set, parsed from the migrations that populate control.tenant_tables.
function tenantTables() {
  const set = new Set();
  for (const f of ['064_sec05_template_schema.sql', '068_sec05_expand_tenant_set.sql']) {
    const p = path.join(MIGRATIONS, f);
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    // INSERT INTO control.tenant_tables ... VALUES ('name', n), ...
    const m = txt.match(/tenant_tables[\s\S]*?VALUES([\s\S]*?);/i);
    if (m) for (const mm of m[1].matchAll(/\('([a-z_]+)'/g)) set.add(mm[1]);
  }
  return set;
}

const TENANT = tenantTables();
const violations = [];

for (const file of fs.readdirSync(ROUTES).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(ROUTES, file), 'utf8');
  const lines = src.split('\n');

  lines.forEach((line, i) => {
    const n = i + 1;
    // A. hardcoded tenant schema
    if (/\btenant_[a-z0-9_]+\.\w/i.test(line) && !/\/\//.test(line.split('tenant_')[0])) {
      violations.push(`${file}:${n}  hardcoded tenant schema: ${line.trim().slice(0, 90)}`);
    }
    // B. public-qualified tenant table
    for (const t of TENANT) {
      const re = new RegExp(`\\bpublic\\.${t}\\b`);
      if (re.test(line)) {
        violations.push(`${file}:${n}  tenant table pinned to public.${t}: ${line.trim().slice(0, 80)}`);
        break;
      }
    }
  });

  // C. raw shared-pool binding in a non-allowlisted route
  if (!RAW_POOL_ALLOWLIST.has(file)) {
    lines.forEach((line, i) => {
      if (/const\s+pool\s*=\s*req\.app\.locals\.pool\s*;/.test(line)) {
        violations.push(`${file}:${i + 1}  raw pool binding (use \`req.db || req.app.locals.pool\`): ${line.trim()}`);
      }
    });
  }
}

if (violations.length) {
  console.error(`SEC-05 tenant-scoping guard: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error('  ' + v);
  console.error('\nFix: route tenant-table access through req.db, never hardcode/pin a schema.');
  process.exit(1);
}
console.log(`SEC-05 tenant-scoping guard: OK (${TENANT.size} tenant tables; ${RAW_POOL_ALLOWLIST.size} allowlisted files).`);
process.exit(0);
