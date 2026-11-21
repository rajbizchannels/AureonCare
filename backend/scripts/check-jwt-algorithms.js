#!/usr/bin/env node
// SEC-11 guard: every jwt.verify() must pin its algorithms.
//
// Without an `algorithms` allowlist, jsonwebtoken accepts any HMAC algorithm the
// secret can produce (and, for public keys, algorithm-confusion attacks). Three call
// sites slipped through the original fix, so this check runs over the whole backend
// and fails the build if a new one appears.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', 'test', '.git']);
const offenders = [];

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith('.js') || full === __filename) continue;
    const src = fs.readFileSync(full, 'utf8');
    const re = /jwt\.verify\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      // The call's argument list: scan to the matching close paren.
      let depth = 0; let i = m.index + m[0].length - 1;
      for (; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')' && --depth === 0) break;
      }
      const call = src.slice(m.index, i + 1);
      if (!/algorithms\s*:/.test(call)) {
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(`${path.relative(ROOT, full)}:${line}`);
      }
    }
  }
};

walk(ROOT);
if (offenders.length) {
  console.error('jwt.verify without an algorithms allowlist (SEC-11):');
  offenders.forEach((o) => console.error('  ' + o));
  process.exit(1);
}
console.log('ok: every jwt.verify pins its algorithms');
