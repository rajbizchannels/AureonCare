// SEC-23: robustness of the X12 835 (remittance) parser against hostile input.
//
// The 835 upload is the one place the server parses a structured file supplied by a
// user. It is not XML (no XXE), but a parser that throws or spins on malformed input is
// still a denial of service and a source of 500s. This drives validate835File ->
// parse835File -> convertToPaymentPostings with well-formed, mutated and random input and
// requires that every input either parses or is rejected cleanly: no uncaught exception
// escaping the validate/parse contract, no input taking more than a bounded time.
//
// Deterministic (seeded) so a failure reproduces.

const path = require('path');

// The parser logs every unmatched claim; across 10,000 inputs that buries the report.
const out = console.log.bind(console);
console.log = () => {};
console.error = () => {};
console.warn = () => {};
const { parse835File, validate835File, convertToPaymentPostings, generate835File } =
  require(path.join(__dirname, '..', '..', 'utils', 'edi835Parser.js'));

let seed = 0x5ec23;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rand() * a.length)];

const VALID = [
  'ISA*00*          *00*          *ZZ*PAYER          *ZZ*CLINIC         *251119*1200*^*00501*000000905*0*P*:',
  'GS*HP*PAYER*CLINIC*20251119*1200*1*X*005010X221A1', 'ST*835*0001', 'BPR*I*150.00*C*ACH*CCP*01*999999999*DA*123456*1512345678**01*999988880*DA*98765*20251119',
  'TRN*1*12345*1512345678', 'N1*PR*ACME HEALTH', 'REF*2U*99999', 'N1*PE*AUREON CLINIC*XX*1234567893',
  'CLP*CLM-001*1*200.00*150.00*50.00*12*ICN0001', 'NM1*QC*1*DOE*JANE', 'DTM*232*20251101',
  'SVC*HC:99213*200.00*150.00**1', 'DTM*472*20251101', 'CAS*PR*1*50.00', 'AMT*B6*150.00',
  'SE*16*0001', 'GE*1*1', 'IEA*1*000000905',
].join('~') + '~';

const results = [];
const check = (n, c) => results.push([n, !!c]);

// Run one input through the full pipeline the route uses. "Rejected" (validate says no)
// is fine; throwing out of validate, or out of parse after validate accepted, is not.
const run = (input) => {
  const t0 = process.hrtime.bigint();
  let outcome;
  try {
    const v = validate835File(input);
    if (!v || typeof v.valid !== 'boolean') return { outcome: 'bad-validate-shape', ms: 0 };
    if (!v.valid) outcome = 'rejected';
    else {
      const parsed = parse835File(input);
      convertToPaymentPostings(parsed, {});
      JSON.stringify(parsed);
      outcome = 'parsed';
    }
  } catch (e) {
    outcome = 'threw: ' + (e && e.message);
  }
  return { outcome, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
};

const mutate = (s) => {
  const ops = [
    () => s.slice(0, Math.floor(rand() * s.length)),                       // truncate
    () => s.replace(/\*/g, () => (rand() < 0.1 ? '' : '*')),               // drop element separators
    () => s.replace(/~/g, () => (rand() < 0.2 ? '' : '~')),                // drop segment terminators
    () => s.replace(/[0-9.]+/g, () => pick(['NaN', '-1', '1e309', '', '9'.repeat(400), '0x10'])),
    () => s + pick(['CLP*', 'SVC', 'CAS*PR', 'CLP*X*1*', '~~~~', '*'.repeat(5000)]),
    () => s.split('~').sort(() => rand() - 0.5).join('~'),                 // reorder segments
    () => s.replace(/CLP\*/g, 'CLP*' + '\u0000'.repeat(3)),
    () => s.replace(/DTM\*(\d+)\*\d+/g, 'DTM*$1*' + pick(['99999999', '2025', 'abcdefgh', ''])),
    () => s.replace(/SVC\*/g, 'SVC*' + ':'.repeat(50)),
  ];
  let out = s;
  const n = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) out = pick(ops)();
  return out;
};

const randomText = () => {
  const alphabet = 'ISACLPSVCDTMCASNM1BPRTRNREF*~:^0123456789.- \n\r\t';
  let s = ''; const len = Math.floor(rand() * 2000);
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
  return s;
};

const baseline = run(VALID);
check('a well-formed 835 parses', baseline.outcome === 'parsed');
const parsed = parse835File(VALID);
check('...and yields the claim', parsed.claims.length === 1 && parsed.claims[0].claimNumber === 'CLM-001');

const failures = [];
let slowest = 0;
const N = Number(process.env.FUZZ_N) || 10000;
for (let i = 0; i < N; i++) {
  const input = i % 4 === 0 ? randomText() : mutate(VALID);
  const r = run(input);
  slowest = Math.max(slowest, r.ms);
  if (r.outcome.startsWith('threw') || r.outcome === 'bad-validate-shape' || r.ms > 250) {
    failures.push({ i, outcome: r.outcome, ms: r.ms.toFixed(1), sample: JSON.stringify(input.slice(0, 160)) });
  }
}
check(`${N} fuzzed inputs: none throws out of validate/parse`, failures.filter((f) => f.outcome.startsWith('threw')).length === 0);
check(`${N} fuzzed inputs: none takes over 250 ms (slowest ${slowest.toFixed(1)} ms)`, failures.filter((f) => Number(f.ms) > 250).length === 0);

// Large but within the 10 MB upload cap: linear, not quadratic.
const big = VALID.replace('SE*16', 'CLP*CLM-002*1*1*1*0*12*X~'.repeat(60000) + 'SE*16');
const bigRun = run(big);
check(`a ~${(big.length / 1e6).toFixed(1)} MB file is handled in under 5 s (${bigRun.ms.toFixed(0)} ms)`,
  !bigRun.outcome.startsWith('threw') && bigRun.ms < 5000);

// Non-string input (e.g. a missing upload buffer) is rejected, not a crash.
for (const bad of [undefined, null, 42, {}, '']) {
  check(`validate rejects ${JSON.stringify(bad)} without throwing`, (() => {
    try { const v = validate835File(bad); return v && v.valid === false; } catch { return false; }
  })());
}

let failed = 0;
for (const [n, c] of results) { out(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
if (failures.length) {
  out('\nFirst failures:');
  failures.slice(0, 8).forEach((f) => out(' ', JSON.stringify(f)));
}
out(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
