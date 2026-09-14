#!/usr/bin/env node
/**
 * Records one Wave 1 video, or all of them.
 *
 *   NODE_PATH=$(npm root -g) node docs/demo/video-harness/record.js v03
 *   NODE_PATH=$(npm root -g) node docs/demo/video-harness/record.js all
 *
 * The frontend must be serving on DEMO_BASE_URL (default http://localhost:3000):
 *   cd frontend && HOST=localhost PORT=3000 BROWSER=none npm start
 */

const fs = require('fs');
const path = require('path');
const { record } = require('./harness');

const SCRIPT_DIR = path.join(__dirname, 'scripts');

/**
 * Training scripts sit at the top level; marketing cuts live in scripts/marketing.
 * Paths stay relative to SCRIPT_DIR so a name match can still work on the
 * basename alone.
 */
function available() {
  const walk = (dir, prefix = '') => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const rel = path.join(prefix, entry.name);
      if (entry.isDirectory()) return walk(path.join(dir, entry.name), rel);
      return entry.name.endsWith('.js') ? [rel] : [];
    });
  return walk(SCRIPT_DIR).sort();
}

async function main() {
  const arg = (process.argv[2] || 'all').toLowerCase();
  const files = available();
  const specOf = (f) => require(path.join(SCRIPT_DIR, f));
  const isMarketing = (f) => Boolean(specOf(f).marketing);
  const wave = arg.match(/^wave(\d+)$/);
  // "all" stays the training library, so an existing full-library run does not
  // silently start re-cutting marketing assets too.
  const targets = arg === 'all'
    ? files.filter((f) => !isMarketing(f))
    : arg === 'marketing'
      ? files.filter(isMarketing)
      : wave
        ? files.filter((f) => !isMarketing(f) && String(specOf(f).wave || 1) === wave[1])
        : files.filter((f) => path.basename(f).toLowerCase().includes(arg));

  if (!targets.length) {
    console.error(`No script matches "${arg}". Available:\n  ${files.join('\n  ')}`);
    process.exit(1);
  }

  console.log(`Recording ${targets.length} video(s)…`);
  const failures = [];
  for (const file of targets) {
    const spec = require(path.join(SCRIPT_DIR, file));
    process.stdout.write(`\n▶ ${spec.id} ${spec.title}\n`);
    try {
      await record(spec);
    } catch (err) {
      failures.push({ id: spec.id, err });
      console.error(`  ✗ ${spec.id} failed: ${String(err.message).split('\n')[0]}`);
    }
  }

  if (failures.length) {
    console.error(`\n${failures.length} of ${targets.length} failed.`);
    process.exit(1);
  }
  console.log('\nAll recordings complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
