#!/usr/bin/env node
// Fails when a route can never be reached because an earlier parameter route catches it.
//
// Express matches routes in declaration order. `router.get('/:id')` declared before
// `router.get('/receivables')` handles GET /receivables itself, with id = 'receivables'.
// That broke four Accounts screens and two Patient Intake screens (each answered 500 from
// a UUID parse error) until the parameter was constrained to a UUID. Constrained
// parameters (`:id(<regex>)`, or a template path built from one) are not flagged.
const fs = require('fs');
const path = require('path');

const ROUTES = path.join(__dirname, '..', 'routes');
const found = [];
for (const f of fs.readdirSync(ROUTES).filter((n) => n.endsWith('.js'))) {
  const routes = [];
  fs.readFileSync(path.join(ROUTES, f), 'utf8').split('\n').forEach((l, i) => {
    const m = l.match(/^\s*router\.(get|post|put|patch|delete)\(\s*'([^']+)'/);
    if (m) routes.push({ method: m[1], segs: m[2].split('/').filter(Boolean), path: m[2], line: i + 1 });
  });
  routes.forEach((r, i) => {
    const isFreeParam = (s) => s.startsWith(':') && !s.includes('(');
    if (!r.segs.some(isFreeParam)) return;
    for (const later of routes.slice(i + 1)) {
      if (later.method !== r.method || later.segs.length !== r.segs.length) continue;
      const caught = r.segs.every((s, k) => isFreeParam(s) || s === later.segs[k]);
      const literalWhereParam = later.segs.some((s, k) => isFreeParam(r.segs[k]) && !s.startsWith(':'));
      if (caught && literalWhereParam) {
        found.push(`${f}:${later.line}  ${later.method.toUpperCase()} ${later.path} is unreachable — caught by ${r.path} (line ${r.line})`);
      }
    }
  });
}
if (found.length) {
  console.error('Shadowed routes:');
  found.forEach((x) => console.error('  ' + x));
  console.error('\nFix: constrain the parameter (e.g. /:id(<uuid regex>)) or declare the literal route first.');
  process.exit(1);
}
console.log('ok: no route is shadowed by an earlier parameter route');
