#!/usr/bin/env node
// SEC-14 guard: the frontend must not log whole records or credentials.
//
// Production builds no-op console.log/info/debug (src/index.js), but development builds,
// shared screenshots and support sessions still show them, and console.warn/error are
// never silenced. A blanket ESLint no-console rule is not usable here (CRA fails a CI
// build on any lint warning and the app has hundreds of harmless logs), so this check
// targets the shape that leaks: a console call whose argument is a bare variable named
// like a clinical record, a person, a payload, or a secret.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'frontend', 'src');
const SENSITIVE = /^(patient|prescription|record|medicalRecord|diagnosis|labOrder|appointment|claim|payload|prescriptionPayload|formData|currentFormData|originalData|credentials|secret|apiKey|token|sessionToken|user|provider|normalizedProvider|insurance|result)s?$/i;
const CALL = /console\.(log|info|debug|warn|error)\s*\(([^;]*?)\)\s*;/g;

const offenders = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    if (!/\.jsx?$/.test(e.name) || /\.test\.jsx?$/.test(e.name)) continue;
    const src = fs.readFileSync(full, 'utf8');
    let m;
    while ((m = CALL.exec(src))) {
      // Top-level arguments after the first (the message).
      const args = m[2].split(',').slice(1).map((a) => a.trim());
      if (args.some((a) => SENSITIVE.test(a))) {
        offenders.push(`${path.relative(SRC, full)}:${src.slice(0, m.index).split('\n').length}  ${m[0].slice(0, 100)}`);
      }
    }
  }
};
walk(SRC);
if (offenders.length) {
  console.error('Console call logs a whole record/credential (SEC-14) — log an id instead:');
  offenders.forEach((o) => console.error('  ' + o));
  process.exit(1);
}
console.log('ok: no console call logs a whole record or credential');
